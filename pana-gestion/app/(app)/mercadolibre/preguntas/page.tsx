import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { QuestionsTable } from "@/features/mercadolibre/questions/components/questions-table";
import { QuestionsFilters } from "@/features/mercadolibre/questions/components/questions-filters";
import { QuestionsPagination } from "@/features/mercadolibre/questions/components/questions-pagination";
import { SyncButton } from "@/features/mercadolibre/questions/components/sync-button";
import { questionFiltersSchema } from "@/features/mercadolibre/questions/schemas";
import { listItemsWithQuestions, listQuestions } from "@/features/mercadolibre/questions/queries";
import { StatusTabs } from "@/features/mercadolibre/questions/components/status-tabs";

export const metadata: Metadata = { title: "Preguntas" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PreguntasPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const filters = questionFiltersSchema.parse(raw);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Preguntas"
        description="Todo lo que preguntan los compradores en Mercado Libre, en un solo lugar."
        actions={<SyncButton />}
      />

      <StatusTabs current={filters.estado} />

      <Suspense fallback={<FiltersSkeleton />}>
        <FiltersSlot />
      </Suspense>

      <Suspense key={JSON.stringify(filters)} fallback={<TableSkeleton />}>
        <QuestionsSlot filters={filters} />
      </Suspense>
    </div>
  );
}

async function FiltersSlot() {
  const items = await listItemsWithQuestions();
  return <QuestionsFilters items={items} />;
}

async function QuestionsSlot({
  filters,
}: {
  filters: ReturnType<typeof questionFiltersSchema.parse>;
}) {
  const { questions, total, page, pageCount } = await listQuestions(filters);

  const empty = emptyCopy(filters.estado, Boolean(filters.q || filters.publicacion));

  return (
    <div className="space-y-4">
      <QuestionsTable
        questions={questions}
        emptyTitle={empty.title}
        emptyDescription={empty.description}
      />
      <QuestionsPagination page={page} pageCount={pageCount} total={total} />
    </div>
  );
}

function emptyCopy(estado: string, filtered: boolean): { title: string; description?: string } {
  if (filtered) {
    return {
      title: "No hay preguntas con esos filtros",
      description: "Probá con otro texto o sacá el filtro de publicación.",
    };
  }

  switch (estado) {
    case "pending":
      return {
        title: "No hay preguntas pendientes",
        description: "Está todo respondido. Las nuevas van a aparecer acá solas.",
      };
    case "answered":
      return { title: "Todavía no respondiste ninguna pregunta desde acá" };
    case "archived":
      return { title: "No hay preguntas archivadas" };
    default:
      return { title: "Todavía no llegó ninguna pregunta" };
  }
}

function FiltersSkeleton() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Skeleton className="h-9 w-full sm:max-w-xs" />
      <Skeleton className="h-9 w-full sm:w-64" />
      <Skeleton className="h-9 w-full sm:w-44" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="border-border space-y-3 rounded-lg border p-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-4">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-48 md:block" />
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export const dynamic = "force-dynamic";
