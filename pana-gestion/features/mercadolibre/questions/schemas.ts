import { z } from "zod";

import { ML_ANSWER_MAX_LENGTH } from "@/services/mercadolibre/constants";

/** Estados que se pueden pedir desde la interfaz. */
export const questionFilterStatus = z.enum(["pending", "answered", "archived", "all"]);
export type QuestionFilterStatus = z.infer<typeof questionFilterStatus>;

export const questionSort = z.enum(["oldest", "newest"]);
export type QuestionSort = z.infer<typeof questionSort>;

/**
 * Filtros del listado.
 *
 * Viven en la URL, así que todo llega como texto y puede venir de cualquier
 * lado. Los defaults valen también cuando alguien edita la barra de direcciones
 * a mano: nunca se rompe la página, se cae al valor razonable.
 */
export const questionFiltersSchema = z.object({
  estado: questionFilterStatus.catch("pending"),
  q: z.string().trim().max(120).optional().catch(undefined),
  publicacion: z.string().trim().max(40).optional().catch(undefined),
  orden: questionSort.catch("oldest"),
  pagina: z.coerce.number().int().min(1).max(1000).catch(1),
});

export type QuestionFilters = z.infer<typeof questionFiltersSchema>;

export const PAGE_SIZE = 25;

export const answerSchema = z.object({
  questionId: z.uuid("Pregunta inválida"),
  text: z
    .string()
    .trim()
    .min(1, "Escribí una respuesta")
    .max(
      ML_ANSWER_MAX_LENGTH,
      `La respuesta no puede superar los ${ML_ANSWER_MAX_LENGTH} caracteres`,
    ),
});

export type AnswerInput = z.input<typeof answerSchema>;

export const archiveSchema = z.object({
  questionId: z.uuid("Pregunta inválida"),
});
