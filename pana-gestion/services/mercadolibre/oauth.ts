import {
  ML_AUTHORIZATION_PATH,
  ML_TOKEN_ENDPOINT,
  authBaseForSite,
} from "@/services/mercadolibre/constants";
import { mlRequest } from "@/services/mercadolibre/client";
import { mlTokenResponseSchema, type MlTokenResponse } from "@/services/mercadolibre/types";
import { MlAuthError, MlValidationError } from "@/services/mercadolibre/errors";

/**
 * OAuth de Mercado Libre.
 *
 * Este módulo no toca la base: arma URLs y canjea códigos. Guardar y renovar
 * es responsabilidad de features/mercadolibre/account.
 */

export type OAuthConfig = {
  appId: string;
  clientSecret: string;
  redirectUri: string;
  siteId: string;
};

/** URL a la que se manda al administrador para que autorice la aplicación. */
export function buildAuthorizationUrl(
  config: OAuthConfig,
  params: { state: string; codeChallenge?: string },
): string {
  const url = new URL(ML_AUTHORIZATION_PATH, authBaseForSite(config.siteId));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", params.state);

  // PKCE: sin esto, un código interceptado alcanza para obtener el token.
  if (params.codeChallenge) {
    url.searchParams.set("code_challenge", params.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }

  return url.toString();
}

/** Canjea el código de autorización por el primer par de tokens. */
export async function exchangeCodeForTokens(
  config: OAuthConfig,
  params: { code: string; codeVerifier?: string },
): Promise<MlTokenResponse> {
  const body: Record<string, string> = {
    grant_type: "authorization_code",
    client_id: config.appId,
    client_secret: config.clientSecret,
    code: params.code,
    redirect_uri: config.redirectUri,
  };
  if (params.codeVerifier) body.code_verifier = params.codeVerifier;

  return parseTokenResponse(await postToken(body));
}

/**
 * Renueva el access token.
 *
 * Mercado Libre devuelve TAMBIÉN un refresh token nuevo e invalida el anterior.
 * Guardar los dos es obligatorio: si se guarda solo el access token, la próxima
 * renovación falla y hay que reconectar la cuenta a mano.
 */
export async function refreshTokens(
  config: OAuthConfig,
  refreshToken: string,
): Promise<MlTokenResponse> {
  return parseTokenResponse(
    await postToken({
      grant_type: "refresh_token",
      client_id: config.appId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    }),
  );
}

async function postToken(body: Record<string, string>): Promise<unknown> {
  try {
    return await mlRequest<unknown>(ML_TOKEN_ENDPOINT, {
      method: "POST",
      body,
      timeoutMs: 15_000,
    });
  } catch (error) {
    // Un `invalid_grant` acá significa que el código o el refresh token ya no
    // sirven: no es un problema de red, es reconectar la cuenta.
    if (error instanceof MlValidationError && error.mlErrorCode === "invalid_grant") {
      throw new MlAuthError("El código o el refresh token ya no son válidos", {
        status: error.status,
        body: error.body,
        cause: error,
      });
    }
    throw error;
  }
}

function parseTokenResponse(raw: unknown): MlTokenResponse {
  const parsed = mlTokenResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new MlAuthError("Mercado Libre devolvió una respuesta de token inesperada", {
      body: raw,
    });
  }
  return parsed.data;
}
