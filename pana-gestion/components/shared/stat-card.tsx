import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Métrica del dashboard.
 *
 * El número manda: va grande y con cifras de ancho fijo para que no baile
 * cuando cambia. El resto es contexto.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "warning" | "success" | "destructive";
}) {
  const toneClass = {
    default: "text-foreground",
    warning: "text-warning",
    success: "text-success",
    destructive: "text-destructive",
  }[tone];

  return (
    <Card className="gap-0 py-5">
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-muted-foreground text-sm">{label}</p>
          {Icon ? <Icon className="text-muted-foreground size-4" aria-hidden /> : null}
        </div>
        <p className={cn("tabular text-2xl font-semibold tracking-tight", toneClass)}>{value}</p>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
