/**
 * Supabase simulado para las pruebas end-to-end.
 *
 * Responde con la forma exacta que devuelven PostgREST y GoTrue, así la
 * aplicación corre entera —middleware, sesión, Server Components, RLS del lado
 * del cliente de Supabase— sin necesidad de un proyecto real ni de Docker.
 *
 * Lo que NO prueba: si las consultas son válidas contra el esquema. De eso se
 * ocupa scripts/check-migrations.sh, que corre SQL de verdad.
 */
import { createServer } from "node:http";

export const USUARIO_ID = "11111111-1111-1111-1111-111111111111";

const hace = (horas) => new Date(Date.now() - horas * 3_600_000).toISOString();

const perfil = {
  id: USUARIO_ID,
  full_name: "Ana Benítez",
  role: "admin",
  is_active: true,
  created_at: hace(2400),
  updated_at: hace(24),
};

const publicacion = {
  ml_item_id: "MLA123456789",
  title: "Lámpara LED 9W E27 luz fría — pack x10",
  thumbnail_url: null,
  permalink: "https://articulo.mercadolibre.com.ar/MLA-123456789",
  price: 3500,
  currency_id: "ARS",
  available_quantity: 42,
};

const publicacion2 = {
  ...publicacion,
  ml_item_id: "MLA987654321",
  title: "Panel LED embutir 18W cuadrado",
  price: 12800,
  available_quantity: 0,
};

const base = {
  account_id: "c1",
  ml_seller_id: 987654321,
  raw: {},
  deleted_at: null,
  answered_by: null,
  answer_source: null,
  answer_text: null,
  answered_at: null,
  last_error: null,
};

export const PREGUNTAS = [
  {
    ...base,
    id: "q1",
    ml_question_id: 5036111111,
    ml_item_id: "MLA123456789",
    ml_buyer_id: 555000111,
    text: "Hola, ¿tienen stock en luz cálida? Necesito 20 unidades para una obra.",
    status: "pending",
    ml_status: "UNANSWERED",
    ml_date_created: hace(31),
    last_synced_at: hace(1),
    created_at: hace(31),
    updated_at: hace(1),
    mercadolibre_items: publicacion,
  },
  {
    ...base,
    id: "q2",
    ml_question_id: 5036222222,
    ml_item_id: "MLA987654321",
    ml_buyer_id: 555000222,
    text: "¿Hacen envío a Córdoba capital?",
    status: "pending",
    ml_status: "UNANSWERED",
    ml_date_created: hace(6),
    last_synced_at: hace(1),
    created_at: hace(6),
    updated_at: hace(1),
    mercadolibre_items: publicacion2,
  },
  {
    ...base,
    id: "q3",
    ml_question_id: 5036333333,
    ml_item_id: "MLA123456789",
    ml_buyer_id: 555000333,
    text: "¿El pack viene con garantía?",
    status: "pending",
    ml_status: "UNANSWERED",
    ml_date_created: hace(2),
    last_error: "Mercado Libre no respondió a tiempo",
    last_synced_at: hace(1),
    created_at: hace(2),
    updated_at: hace(1),
    mercadolibre_items: publicacion,
  },
  {
    ...base,
    id: "q4",
    ml_question_id: 5036444444,
    ml_item_id: "MLA123456789",
    ml_buyer_id: 555000444,
    text: "¿Sirve para exterior?",
    status: "answered",
    ml_status: "ANSWERED",
    ml_date_created: hace(28),
    answer_text: "Hola! No, este modelo es de interior. Para exterior tenemos la línea IP65.",
    answered_at: hace(27),
    answered_by: USUARIO_ID,
    answer_source: "pana",
    last_synced_at: hace(1),
    created_at: hace(28),
    updated_at: hace(27),
    mercadolibre_items: publicacion,
  },
];

const HISTORIAL = [
  {
    id: "a2",
    question_id: "q1",
    text: "Hola! Sí, tenemos stock en luz cálida. Por 20 unidades te hacemos precio.",
    status: "sent",
    source: "pana",
    sent_by: USUARIO_ID,
    sent_at: hace(0.5),
    ml_response: {},
    error_code: null,
    error_message: null,
    created_at: hace(0.5),
    profiles: { id: USUARIO_ID, full_name: perfil.full_name },
  },
  {
    id: "a1",
    question_id: "q1",
    text: "Hola! Sí, tenemos stock en luz cálida.",
    status: "failed",
    source: "pana",
    sent_by: USUARIO_ID,
    sent_at: null,
    ml_response: null,
    error_code: "ml_unavailable",
    error_message: "Mercado Libre no respondió a tiempo",
    created_at: hace(1),
    profiles: { id: USUARIO_ID, full_name: perfil.full_name },
  },
];

const integracion = {
  id: "i1",
  provider: "mercadolibre",
  status: "connected",
  connected_by: USUARIO_ID,
  connected_at: hace(240),
  disconnected_at: null,
  last_sync_at: hace(0.05),
  last_webhook_at: hace(0.2),
  last_error: null,
  settings: {},
  created_at: hace(240),
  updated_at: hace(0.05),
  mercadolibre_accounts: [
    {
      id: "c1",
      integration_id: "i1",
      ml_user_id: 987654321,
      nickname: "PANAILUMINACION",
      site_id: "MLA",
      email: "ventas@pana.com.ar",
      permalink: "https://perfil.mercadolibre.com.ar/PANAILUMINACION",
      raw: {},
      created_at: hace(240),
      updated_at: hace(240),
    },
  ],
};

const metricas = [
  {
    pending_count: 3,
    pending_over_24h_count: 1,
    answered_today_count: 1,
    answered_7d_count: 12,
    avg_response_minutes_7d: 47.5,
    oldest_pending_at: hace(31),
  },
];

/** Levanta el simulador. Devuelve una función para apagarlo. */
export function startSupabaseStub(port = 54400) {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://stub");

    const enviar = (cuerpo, extra = {}) => {
      res.writeHead(200, { "content-type": "application/json", ...extra });
      res.end(JSON.stringify(cuerpo));
    };

    if (url.pathname.startsWith("/auth/v1/user")) {
      return enviar({
        id: USUARIO_ID,
        email: "ana@pana.com.ar",
        aud: "authenticated",
        role: "authenticated",
        app_metadata: {},
        user_metadata: {},
        created_at: perfil.created_at,
      });
    }
    if (url.pathname.startsWith("/auth/v1")) return enviar({});

    if (url.pathname === "/rest/v1/rpc/question_metrics") return enviar(metricas);
    if (url.pathname === "/rest/v1/profiles") return enviar([perfil]);
    if (url.pathname === "/rest/v1/integrations") return enviar([integracion]);
    if (url.pathname === "/rest/v1/webhook_events") return enviar([]);

    if (url.pathname === "/rest/v1/questions") {
      const id = (url.searchParams.get("id") ?? "").replace("eq.", "");
      const estado = (url.searchParams.get("status") ?? "").replace("eq.", "");

      if (id) {
        const una = PREGUNTAS.filter((q) => q.id === id).map((q) => ({
          ...q,
          question_answers: HISTORIAL.filter((a) => a.question_id === q.id),
          answered_by_profile: q.answered_by
            ? { id: USUARIO_ID, full_name: perfil.full_name }
            : null,
        }));
        return enviar(una, { "content-range": `0-0/${una.length}` });
      }

      const lista = estado ? PREGUNTAS.filter((q) => q.status === estado) : PREGUNTAS;

      if (req.method === "HEAD") {
        res.writeHead(200, { "content-range": `0-0/${lista.length}` });
        return res.end();
      }
      return enviar(lista, {
        "content-range": `0-${Math.max(0, lista.length - 1)}/${lista.length}`,
      });
    }

    return enviar([]);
  });

  return new Promise((resolve) => {
    server.listen(port, () => resolve(() => new Promise((r) => server.close(() => r()))));
  });
}

// Permite correrlo suelto: node tests/e2e/supabase-stub.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  await startSupabaseStub();
  console.log("Supabase simulado escuchando en 54400");
}
