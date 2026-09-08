/**
 * Constantes de la API de Mercado Libre.
 *
 * Todo lo que depende de su documentación vive acá, en un solo archivo, para
 * que confirmarlo o corregirlo sea abrir uno y no doce.
 *
 * ⚠ Los valores marcados con VERIFICAR se tomaron de la documentación pública
 * conocida, pero no se pudieron confirmar contra developers.mercadolibre.com.ar
 * en el entorno donde se escribió este código. Hay que revisarlos antes de
 * conectar la cuenta real. Los tests usan estos mismos valores, así que si
 * alguno cambia, se cambia acá y las pruebas siguen sirviendo.
 */

export const ML_API_BASE = "https://api.mercadolibre.com";

/** El dominio de autorización cambia por país. MLA es Argentina. */
export const ML_AUTH_BASE_BY_SITE: Record<string, string> = {
  MLA: "https://auth.mercadolibre.com.ar",
  MLM: "https://auth.mercadolibre.com.mx",
  MLB: "https://auth.mercadolivre.com.br",
  MLU: "https://auth.mercadolibre.com.uy",
  MLC: "https://auth.mercadolibre.cl",
};

export const ML_TOKEN_ENDPOINT = "/oauth/token";
export const ML_AUTHORIZATION_PATH = "/authorization";

/** VERIFICAR: versión de la API de preguntas. */
export const ML_QUESTIONS_API_VERSION = "4";

/** VERIFICAR: largo máximo de una respuesta. */
export const ML_ANSWER_MAX_LENGTH = 2000;

/**
 * VERIFICAR: estados que devuelve Mercado Libre para una pregunta.
 * Si aparece uno nuevo, se guarda igual en `ml_status` y se trata como
 * pendiente hasta que alguien decida a qué estado interno corresponde.
 */
export const ML_QUESTION_STATUSES = [
  "UNANSWERED",
  "ANSWERED",
  "CLOSED_UNANSWERED",
  "UNDER_REVIEW",
  "BANNED",
  "DELETED",
  "DISABLED",
] as const;

export type MlQuestionStatus = (typeof ML_QUESTION_STATUSES)[number];

/** Topics de notificaciones a los que se suscribe la aplicación. */
export const ML_SUBSCRIBED_TOPICS = ["questions"] as const;

/** Cuánto antes del vencimiento se renueva el token, para no llegar justo. */
export const TOKEN_REFRESH_MARGIN_SECONDS = 300;

/** Cuánto dura el lease que evita dos renovaciones simultáneas. */
export const TOKEN_REFRESH_LOCK_SECONDS = 30;

/** Fallos de renovación seguidos antes de pedir reconexión manual. */
export const TOKEN_REFRESH_MAX_FAILURES = 3;

/** Una publicación se vuelve a pedir si la copia local tiene más de esto. */
export const ITEM_CACHE_HOURS = 24;

/** Reintentos del procesamiento de un webhook antes de darlo por perdido. */
export const WEBHOOK_MAX_ATTEMPTS = 5;

/** Espera entre reintentos de un webhook, en minutos. */
export const WEBHOOK_RETRY_BACKOFF_MINUTES = [1, 5, 15, 60, 180];

export function authBaseForSite(siteId: string): string {
  return ML_AUTH_BASE_BY_SITE[siteId] ?? ML_AUTH_BASE_BY_SITE.MLA!;
}
