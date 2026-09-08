-- ============================================================================
-- PANA Gestión — Notificaciones de Mercado Libre.
--
-- El endpoint que las recibe hace lo mínimo: guarda el evento y responde 200.
-- Todo lo demás pasa después, leyendo esta tabla. Si el procesamiento falla,
-- el evento sigue acá y el job de reconciliación lo reintenta.
-- ============================================================================

create type public.webhook_event_status as enum (
  'received',    -- guardado, todavía sin procesar
  'processing',  -- alguien lo está trabajando
  'processed',   -- listo
  'failed',      -- falló; se reintenta hasta agotar los intentos
  'ignored'      -- no es para nosotros (otra app, otra cuenta, topic sin uso)
);

create table public.webhook_events (
  id               uuid primary key default gen_random_uuid(),
  provider         public.integration_provider not null,
  -- El `_id` que manda Mercado Libre. Es lo que hace idempotente la ingesta.
  external_id      text not null,
  topic            text not null,
  -- El recurso al que apunta, por ejemplo "/questions/5036111111".
  resource         text not null,
  ml_user_id       bigint,
  application_id   bigint,
  -- Intentos de Mercado Libre (campo `attempts` del payload), no los nuestros.
  ml_attempts      integer,
  sent_at          timestamptz,
  received_at      timestamptz not null default now(),
  payload          jsonb       not null,

  status           public.webhook_event_status not null default 'received',
  process_attempts integer     not null default 0,
  next_retry_at    timestamptz,
  processed_at     timestamptz,
  last_error       text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Si Mercado Libre manda dos veces el mismo evento, la segunda no entra.
  constraint webhook_events_external_unique unique (provider, external_id)
);

comment on table public.webhook_events is
  'Bitácora de notificaciones. El payload nunca se usa para escribir datos: solo dice qué recurso releer.';

-- Cola de trabajo del job de reconciliación.
create index webhook_events_pending_idx
  on public.webhook_events (next_retry_at nulls first)
  where status in ('received', 'failed');

create index webhook_events_received_at_idx on public.webhook_events (received_at desc);
create index webhook_events_topic_idx       on public.webhook_events (topic, received_at desc);
create index webhook_events_resource_idx    on public.webhook_events (resource);

create trigger webhook_events_set_updated_at
  before update on public.webhook_events
  for each row execute function public.set_updated_at();

alter table public.webhook_events enable row level security;

-- Es información de diagnóstico: la ve quien administra.
create policy webhook_events_select_admin
  on public.webhook_events for select
  to authenticated
  using (public.is_admin());

revoke insert, update, delete on public.webhook_events from authenticated, anon;
