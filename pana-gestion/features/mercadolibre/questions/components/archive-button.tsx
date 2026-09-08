"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { archiveQuestion } from "@/features/mercadolibre/questions/actions";

/**
 * Archivar saca la pregunta de la bandeja sin responderla.
 *
 * Lleva confirmación porque el efecto es que nadie más la va a ver en la lista
 * de pendientes: es la clase de acción que no conviene poder hacer sin querer.
 */
export function ArchiveButton({ questionId }: { questionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          <Archive aria-hidden />
          Archivar
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Archivar esta pregunta?</AlertDialogTitle>
          <AlertDialogDescription>
            Se saca de la bandeja de pendientes sin responderla. En Mercado Libre queda como está,
            así que el comprador va a seguir esperando una respuesta.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              startTransition(async () => {
                const result = await archiveQuestion({ questionId });
                if (result.ok) {
                  toast.success("Pregunta archivada");
                  router.push("/mercadolibre/preguntas");
                  router.refresh();
                } else {
                  toast.error(result.error);
                }
              });
            }}
          >
            Archivar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
