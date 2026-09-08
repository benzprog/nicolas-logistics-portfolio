import "server-only";

import { fetchQuestion, searchQuestions } from "@/services/mercadolibre/api";
import { MlNotFoundError } from "@/services/mercadolibre/errors";
import type { TokenProvider } from "@/services/mercadolibre/client";
import type { MlQuestion } from "@/services/mercadolibre/types";
import { ensureItem } from "@/features/mercadolibre/items/server/sync-item";
import { mapQuestionToRow, mergeOnConflict } from "@/features/mercadolibre/questions/mappers";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { audit } from "@/lib/audit";
import { now } from "@/lib/time";

export type SyncOutcome = "created" | "updated" | "archived_missing";

/**
 * Trae una pregunta desde Mercado Libre y la deja guardada.
 *
 * Es idempotente: correrla dos veces con el mismo id deja el mismo resultado.
 * Eso es lo que permite que un webhook repetido no genere basura.
 */
export async function syncQuestionById(
  auth: TokenProvider,
  params: { accountId: string; questionId: number },
): Promise<SyncOutcome> {
  try {
    const question = await fetchQuestion(auth, params.questionId);
    return persistQuestion(auth, { accountId: params.accountId, question });
  } catch (error) {
    // La pregunta se borró entre que llegó la notificación y la fuimos a
    // buscar. No es un fallo: es información.
    if (error instanceof MlNotFoundError) {
      await archiveMissingQuestion(params.accountId, params.questionId);
      return "archived_missing";
    }
    throw error;
  }
}

/** Guarda una pregunta ya traída de Mercado Libre. */
export async function persistQuestion(
  auth: TokenProvider,
  params: { accountId: string; question: MlQuestion },
): Promise<SyncOutcome> {
  const supabase = createSupabaseServiceClient();
  const { accountId, question } = params;

  // La publicación tiene que existir antes: la pregunta la referencia.
  await ensureItem(auth, { accountId, itemId: question.item_id });

  const { data: existing, error: readError } = await supabase
    .from("questions")
    .select("id, answer_source, answered_by")
    .eq("account_id", accountId)
    .eq("ml_question_id", question.id)
    .maybeSingle();

  if (readError) throw new AppError("database", { message: readError.message });

  const row = mapQuestionToRow(question, { accountId, nowIso: now().toISOString() });
  const merged = existing ? mergeOnConflict(row, existing) : row;

  const { error: upsertError } = await supabase
    .from("questions")
    .upsert(merged, { onConflict: "account_id,ml_question_id" });

  if (upsertError) throw new AppError("database", { message: upsertError.message });

  if (!existing) {
    await audit({
      action: "question.created",
      actorType: "system",
      entityType: "question",
      entityId: String(question.id),
      metadata: { itemId: question.item_id, status: question.status },
    });
    return "created";
  }

  return "updated";
}

/** Marca como archivada una pregunta que Mercado Libre ya no tiene. */
async function archiveMissingQuestion(accountId: string, questionId: number): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const nowIso = now().toISOString();

  const { error } = await supabase
    .from("questions")
    .update({
      status: "archived",
      ml_status: "DELETED",
      deleted_at: nowIso,
      last_synced_at: nowIso,
    })
    .eq("account_id", accountId)
    .eq("ml_question_id", questionId);

  if (error) throw new AppError("database", { message: error.message });

  logger.info("Pregunta archivada: ya no existe en Mercado Libre", { questionId });
}

/**
 * Importa todas las preguntas sin responder del vendedor.
 *
 * Se usa al conectar la cuenta por primera vez y como red de contención del
 * job de reconciliación: si se perdió una notificación, acá aparece igual.
 */
export async function syncUnansweredQuestions(
  auth: TokenProvider,
  params: { accountId: string; sellerId: number; maxPages?: number },
): Promise<{ imported: number; created: number }> {
  const pageSize = 50;
  const maxPages = params.maxPages ?? 10;

  let created = 0;
  let imported = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const { questions, total } = await searchQuestions(auth, {
      sellerId: params.sellerId,
      status: "UNANSWERED",
      limit: pageSize,
      offset: page * pageSize,
    });

    if (questions.length === 0) break;

    for (const question of questions) {
      const outcome = await persistQuestion(auth, {
        accountId: params.accountId,
        question,
      });
      imported += 1;
      if (outcome === "created") created += 1;
    }

    if ((page + 1) * pageSize >= total) break;
  }

  logger.info("Sincronización de preguntas sin responder", { imported, created });
  return { imported, created };
}

/**
 * Vuelve a mirar las preguntas que tenemos como pendientes.
 *
 * Cubre el caso de alguien respondiendo desde la app de Mercado Libre en el
 * celular: para nosotros seguiría pendiente hasta que la releamos.
 */
export async function refreshStalePendingQuestions(
  auth: TokenProvider,
  params: { accountId: string; olderThanHours?: number; limit?: number },
): Promise<number> {
  const supabase = createSupabaseServiceClient();
  const threshold = new Date(
    now().getTime() - (params.olderThanHours ?? 1) * 3_600_000,
  ).toISOString();

  const { data: stale, error } = await supabase
    .from("questions")
    .select("ml_question_id")
    .eq("account_id", params.accountId)
    .eq("status", "pending")
    .is("deleted_at", null)
    .lt("last_synced_at", threshold)
    .order("last_synced_at", { ascending: true })
    .limit(params.limit ?? 25);

  if (error) throw new AppError("database", { message: error.message });

  let refreshed = 0;
  for (const question of stale ?? []) {
    await syncQuestionById(auth, {
      accountId: params.accountId,
      questionId: question.ml_question_id,
    });
    refreshed += 1;
  }

  return refreshed;
}
