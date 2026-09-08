import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { randomBytes } from "node:crypto";

import { mlServer } from "@/tests/mocks/mercadolibre/server";
import { tokenResponse } from "@/tests/mocks/mercadolibre/fixtures";
import {
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  refreshTokens,
  type OAuthConfig,
} from "@/services/mercadolibre/oauth";
import { MlAuthError } from "@/services/mercadolibre/errors";
import { resetServerEnvCache } from "@/lib/env";

beforeAll(() => mlServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mlServer.resetHandlers());
afterAll(() => mlServer.close());

const config: OAuthConfig = {
  appId: "1234567890",
  clientSecret: "secreto",
  redirectUri: "https://pana.test/api/mercadolibre/oauth/callback",
  siteId: "MLA",
};

beforeEach(() => {
  resetServerEnvCache();
  process.env.ML_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("URL de autorización", () => {
  it("apunta al dominio del país y lleva todos los parámetros", () => {
    const url = new URL(
      buildAuthorizationUrl(config, { state: "estado-al-azar", codeChallenge: "desafio" }),
    );

    expect(url.origin).toBe("https://auth.mercadolibre.com.ar");
    expect(url.pathname).toBe("/authorization");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("1234567890");
    expect(url.searchParams.get("state")).toBe("estado-al-azar");
    expect(url.searchParams.get("code_challenge")).toBe("desafio");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("usa el dominio de cada país", () => {
    expect(buildAuthorizationUrl({ ...config, siteId: "MLB" }, { state: "x" })).toContain(
      "auth.mercadolivre.com.br",
    );
    // Un país que no conocemos cae en Argentina, que es donde opera PANA.
    expect(buildAuthorizationUrl({ ...config, siteId: "XXX" }, { state: "x" })).toContain(
      "auth.mercadolibre.com.ar",
    );
  });

  it("omite PKCE si no se pasa el desafío", () => {
    const url = new URL(buildAuthorizationUrl(config, { state: "x" }));
    expect(url.searchParams.has("code_challenge")).toBe(false);
  });
});

describe("canje del código", () => {
  it("manda lo que corresponde y devuelve los tokens", async () => {
    let body: Record<string, unknown> = {};

    mlServer.use(
      http.post("https://api.mercadolibre.com/oauth/token", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(tokenResponse);
      }),
    );

    const tokens = await exchangeCodeForTokens(config, {
      code: "TG-codigo",
      codeVerifier: "verificador",
    });

    expect(body.grant_type).toBe("authorization_code");
    expect(body.code).toBe("TG-codigo");
    expect(body.code_verifier).toBe("verificador");
    expect(body.redirect_uri).toBe(config.redirectUri);
    expect(tokens.access_token).toBe(tokenResponse.access_token);
    expect(tokens.user_id).toBe(987654321);
  });

  it("un código vencido pide reconectar, no reintentar", async () => {
    mlServer.use(
      http.post("https://api.mercadolibre.com/oauth/token", () =>
        HttpResponse.json({ error: "invalid_grant", message: "Code has expired" }, { status: 400 }),
      ),
    );

    await expect(exchangeCodeForTokens(config, { code: "viejo" })).rejects.toBeInstanceOf(
      MlAuthError,
    );
  });

  it("rechaza una respuesta con forma inesperada", async () => {
    mlServer.use(
      http.post("https://api.mercadolibre.com/oauth/token", () =>
        HttpResponse.json({ access_token: "solo-esto" }),
      ),
    );

    await expect(exchangeCodeForTokens(config, { code: "x" })).rejects.toBeInstanceOf(MlAuthError);
  });
});

describe("renovación", () => {
  it("devuelve también un refresh token nuevo", async () => {
    // Mercado Libre rota el refresh token en cada uso. Si el código no guardara
    // el nuevo, la siguiente renovación fallaría y habría que reconectar a mano.
    let body: Record<string, unknown> = {};

    mlServer.use(
      http.post("https://api.mercadolibre.com/oauth/token", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...tokenResponse, refresh_token: "TG-refresh-rotado" });
      }),
    );

    const tokens = await refreshTokens(config, "TG-refresh-viejo");

    expect(body.grant_type).toBe("refresh_token");
    expect(body.refresh_token).toBe("TG-refresh-viejo");
    expect(tokens.refresh_token).toBe("TG-refresh-rotado");
  });

  it("un refresh token muerto pide reconexión", async () => {
    mlServer.use(
      http.post("https://api.mercadolibre.com/oauth/token", () =>
        HttpResponse.json({ error: "invalid_grant" }, { status: 400 }),
      ),
    );

    await expect(refreshTokens(config, "TG-muerto")).rejects.toBeInstanceOf(MlAuthError);
  });
});
