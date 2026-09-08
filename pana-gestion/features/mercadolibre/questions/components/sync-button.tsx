"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { syncQuestionsNow } from "@/features/mercadolibre/questions/actions";
import { cn } from "@/lib/utils";

/**
 * Sincronización a pedido.
 *
 * El sistema ya trae las preguntas solo (webhook + reconciliación). Este botón
 * está para el momento en que alguien duda: "¿estará todo?". Poder comprobarlo
 * en un click evita que se abra Mercado Libre en otra pestaña.
 */
export function SyncButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await syncQuestionsNow();
          if (result.ok) {
            toast.success(
              result.data.imported === 0
                ? "Ya estaba todo al día"
                : `Se revisaron ${result.data.imported} preguntas`,
            );
            router.refresh();
          } else {
            toast.error(result.error);
          }
        })
      }
    >
      <RefreshCw className={cn(pending && "animate-spin")} aria-hidden />
      {pending ? "Sincronizando…" : "Sincronizar"}
    </Button>
  );
}
