import "server-only";

import { ITEM_CACHE_HOURS } from "@/services/mercadolibre/constants";
import { fetchItem } from "@/services/mercadolibre/api";
import { MlNotFoundError } from "@/services/mercadolibre/errors";
import type { TokenProvider } from "@/services/mercadolibre/client";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { hoursSince, now } from "@/lib/time";
import type { Json } from "@/types/database.types";

/**
 * Asegura que exista una copia local de la publicación.
 *
 * Se pide a Mercado Libre solo si no la tenemos o si la copia está vieja. Sin
 * esto, abrir una lista de veinte preguntas dispararía veinte llamadas a su
 * API para mostrar veinte veces el mismo título.
 */
export async function ensureItem(
  auth: TokenProvider,
  params: { accountId: string; itemId: string; force?: boolean },
): Promise<void> {
  const supabase = createSupabaseServiceClient();

  const { data: existing, error } = await supabase
    .from("mercadolibre_items")
    .select("ml_item_id, synced_at")
    .eq("ml_item_id", params.itemId)
    .maybeSingle();

  if (error) throw new AppError("database", { message: error.message });

  const fresh = existing && hoursSince(existing.synced_at) < ITEM_CACHE_HOURS;
  if (fresh && !params.force) return;

  try {
    const item = await fetchItem(auth, params.itemId);

    const { error: upsertError } = await supabase.from("mercadolibre_items").upsert(
      {
        ml_item_id: item.id,
        account_id: params.accountId,
        title: item.title,
        thumbnail_url: item.secure_thumbnail ?? item.thumbnail ?? null,
        permalink: item.permalink ?? null,
        price: item.price ?? null,
        currency_id: item.currency_id ?? null,
        available_quantity: item.available_quantity ?? null,
        status: item.status ?? null,
        raw: item as unknown as Json,
        synced_at: now().toISOString(),
      },
      { onConflict: "ml_item_id" },
    );

    if (upsertError) throw new AppError("database", { message: upsertError.message });
  } catch (cause) {
    // Una publicación borrada no puede bloquear la pregunta: se guarda un
    // marcador para que la interfaz muestre algo y siga andando.
    if (cause instanceof MlNotFoundError) {
      logger.warn("La publicación ya no existe en Mercado Libre", { itemId: params.itemId });

      if (!existing) {
        await supabase.from("mercadolibre_items").upsert(
          {
            ml_item_id: params.itemId,
            account_id: params.accountId,
            title: "Publicación no disponible",
            status: "not_found",
            synced_at: now().toISOString(),
          },
          { onConflict: "ml_item_id" },
        );
      }
      return;
    }

    // Si la publicación ya estaba guardada, seguimos con la copia vieja: es
    // mejor un título desactualizado que no poder responder la pregunta.
    if (existing) {
      logger.warn("No se pudo refrescar la publicación; se usa la copia local", {
        itemId: params.itemId,
        reason: cause instanceof Error ? cause.message : String(cause),
      });
      return;
    }

    throw cause;
  }
}
