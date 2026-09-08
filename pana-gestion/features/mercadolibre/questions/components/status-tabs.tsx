"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { QuestionFilterStatus } from "@/features/mercadolibre/questions/schemas";

const TABS: { value: QuestionFilterStatus; label: string }[] = [
  { value: "pending", label: "Pendientes" },
  { value: "answered", label: "Respondidas" },
  { value: "archived", label: "Archivadas" },
  { value: "all", label: "Todas" },
];

/** Las pestañas cambian la URL: se pueden compartir y el atrás funciona. */
export function StatusTabs({ current }: { current: QuestionFilterStatus }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <Tabs
      value={current}
      onValueChange={(value) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "pending") params.delete("estado");
        else params.set("estado", value);
        params.delete("pagina");
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }}
    >
      {/* Cuatro pestañas no entran en un teléfono angosto: que se puedan
          desplazar es mejor que recortarlas. */}
      <TabsList className="max-w-full overflow-x-auto">
        {TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="px-4">
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
