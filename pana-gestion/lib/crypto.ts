import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual, createHmac } from "node:crypto";

import { getServerEnv } from "@/lib/env";

/**
 * Cifrado de los tokens de Mercado Libre.
 *
 * AES-256-GCM: además de cifrar, autentica. Si alguien toca un byte de la fila
 * en la base, el descifrado falla en vez de devolver basura.
 *
 * Formato guardado: `v1:<iv base64>:<tag base64>:<ciphertext base64>`.
 * El prefijo de versión está para poder rotar el algoritmo sin adivinar.
 */

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits, el tamaño recomendado para GCM

function key(): Buffer {
  return Buffer.from(getServerEnv().ML_TOKEN_ENCRYPTION_KEY, "base64");
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(
    ":",
  );
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Formato de secreto cifrado desconocido");
  }

  const [, ivB64, tagB64, dataB64] = parts as [string, string, string, string];
  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Compara dos secretos sin filtrar información por el tiempo de respuesta. */
export function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/** Firma un valor para poder confiar en él cuando vuelve del navegador. */
export function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function verifySignature(value: string, signature: string, secret: string): boolean {
  return safeCompare(sign(value, secret), signature);
}
