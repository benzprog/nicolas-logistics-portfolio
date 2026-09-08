import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Tables } from "@/types/database.types";

/** Diagnóstico de webhooks para la pantalla de configuración (solo admin). */
export type WebhookHealth = {
  lastReceivedAt: string | null;
  processedLast24h: number;
  failed: number;
  recentFailures: Pick<
    Tables<"webhook_events">,
    "id" | "topic" | "resource" | "last_error" | "received_at"
  >[];
};

export async function getWebhookHealth(): Promise<WebhookHealth | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const since = new Date(Date.now() - 24 * 3_600_000).toISOString();

    const [last, processed, failures] = await Promise.all([
      supabase
        .from("webhook_events")
        .select("received_at")
        .order("received_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("webhook_events")
        .select("id", { count: "exact", head: true })
        .eq("status", "processed")
        .gte("received_at", since),
      supabase
        .from("webhook_events")
        .select("id, topic, resource, last_error, received_at")
        .eq("status", "failed")
        .order("received_at", { ascending: false })
        .limit(5),
    ]);

    // Un usuario sin permisos no ve nada: la pantalla lo resuelve mostrando menos.
    if (last.error && last.error.code === "42501") return null;

    return {
      lastReceivedAt: last.data?.received_at ?? null,
      processedLast24h: processed.count ?? 0,
      failed: failures.data?.length ?? 0,
      recentFailures: failures.data ?? [],
    };
  } catch (error) {
    logger.warn("No se pudo leer el estado de los webhooks", {
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
