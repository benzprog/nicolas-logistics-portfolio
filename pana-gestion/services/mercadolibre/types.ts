import { z } from "zod";

/**
 * Formas de las respuestas de Mercado Libre.
 *
 * Se validan con Zod en vez de confiar en el tipo declarado: son datos de un
 * sistema ajeno que puede cambiar sin avisar. Los campos que no usamos quedan
 * fuera del schema y se conservan igual en la columna `raw`.
 */

export const mlTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  expires_in: z.number().int().positive(),
  scope: z.string().optional(),
  user_id: z.number().int().positive(),
  refresh_token: z.string().min(1),
});

export type MlTokenResponse = z.infer<typeof mlTokenResponseSchema>;

export const mlUserSchema = z.object({
  id: z.number().int().positive(),
  nickname: z.string(),
  email: z.string().optional().nullable(),
  site_id: z.string().optional(),
  permalink: z.string().optional().nullable(),
});

export type MlUser = z.infer<typeof mlUserSchema>;

export const mlQuestionSchema = z.object({
  id: z.number().int().positive(),
  seller_id: z.number().int().positive(),
  item_id: z.string().min(1),
  text: z.string(),
  status: z.string(),
  date_created: z.string(),
  from: z.object({ id: z.number().int().positive().optional() }).optional().nullable(),
  answer: z
    .object({
      text: z.string(),
      status: z.string().optional(),
      date_created: z.string().optional(),
    })
    .optional()
    .nullable(),
});

export type MlQuestion = z.infer<typeof mlQuestionSchema>;

export const mlQuestionSearchSchema = z.object({
  total: z.number().int().nonnegative().optional(),
  questions: z.array(mlQuestionSchema).default([]),
});

export const mlItemSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  thumbnail: z.string().optional().nullable(),
  secure_thumbnail: z.string().optional().nullable(),
  permalink: z.string().optional().nullable(),
  price: z.number().optional().nullable(),
  currency_id: z.string().optional().nullable(),
  available_quantity: z.number().int().optional().nullable(),
  status: z.string().optional().nullable(),
});

export type MlItem = z.infer<typeof mlItemSchema>;

/**
 * Notificación de Mercado Libre.
 *
 * Se valida con tolerancia: si aparece un campo nuevo no queremos rechazar el
 * evento, porque el payload solo sirve como puntero al recurso que después
 * vamos a releer con nuestro token.
 */
export const mlNotificationSchema = z.object({
  _id: z.string().min(1),
  resource: z.string().min(1),
  user_id: z.number().int().positive(),
  topic: z.string().min(1),
  application_id: z.union([z.number(), z.string()]).optional(),
  attempts: z.number().int().optional(),
  sent: z.string().optional(),
  received: z.string().optional(),
});

export type MlNotification = z.infer<typeof mlNotificationSchema>;

export const mlMissedFeedSchema = z.object({
  messages: z
    .array(
      z.object({
        _id: z.string().optional(),
        resource: z.string(),
        user_id: z.number().int(),
        topic: z.string(),
        application_id: z.union([z.number(), z.string()]).optional(),
        sent: z.string().optional(),
      }),
    )
    .default([]),
});

/** Saca el id numérico de un recurso como "/questions/5036111111". */
export function idFromResource(resource: string): number | null {
  const match = /(\d+)\s*$/.exec(resource.trim());
  if (!match?.[1]) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(value) ? value : null;
}
