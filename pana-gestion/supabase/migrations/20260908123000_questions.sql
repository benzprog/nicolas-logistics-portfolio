-- ============================================================================
-- PANA Gestión — Publicaciones y preguntas de Mercado Libre.
--
-- Es el corazón de V1: que no se pierda ninguna pregunta y que responderla
-- sea una sola acción, con historial.
-- ============================================================================

-- Estado interno. No es el de Mercado Libre: es el que le importa a quien
-- atiende. Un envío fallido NO saca la pregunta de "pendiente" — si la sacara,
-- desaparecería de la bandeja justo cuando más hay que responderla. El error
-- queda en `last_error` y en el historial.
create type public.question_status as enum ('pending', 'answered', 'archived');

create type public.answer_status as enum ('sending', 'sent', 'failed');

-- pana     : se respondió desde este panel
-- external : ya venía respondida de Mercado Libre (app oficial, otro sistema)
create type public.answer_source as enum ('pana', 'external');

-- ----------------------------------------------------------------------------
-- mercadolibre_items: copia local de lo mínimo de cada publicación
--
-- Evita pedirle a Mercado Libre el ítem cada vez que se abre una pregunta, y
-- es la semilla del módulo de Publicaciones.
-- ----------------------------------------------------------------------------

create table public.mercadolibre_items (
  ml_item_id         text primary key,
  account_id         uuid not null references public.mercadolibre_accounts (id) on delete cascade,
  title              text not null,
  thumbnail_url      text,
  permalink          text,
  price              numeric(14, 2),
  currency_id        text,
  available_quantity integer,
  -- Tal cual lo devuelve Mercado Libre: active, paused, closed...
  status             text,
  raw                jsonb       not null default '{}'::jsonb,
  synced_at          timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index mercadolibre_items_account_idx on public.mercadolibre_items (account_id);

create trigger mercadolibre_items_set_updated_at
  before update on public.mercadolibre_items
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- questions
-- ----------------------------------------------------------------------------

create table public.questions (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid   not null references public.mercadolibre_accounts (id) on delete cascade,
  ml_question_id  bigint not null,
  ml_item_id      text   not null references public.mercadolibre_items (ml_item_id) on delete cascade,
  ml_seller_id    bigint not null,
  ml_buyer_id     bigint,

  text            text   not null,

  status          public.question_status not null default 'pending',
  -- El estado crudo de Mercado Libre (UNANSWERED, ANSWERED, CLOSED_UNANSWERED,
  -- UNDER_REVIEW, BANNED, DELETED...). Se guarda sin traducir para no perder
  -- información si mañana aparece un estado nuevo.
  ml_status       text   not null,
  ml_date_created timestamptz not null,

  -- Respuesta vigente, desnormalizada: el listado la muestra sin un join.
  answer_text     text,
  answered_at     timestamptz,
  answered_by     uuid references public.profiles (id) on delete set null,
  answer_source   public.answer_source,

  -- Último error de envío. Se limpia cuando una respuesta sale bien.
  last_error      text,

  raw             jsonb       not null default '{}'::jsonb,
  last_synced_at  timestamptz not null default now(),
  -- Soft delete: la pregunta se borró en Mercado Libre pero el historial queda.
  deleted_at      timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- La clave de la idempotencia: el mismo evento procesado dos veces
  -- actualiza la misma fila en lugar de duplicarla.
  constraint questions_ml_unique unique (account_id, ml_question_id),

  -- Una pregunta respondida tiene que tener respuesta y fecha.
  constraint questions_answered_consistency check (
    status <> 'answered' or (answer_text is not null and answered_at is not null)
  )
);

-- El listado por defecto: pendientes de una cuenta, más viejas arriba.
create index questions_account_status_date_idx
  on public.questions (account_id, status, ml_date_created);

-- Contador del dashboard y bandeja de pendientes.
create index questions_pending_idx
  on public.questions (ml_date_created)
  where status = 'pending' and deleted_at is null;

create index questions_item_idx      on public.questions (ml_item_id);
create index questions_answered_idx  on public.questions (answered_at desc) where status = 'answered';

-- Búsqueda por texto de la pregunta, en español.
create index questions_text_search_idx
  on public.questions
  using gin (to_tsvector('spanish', text));

create trigger questions_set_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- question_answers: cada intento de respuesta
-- ----------------------------------------------------------------------------

create table public.question_answers (
  id            uuid primary key default gen_random_uuid(),
  question_id   uuid not null references public.questions (id) on delete cascade,
  text          text not null,
  status        public.answer_status not null,
  source        public.answer_source not null default 'pana',
  sent_by       uuid references public.profiles (id) on delete set null,
  sent_at       timestamptz,
  ml_response   jsonb,
  error_code    text,
  error_message text,
  created_at    timestamptz not null default now()
);

comment on table public.question_answers is
  'Historial de intentos. Un envío fallido también deja fila: es lo que permite explicar qué pasó.';

create index question_answers_question_idx on public.question_answers (question_id, created_at desc);

-- Candado de doble envío: si dos personas responden la misma pregunta al mismo
-- tiempo, la segunda choca contra este índice y recibe un mensaje claro en vez
-- de mandar dos respuestas a Mercado Libre.
create unique index question_answers_one_in_flight_idx
  on public.question_answers (question_id)
  where status = 'sending';

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

alter table public.mercadolibre_items enable row level security;
alter table public.questions          enable row level security;
alter table public.question_answers   enable row level security;

create policy mercadolibre_items_select_active_users
  on public.mercadolibre_items for select
  to authenticated
  using (public.is_active_user());

create policy questions_select_active_users
  on public.questions for select
  to authenticated
  using (public.is_active_user());

create policy question_answers_select_active_users
  on public.question_answers for select
  to authenticated
  using (public.is_active_user());

revoke insert, update, delete on public.mercadolibre_items from authenticated, anon;
revoke insert, update, delete on public.questions          from authenticated, anon;
revoke insert, update, delete on public.question_answers   from authenticated, anon;
