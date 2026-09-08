"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";

/**
 * Último recurso ante un error no controlado.
 *
 * Nunca muestra el mensaje técnico: el `digest` alcanza para encontrar el
 * error en los logs del servidor sin exponerle nada a quien lo ve.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-md">
        <ErrorState
          title="Algo salió mal"
          description={
            error.digest
              ? `Ya quedó registrado. Si hace falta reportarlo, el código es ${error.digest}.`
              : "Ya quedó registrado. Probá de nuevo en un momento."
          }
          action={
            <Button onClick={reset} variant="outline" size="sm">
              Reintentar
            </Button>
          }
        />
      </div>
    </div>
  );
}
