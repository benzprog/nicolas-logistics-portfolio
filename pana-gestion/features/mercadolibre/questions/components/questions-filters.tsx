"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ItemOption = { id: string; title: string; count: number };

/**
 * Filtros del listado.
 *
 * Todo vive en la URL: así un filtro se puede compartir por chat, el botón de
 * atrás funciona como se espera, y el servidor puede renderizar la página ya
 * filtrada sin un ida y vuelta más.
 */
export function QuestionsFilters({ items }: { items: ItemOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [term, setTerm] = useState(searchParams.get("q") ?? "");
  const firstRender = useRef(true);

  const update = (changes: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === "") params.delete(key);
      else params.set(key, value);
    }
    // Cambiar un filtro y quedarse en la página 7 muestra una lista vacía.
    params.delete("pagina");
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  };

  // La búsqueda espera a que la persona deje de escribir.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if ((searchParams.get("q") ?? "") !== term) update({ q: term || undefined });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const publicacion = searchParams.get("publicacion") ?? "todas";
  const orden = searchParams.get("orden") ?? "oldest";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center" data-pending={pending}>
      <div className="relative flex-1 sm:max-w-xs">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Buscar en preguntas y respuestas"
          className="pl-8"
          aria-label="Buscar preguntas"
        />
        {term ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
            onClick={() => setTerm("")}
            aria-label="Limpiar búsqueda"
          >
            <X className="size-3.5" />
          </Button>
        ) : null}
      </div>

      <Select
        value={publicacion}
        onValueChange={(value) => update({ publicacion: value === "todas" ? undefined : value })}
      >
        <SelectTrigger className="w-full sm:w-64" aria-label="Filtrar por publicación">
          <SelectValue placeholder="Todas las publicaciones" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas las publicaciones</SelectItem>
          {items.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              <span className="block max-w-56 truncate">{item.title}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={orden} onValueChange={(value) => update({ orden: value })}>
        <SelectTrigger className="w-full sm:w-44" aria-label="Ordenar">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="oldest">Más antiguas primero</SelectItem>
          <SelectItem value="newest">Más recientes primero</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
