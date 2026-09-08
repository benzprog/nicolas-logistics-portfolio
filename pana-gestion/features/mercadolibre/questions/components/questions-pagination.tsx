"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function QuestionsPagination({
  page,
  pageCount,
  total,
}: {
  page: number;
  pageCount: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pageCount <= 1) {
    return (
      <p className="tabular text-muted-foreground text-sm">
        {total === 0 ? "Sin resultados" : `${total} ${total === 1 ? "pregunta" : "preguntas"}`}
      </p>
    );
  }

  const goTo = (target: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (target <= 1) params.delete("pagina");
    else params.set("pagina", String(target));
    router.replace(`${pathname}?${params.toString()}`, { scroll: true });
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="tabular text-muted-foreground text-sm">
        Página {page} de {pageCount} · {total} preguntas
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goTo(page - 1)}>
          <ChevronLeft aria-hidden />
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => goTo(page + 1)}
        >
          Siguiente
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}
