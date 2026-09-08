import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { getCurrentUser, canAnswerQuestions } from "@/features/auth/server/session";
import { getQuestionDetail } from "@/features/mercadolibre/questions/queries";
import { ItemCard } from "@/features/mercadolibre/questions/components/item-card";
import { AnswerForm } from "@/features/mercadolibre/questions/components/answer-form";
import { ArchiveButton } from "@/features/mercadolibre/questions/components/archive-button";
import { QuestionHistory } from "@/features/mercadolibre/questions/components/question-history";
import { QuestionStatusBadge } from "@/features/mercadolibre/questions/components/question-status-badge";
import { formatDateTime, formatRelative } from "@/lib/time";

export const metadata: Metadata = { title: "Pregunta" };
export const dynamic = "force-dynamic";

export default async function PreguntaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [question, user] = await Promise.all([getQuestionDetail(id), getCurrentUser()]);
  if (!question) notFound();

  const canAnswer =
    user !== null &&
    canAnswerQuestions(user.profile.role) &&
    question.status === "pending" &&
    !question.deleted_at;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/mercadolibre/preguntas">
            <ArrowLeft aria-hidden />
            Volver a preguntas
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <QuestionStatusBadge status={question.status} hasError={Boolean(question.last_error)} />
          {canAnswer ? <ArchiveButton questionId={question.id} /> : null}
        </div>
      </div>

      <ItemCard item={question.mercadolibre_items} />

      {question.deleted_at ? (
        <div
          role="status"
          className="border-border bg-muted flex items-start gap-2 rounded-lg border px-4 py-3 text-sm"
        >
          <AlertTriangle className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="text-muted-foreground">
            Esta pregunta ya no existe en Mercado Libre. Queda acá como registro.
          </span>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pregunta del comprador</CardTitle>
          <p className="text-muted-foreground text-xs">
            {formatDateTime(question.ml_date_created)} · {formatRelative(question.ml_date_created)}
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          <blockquote className="border-brand border-l-2 pl-4 text-[15px] leading-relaxed whitespace-pre-wrap">
            {question.text}
          </blockquote>

          {question.last_error && question.status === "pending" ? (
            <div className="border-destructive/30 bg-destructive-subtle text-destructive rounded-md border px-3 py-2 text-sm">
              <span className="font-medium">El último envío falló.</span> {question.last_error}
            </div>
          ) : null}

          {canAnswer ? (
            <>
              <Separator />
              <AnswerForm questionId={question.id} />
            </>
          ) : question.status === "pending" ? (
            <p className="text-muted-foreground text-sm">
              Tu usuario es de solo lectura, así que no podés responder desde acá.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial</CardTitle>
        </CardHeader>
        <CardContent>
          <QuestionHistory answers={question.question_answers} />
        </CardContent>
      </Card>
    </div>
  );
}
