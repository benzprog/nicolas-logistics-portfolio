import "server-only";

import {
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_RETRY_BACKOFF_MINUTES,
} from "@/services/mercadolibre/constants";
import { idFromResource } from "@/services/mercadolibre/types";
import { findAccountByMlUserId } from "@/features/mercadolibre/account/server/repository";
import { tokenProviderFor } from "@/features/mercadolibre/account/server/token-manager";
import { syncQuestionById } from "@/features/mercadolibre/questions/server/sync-question";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";
import { audit } from "@/lib/audit";
import { now } from "@/lib/time";
import type { Tables } from "@/types/database.types";

type WebhookEvent = Tables<"webhook_events">;

/**
 * Procesa un evento ya guardado.
 *
 * Se puede llamar dos veces con el mismo id sin consecuencias: toma el evento
 * solo si sigue pendiente, y lo que hace después (releer la pregunta y
 * guardarla) es idempotente de por sí.
 */
export async function processWebhookEvent(eventId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();

  // Tomar el evento con una condición en el WHERE: si otro proceso lo agarró
  // primero, este update no devuelve nada y salimos sin hacer nada.
  const { data: event, error } = await supabase
    .from("webhook_events")
    .update({ status: "processing" })
    .eq("id", eventId)
    .in("status", ["received", "failed"])
    .select("*")
    .maybeSingle();

  if (error) {
    logger.error("No se pudo tomar el evento", { eventId, error: error.message });
    return;
  }
  if (!event) return;

  try {
    await dispatch(event);

    await supabase
      .from("webhook_events")
      .update({
        status: "processed",
        processed_at: now().toISOString(),
        last_error: null,
        next_retry_at: null,
      })
      .eq("id", event.id);

    await audit({
      action: "ml.webhook.processed",
      actorType: "webhook",
      entityType: "webhook_event",
      entityId: event.id,
      metadata: { topic: event.topic, resource: event.resource },
    });
  } catch (cause) {
    await registerFailure(event, cause);
  }
}

async function dispatch(event: WebhookEvent): Promise<void> {
  switch (event.topic) {
    case "questions":
      await processQuestionEvent(event);
      return;
    default:
      // No debería llegar acá: la ingesta ya filtra los topics.
      logger.warn("Topic sin procesador", { topic: event.topic, eventId: event.id });
  }
}

async function processQuestionEvent(event: WebhookEvent): Promise<void> {
  const questionId = idFromResource(event.resource);
  if (!questionId) {
    throw new Error(`No se pudo extraer el id de la pregunta de "${event.resource}"`);
  }
  if (!event.ml_user_id) {
    throw new Error("La notificación no trae el id de usuario de Mercado Libre");
  }

  const account = await findAccountByMlUserId(event.ml_user_id);
  if (!account) {
    throw new Error(`No hay cuenta conectada para el usuario ${event.ml_user_id}`);
  }

  await syncQuestionById(tokenProviderFor(account.id), {
    accountId: account.id,
    questionId,
  });
}

async function registerFailure(event: WebhookEvent, cause: unknown): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const attempts = event.process_attempts + 1;
  const reason = cause instanceof Error ? cause.message : String(cause);

  const exhausted = attempts >= WEBHOOK_MAX_ATTEMPTS;

  // Espera creciente: un problema pasajero se resuelve en el primer reintento,
  // y uno persistente no golpea la API cada minuto.
  const delayMinutes =
    WEBHOOK_RETRY_BACKOFF_MINUTES[
      Math.min(attempts - 1, WEBHOOK_RETRY_BACKOFF_MINUTES.length - 1)
    ] ?? 60;

  await supabase
    .from("webhook_events")
    .update({
      status: "failed",
      process_attempts: attempts,
      last_error: reason.slice(0, 500),
      next_retry_at: exhausted
        ? null
        : new Date(now().getTime() + delayMinutes * 60_000).toISOString(),
    })
    .eq("id", event.id);

  logger.error("Falló el procesamiento de un evento", {
    eventId: event.id,
    topic: event.topic,
    attempts,
    exhausted,
    reason,
  });

  await audit({
    action: "ml.webhook.failed",
    actorType: "webhook",
    entityType: "webhook_event",
    entityId: event.id,
    metadata: { attempts, exhausted, reason: reason.slice(0, 300) },
  });
}

/**
 * Reprocesa lo que quedó pendiente.
 *
 * Es la red que cubre los dos agujeros del camino feliz: que el procesamiento
 * en segundo plano se haya cortado, y que Mercado Libre no haya podido
 * entregarnos una notificación.
 */
export async function processPendingEvents(limit = 25): Promise<{ processed: number }> {
  const supabase = createSupabaseServiceClient();

  const { data: pending, error } = await supabase
    .from("webhook_events")
    .select("id")
    .in("status", ["received", "failed"])
    .lt("process_attempts", WEBHOOK_MAX_ATTEMPTS)
    .or(`next_retry_at.is.null,next_retry_at.lte.${now().toISOString()}`)
    .order("received_at", { ascending: true })
    .limit(limit);

  if (error) {
    logger.error("No se pudo listar los eventos pendientes", { error: error.message });
    return { processed: 0 };
  }

  let processed = 0;
  for (const event of pending ?? []) {
    await processWebhookEvent(event.id);
    processed += 1;
  }

  return { processed };
}
