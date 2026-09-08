import { ExternalLink, ImageOff, Package } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { QuestionDetail } from "@/features/mercadolibre/questions/queries";

/**
 * La publicación sobre la que preguntan.
 *
 * Va arriba de todo porque es el contexto que necesita quien responde: sin
 * saber qué producto es, ni el precio ni el stock, no se puede contestar.
 */
export function ItemCard({ item }: { item: QuestionDetail["mercadolibre_items"] }) {
  if (!item) return null;

  const price =
    item.price === null
      ? null
      : new Intl.NumberFormat("es-AR", {
          style: "currency",
          currency: item.currency_id ?? "ARS",
          maximumFractionDigits: 0,
        }).format(item.price);

  const outOfStock = item.available_quantity !== null && item.available_quantity <= 0;

  return (
    <Card>
      <CardContent className="flex gap-4">
        <div className="border-border bg-muted flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border">
          {item.thumbnail_url ? (
            // Imágenes de Mercado Libre: <img> directo evita configurar
            // remotePatterns para un dominio que ellos pueden cambiar.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnail_url}
              alt=""
              className="size-full object-contain"
              loading="lazy"
            />
          ) : (
            <ImageOff className="text-muted-foreground size-6" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <p className="line-clamp-2 leading-snug font-medium">{item.title}</p>
            {item.permalink ? (
              <a
                href={item.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1 text-xs hover:underline"
              >
                Ver en ML
                <ExternalLink className="size-3" aria-hidden />
              </a>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {price ? <span className="tabular font-semibold">{price}</span> : null}

            <span className="tabular text-muted-foreground flex items-center gap-1.5">
              <Package className="size-3.5" aria-hidden />
              {item.available_quantity === null
                ? "Stock desconocido"
                : `${item.available_quantity} en stock`}
            </span>

            {outOfStock ? <Badge variant="destructive">Sin stock</Badge> : null}

            <span className="text-muted-foreground font-mono text-xs">{item.ml_item_id}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
