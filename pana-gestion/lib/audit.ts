import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";
import type { Json } from "@/types/database.types";

/**
 * Acciones auditables.
 *
 * Es una unión cerrada a propósito: si el día de mañana hay que buscar "todo
 * lo que pasó con los tokens", los nombres tienen que ser exactos, no
 * variaciones libres escritas en cada llamada.
 */
export type AuditAction =
  | "auth.login"
  | "auth.logout"
  | "auth.login_failed"
  | "ml.account.connected"
  | "ml.account.disconnected"
  | "ml.account.reconnected"
  | "ml.token.refreshed"
  | "ml.token.refresh_failed"
  | "ml.webhook.received"
  | "ml.webhook.rejected"
  | "ml.webhook.processed"
  | "ml.webhook.failed"
  | "ml.sync.completed"
  | "ml.sync.failed"
  | "ml.api.error"
  | "question.created"
  | "question.updated"
  | "question.archived"
  | "question.answer.sent"
  | "question.answer.failed";

type ActorType = "user" | "system" | "webhook" | "cron";

export type AuditEntry = {
  action: AuditAction;
  actorType?: ActorType;
  actorUserId?: string | null;
  entityType?: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Registra una acción.
 *
 * Nunca lanza: si la auditoría falla, la operación que la generó no tiene por
 * qué caerse. El fallo queda en los logs de la aplicación.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.from("audit_logs").insert({
      actor_type: entry.actorType ?? (entry.actorUserId ? "user" : "system"),
      actor_user_id: entry.actorUserId ?? null,
      action: entry.action,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      metadata: (entry.metadata ?? {}) as Json,
      ip: entry.ip ?? null,
      user_agent: entry.userAgent ?? null,
    });

    if (error) {
      logger.error("No se pudo escribir en la auditoría", {
        action: entry.action,
        error: error.message,
      });
    }
  } catch (error) {
    logger.error("No se pudo escribir en la auditoría", {
      action: entry.action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
