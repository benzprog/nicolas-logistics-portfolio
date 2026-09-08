import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ExternalLink, PlugZap, RefreshCw, XCircle } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getCurrentUser, canManageIntegrations } from "@/features/auth/server/session";
import { findConnectedAccount } from "@/features/mercadolibre/account/server/repository";
import { getWebhookHealth } from "@/features/mercadolibre/account/queries";
import { DisconnectButton } from "@/features/mercadolibre/account/components/disconnect-button";
import { formatDateTime, formatRelative } from "@/lib/time";
import type { Enums } from "@/types/database.types";

export const metadata: Metadata = { title: "Configuración de Mercado Libre" };
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<Enums<"integration_status">, string> = {
  connected: "Conectada",
  needs_reauth: "Hay que reconectar",
  disconnected: "Desconectada",
  error: "Con problemas",
};

const ERROR_MESSAGES: Record<string, string> = {
  permisos: "Solo un administrador puede conectar la cuenta.",
  cancelado: "Se canceló la autorización en Mercado Libre.",
  respuesta_incompleta: "Mercado Libre devolvió una respuesta incompleta. Probá de nuevo.",
  estado_invalido:
    "La conexión venció o se abrió desde otra pestaña. Volvé a empezar desde este botón.",
  conexion: "No se pudo completar la conexión. Revisá los datos de la aplicación y probá de nuevo.",
  configuracion: "Faltan variables de entorno para conectar con Mercado Libre.",
};

export default async function MercadoLibreConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; conectado?: string }>;
}) {
  const [params, user, connection, webhooks] = await Promise.all([
    searchParams,
    getCurrentUser(),
    findConnectedAccount(),
    getWebhookHealth(),
  ]);

  const isAdmin = user !== null && canManageIntegrations(user.profile.role);
  const status = connection?.integration.status ?? "disconnected";
  const connected = status === "connected";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mercado Libre"
        description="Estado de la conexión, sincronización y notificaciones."
      />

      {params.error ? (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive-subtle text-destructive rounded-lg border px-4 py-3 text-sm"
        >
          {ERROR_MESSAGES[params.error] ?? "No se pudo completar la operación."}
        </div>
      ) : null}

      {params.conectado ? (
        <div
          role="status"
          className="border-success/30 bg-success-subtle text-success rounded-lg border px-4 py-3 text-sm"
        >
          {params.conectado === "reconectada"
            ? "Cuenta reconectada. Las preguntas vuelven a entrar."
            : "Cuenta conectada. Estamos importando las preguntas sin responder."}
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">Cuenta conectada</CardTitle>
            <p className="text-muted-foreground text-sm">
              La cuenta desde la que se leen y responden las preguntas.
            </p>
          </div>
          <Badge
            variant={connected ? "success" : status === "disconnected" ? "secondary" : "warning"}
          >
            {STATUS_LABELS[status]}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-5">
          {connection ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Usuario de Mercado Libre">
                <span className="font-medium">{connection.account.nickname}</span>
                {connection.account.permalink ? (
                  <a
                    href={connection.account.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground ml-2 inline-flex items-center gap-1 text-xs hover:underline"
                  >
                    ver perfil
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : null}
              </Field>

              <Field label="ID de vendedor">
                <span className="tabular font-mono text-sm">{connection.account.ml_user_id}</span>
              </Field>

              <Field label="Conectada">
                {connection.integration.connected_at
                  ? formatDateTime(connection.integration.connected_at)
                  : "—"}
              </Field>

              <Field label="Última sincronización">
                {connection.integration.last_sync_at ? (
                  <span title={formatDateTime(connection.integration.last_sync_at)}>
                    {formatRelative(connection.integration.last_sync_at)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Todavía no corrió</span>
                )}
              </Field>
            </dl>
          ) : (
            <p className="text-muted-foreground text-sm">
              Todavía no hay ninguna cuenta conectada. Sin esto, PANA Gestión no recibe preguntas.
            </p>
          )}

          {connection?.integration.last_error ? (
            <p className="bg-destructive-subtle text-destructive rounded-md px-3 py-2 text-sm">
              {connection.integration.last_error}
            </p>
          ) : null}

          <Separator />

          {isAdmin ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="sm">
                {/* Es una navegación con efecto: arranca el flujo OAuth del lado del servidor. */}
                <a href="/api/mercadolibre/oauth/start">
                  {connected ? <RefreshCw aria-hidden /> : <PlugZap aria-hidden />}
                  {connected
                    ? "Volver a autorizar"
                    : status === "needs_reauth"
                      ? "Reconectar"
                      : "Conectar cuenta"}
                </a>
              </Button>

              {connection && status !== "disconnected" ? (
                <DisconnectButton nickname={connection.account.nickname} />
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Conectar o desconectar la cuenta lo hace un administrador.
            </p>
          )}
        </CardContent>
      </Card>

      {webhooks ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notificaciones</CardTitle>
            <p className="text-muted-foreground text-sm">
              Mercado Libre nos avisa apenas entra una pregunta. Cada 5 minutos, además, se revisa
              que no falte nada.
            </p>
          </CardHeader>

          <CardContent className="space-y-4">
            <dl className="grid gap-4 sm:grid-cols-3">
              <Field label="Última notificación">
                {webhooks.lastReceivedAt ? (
                  <span title={formatDateTime(webhooks.lastReceivedAt)}>
                    {formatRelative(webhooks.lastReceivedAt)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Ninguna todavía</span>
                )}
              </Field>

              <Field label="Procesadas (24 h)">
                <span className="tabular">{webhooks.processedLast24h}</span>
              </Field>

              <Field label="Con error">
                <span className="tabular flex items-center gap-1.5">
                  {webhooks.failed === 0 ? (
                    <>
                      <CheckCircle2 className="text-success size-4" aria-hidden />
                      Ninguna
                    </>
                  ) : (
                    <>
                      <XCircle className="text-destructive size-4" aria-hidden />
                      {webhooks.failed}
                    </>
                  )}
                </span>
              </Field>
            </dl>

            {webhooks.recentFailures.length > 0 ? (
              <ul className="bg-muted space-y-2 rounded-md p-3 text-xs">
                {webhooks.recentFailures.map((failure) => (
                  <li key={failure.id} className="flex flex-col gap-0.5">
                    <span className="font-mono">{failure.resource}</span>
                    <span className="text-muted-foreground">{failure.last_error}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <p className="text-muted-foreground text-sm">
        ¿Buscabas responder preguntas?{" "}
        <Link href="/mercadolibre/preguntas" className="underline underline-offset-4">
          Ir a preguntas
        </Link>
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground text-xs tracking-wide uppercase">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
