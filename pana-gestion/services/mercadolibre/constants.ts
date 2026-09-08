/**
 * Constantes de la API de Mercado Libre.
 *
 * Todo lo que depende de su documentación vive acá, en un solo archivo, para
 * que confirmarlo o corregirlo sea abrir uno y no doce. Los tests usan estas
 * mismas constantes: cambiar un valor acá mantiene las pruebas alineadas.
 *
 * Estado de verificación (septiembre 2026), contra la documentación oficial:
 *   ✔ api_version=4 para preguntas
 *   ✔ 2000 caracteres como máximo de una respuesta
 *   ✔ los siete estados de pregunta
 *   ✔ access token de 6 horas y refresh token que se rota en cada uso
 *   ✔ el refresh token solo se emite con el scope offline_access
 *   ✔ /missed_feeds?app_id= para las notificaciones perdidas
 *   ✔ el formato del payload de una notificación
 *   ? PKCE: ver ML_PKCE_ENABLED más abajo
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

/** Versión de la API de preguntas. Sin esto, la respuesta viene con la forma vieja. */
export const ML_QUESTIONS_API_VERSION = "4";

/** Largo máximo de una respuesta, tanto para preguntar como para responder. */
export const ML_ANSWER_MAX_LENGTH = 2000;

/**
 * Estados que devuelve Mercado Libre para una pregunta.
 *
 * Si algún día aparece uno nuevo, se guarda igual en `ml_status` y se trata
 * como pendiente: es preferible que alguien mire una pregunta de más a que una
 * quede invisible.
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

/**
 * PKCE en el flujo de autorización.
 *
 * Es el único dato que no se pudo confirmar: en el panel de aplicaciones hay
 * un interruptor para exigir PKCE, así que mandar `code_challenge` cuando la
 * aplicación NO lo tiene activado podría hacer fallar el canje del código.
 *
 * Por eso es configurable en vez de estar fijo. Queda activado por defecto,
 * que es lo seguro: sin PKCE, un código de autorización interceptado alcanza
 * para obtener el token. Si al conectar la cuenta el canje falla con
 * `invalid_grant`, se prueba poniendo ML_PKCE_ENABLED=0 y se activa el
 * interruptor en el panel de Mercado Libre.
 */
export function isPkceEnabled(): boolean {
  return process.env.ML_PKCE_ENABLED !== "0";
}

/**
 * Mercado Libre reintenta una notificación hasta ocho veces a lo largo de una
 * hora; después la da por perdida y solo queda en /missed_feeds. Por eso el
 * endpoint responde 200 siempre que la notificación sea legítima, incluso si
 * el procesamiento posterior falla: el reintento nuestro es mejor que el suyo,
 * porque nosotros sabemos qué salió mal.
 */
export const ML_NOTIFICATION_MAX_DELIVERY_ATTEMPTS = 8;

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
