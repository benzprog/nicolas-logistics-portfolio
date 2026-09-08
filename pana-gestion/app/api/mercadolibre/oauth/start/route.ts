import { NextResponse } from "next/server";

import { requireRole } from "@/features/auth/server/session";
import { oauthConfig } from "@/features/mercadolibre/account/server/token-manager";
import {
  codeChallengeFor,
  generateOAuthState,
  storeOAuthState,
} from "@/features/mercadolibre/account/server/oauth-state";
import { buildAuthorizationUrl } from "@/services/mercadolibre/oauth";
import { isPkceEnabled } from "@/services/mercadolibre/constants";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Arranca la conexión con Mercado Libre.
 *
 * Solo un administrador puede: conectar la cuenta define qué preguntas ve todo
 * el equipo y con qué permisos actúa el sistema.
 */
export async function GET() {
  try {
    await requireRole("admin");

    const state = generateOAuthState();
    await storeOAuthState(state);

    const url = buildAuthorizationUrl(oauthConfig(), {
      state: state.state,
      // El desafío solo viaja si la aplicación tiene PKCE activado; mandarlo
      // cuando no corresponde puede hacer fallar el canje del código.
      codeChallenge: isPkceEnabled() ? codeChallengeFor(state.codeVerifier) : undefined,
    });

    return NextResponse.redirect(url);
  } catch (error) {
    if (
      error instanceof AppError &&
      (error.code === "unauthorized" || error.code === "forbidden")
    ) {
      return NextResponse.redirect(
        new URL("/mercadolibre/configuracion?error=permisos", baseUrl()),
      );
    }

    logger.error("No se pudo iniciar la conexión con Mercado Libre", {
      reason: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.redirect(
      new URL("/mercadolibre/configuracion?error=configuracion", baseUrl()),
    );
  }
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
