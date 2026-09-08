import type { MlQuestion } from "@/services/mercadolibre/types";
import type { Enums, TablesInsert } from "@/types/database.types";

export type QuestionStatus = Enums<"question_status">;

/**
 * Traduce el estado de Mercado Libre al estado interno.
 *
 * Los estados de ellos describen la pregunta en su sistema; los nuestros
 * describen qué tiene que hacer una persona. Un estado desconocido cae en
 * "pendiente" a propósito: es preferible que alguien mire una pregunta de más
 * a que una quede invisible porque apareció un estado nuevo.
 */
export function toInternalStatus(mlStatus: string): QuestionStatus {
  switch (mlStatus.toUpperCase()) {
    case "ANSWERED":
      return "answered";
    case "CLOSED_UNANSWERED":
    case "DELETED":
    case "BANNED":
    case "DISABLED":
      return "archived";
    case "UNANSWERED":
    case "UNDER_REVIEW":
      return "pending";
    default:
      return "pending";
  }
}

/** Solo estas preguntas se borran de verdad del lado de Mercado Libre. */
export function isDeletedInMl(mlStatus: string): boolean {
  return mlStatus.toUpperCase() === "DELETED";
}

/**
 * Convierte una pregunta de Mercado Libre en una fila lista para guardar.
 *
 * No decide sobre `answered_by`: quién respondió es información nuestra, y solo
 * la sabemos cuando la respuesta salió desde este panel.
 */
export function mapQuestionToRow(
  question: MlQuestion,
  context: { accountId: string; nowIso: string },
): TablesInsert<"questions"> {
  const status = toInternalStatus(question.status);
  const answerText = question.answer?.text?.trim() || null;

  return {
    account_id: context.accountId,
    ml_question_id: question.id,
    ml_item_id: question.item_id,
    ml_seller_id: question.seller_id,
    ml_buyer_id: question.from?.id ?? null,
    text: question.text,
    status,
    ml_status: question.status,
    ml_date_created: question.date_created,
    answer_text: answerText,
    answered_at: answerText ? (question.answer?.date_created ?? context.nowIso) : null,
    // Si Mercado Libre la muestra respondida y nosotros no fuimos, alguien
    // contestó desde la app oficial. Queda registrado como respuesta externa.
    answer_source: answerText ? "external" : null,
    raw: question as unknown as TablesInsert<"questions">["raw"],
    last_synced_at: context.nowIso,
    deleted_at: isDeletedInMl(question.status) ? context.nowIso : null,
  };
}

/**
 * Campos que se actualizan al re-sincronizar una pregunta que ya teníamos.
 *
 * Deliberadamente NO se pisan `answered_by` ni `answer_source` cuando ya
 * tenemos una respuesta propia: Mercado Libre no sabe quién de PANA respondió,
 * y esa atribución es justamente lo que hace útil el historial.
 */
export function mergeOnConflict(
  row: TablesInsert<"questions">,
  existing: { answer_source: Enums<"answer_source"> | null; answered_by: string | null },
): TablesInsert<"questions"> {
  if (existing.answer_source === "pana") {
    return { ...row, answer_source: "pana", answered_by: existing.answered_by };
  }
  return row;
}
