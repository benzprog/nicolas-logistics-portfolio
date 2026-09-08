import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { getServerEnv } from "@/lib/env";
import { sign, verifySignature } from "@/lib/crypto";

/**
 * Estado del flujo OAuth.
 *
 * Guarda dos cosas entre que mandamos al usuario a Mercado Libre y vuelve:
 *
 *  - `state`: un valor al azar que tiene que volver igual. Sin esto, cualquiera
 *    puede inducir a un administrador a conectar la cuenta de otro (CSRF).
 *  - `codeVerifier` (PKCE): el código de autorización que vuelve por la URL
 *    queda en historiales y logs de proxies. Con PKCE, tenerlo no alcanza.
 *
 * Va en una cookie httpOnly y firmada, con vida corta y de un solo uso.
 */

const COOKIE_NAME = "pana_ml_oauth";
const MAX_AGE_SECONDS = 600;

export type OAuthState = { state: string; codeVerifier: string };

export function generateOAuthState(): OAuthState {
  return {
    state: randomBytes(24).toString("base64url"),
    codeVerifier: randomBytes(48).toString("base64url"),
  };
}

/** El desafío que viaja a Mercado Libre. El verifier nunca sale de acá. */
export function codeChallengeFor(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

export async function storeOAuthState(value: OAuthState): Promise<void> {
  const payload = `${value.state}.${value.codeVerifier}`;
  const signature = sign(payload, getServerEnv().OAUTH_STATE_SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `${payload}.${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // "strict" rompería la vuelta desde Mercado Libre.
    path: "/api/mercadolibre/oauth",
    maxAge: MAX_AGE_SECONDS,
  });
}

/**
 * Lee y borra el estado. Devuelve null si no está, si fue alterado o si el
 * `state` no coincide con el que volvió de Mercado Libre.
 */
export async function consumeOAuthState(returnedState: string): Promise<OAuthState | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;

  // De un solo uso: se borra pase lo que pase.
  cookieStore.delete({ name: COOKIE_NAME, path: "/api/mercadolibre/oauth" });

  if (!raw) return null;

  const parts = raw.split(".");
  if (parts.length !== 3) return null;

  const [state, codeVerifier, signature] = parts as [string, string, string];

  if (!verifySignature(`${state}.${codeVerifier}`, signature, getServerEnv().OAUTH_STATE_SECRET)) {
    return null;
  }
  if (state !== returnedState) return null;

  return { state, codeVerifier };
}
