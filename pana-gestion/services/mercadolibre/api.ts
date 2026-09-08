import { mlRequest, type TokenProvider } from "@/services/mercadolibre/client";
import { ML_ANSWER_MAX_LENGTH, ML_QUESTIONS_API_VERSION } from "@/services/mercadolibre/constants";
import {
  mlItemSchema,
  mlMissedFeedSchema,
  mlQuestionSchema,
  mlQuestionSearchSchema,
  mlUserSchema,
  type MlItem,
  type MlQuestion,
  type MlUser,
} from "@/services/mercadolibre/types";
import { MlValidationError } from "@/services/mercadolibre/errors";

/**
 * Endpoints de Mercado Libre que usa PANA Gestión.
 *
 * Cada respuesta se valida antes de salir de acá: del otro lado del módulo,
 * nadie tiene que preguntarse si un campo puede venir con otra forma.
 */

/** La cuenta dueña del token. */
export async function fetchCurrentUser(auth: TokenProvider): Promise<MlUser> {
  const raw = await mlRequest<unknown>("/users/me", { auth });
  return mlUserSchema.parse(raw);
}

/** Una pregunta puntual. Es lo que se pide al procesar una notificación. */
export async function fetchQuestion(auth: TokenProvider, questionId: number): Promise<MlQuestion> {
  const raw = await mlRequest<unknown>(`/questions/${questionId}`, {
    auth,
    query: { api_version: ML_QUESTIONS_API_VERSION },
  });
  return mlQuestionSchema.parse(raw);
}

export type QuestionSearchParams = {
  sellerId: number;
  /** UNANSWERED, ANSWERED... Sin esto trae todas. */
  status?: string;
  limit?: number;
  offset?: number;
};

/** Búsqueda de preguntas del vendedor. La usa la reconciliación. */
export async function searchQuestions(
  auth: TokenProvider,
  params: QuestionSearchParams,
): Promise<{ total: number; questions: MlQuestion[] }> {
  const raw = await mlRequest<unknown>("/questions/search", {
    auth,
    query: {
      seller_id: params.sellerId,
      status: params.status,
      api_version: ML_QUESTIONS_API_VERSION,
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
      sort_fields: "date_created",
      sort_types: "ASC",
    },
  });

  const parsed = mlQuestionSearchSchema.parse(raw);
  return { total: parsed.total ?? parsed.questions.length, questions: parsed.questions };
}

/**
 * Publica una respuesta.
 *
 * No se reintenta sola (ver el cliente): un reintento a ciegas puede publicar
 * la misma respuesta dos veces en la publicación.
 */
export async function postAnswer(
  auth: TokenProvider,
  params: { questionId: number; text: string },
): Promise<unknown> {
  const text = params.text.trim();

  if (!text) {
    throw new MlValidationError("La respuesta no puede estar vacía");
  }
  if (text.length > ML_ANSWER_MAX_LENGTH) {
    throw new MlValidationError(
      `La respuesta supera los ${ML_ANSWER_MAX_LENGTH} caracteres que acepta Mercado Libre`,
    );
  }

  return mlRequest<unknown>("/answers", {
    method: "POST",
    auth,
    body: { question_id: params.questionId, text },
    timeoutMs: 15_000,
  });
}

/** Datos de una publicación. Se piden solo los campos que se muestran. */
export async function fetchItem(auth: TokenProvider, itemId: string): Promise<MlItem> {
  const raw = await mlRequest<unknown>(`/items/${itemId}`, {
    auth,
    query: {
      attributes:
        "id,title,thumbnail,secure_thumbnail,permalink,price,currency_id,available_quantity,status",
    },
  });
  return mlItemSchema.parse(raw);
}

/**
 * Notificaciones que Mercado Libre no pudo entregar.
 *
 * Es la red de contención del webhook: si el endpoint estuvo caído, acá están
 * los eventos que se perdieron.
 */
export async function fetchMissedFeeds(
  auth: TokenProvider,
  params: { appId: string; limit?: number },
): Promise<{ resource: string; topic: string; userId: number; externalId: string | null }[]> {
  const raw = await mlRequest<unknown>("/missed_feeds", {
    auth,
    query: { app_id: params.appId, limit: params.limit ?? 50 },
  });

  const parsed = mlMissedFeedSchema.parse(raw);
  return parsed.messages.map((message) => ({
    resource: message.resource,
    topic: message.topic,
    userId: message.user_id,
    externalId: message._id ?? null,
  }));
}
