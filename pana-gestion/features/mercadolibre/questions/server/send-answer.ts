import "server-only";

import { postAnswer } from "@/services/mercadolibre/api";
import {
  MlAuthError,
  MlNotFoundError,
  MlRateLimitError,
  MlUnavailableError,
  MlValidationError,
} from "@/services/mercadolibre/errors";
import { tokenProviderFor } from "@/features/mercadolibre/account/server/token-manager";
import { requireConnectedAccount } from "@/features/mercadolibre/account/server/repository";
import { syncQuestionById } from "@/features/mercadolibre/questions/server/sync-question";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { audit } from "@/lib/audit";
import type { Json } from "@/types/database.types";

/**
 * Publica una respuesta en Mercado Libre.
 *
 * El orden importa. Primero se anota la intención en la base (`sending`), y
 * recién después se llama a Mercado Libre. Si se hiciera al revés y el proceso
 * se cayera justo después de publicar, no quedaría rastro de que se respondió.
 *
 * La fila en estado `sending` es además el candado que impide que dos personas
 * respondan la misma pregunta al mismo tiempo: hay un índice único parcial que
 * solo admite una.
 */
export async function sendAnswer(params: {
  questionId: string;
  text: string;
  userId: string;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { account } = await requireConnectedAccount();

  const { data: question, error: readError } = await supabase
    .from("questions")
    .select("id, ml_question_id, status, deleted_at")
    .eq("id", params.questionId)
    .maybeSingle();

  if (readError) throw new AppError("database", { message: readError.message });
  if (!question) throw new AppError("not_found");

  if (question.deleted_at) {
    throw new AppError("ml_not_found", {
      userMessage: "Esta pregunta ya no existe en Mercado Libre.",
    });
  }

  if (question.status === "answered") {
    throw new AppError("conflict", {
      userMessage: "Esta pregunta ya fue respondida.",
    });
  }

  // Tomar el turno. Si otro lo tiene, esto choca contra el índice único.
  const { data: attempt, error: claimError } = await supabase
    .from("question_answers")
    .insert({
      question_id: question.id,
      text: params.text,
      status: "sending",
      source: "pana",
      sent_by: params.userId,
    })
    .select("id")
    .single();

  if (claimError) {
    // 23505 es la violación de unicidad: ya hay un envío en curso.
    if (claimError.code === "23505") {
      throw new AppError("conflict", {
        userMessage: "Otra persona está enviando una respuesta a esta pregunta en este momento.",
      });
    }
    throw new AppError("database", { message: claimError.message });
  }

  const auth = tokenProviderFor(account.id);

  try {
    const response = await postAnswer(auth, {
      questionId: question.ml_question_id,
      text: params.text,
    });

    // Cierre atómico: marcar el intento como enviado y la pregunta como
    // respondida tienen que pasar juntos.
    const { error: closeError } = await supabase.rpc("mark_question_answered", {
      p_answer_id: attempt.id,
      p_ml_response: (response ?? {}) as Json,
    });

    if (closeError) {
      // La respuesta salió, pero no pudimos anotarlo. La reconciliación lo
      // detecta releyendo la pregunta en Mercado Libre.
      logger.error("La respuesta se publicó pero no se pudo cerrar el registro", {
        questionId: question.id,
        error: closeError.message,
      });
      throw new AppError("database", { message: closeError.message });
    }

    await audit({
      action: "question.answer.sent",
      actorUserId: params.userId,
      entityType: "question",
      entityId: question.id,
      metadata: { mlQuestionId: question.ml_question_id, length: params.text.length },
    });
  } catch (error) {
    const { code, message } = describeFailure(error);

    await supabase.rpc("mark_answer_failed", {
      p_answer_id: attempt.id,
      p_error_code: code,
      p_error_message: message,
    });

    await audit({
      action: "question.answer.failed",
      actorUserId: params.userId,
      entityType: "question",
      entityId: question.id,
      metadata: { mlQuestionId: question.ml_question_id, code, message },
    });

    // Mercado Libre rechazó por el estado de la pregunta: puede haber sido
    // respondida o cerrada por otro lado. Se relee para mostrar la realidad.
    if (error instanceof MlValidationError || error instanceof MlNotFoundError) {
      await syncQuestionById(auth, {
        accountId: account.id,
        questionId: question.ml_question_id,
      }).catch((syncError: unknown) => {
        logger.warn("No se pudo re-sincronizar la pregunta después del rechazo", {
          questionId: question.id,
          reason: syncError instanceof Error ? syncError.message : String(syncError),
        });
      });
    }

    throw toAppError(error, message);
  }
}

function describeFailure(error: unknown): { code: string; message: string } {
  if (error instanceof MlAuthError) return { code: "ml_auth", message: error.message };
  if (error instanceof MlNotFoundError) return { code: "ml_not_found", message: error.message };
  if (error instanceof MlRateLimitError) return { code: "ml_rate_limit", message: error.message };
  if (error instanceof MlUnavailableError)
    return { code: "ml_unavailable", message: error.message };
  if (error instanceof MlValidationError) return { code: "ml_validation", message: error.message };
  if (error instanceof AppError) return { code: error.code, message: error.message };
  return { code: "unknown", message: error instanceof Error ? error.message : String(error) };
}

function toAppError(error: unknown, message: string): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof MlAuthError) return new AppError("ml_auth", { cause: error });
  if (error instanceof MlNotFoundError) return new AppError("ml_not_found", { cause: error });
  if (error instanceof MlRateLimitError) return new AppError("ml_rate_limit", { cause: error });
  if (error instanceof MlUnavailableError) {
    return new AppError("ml_unavailable", {
      cause: error,
      // Importa aclararlo: si reintenta a ciegas puede duplicar la respuesta.
      userMessage:
        "Mercado Libre no respondió. Verificá en la publicación si la respuesta se publicó antes de reintentar.",
    });
  }
  if (error instanceof MlValidationError) {
    return new AppError("ml_validation", {
      cause: error,
      userMessage: `Mercado Libre rechazó la respuesta: ${message}`,
    });
  }

  return new AppError("unknown", { cause: error });
}
