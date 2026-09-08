import Link from "next/link";
import { MessageSquare } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { QuestionStatusBadge } from "@/features/mercadolibre/questions/components/question-status-badge";
import { QuestionAge } from "@/features/mercadolibre/questions/components/question-age";
import type { QuestionListItem } from "@/features/mercadolibre/questions/queries";

/**
 * Listado de preguntas.
 *
 * Se lee de izquierda a derecha en el orden en que importa: qué preguntaron,
 * sobre qué publicación, hace cuánto y en qué estado está.
 */
export function QuestionsTable({
  questions,
  emptyTitle,
  emptyDescription,
}: {
  questions: QuestionListItem[];
  emptyTitle: string;
  emptyDescription?: string;
}) {
  if (questions.length === 0) {
    return <EmptyState icon={MessageSquare} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-[45%]">Pregunta</TableHead>
            <TableHead className="hidden md:table-cell">Publicación</TableHead>
            <TableHead className="w-24">Antigüedad</TableHead>
            <TableHead className="w-32">Estado</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {questions.map((question) => (
            <TableRow key={question.id} className="group relative">
              <TableCell className="align-top">
                <Link
                  href={`/mercadolibre/preguntas/${question.id}`}
                  className="block space-y-1 outline-none"
                >
                  {/* El área de click cubre toda la fila sin anidar enlaces. */}
                  <span className="absolute inset-0 z-0" aria-hidden />
                  <span className="line-clamp-2 font-medium group-hover:underline">
                    {question.text}
                  </span>
                  {question.answer_text ? (
                    <span className="text-muted-foreground line-clamp-1 text-xs">
                      Respuesta: {question.answer_text}
                    </span>
                  ) : null}
                </Link>
              </TableCell>

              <TableCell className="hidden max-w-64 align-top md:table-cell">
                <span className="text-muted-foreground line-clamp-2 text-sm">
                  {question.mercadolibre_items?.title ?? question.ml_item_id}
                </span>
              </TableCell>

              <TableCell className="align-top">
                <QuestionAge date={question.ml_date_created} />
              </TableCell>

              <TableCell className="align-top">
                <QuestionStatusBadge
                  status={question.status}
                  hasError={Boolean(question.last_error)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
