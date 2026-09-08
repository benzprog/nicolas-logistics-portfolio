import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { PAGE_SIZE, type QuestionFilters } from "@/features/mercadolibre/questions/schemas";
import type { Tables } from "@/types/database.types";

/**
 * Lecturas de preguntas.
 *
 * Usan el cliente con la sesión del usuario, no el de servicio: así cada
 * consulta pasa por RLS y un error en el código no puede filtrar datos.
 */

export type QuestionListItem = Tables<"questions"> & {
  mercadolibre_items: Pick<
    Tables<"mercadolibre_items">,
    | "ml_item_id"
    | "title"
    | "thumbnail_url"
    | "permalink"
    | "price"
    | "currency_id"
    | "available_quantity"
  > | null;
};

export type QuestionDetail = QuestionListItem & {
  question_answers: (Tables<"question_answers"> & {
    profiles: Pick<Tables<"profiles">, "id" | "full_name"> | null;
  })[];
  answered_by_profile: Pick<Tables<"profiles">, "id" | "full_name"> | null;
};

const ITEM_COLUMNS =
  "ml_item_id, title, thumbnail_url, permalink, price, currency_id, available_quantity";

export async function listQuestions(filters: QuestionFilters): Promise<{
  questions: QuestionListItem[];
  total: number;
  page: number;
  pageCount: number;
}> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("questions")
    .select(`*, mercadolibre_items!inner(${ITEM_COLUMNS})`, { count: "exact" });

  if (filters.estado !== "all") {
    query = query.eq("status", filters.estado);
  }

  // Las archivadas solo se ven pidiéndolas: si aparecieran en "todas", la
  // bandeja se llenaría de preguntas que ya no requieren nada.
  if (filters.estado !== "archived") {
    query = query.is("deleted_at", null);
  }

  if (filters.publicacion) {
    query = query.eq("ml_item_id", filters.publicacion);
  }

  if (filters.q) {
    // Búsqueda en el texto de la pregunta y en el de la respuesta.
    const term = escapeForLike(filters.q);
    query = query.or(`text.ilike.%${term}%,answer_text.ilike.%${term}%`);
  }

  const from = (filters.pagina - 1) * PAGE_SIZE;

  const { data, error, count } = await query
    .order("ml_date_created", { ascending: filters.orden === "oldest" })
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    logger.error("No se pudieron listar las preguntas", { error: error.message });
    throw new AppError("database", { message: error.message });
  }

  const total = count ?? 0;

  return {
    questions: (data ?? []) as unknown as QuestionListItem[],
    total,
    page: filters.pagina,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getQuestionDetail(id: string): Promise<QuestionDetail | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("questions")
    .select(
      `*,
       mercadolibre_items!inner(${ITEM_COLUMNS}),
       question_answers(*, profiles(id, full_name)),
       answered_by_profile:profiles!questions_answered_by_fkey(id, full_name)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logger.error("No se pudo cargar la pregunta", { id, error: error.message });
    throw new AppError("database", { message: error.message });
  }
  if (!data) return null;

  const detail = data as unknown as QuestionDetail;
  detail.question_answers = [...(detail.question_answers ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return detail;
}

/** Contador del sidebar. Si falla, no puede romper el layout entero. */
export async function getPendingQuestionsCount(): Promise<number> {
  try {
    const supabase = await createSupabaseServerClient();
    const { count, error } = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .is("deleted_at", null);

    if (error) throw error;
    return count ?? 0;
  } catch (error) {
    logger.warn("No se pudo contar las preguntas pendientes", {
      reason: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

export type QuestionMetrics = {
  pendingCount: number;
  pendingOver24hCount: number;
  answeredTodayCount: number;
  answered7dCount: number;
  avgResponseMinutes7d: number | null;
  oldestPendingAt: string | null;
};

export async function getQuestionMetrics(): Promise<QuestionMetrics | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("question_metrics");
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;

    return {
      pendingCount: Number(row.pending_count ?? 0),
      pendingOver24hCount: Number(row.pending_over_24h_count ?? 0),
      answeredTodayCount: Number(row.answered_today_count ?? 0),
      answered7dCount: Number(row.answered_7d_count ?? 0),
      avgResponseMinutes7d:
        row.avg_response_minutes_7d === null ? null : Number(row.avg_response_minutes_7d),
      oldestPendingAt: row.oldest_pending_at ?? null,
    };
  } catch (error) {
    logger.warn("No se pudieron calcular las métricas", {
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Publicaciones con preguntas, para el filtro del listado. */
export async function listItemsWithQuestions(): Promise<
  { id: string; title: string; count: number }[]
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("questions")
    .select("ml_item_id, mercadolibre_items!inner(title)")
    .is("deleted_at", null)
    .limit(500);

  if (error) return [];

  const counts = new Map<string, { title: string; count: number }>();
  for (const row of (data ?? []) as unknown as {
    ml_item_id: string;
    mercadolibre_items: { title: string } | null;
  }[]) {
    const current = counts.get(row.ml_item_id);
    if (current) current.count += 1;
    else
      counts.set(row.ml_item_id, {
        title: row.mercadolibre_items?.title ?? row.ml_item_id,
        count: 1,
      });
  }

  return [...counts.entries()]
    .map(([id, value]) => ({ id, title: value.title, count: value.count }))
    .sort((a, b) => b.count - a.count);
}

/** Escapa los comodines de PostgREST para que una búsqueda con % no rompa. */
function escapeForLike(term: string): string {
  return term.replace(/[%_,()]/g, " ").trim();
}
