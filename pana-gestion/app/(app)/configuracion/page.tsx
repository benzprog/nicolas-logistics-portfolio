import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser, ROLE_LABELS } from "@/features/auth/server/session";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Configuración" };
export const dynamic = "force-dynamic";

const PERMISSIONS: Record<string, string[]> = {
  admin: [
    "Responder y archivar preguntas",
    "Conectar y desconectar Mercado Libre",
    "Ver el registro de auditoría y el estado de las notificaciones",
  ],
  operator: ["Responder y archivar preguntas", "Ver el estado de la conexión"],
  viewer: ["Ver preguntas y respuestas"],
};

export default async function ConfiguracionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <PageHeader title="Configuración" description="Tu usuario y qué podés hacer." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tu cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-muted-foreground text-xs tracking-wide uppercase">Nombre</dt>
              <dd className="text-sm font-medium">{user.profile.full_name || "—"}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-muted-foreground text-xs tracking-wide uppercase">Email</dt>
              <dd className="text-sm">{user.email ?? "—"}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-muted-foreground text-xs tracking-wide uppercase">Rol</dt>
              <dd>
                <Badge variant="secondary">{ROLE_LABELS[user.profile.role]}</Badge>
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                Usuario desde
              </dt>
              <dd className="text-sm">{formatDateTime(user.profile.created_at)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Qué podés hacer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-1.5 text-sm">
            {(PERMISSIONS[user.profile.role] ?? []).map((permission) => (
              <li key={permission} className="flex gap-2">
                <span aria-hidden className="text-muted-foreground">
                  •
                </span>
                {permission}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-sm">
            Los usuarios y los roles los administra un administrador desde Supabase. Si necesitás
            otro permiso, pedíselo.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integraciones</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            <Link href="/mercadolibre/configuracion" className="underline underline-offset-4">
              Mercado Libre
            </Link>{" "}
            <span className="text-muted-foreground">
              — estado de la conexión, sincronización y notificaciones.
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
