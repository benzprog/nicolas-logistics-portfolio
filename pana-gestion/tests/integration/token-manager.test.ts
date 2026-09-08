import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";

import { createFakeSupabase, argsOf, type FakeSupabase } from "@/tests/mocks/supabase";
import { resetServerEnvCache } from "@/lib/env";
import { encryptSecret } from "@/lib/crypto";
import { MlAuthError } from "@/services/mercadolibre/errors";

/**
 * La renovación de tokens es donde más fácil se rompe la integración.
 *
 * Mercado Libre invalida el refresh token cada vez que se usa. Si dos procesos
 * renuevan a la vez, uno se queda con un token muerto y la cuenta hay que
 * reconectarla a mano. Por eso hay un candado en la base, y por eso se prueba.
 */

let supabase: FakeSupabase;
const refreshMock = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: () => supabase.client,
}));

vi.mock("@/services/mercadolibre/oauth", () => ({
  refreshTokens: (...args: unknown[]) => refreshMock(...args),
}));

vi.mock("@/lib/audit", () => ({ audit: async () => {} }));

const { getValidAccessToken } =
  await import("@/features/mercadolibre/account/server/token-manager");

const CUENTA = "cuenta-1";

beforeEach(() => {
  resetServerEnvCache();
  refreshMock.mockReset();
  Object.assign(process.env, {
    NODE_ENV: "test",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    ML_APP_ID: "1234567890",
    ML_CLIENT_SECRET: "secreto",
    ML_REDIRECT_URI: "https://pana.test/api/mercadolibre/oauth/callback",
    ML_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    ML_WEBHOOK_TOKEN: "webhook-token-largo-de-sobra",
    OAUTH_STATE_SECRET: "un-secreto-de-al-menos-32-caracteres-largo",
    CRON_SECRET: "cron-secret-suficientemente-largo",
  });
});

function tokenRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    account_id: CUENTA,
    access_token_enc: encryptSecret("access-vigente"),
    refresh_token_enc: encryptSecret("refresh-guardado"),
    access_token_expires_at: new Date(Date.now() + 6 * 3_600_000).toISOString(),
    refresh_failures: 0,
    refresh_lock_until: null,
    ...overrides,
  };
}

describe("obtención del token", () => {
  it("usa el token guardado si todavía es válido", async () => {
    supabase = createFakeSupabase({
      "mercadolibre_tokens.select": { data: tokenRow(), error: null },
    });

    expect(await getValidAccessToken(CUENTA)).toBe("access-vigente");
    // Sin llamada a Mercado Libre: renovar de más gasta el refresh token.
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("renueva cuando está por vencer", async () => {
    // Dentro del margen de 5 minutos: se renueva antes de que falle.
    supabase = createFakeSupabase({
      "mercadolibre_tokens.select": {
        data: tokenRow({ access_token_expires_at: new Date(Date.now() + 60_000).toISOString() }),
        error: null,
      },
      "mercadolibre_tokens.update": {
        data: { refresh_token_enc: encryptSecret("refresh-guardado") },
        error: null,
      },
      "mercadolibre_tokens.upsert": { data: null, error: null },
    });

    refreshMock.mockResolvedValue({
      access_token: "access-nuevo",
      refresh_token: "refresh-rotado",
      expires_in: 21600,
      user_id: 1,
    });

    expect(await getValidAccessToken(CUENTA)).toBe("access-nuevo");
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("guarda cifrados los DOS tokens al renovar", async () => {
    supabase = createFakeSupabase({
      "mercadolibre_tokens.select": {
        data: tokenRow({ access_token_expires_at: new Date(Date.now() - 1000).toISOString() }),
        error: null,
      },
      "mercadolibre_tokens.update": {
        data: { refresh_token_enc: encryptSecret("refresh-guardado") },
        error: null,
      },
      "mercadolibre_tokens.upsert": { data: null, error: null },
    });

    refreshMock.mockResolvedValue({
      access_token: "access-nuevo",
      refresh_token: "refresh-rotado",
      expires_in: 21600,
      user_id: 1,
    });

    await getValidAccessToken(CUENTA);

    const guardado = argsOf(
      supabase.on("mercadolibre_tokens").find((call) => call.ops[0]?.name === "upsert"),
      "upsert",
    ) as Record<string, string>;

    // Guardar solo el access token dejaría un refresh muerto en la base, y la
    // próxima renovación fallaría sin manera de recuperarse sola.
    expect(guardado.refresh_token_enc).toBeTruthy();
    expect(guardado.access_token_enc).toBeTruthy();
    // Cifrados, no en claro.
    expect(guardado.access_token_enc).not.toContain("access-nuevo");
    expect(guardado.refresh_token_enc).not.toContain("refresh-rotado");
    expect(guardado.refresh_failures).toBe(0);
  });

  it("toma el candado con la condición dentro del UPDATE", async () => {
    supabase = createFakeSupabase({
      "mercadolibre_tokens.select": {
        data: tokenRow({ access_token_expires_at: new Date(Date.now() - 1000).toISOString() }),
        error: null,
      },
      "mercadolibre_tokens.update": {
        data: { refresh_token_enc: encryptSecret("r") },
        error: null,
      },
      "mercadolibre_tokens.upsert": { data: null, error: null },
    });

    refreshMock.mockResolvedValue({
      access_token: "nuevo",
      refresh_token: "rotado",
      expires_in: 21600,
      user_id: 1,
    });

    await getValidAccessToken(CUENTA);

    const update = supabase
      .on("mercadolibre_tokens")
      .find((call) => call.ops[0]?.name === "update");
    // La condición va en el WHERE: entre leer y escribir no hay ventana para
    // que dos procesos crean que ambos tienen el candado.
    expect(update?.ops.some((op) => op.name === "or")).toBe(true);
    expect(argsOf(update, "update")).toHaveProperty("refresh_lock_until");
  });

  it("espera si otro proceso ya está renovando", async () => {
    let lectura = 0;

    supabase = createFakeSupabase({
      "mercadolibre_tokens.select": () => {
        lectura += 1;
        // Primera lectura: vencido y con candado tomado por otro.
        if (lectura === 1) {
          return {
            data: tokenRow({
              access_token_expires_at: new Date(Date.now() - 1000).toISOString(),
              refresh_lock_until: new Date(Date.now() + 20_000).toISOString(),
            }),
            error: null,
          };
        }
        // Segunda: el otro proceso ya terminó y dejó un token nuevo.
        return {
          data: tokenRow({ access_token_enc: encryptSecret("access-del-otro-proceso") }),
          error: null,
        };
      },
      // No se pudo tomar el candado.
      "mercadolibre_tokens.update": { data: null, error: null },
    });

    expect(await getValidAccessToken(CUENTA)).toBe("access-del-otro-proceso");
    // Lo importante: no renovamos en paralelo.
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("pide reconexión cuando se agotaron los intentos", async () => {
    supabase = createFakeSupabase({
      "mercadolibre_tokens.select": {
        data: tokenRow({
          access_token_expires_at: new Date(Date.now() - 1000).toISOString(),
          refresh_failures: 3,
        }),
        error: null,
      },
    });

    await expect(getValidAccessToken(CUENTA)).rejects.toMatchObject({
      code: "integration_needs_reauth",
    });
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("registra el fallo de forma atómica cuando el refresh token muere", async () => {
    supabase = createFakeSupabase({
      "mercadolibre_tokens.select": {
        data: tokenRow({ access_token_expires_at: new Date(Date.now() - 1000).toISOString() }),
        error: null,
      },
      "mercadolibre_tokens.update": {
        data: { refresh_token_enc: encryptSecret("r") },
        error: null,
      },
      "rpc.register_token_refresh_failure": { data: 3, error: null },
    });

    refreshMock.mockRejectedValue(new MlAuthError("invalid_grant"));

    await expect(getValidAccessToken(CUENTA)).rejects.toMatchObject({
      code: "integration_needs_reauth",
    });

    // Contar el fallo desde la aplicación perdería fallos simultáneos, y la
    // cuenta nunca se marcaría para reconexión.
    expect(supabase.rpcCalls[0]?.name).toBe("register_token_refresh_failure");
    expect(supabase.rpcCalls[0]?.args).toMatchObject({ p_auth_problem: true });
  });

  it("un problema de red no cuenta como fallo de autenticación", async () => {
    supabase = createFakeSupabase({
      "mercadolibre_tokens.select": {
        data: tokenRow({ access_token_expires_at: new Date(Date.now() - 1000).toISOString() }),
        error: null,
      },
      "mercadolibre_tokens.update": {
        data: { refresh_token_enc: encryptSecret("r") },
        error: null,
      },
      "rpc.register_token_refresh_failure": { data: 0, error: null },
    });

    refreshMock.mockRejectedValue(new Error("ECONNRESET"));

    await expect(getValidAccessToken(CUENTA)).rejects.toMatchObject({ code: "ml_unavailable" });
    // Si un corte de red sumara al contador, tres caídas seguidas obligarían a
    // reconectar una cuenta que en realidad está perfecta.
    expect(supabase.rpcCalls[0]?.args).toMatchObject({ p_auth_problem: false });
  });

  it("falla claro si no hay tokens guardados", async () => {
    supabase = createFakeSupabase({ "mercadolibre_tokens.select": { data: null, error: null } });
    await expect(getValidAccessToken(CUENTA)).rejects.toMatchObject({
      code: "integration_disconnected",
    });
  });
});
