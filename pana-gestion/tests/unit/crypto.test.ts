import { beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

import { encryptSecret, decryptSecret, safeCompare, sign, verifySignature } from "@/lib/crypto";
import { resetServerEnvCache } from "@/lib/env";

/**
 * El cifrado de los tokens es lo que hace que una filtración de la base no sea
 * una filtración de la cuenta de Mercado Libre.
 */
describe("cifrado de secretos", () => {
  beforeEach(() => {
    resetServerEnvCache();
    Object.assign(process.env, baseEnv());
  });

  it("recupera el texto original", () => {
    const token = "APP_USR-1234567890-abcdefghijklmnop";
    expect(decryptSecret(encryptSecret(token))).toBe(token);
  });

  it("cifra distinto el mismo texto dos veces", () => {
    // Cada cifrado usa su propio IV: si dieran igual, alguien mirando la base
    // sabría que dos cuentas comparten token.
    const a = encryptSecret("mismo-token");
    const b = encryptSecret("mismo-token");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(decryptSecret(b));
  });

  it("rechaza un texto cifrado alterado", () => {
    const payload = encryptSecret("token-original");
    const parts = payload.split(":");
    const corrupted = Buffer.from(parts[3]!, "base64");
    corrupted[0] = corrupted[0]! ^ 0xff;
    parts[3] = corrupted.toString("base64");

    // GCM autentica además de cifrar: un byte cambiado se detecta.
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });

  it("rechaza un formato desconocido", () => {
    expect(() => decryptSecret("v2:a:b:c")).toThrow(/formato/i);
    expect(() => decryptSecret("no-es-un-secreto")).toThrow();
  });

  it("no descifra con otra clave", () => {
    const payload = encryptSecret("token");
    resetServerEnvCache();
    process.env.ML_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    expect(() => decryptSecret(payload)).toThrow();
  });
});

describe("comparación de secretos", () => {
  it("compara correctamente", () => {
    expect(safeCompare("abc123", "abc123")).toBe(true);
    expect(safeCompare("abc123", "abc124")).toBe(false);
  });

  it("no falla con longitudes distintas", () => {
    expect(safeCompare("corto", "muchísimo más largo")).toBe(false);
  });
});

describe("firmas", () => {
  beforeEach(() => {
    resetServerEnvCache();
    Object.assign(process.env, baseEnv());
  });

  it("verifica lo que firmó", () => {
    const secreto = "un-secreto-de-al-menos-32-caracteres-largo";
    const firma = sign("estado-oauth", secreto);
    expect(verifySignature("estado-oauth", firma, secreto)).toBe(true);
  });

  it("rechaza un valor cambiado o una firma de otro secreto", () => {
    const secreto = "un-secreto-de-al-menos-32-caracteres-largo";
    const firma = sign("estado-oauth", secreto);
    expect(verifySignature("otro-estado", firma, secreto)).toBe(false);
    expect(verifySignature("estado-oauth", firma, "otro-secreto-distinto-igual-de-largo")).toBe(
      false,
    );
  });
});

function baseEnv() {
  return {
    NODE_ENV: "test",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    ML_APP_ID: "1234567890",
    ML_CLIENT_SECRET: "secreto",
    ML_REDIRECT_URI: "https://pana.test/api/mercadolibre/oauth/callback",
    ML_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    ML_WEBHOOK_TOKEN: "webhook-token-largo-de-sobra",
    OAUTH_STATE_SECRET: "un-secreto-de-al-menos-32-caracteres-largo",
    CRON_SECRET: "cron-secret-suficientemente-largo",
  };
}
