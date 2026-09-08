"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { answerQuestion } from "@/features/mercadolibre/questions/actions";
import { ML_ANSWER_MAX_LENGTH } from "@/services/mercadolibre/constants";
import { cn } from "@/lib/utils";

/**
 * Redacción y envío de la respuesta.
 *
 * Tres cosas que tienen que pasar sí o sí:
 *  - no se puede enviar vacío;
 *  - no se puede enviar dos veces (el botón se apaga y la acción está en
 *    curso dentro de una transición);
 *  - un error se explica en castellano, y el texto NO se pierde.
 *
 * Ese último punto es el que más cuida el trabajo de la persona: si Mercado
 * Libre no responde, lo último que queremos es que además tenga que volver a
 * escribir lo que ya escribió.
 */
export function AnswerForm({ questionId }: { questionId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  const trimmed = text.trim();
  const tooLong = trimmed.length > ML_ANSWER_MAX_LENGTH;
  const canSend = trimmed.length > 0 && !tooLong && !pending;

  const submit = () => {
    if (!canSend) return;

    startTransition(async () => {
      const result = await answerQuestion({ questionId, text: trimmed });

      if (result.ok) {
        toast.success("Respuesta enviada", {
          description: "Ya está publicada en Mercado Libre.",
        });
        setText("");
        router.refresh();
        return;
      }

      // El texto queda intacto: se puede corregir y reintentar.
      toast.error("No se pudo enviar la respuesta", { description: result.error, duration: 8000 });
    });
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="respuesta">Tu respuesta</Label>
        <Textarea
          id="respuesta"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // Atajo para quien responde muchas seguidas.
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Escribí la respuesta que va a ver el comprador…"
          rows={5}
          disabled={pending}
          aria-invalid={tooLong}
          className="resize-y"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          className={cn(
            "tabular text-xs",
            tooLong ? "text-destructive font-medium" : "text-muted-foreground",
          )}
        >
          {trimmed.length} / {ML_ANSWER_MAX_LENGTH} caracteres
          {tooLong ? " · te pasaste del máximo que acepta Mercado Libre" : ""}
        </p>

        <div className="flex items-center gap-3">
          <p className="text-muted-foreground hidden text-xs sm:block">
            Se publica en Mercado Libre y no se puede editar.
          </p>
          <Button type="submit" disabled={!canSend}>
            {pending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Enviando…
              </>
            ) : (
              <>
                <Send aria-hidden />
                Enviar respuesta
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
