import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Estado vacío.
 *
 * Un vacío puede ser una buena noticia (no hay preguntas sin responder) o un
 * callejón (el filtro no encontró nada). El texto lo decide quien lo usa.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-full">
          <Icon className="size-5" aria-hidden />
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description ? (
          <p className="text-muted-foreground max-w-md text-sm text-balance">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
