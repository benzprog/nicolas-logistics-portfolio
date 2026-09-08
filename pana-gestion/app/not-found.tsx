import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-muted-foreground text-sm tracking-widest uppercase">Error 404</p>
      <h1 className="text-xl font-semibold">No encontramos esta página</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        Puede que el enlace esté viejo o que la pregunta que buscabas se haya archivado.
      </p>
      <Button asChild size="sm">
        <Link href="/">Ir al dashboard</Link>
      </Button>
    </div>
  );
}
