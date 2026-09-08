"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Unplug } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { disconnectMercadoLibre } from "@/features/mercadolibre/account/actions";

export function DisconnectButton({ nickname }: { nickname: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          <Unplug aria-hidden />
          Desconectar
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Desconectar {nickname}?</AlertDialogTitle>
          <AlertDialogDescription>
            Deja de entrar cualquier pregunta nueva y nadie del equipo va a poder responder hasta
            que se vuelva a conectar. Las preguntas y el historial que ya están guardados no se
            borran.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(event) => {
              event.preventDefault();
              startTransition(async () => {
                const result = await disconnectMercadoLibre();
                if (result.ok) {
                  toast.success("Cuenta desconectada");
                  router.refresh();
                } else {
                  toast.error(result.error);
                }
              });
            }}
          >
            Desconectar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
