import "server-only";

import { mlNotificationSchema } from "@/services/mercadolibre/types";
import { ML_SUBSCRIBED_TOPICS } from "@/services/mercadolibre/constants";
import { findAccountByMlUserId } from "@/features/mercadolibre/account/server/repository";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getServerEnv } from "@/lib/env";
import { safeCompare } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { audit } from "@/lib/audit";
import { now } from "@/lib/time";
import type { Json } from "@/types/database.types";

/**
 * Ingesta de notificaciones de Mercado Libre.
 *
 * Regla de oro: guardar y responder rápido. Todo lo que tarde va después.
 * Mercado Libre corta la conexión si el endpoint no responde a tiempo, y un
 * timeout de su lado se traduce en reintentos y eventos duplicados.
 *
 * El payload NUNCA se usa para escribir datos de negocio: solo dice qué
 * recurso hay que ir a leer con nuestro propio token. Así, aunque alguien
 * lograra mandarnos una notificación falsa, lo único que consigue es que
 * releamos algo nuestro.
 */

export type IngestResult =
  | { outcome: "queued"; eventId: string }
  | { outcome: "duplicate" }
  | { outcome: "ignored"; reason: string }
  | { outcome: "rejected"; reason: string };

/** Verifica el secreto que viaja en la URL de notificaciones. */
export function isAuthorizedWebhook(token: string | null): boolean {
  if (!token) return false;
  return safeCompare(token, getServerEnv().ML_WEBHOOK_TOKEN);
}

export async function ingestNotification(rawPayload: unknown): Promise<IngestResult> {
  const parsed = mlNotificationSchema.safeParse(rawPayload);

  if (!parsed.success) {
    logger.warn("Notificación con formato inesperado", {
      issues: parsed.error.issues.map((issue) => issue.path.join(".")),
    });
    return { outcome: "rejected", reason: "formato inválido" };
  }

  const notification = parsed.data;
  const env = getServerEnv();

  // ¿Es para nuestra aplicación?
  if (
    notification.application_id !== undefined &&
    String(notification.application_id) !== env.ML_APP_ID
  ) {
    return { outcome: "ignored", reason: "otra aplicación" };
  }

  // ¿Es un topic que manejamos?
  if (!ML_SUBSCRIBED_TOPICS.includes(notification.topic as (typeof ML_SUBSCRIBED_TOPICS)[number])) {
    return { outcome: "ignored", reason: `topic sin uso: ${notification.topic}` };
  }

  // ¿Es de la cuenta conectada?
  const account = await findAccountByMlUserId(notification.user_id);
  if (!account) {
    return { outcome: "ignored", reason: "cuenta desconocida" };
  }

  const supabase = createSupabaseServiceClient();

  // La unicidad de (provider, external_id) es lo que hace idempotente esto:
  // si Mercado Libre reintenta, la segunda no inserta nada.
  const { data, error } = await supabase
    .from("webhook_events")
    .upsert(
      {
        provider: "mercadolibre",
        external_id: notification._id,
        topic: notification.topic,
        resource: notification.resource,
        ml_user_id: notification.user_id,
        application_id:
          notification.application_id === undefined ? null : Number(notification.application_id),
        ml_attempts: notification.attempts ?? null,
        sent_at: notification.sent ?? null,
        received_at: now().toISOString(),
        payload: notification as unknown as Json,
        status: "received",
        next_retry_at: now().toISOString(),
      },
      { onConflict: "provider,external_id", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();

  if (error) {
    logger.error("No se pudo guardar la notificación", { error: error.message });
    return { outcome: "rejected", reason: "error al guardar" };
  }

  // Sin fila devuelta: ya existía. Es un reintento de Mercado Libre.
  if (!data) return { outcome: "duplicate" };

  await Promise.all([
    supabase
      .from("integrations")
      .update({ last_webhook_at: now().toISOString() })
      .eq("id", account.integration_id),
    audit({
      action: "ml.webhook.received",
      actorType: "webhook",
      entityType: "webhook_event",
      entityId: data.id,
      metadata: { topic: notification.topic, resource: notification.resource },
    }),
  ]);

  return { outcome: "queued", eventId: data.id };
}
