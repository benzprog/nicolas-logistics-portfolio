import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Error mostrable. El detalle técnico va a los logs, no acá. */
export function ErrorState({
  title = "No pudimos cargar esta información",
  description,
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "border-destructive/30 bg-destructive-subtle flex flex-col items-center justify-center gap-3 rounded-lg border px-6 py-12 text-center",
        className,
      )}
    >
      <AlertTriangle className="text-destructive size-6" aria-hidden />
      <div className="space-y-1">
        <p className="text-destructive font-medium">{title}</p>
        {description ? (
          <p className="text-destructive/80 max-w-md text-sm text-balance">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
