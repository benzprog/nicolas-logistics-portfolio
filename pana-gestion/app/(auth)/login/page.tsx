import type { Metadata } from "next";

import { LoginForm } from "@/features/auth/components/login-form";
import { PanaMark } from "@/components/layout/pana-mark";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  const { volver } = await searchParams;
  // Solo rutas internas: si aceptáramos una URL completa tendríamos un
  // redirect abierto servido desde nuestro propio dominio.
  const redirectTo = volver && volver.startsWith("/") && !volver.startsWith("//") ? volver : "/";

  return (
    <main className="bg-muted flex min-h-svh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-6">
          <PanaMark />
          <div className="space-y-1 text-center">
            <h1 className="text-lg font-semibold tracking-tight">Entrar a PANA Gestión</h1>
            <p className="text-muted-foreground text-sm">
              Es una herramienta interna. Si no tenés usuario, pedíselo a un administrador.
            </p>
          </div>
        </div>

        <div className="border-border bg-card rounded-lg border p-6 shadow-xs">
          <LoginForm redirectTo={redirectTo} />
        </div>
      </div>
    </main>
  );
}
