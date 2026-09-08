-- ============================================================================
-- PANA Gestión — Integraciones y cuenta de Mercado Libre.
--
-- Tres tablas en vez de una, a propósito:
--   integrations           estado que la UI muestra (genérico a futuras APIs)
--   mercadolibre_accounts  identidad de la cuenta (nada sensible)
--   mercadolibre_tokens    secretos, sin una sola policy de lectura
--
-- Separar los tokens es lo que permite decir "ningún cliente puede leerlos"
-- sin tener que armar vistas ni columnas ocultas.
-- ============================================================================

create type public.integration_provider as enum ('mercadolibre');

create type public.integration_status as enum (
  'connected',     -- funcionando
  'needs_reauth',  -- el refresh token dejó de servir: hay que reconectar a mano
  'disconnected',  -- nunca se conectó, o se desconectó a propósito
  'error'          -- falla persistente que no es de autenticación
);

-- ----------------------------------------------------------------------------
-- integrations
-- ----------------------------------------------------------------------------

create table public.integrations (
  id               uuid primary key default gen_random_uuid(),
  provider         public.integration_provider not null,
  status           public.integration_status   not null default 'disconnected',
  connected_by     uuid references public.profiles (id) on delete set null,
  connected_at     timestamptz,
  disconnected_at  timestamptz,
  -- Última reconciliación que terminó bien.
  last_sync_at     timestamptz,
  -- Último webhook recibido. Si esto se queda viejo, algo se rompió.
  last_webhook_at  timestamptz,
  last_error       text,
  settings         jsonb       not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- V1 maneja una cuenta por proveedor. El resto del modelo ya está preparado
  -- para varias: cuando llegue el momento, se cae esta restricción y nada más.
  constraint integrations_provider_unique unique (provider)
);

create trigger integrations_set_updated_at
  before update on public.integrations
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- mercadolibre_accounts
-- ----------------------------------------------------------------------------

create table public.mercadolibre_accounts (
  id             uuid primary key default gen_random_uuid(),
  integration_id uuid not null unique references public.integrations (id) on delete cascade,
  -- El id de usuario de Mercado Libre. Es la clave que llega en los webhooks.
  ml_user_id     bigint not null unique,
  nickname       text   not null,
  site_id        text   not null default 'MLA',
  email          text,
  permalink      text,
  raw            jsonb  not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger mercadolibre_accounts_set_updated_at
  before update on public.mercadolibre_accounts
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- mercadolibre_tokens
-- ----------------------------------------------------------------------------

create table public.mercadolibre_tokens (
  account_id               uuid primary key references public.mercadolibre_accounts (id) on delete cascade,
  -- Cifrados con AES-256-GCM por la aplicación (ver lib/crypto.ts).
  -- Aunque alguien lea la fila, sin la clave no tiene nada.
  access_token_enc         text        not null,
  refresh_token_enc        text        not null,
  access_token_expires_at  timestamptz not null,
  scope                    text,
  refreshed_at             timestamptz,
  -- Mercado Libre invalida el refresh token al usarlo. Si dos procesos
  -- renuevan a la vez, la cuenta se cae y hay que reconectar a mano.
  -- Este lease en la base los serializa: en Vercel no hay memoria compartida.
  refresh_lock_until       timestamptz,
  refresh_failures         integer     not null default 0,
  updated_at               timestamptz not null default now()
);

comment on table public.mercadolibre_tokens is
  'Secretos de Mercado Libre. Sin policies: solo el service role llega acá.';

create trigger mercadolibre_tokens_set_updated_at
  before update on public.mercadolibre_tokens
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

alter table public.integrations          enable row level security;
alter table public.mercadolibre_accounts enable row level security;
alter table public.mercadolibre_tokens   enable row level security;

create policy integrations_select_active_users
  on public.integrations for select
  to authenticated
  using (public.is_active_user());

create policy mercadolibre_accounts_select_active_users
  on public.mercadolibre_accounts for select
  to authenticated
  using (public.is_active_user());

-- mercadolibre_tokens no lleva ninguna policy. Con RLS activo y sin policies,
-- authenticated y anon no ven ni una fila. Es deliberado.

-- Escrituras: solo service role, después de que el código autorizó.
revoke insert, update, delete on public.integrations          from authenticated, anon;
revoke insert, update, delete on public.mercadolibre_accounts from authenticated, anon;
revoke all                    on public.mercadolibre_tokens   from authenticated, anon;
