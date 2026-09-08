import { beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

import { getServerEnv, resetServerEnvCache } from "@/lib/env";

/**
 * Que falte una variable tiene que fallar temprano y con un mensaje que diga
 * cuál. El modo silencioso es el que termina en "andaba en local".
 */
describe("variables de entorno del servidor", () => {
  const original = { ...process.env };

  beforeEach(() => {
    resetServerEnvCache();
    process.env = { ...original };
  });

  it("acepta una configuración completa", () => {
    Object.assign(process.env, validEnv());
    const env = getServerEnv();
    expect(env.ML_APP_ID).toBe("1234567890");
    expect(env.ML_SITE_ID).toBe("MLA");
    expect(env.ML_MOCK).toBe(false);
  });

  it("dice cuál falta", () => {
    Object.assign(process.env, validEnv());
    delete process.env.ML_CLIENT_SECRET;
    expect(() => getServerEnv()).toThrow(/ML_CLIENT_SECRET/);
  });

  it("rechaza una clave de cifrado que no sea de 32 bytes", () => {
    Object.assign(process.env, validEnv());
    process.env.ML_TOKEN_ENCRYPTION_KEY = Buffer.from("corta").toString("base64");
    expect(() => getServerEnv()).toThrow(/32 bytes/);
  });

  it("rechaza secretos demasiado cortos", () => {
    Object.assign(process.env, validEnv());
    process.env.CRON_SECRET = "corto";
    expect(() => getServerEnv()).toThrow(/CRON_SECRET/);
  });

  it("rechaza un redirect que no sea URL absoluta", () => {
    Object.assign(process.env, validEnv());
    process.env.ML_REDIRECT_URI = "/callback";
    expect(() => getServerEnv()).toThrow(/ML_REDIRECT_URI/);
  });

  it("interpreta ML_MOCK", () => {
    Object.assign(process.env, validEnv(), { ML_MOCK: "1" });
    expect(getServerEnv().ML_MOCK).toBe(true);
  });
});

function validEnv() {
  return {
    NODE_ENV: "test",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    ML_APP_ID: "1234567890",
    ML_CLIENT_SECRET: "secreto",
    ML_REDIRECT_URI: "https://pana.test/api/mercadolibre/oauth/callback",
    ML_SITE_ID: "MLA",
    ML_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    ML_WEBHOOK_TOKEN: "webhook-token-largo-de-sobra",
    OAUTH_STATE_SECRET: "un-secreto-de-al-menos-32-caracteres-largo",
    CRON_SECRET: "cron-secret-suficientemente-largo",
    ML_MOCK: "0",
  };
}
