import { Badge } from "@/components/ui/badge";
import type { Enums } from "@/types/database.types";

const LABELS: Record<Enums<"question_status">, string> = {
  pending: "Pendiente",
  answered: "Respondida",
  archived: "Archivada",
};

const VARIANTS: Record<Enums<"question_status">, "warning" | "success" | "secondary"> = {
  pending: "warning",
  answered: "success",
  archived: "secondary",
};

export function QuestionStatusBadge({
  status,
  hasError,
}: {
  status: Enums<"question_status">;
  hasError?: boolean;
}) {
  // Un envío fallido no cambia el estado (sigue pendiente), pero tiene que
  // notarse: es una pregunta que alguien intentó responder y no salió.
  if (hasError && status === "pending") {
    return <Badge variant="destructive">Falló el envío</Badge>;
  }

  return <Badge variant={VARIANTS[status]}>{LABELS[status]}</Badge>;
}
