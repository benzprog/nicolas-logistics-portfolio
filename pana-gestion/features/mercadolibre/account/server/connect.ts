import "server-only";

import { after } from "next/server";

import { exchangeCodeForTokens } from "@/services/mercadolibre/oauth";
import { fetchCurrentUser } from "@/services/mercadolibre/api";
import {
  oauthConfig,
  storeTokens,
  tokenProviderFor,
} from "@/features/mercadolibre/account/server/token-manager";
import { syncUnansweredQuestions } from "@/features/mercadolibre/questions/server/sync-question";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { audit } from "@/lib/audit";
import { now } from "@/lib/time";
import type { Json } from "@/types/database.types";

/**
 * Conecta la cuenta de Mercado Libre.
 *
 * Reconectar una cuenta ya conocida no crea nada nuevo: actualiza los tokens y
 * vuelve a marcarla como conectada. Es exactamente lo que hay que hacer cuando
 * un refresh token se venció.
 */
export async function connectAccount(params: {
  code: string;
  /** Ausente cuando la aplicación no usa PKCE (ver isPkceEnabled). */
  codeVerifier?: string;
  userId: string;
}): Promise<{ accountId: string; nickname: string; reconnected: boolean }> {
  const config = oauthConfig();

  const tokens = await exchangeCodeForTokens(config, {
    code: params.code,
    codeVerifier: params.codeVerifier,
  });

  const supabase = createSupabaseServiceClient();
  const nowIso = now().toISOString();

  // La integración es única por proveedor: si ya existía, se reusa.
  const { data: integration, error: integrationError } = await supabase
    .from("integrations")
    .upsert(
      {
        provider: "mercadolibre",
        status: "connected",
        connected_by: params.userId,
        connected_at: nowIso,
        disconnected_at: null,
        last_error: null,
      },
      { onConflict: "provider" },
    )
    .select("id")
    .single();

  if (integrationError) throw new AppError("database", { message: integrationError.message });

  // Los datos de la cuenta se piden con el token recién obtenido.
  const mlUser = await fetchCurrentUser({ getAccessToken: async () => tokens.access_token });

  const { data: existing } = await supabase
    .from("mercadolibre_accounts")
    .select("id")
    .eq("ml_user_id", mlUser.id)
    .maybeSingle();

  const { data: account, error: accountError } = await supabase
    .from("mercadolibre_accounts")
    .upsert(
      {
        ...(existing ? { id: existing.id } : {}),
        integration_id: integration.id,
        ml_user_id: mlUser.id,
        nickname: mlUser.nickname,
        site_id: mlUser.site_id ?? config.siteId,
        email: mlUser.email ?? null,
        permalink: mlUser.permalink ?? null,
        raw: mlUser as unknown as Json,
      },
      { onConflict: "ml_user_id" },
    )
    .select("id")
    .single();

  if (accountError) throw new AppError("database", { message: accountError.message });

  await storeTokens(account.id, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresInSeconds: tokens.expires_in,
    scope: tokens.scope,
  });

  await audit({
    action: existing ? "ml.account.reconnected" : "ml.account.connected",
    actorUserId: params.userId,
    entityType: "mercadolibre_account",
    entityId: account.id,
    metadata: { mlUserId: mlUser.id, nickname: mlUser.nickname },
  });

  // La primera importación puede tardar: no tiene por qué hacer esperar al
  // administrador mirando el navegador.
  after(async () => {
    try {
      const { imported } = await syncUnansweredQuestions(tokenProviderFor(account.id), {
        accountId: account.id,
        sellerId: mlUser.id,
      });
      await supabase
        .from("integrations")
        .update({ last_sync_at: now().toISOString() })
        .eq("id", integration.id);
      logger.info("Importación inicial terminada", { imported });
    } catch (error) {
      logger.error("Falló la importación inicial", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return { accountId: account.id, nickname: mlUser.nickname, reconnected: Boolean(existing) };
}

/**
 * Desconecta la cuenta.
 *
 * Los tokens se borran; las preguntas y el historial quedan. Desconectar no
 * puede ser una forma de perder el registro de lo que se respondió.
 */
export async function disconnectAccount(params: { userId: string }): Promise<void> {
  const supabase = createSupabaseServiceClient();

  const { data: integration } = await supabase
    .from("integrations")
    .select("id, mercadolibre_accounts(id)")
    .eq("provider", "mercadolibre")
    .maybeSingle();

  if (!integration) return;

  const accounts = (integration as { mercadolibre_accounts: { id: string }[] | null })
    .mercadolibre_accounts;

  for (const account of accounts ?? []) {
    await supabase.from("mercadolibre_tokens").delete().eq("account_id", account.id);
  }

  await supabase
    .from("integrations")
    .update({
      status: "disconnected",
      disconnected_at: now().toISOString(),
      last_error: null,
    })
    .eq("id", integration.id);

  await audit({
    action: "ml.account.disconnected",
    actorUserId: params.userId,
    entityType: "integration",
    entityId: integration.id,
  });
}
