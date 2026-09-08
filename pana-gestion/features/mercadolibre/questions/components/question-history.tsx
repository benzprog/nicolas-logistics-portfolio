import { CheckCircle2, Clock, XCircle } from "lucide-react";

import { formatDateTime } from "@/lib/time";
import type { QuestionDetail } from "@/features/mercadolibre/questions/queries";

/**
 * Historial de intentos.
 *
 * Muestra también los fallidos, y a propósito: cuando alguien pregunta "¿por
 * qué esta pregunta sigue sin responder si yo la contesté?", la respuesta está
 * acá.
 */
export function QuestionHistory({ answers }: { answers: QuestionDetail["question_answers"] }) {
  if (!answers || answers.length === 0) {
    return <p className="text-muted-foreground text-sm">Todavía no hubo intentos de respuesta.</p>;
  }

  return (
    <ol className="space-y-4">
      {answers.map((answer) => {
        const icon =
          answer.status === "sent" ? (
            <CheckCircle2 className="text-success size-4" aria-hidden />
          ) : answer.status === "failed" ? (
            <XCircle className="text-destructive size-4" aria-hidden />
          ) : (
            <Clock className="text-warning size-4" aria-hidden />
          );

        const author =
          answer.source === "external"
            ? "Respondida desde Mercado Libre"
            : (answer.profiles?.full_name ?? "Usuario eliminado");

        return (
          <li key={answer.id} className="flex gap-3">
            <span className="mt-0.5 shrink-0">{icon}</span>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-medium">{author}</span>
                <span className="text-muted-foreground text-xs">
                  {formatDateTime(answer.sent_at ?? answer.created_at)}
                </span>
                {answer.status === "failed" ? (
                  <span className="text-destructive text-xs font-medium">no se envió</span>
                ) : null}
                {answer.status === "sending" ? (
                  <span className="text-warning text-xs font-medium">enviando…</span>
                ) : null}
              </div>

              <p className="text-foreground/90 text-sm whitespace-pre-wrap">{answer.text}</p>

              {answer.error_message ? (
                <p className="bg-destructive-subtle text-destructive rounded-md px-2 py-1 text-xs">
                  {answer.error_message}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
