import { NextResponse, type NextRequest } from "next/server";

import { requireRole } from "@/features/auth/server/session";
import { consumeOAuthState } from "@/features/mercadolibre/account/server/oauth-state";
import { connectAccount } from "@/features/mercadolibre/account/server/connect";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Vuelta desde Mercado Libre.
 *
 * El redirect siempre es a una ruta fija nuestra: nunca a algo que venga en la
 * URL. Un `returnTo` controlable por quien arma el enlace convertiría este
 * endpoint en un redirect abierto con nuestro dominio.
 */
export async function GET(request: NextRequest) {
  const destination = new URL("/mercadolibre/configuracion", baseUrl(request));
  const params = request.nextUrl.searchParams;

  try {
    const user = await requireRole("admin");

    // El usuario canceló la autorización en la pantalla de Mercado Libre.
    const oauthError = params.get("error");
    if (oauthError) {
      logger.info("El administrador canceló la autorización", { error: oauthError });
      destination.searchParams.set("error", "cancelado");
      return NextResponse.redirect(destination);
    }

    const code = params.get("code");
    const state = params.get("state");

    if (!code || !state) {
      destination.searchParams.set("error", "respuesta_incompleta");
      return NextResponse.redirect(destination);
    }

    const stored = await consumeOAuthState(state);
    if (!stored) {
      logger.warn("Estado de OAuth inválido o vencido");
      destination.searchParams.set("error", "estado_invalido");
      return NextResponse.redirect(destination);
    }

    const result = await connectAccount({
      code,
      codeVerifier: stored.codeVerifier,
      userId: user.id,
    });

    destination.searchParams.set("conectado", result.reconnected ? "reconectada" : "1");
    return NextResponse.redirect(destination);
  } catch (error) {
    logger.error("Falló la conexión con Mercado Libre", {
      reason: error instanceof Error ? error.message : String(error),
    });
    destination.searchParams.set("error", "conexion");
    return NextResponse.redirect(destination);
  }
}

function baseUrl(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
}
