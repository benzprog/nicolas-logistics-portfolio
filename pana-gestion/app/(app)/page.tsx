import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, MessageSquare, Timer } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { getQuestionMetrics, listQuestions } from "@/features/mercadolibre/questions/queries";
import { QuestionsTable } from "@/features/mercadolibre/questions/components/questions-table";
import { findConnectedAccount } from "@/features/mercadolibre/account/server/repository";
import { ConnectionStatusBanner } from "@/features/mercadolibre/account/components/connection-status-banner";
import { formatRelative } from "@/lib/time";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [metrics, connected] = await Promise.all([getQuestionMetrics(), findConnectedAccount()]);

  const oldest = await listQuestions({
    estado: "pending",
    orden: "oldest",
    pagina: 1,
    q: undefined,
    publicacion: undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Cómo viene la operación de hoy."
        actions={
          <Button asChild size="sm">
            <Link href="/mercadolibre/preguntas">Ver preguntas</Link>
          </Button>
        }
      />

      <ConnectionStatusBanner connection={connected} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pendientes"
          value={String(metrics?.pendingCount ?? 0)}
          hint={
            metrics?.oldestPendingAt
              ? `La más antigua, ${formatRelative(metrics.oldestPendingAt)}`
              : "Nada esperando respuesta"
          }
          icon={MessageSquare}
          tone={metrics && metrics.pendingCount > 0 ? "warning" : "default"}
        />

        <StatCard
          label="Esperando hace más de 24 h"
          value={String(metrics?.pendingOver24hCount ?? 0)}
          hint="Estas son las que más cuestan una venta"
          icon={AlertTriangle}
          tone={metrics && metrics.pendingOver24hCount > 0 ? "destructive" : "success"}
        />

        <StatCard
          label="Respondidas hoy"
          value={String(metrics?.answeredTodayCount ?? 0)}
          hint={`${metrics?.answered7dCount ?? 0} en los últimos 7 días`}
          icon={CheckCircle2}
          tone="success"
        />

        <StatCard
          label="Tiempo medio de respuesta"
          value={formatMinutes(metrics?.avgResponseMinutes7d ?? null)}
          hint="Últimos 7 días, respondidas desde acá"
          icon={Timer}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preguntas que esperan hace más tiempo</CardTitle>
        </CardHeader>
        <CardContent>
          {oldest.questions.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No hay nada pendiente"
              description="Cuando llegue una pregunta nueva va a aparecer acá sola."
            />
          ) : (
            <QuestionsTable
              questions={oldest.questions.slice(0, 5)}
              emptyTitle="No hay nada pendiente"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}
