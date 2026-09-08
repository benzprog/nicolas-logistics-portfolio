-- ============================================================================
-- PANA Gestión — Fundación: perfiles, roles y auditoría.
--
-- Todo lo que viene después (Mercado Libre, preguntas) se apoya en esto:
-- quién es cada usuario, qué puede hacer, y cómo queda registrado lo que hizo.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Tipos
-- ----------------------------------------------------------------------------

-- admin    : conecta y desconecta integraciones, ve la auditoría.
-- operator : responde preguntas. Es el rol del día a día.
-- viewer   : solo lectura.
create type public.app_role as enum ('admin', 'operator', 'viewer');

-- ----------------------------------------------------------------------------
-- Utilidades
-- ----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at is
  'Trigger de updated_at. Se aplica a toda tabla que tenga esa columna.';

-- ----------------------------------------------------------------------------
-- profiles: la identidad de la aplicación, 1 a 1 con auth.users
-- ----------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text        not null default '',
  role        public.app_role not null default 'operator',
  -- Baja lógica: un usuario que se va deja de entrar, pero sus respuestas
  -- siguen atribuidas a él en el historial.
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Datos de aplicación de cada usuario. Se crea sola al registrarse en auth.';

create index profiles_role_idx on public.profiles (role) where is_active;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Alta automática del perfil cuando Supabase Auth crea el usuario.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Helpers de autorización
--
-- Son `security definer` porque tienen que leer profiles sin quedar atrapadas
-- en las policies de la propia tabla profiles (que las usan).
-- ----------------------------------------------------------------------------

create or replace function public.current_role_name()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.is_active
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role_name() = 'admin', false)
$$;

-- ----------------------------------------------------------------------------
-- audit_logs: append-only
-- ----------------------------------------------------------------------------

create table public.audit_logs (
  id            bigint generated always as identity primary key,
  -- user | system | webhook | cron
  actor_type    text        not null default 'user',
  actor_user_id uuid        references public.profiles (id) on delete set null,
  action        text        not null,
  entity_type   text,
  entity_id     text,
  metadata      jsonb       not null default '{}'::jsonb,
  ip            text,
  user_agent    text,
  created_at    timestamptz not null default now(),

  constraint audit_logs_actor_type_check
    check (actor_type in ('user', 'system', 'webhook', 'cron'))
);

comment on table public.audit_logs is
  'Registro de acciones importantes. Solo se inserta: no se actualiza ni se borra.';

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx     on public.audit_logs (entity_type, entity_id);
create index audit_logs_actor_idx      on public.audit_logs (actor_user_id, created_at desc);
create index audit_logs_action_idx     on public.audit_logs (action, created_at desc);

-- ----------------------------------------------------------------------------
-- RLS
--
-- Criterio general del proyecto: RLS gobierna las LECTURAS de los usuarios.
-- Las escrituras de negocio pasan por el service role, después de que el
-- código autorizó explícitamente. Así la regla de negocio vive en un solo
-- lugar (TypeScript) en vez de estar duplicada en SQL.
-- ----------------------------------------------------------------------------

alter table public.profiles   enable row level security;
alter table public.audit_logs enable row level security;

-- Todos los usuarios activos ven los perfiles: hace falta para mostrar
-- "respondida por Fulano" en el historial de una pregunta.
create policy profiles_select_active_users
  on public.profiles for select
  to authenticated
  using (public.is_active_user());

-- Cada uno puede editar su propio nombre. El rol y el alta/baja no:
-- eso se cambia desde el panel de Supabase o por un admin vía service role.
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- La auditoría es sensible: solo administradores.
create policy audit_logs_select_admin
  on public.audit_logs for select
  to authenticated
  using (public.is_admin());

-- RLS decide QUÉ FILAS se tocan, no qué columnas. Sin esto, la policy de
-- arriba dejaría que alguien se ascienda a admin editando su propia fila.
-- Los permisos por columna son el mecanismo correcto para eso.
revoke update on public.profiles from authenticated;
grant  update (full_name) on public.profiles to authenticated;

-- La auditoría no se toca desde el cliente ni siquiera para insertar:
-- si el usuario pudiera escribirla, no serviría como evidencia.
revoke insert, update, delete on public.audit_logs from authenticated, anon;
