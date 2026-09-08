import { cn } from "@/lib/utils";
import { formatAge, formatDateTime, hoursSince } from "@/lib/time";

/**
 * Antigüedad de una pregunta.
 *
 * El color es la información: en Mercado Libre la velocidad de respuesta pesa,
 * y una pregunta de ayer no es lo mismo que una de hace diez minutos.
 */
export function QuestionAge({ date, className }: { date: string; className?: string }) {
  const hours = hoursSince(date);

  const tone =
    hours >= 24
      ? "text-destructive font-medium"
      : hours >= 4
        ? "text-warning"
        : "text-muted-foreground";

  return (
    <span
      className={cn("tabular text-sm whitespace-nowrap", tone, className)}
      title={formatDateTime(date)}
    >
      {formatAge(date)}
    </span>
  );
}
