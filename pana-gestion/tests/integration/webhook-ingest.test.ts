import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";

import { createFakeSupabase, argsOf, type FakeSupabase } from "@/tests/mocks/supabase";
import { notification } from "@/tests/mocks/mercadolibre/fixtures";
import { resetServerEnvCache } from "@/lib/env";

/**
 * La ingesta de notificaciones es la puerta de entrada del sistema y está
 * abierta a internet. Estas pruebas fijan las tres reglas que la sostienen:
 * autenticar, descartar lo ajeno, y no duplicar.
 */

let supabase: FakeSupabase;
let knownAccount: { id: string; integration_id: string } | null = {
  id: "cuenta-1",
  integration_id: "integracion-1",
};

vi.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: () => supabase.client,
}));

vi.mock("@/features/mercadolibre/account/server/repository", () => ({
  findAccountByMlUserId: async () => knownAccount,
}));

const { ingestNotification, isAuthorizedWebhook } =
  await import("@/features/mercadolibre/webhooks/server/ingest");

beforeEach(() => {
  resetServerEnvCache();
  Object.assign(process.env, {
    NODE_ENV: "test",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    ML_APP_ID: "1234567890",
    ML_CLIENT_SECRET: "secreto",
    ML_REDIRECT_URI: "https://pana.test/api/mercadolibre/oauth/callback",
    ML_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    ML_WEBHOOK_TOKEN: "webhook-token-largo-de-sobra",
    OAUTH_STATE_SECRET: "un-secreto-de-al-menos-32-caracteres-largo",
    CRON_SECRET: "cron-secret-suficientemente-largo",
  });

  knownAccount = { id: "cuenta-1", integration_id: "integracion-1" };
  supabase = createFakeSupabase({
    "webhook_events.upsert": { data: { id: "evento-1" }, error: null },
  });
});

describe("autenticación del webhook", () => {
  it("acepta el token configurado", () => {
    expect(isAuthorizedWebhook("webhook-token-largo-de-sobra")).toBe(true);
  });

  it("rechaza un token distinto, vacío o ausente", () => {
    expect(isAuthorizedWebhook("otro-token")).toBe(false);
    expect(isAuthorizedWebhook("")).toBe(false);
    expect(isAuthorizedWebhook(null)).toBe(false);
  });
});

describe("ingesta de notificaciones", () => {
  it("encola una notificación legítima", async () => {
    const result = await ingestNotification(notification);

    expect(result).toEqual({ outcome: "queued", eventId: "evento-1" });

    const guardado = argsOf(supabase.on("webhook_events")[0], "upsert") as Record<string, unknown>;
    expect(guardado.external_id).toBe("evt_abc123");
    expect(guardado.topic).toBe("questions");
    expect(guardado.resource).toBe("/questions/5036111111");
    expect(guardado.status).toBe("received");
  });

  it("marca cuándo llegó la última notificación", async () => {
    await ingestNotification(notification);
    const integraciones = supabase.on("integrations")[0];
    expect(argsOf(integraciones, "update")).toHaveProperty("last_webhook_at");
  });

  it("reconoce un reintento de Mercado Libre como duplicado", async () => {
    // El upsert con ignoreDuplicates no devuelve fila cuando ya existía.
    supabase = createFakeSupabase({ "webhook_events.upsert": { data: null, error: null } });

    expect(await ingestNotification(notification)).toEqual({ outcome: "duplicate" });
  });

  it("guarda con la clave que garantiza la unicidad", async () => {
    await ingestNotification(notification);
    const opciones = supabase.on("webhook_events")[0]?.ops.find((op) => op.name === "upsert")
      ?.args[1] as Record<string, unknown>;

    expect(opciones.onConflict).toBe("provider,external_id");
    expect(opciones.ignoreDuplicates).toBe(true);
  });

  it("descarta notificaciones de otra aplicación", async () => {
    const result = await ingestNotification({ ...notification, application_id: 9999999999 });

    expect(result).toEqual({ outcome: "ignored", reason: "otra aplicación" });
    expect(supabase.on("webhook_events")).toHaveLength(0);
  });

  it("descarta topics que no manejamos", async () => {
    const result = await ingestNotification({ ...notification, topic: "orders_v2" });

    expect(result.outcome).toBe("ignored");
    expect(supabase.on("webhook_events")).toHaveLength(0);
  });

  it("descarta notificaciones de una cuenta que no es la nuestra", async () => {
    knownAccount = null;
    const result = await ingestNotification({ ...notification, user_id: 111222333 });

    expect(result).toEqual({ outcome: "ignored", reason: "cuenta desconocida" });
    expect(supabase.on("webhook_events")).toHaveLength(0);
  });

  it("rechaza un cuerpo con forma inesperada", async () => {
    expect((await ingestNotification({ hola: "mundo" })).outcome).toBe("rejected");
    expect((await ingestNotification(null)).outcome).toBe("rejected");
    expect((await ingestNotification({ ...notification, _id: "" })).outcome).toBe("rejected");
  });

  it("acepta una notificación sin application_id", async () => {
    // Es opcional en el payload: no podemos descartar por lo que no vino.
    const { application_id: _omitido, ...sinAppId } = notification;
    expect((await ingestNotification(sinAppId)).outcome).toBe("queued");
  });

  it("informa el fallo si la base rechaza el guardado", async () => {
    supabase = createFakeSupabase({
      "webhook_events.upsert": { data: null, error: { message: "conexión perdida" } },
    });

    expect((await ingestNotification(notification)).outcome).toBe("rejected");
  });
});
