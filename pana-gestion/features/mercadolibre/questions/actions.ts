"use server";

import { revalidatePath } from "next/cache";

import { requireUser, canAnswerQuestions } from "@/features/auth/server/session";
import { sendAnswer } from "@/features/mercadolibre/questions/server/send-answer";
import { syncUnansweredQuestions } from "@/features/mercadolibre/questions/server/sync-question";
import { requireConnectedAccount } from "@/features/mercadolibre/account/server/repository";
import { tokenProviderFor } from "@/features/mercadolibre/account/server/token-manager";
import { answerSchema, archiveSchema } from "@/features/mercadolibre/questions/schemas";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { AppError, toUserMessage } from "@/lib/errors";
import { fail, ok, type Result } from "@/lib/result";
import { logger } from "@/lib/logger";
import { audit } from "@/lib/audit";

/**
 * Acciones sobre preguntas.
 *
 * Todas empiezan igual: verificar sesión, verificar rol, validar la entrada.
 * Recién después se toca nada. RLS protege las lecturas; esto protege lo que
 * cambia el estado del mundo.
 */

export async function answerQuestion(input: {
  questionId: string;
  text: string;
}): Promise<Result<null>> {
  try {
    const user = await requireUser();
    if (!canAnswerQuestions(user.profile.role)) {
      throw new AppError("forbidden");
    }

    const parsed = answerSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Revisá la respuesta", "validation");
    }

    await sendAnswer({
      questionId: parsed.data.questionId,
      text: parsed.data.text,
      userId: user.id,
    });

    revalidatePath("/mercadolibre/preguntas");
    revalidatePath(`/mercadolibre/preguntas/${parsed.data.questionId}`);
    revalidatePath("/");

    return ok(null);
  } catch (error) {
    logger.error("No se pudo enviar la respuesta", {
      questionId: input.questionId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return fail(toUserMessage(error), error instanceof AppError ? error.code : "unknown");
  }
}

/** Saca una pregunta de la bandeja sin responderla. */
export async function archiveQuestion(input: { questionId: string }): Promise<Result<null>> {
  try {
    const user = await requireUser();
    if (!canAnswerQuestions(user.profile.role)) {
      throw new AppError("forbidden");
    }

    const parsed = archiveSchema.safeParse(input);
    if (!parsed.success) return fail("Pregunta inválida", "validation");

    const supabase = createSupabaseServiceClient();
    const { error } = await supabase
      .from("questions")
      .update({ status: "archived" })
      .eq("id", parsed.data.questionId)
      .eq("status", "pending");

    if (error) throw new AppError("database", { message: error.message });

    await audit({
      action: "question.archived",
      actorUserId: user.id,
      entityType: "question",
      entityId: parsed.data.questionId,
    });

    revalidatePath("/mercadolibre/preguntas");
    revalidatePath(`/mercadolibre/preguntas/${parsed.data.questionId}`);

    return ok(null);
  } catch (error) {
    return fail(toUserMessage(error), error instanceof AppError ? error.code : "unknown");
  }
}

/** Trae ahora mismo lo que haya en Mercado Libre, sin esperar al job. */
export async function syncQuestionsNow(): Promise<Result<{ imported: number }>> {
  try {
    const user = await requireUser();
    if (!canAnswerQuestions(user.profile.role)) {
      throw new AppError("forbidden");
    }

    const { account } = await requireConnectedAccount();
    const auth = tokenProviderFor(account.id);

    const { imported } = await syncUnansweredQuestions(auth, {
      accountId: account.id,
      sellerId: account.ml_user_id,
      maxPages: 4,
    });

    await audit({
      action: "ml.sync.completed",
      actorUserId: user.id,
      entityType: "mercadolibre_account",
      entityId: account.id,
      metadata: { imported, trigger: "manual" },
    });

    revalidatePath("/mercadolibre/preguntas");
    return ok({ imported });
  } catch (error) {
    logger.error("Falló la sincronización manual", {
      reason: error instanceof Error ? error.message : String(error),
    });
    return fail(toUserMessage(error), error instanceof AppError ? error.code : "unknown");
  }
}
