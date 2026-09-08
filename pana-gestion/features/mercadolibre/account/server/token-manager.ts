import "server-only";

import {
  TOKEN_REFRESH_LOCK_SECONDS,
  TOKEN_REFRESH_MARGIN_SECONDS,
  TOKEN_REFRESH_MAX_FAILURES,
} from "@/services/mercadolibre/constants";
import { refreshTokens, type OAuthConfig } from "@/services/mercadolibre/oauth";
import { MlAuthError } from "@/services/mercadolibre/errors";
import type { TokenProvider } from "@/services/mercadolibre/client";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { getServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { audit } from "@/lib/audit";
import { now } from "@/lib/time";

/**
 * Tokens de Mercado Libre: obtención y renovación.
 *
 * El problema que resuelve: Mercado Libre invalida el refresh token cada vez
 * que se usa. Si dos requests renuevan a la vez, una de las dos se queda con un
 * refresh token muerto y la cuenta hay que reconectarla a mano.
 *
 * En Vercel no hay memoria compartida entre invocaciones, así que el candado
 * tiene que vivir en la base: `refresh_lock_until` es un lease corto que solo
 * uno se puede llevar.
 */

export function oauthConfig(siteId = "MLA"): OAuthConfig {
  const env = getServerEnv();
  return {
    appId: env.ML_APP_ID,
    clientSecret: env.ML_CLIENT_SECRET,
    redirectUri: env.ML_REDIRECT_URI,
    siteId: env.ML_SITE_ID || siteId,
  };
}

/** Guarda el par de tokens recibido de Mercado Libre, cifrado. */
export async function storeTokens(
  accountId: string,
  tokens: { accessToken: string; refreshToken: string; expiresInSeconds: number; scope?: string },
): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const expiresAt = new Date(now().getTime() + tokens.expiresInSeconds * 1000).toISOString();

  const { error } = await supabase.from("mercadolibre_tokens").upsert(
    {
      account_id: accountId,
      access_token_enc: encryptSecret(tokens.accessToken),
      refresh_token_enc: encryptSecret(tokens.refreshToken),
      access_token_expires_at: expiresAt,
      scope: tokens.scope ?? null,
      refreshed_at: now().toISOString(),
      refresh_failures: 0,
      refresh_lock_until: null,
    },
    { onConflict: "account_id" },
  );

  if (error) throw new AppError("database", { message: error.message });
}

/**
 * Devuelve un access token vigente para la cuenta.
 *
 * Renueva si está por vencer. Si otro proceso ya está renovando, espera a que
 * termine en vez de renovar en paralelo.
 */
export async function getValidAccessToken(accountId: string): Promise<string> {
  const supabase = createSupabaseServiceClient();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data: row, error } = await supabase
      .from("mercadolibre_tokens")
      .select("*")
      .eq("account_id", accountId)
      .maybeSingle();

    if (error) throw new AppError("database", { message: error.message });
    if (!row) throw new AppError("integration_disconnected");

    const expiresAt = new Date(row.access_token_expires_at).getTime();
    const marginMs = TOKEN_REFRESH_MARGIN_SECONDS * 1000;

    if (expiresAt - marginMs > now().getTime()) {
      return decryptSecret(row.access_token_enc);
    }

    if (row.refresh_failures >= TOKEN_REFRESH_MAX_FAILURES) {
      throw new AppError("integration_needs_reauth");
    }

    // Intento de tomar el lease. La condición va en el WHERE, así que solo
    // gana quien haga el UPDATE primero: no hay ventana entre leer y escribir.
    const lockUntil = new Date(now().getTime() + TOKEN_REFRESH_LOCK_SECONDS * 1000).toISOString();
    const { data: locked, error: lockError } = await supabase
      .from("mercadolibre_tokens")
      .update({ refresh_lock_until: lockUntil })
      .eq("account_id", accountId)
      .or(`refresh_lock_until.is.null,refresh_lock_until.lt.${now().toISOString()}`)
      .select("refresh_token_enc")
      .maybeSingle();

    if (lockError) throw new AppError("database", { message: lockError.message });

    if (!locked) {
      // Otro proceso está renovando. Esperar y volver a leer.
      await sleep(400 + attempt * 200);
      continue;
    }

    return refreshAndStore(accountId, decryptSecret(locked.refresh_token_enc));
  }

  // Ocho vueltas esperando a otro proceso que nunca terminó.
  throw new AppError("ml_unavailable", {
    message: "No se pudo obtener un token: la renovación quedó trabada",
    context: { accountId },
  });
}

/** Fuerza una renovación. La usa el cliente HTTP cuando recibe un 401. */
export async function forceRefresh(accountId: string): Promise<string> {
  const supabase = createSupabaseServiceClient();
  const { data: row, error } = await supabase
    .from("mercadolibre_tokens")
    .select("refresh_token_enc")
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) throw new AppError("database", { message: error.message });
  if (!row) throw new AppError("integration_disconnected");

  return refreshAndStore(accountId, decryptSecret(row.refresh_token_enc));
}

async function refreshAndStore(accountId: string, refreshToken: string): Promise<string> {
  const supabase = createSupabaseServiceClient();

  try {
    const tokens = await refreshTokens(oauthConfig(), refreshToken);

    // Mercado Libre rota el refresh token: hay que guardar los dos.
    await storeTokens(accountId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresInSeconds: tokens.expires_in,
      scope: tokens.scope,
    });

    await audit({
      action: "ml.token.refreshed",
      actorType: "system",
      entityType: "mercadolibre_account",
      entityId: accountId,
    });

    return tokens.access_token;
  } catch (error) {
    const isAuthProblem = error instanceof MlAuthError;

    // Contar el fallo y liberar el lease en una sola operación atómica: si esto
    // se hiciera leyendo y escribiendo desde acá, dos fallos simultáneos
    // contarían como uno y la cuenta nunca se marcaría para reconexión.
    const { data: failures, error: rpcError } = await supabase.rpc(
      "register_token_refresh_failure",
      {
        p_account_id: accountId,
        p_max_failures: TOKEN_REFRESH_MAX_FAILURES,
        p_auth_problem: isAuthProblem,
      },
    );

    if (rpcError) {
      logger.error("No se pudo registrar el fallo de renovación", {
        accountId,
        error: rpcError.message,
      });
    }

    logger.error("Falló la renovación del token de Mercado Libre", {
      accountId,
      failures,
      reason: error instanceof Error ? error.message : String(error),
    });

    await audit({
      action: "ml.token.refresh_failed",
      actorType: "system",
      entityType: "mercadolibre_account",
      entityId: accountId,
      metadata: { failures, authProblem: isAuthProblem },
    });

    if (isAuthProblem && (failures ?? 0) >= TOKEN_REFRESH_MAX_FAILURES) {
      throw new AppError("integration_needs_reauth", { cause: error });
    }

    if (isAuthProblem) throw new AppError("ml_auth", { cause: error });
    throw new AppError("ml_unavailable", { cause: error });
  }
}

/** Adaptador para el cliente HTTP: sabe dar un token y renovarlo. */
export function tokenProviderFor(accountId: string): TokenProvider {
  return {
    getAccessToken: () => getValidAccessToken(accountId),
    refreshAccessToken: () => forceRefresh(accountId),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
