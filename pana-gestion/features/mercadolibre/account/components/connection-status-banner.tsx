import Link from "next/link";
import { AlertTriangle, PlugZap } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ConnectedAccount } from "@/features/mercadolibre/account/server/repository";

/**
 * Aviso de estado de la conexión.
 *
 * Solo aparece cuando hay algo que hacer. Un cartel permanente de "todo bien"
 * se vuelve invisible en dos días, y entonces tampoco se ve cuando dice otra
 * cosa.
 */
export function ConnectionStatusBanner({ connection }: { connection: ConnectedAccount | null }) {
  if (connection && connection.integration.status === "connected") return null;

  const needsReauth = connection?.integration.status === "needs_reauth";

  return (
    <div
      role="status"
      className="border-warning/30 bg-warning-subtle flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2.5">
        {needsReauth ? (
          <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
        ) : (
          <PlugZap className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
        )}
        <div className="space-y-0.5 text-sm">
          <p className="text-warning font-medium">
            {needsReauth
              ? "La conexión con Mercado Libre venció"
              : "No hay ninguna cuenta de Mercado Libre conectada"}
          </p>
          <p className="text-warning/90">
            {needsReauth
              ? "Hasta que se reconecte, no entran preguntas nuevas ni se pueden enviar respuestas."
              : "Sin cuenta conectada, PANA Gestión no puede recibir preguntas."}
          </p>
        </div>
      </div>

      <Button size="sm" variant="outline" asChild className="bg-background shrink-0">
        <Link href="/mercadolibre/configuracion">
          {needsReauth ? "Reconectar" : "Conectar cuenta"}
        </Link>
      </Button>
    </div>
  );
}
