-- ============================================================================
-- Arnés de pruebas de base de datos.
--
-- Simula lo mínimo que aporta Supabase (schema auth, auth.uid(), los tres
-- roles y sus grants por defecto) para poder correr las migraciones y sus
-- pruebas contra un PostgreSQL común, sin Docker.
--
-- Con Docker disponible, `supabase db reset` es la opción fiel. Esto existe
-- para CI y para poder validar el modelo en cualquier máquina.
-- ============================================================================

create extension if not exists "pgcrypto";

create schema if not exists auth;
create schema if not exists extensions;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon')
    then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated')
    then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role')
    then create role service_role nologin bypassrls; end if;
end $$;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- En Supabase esto sale del JWT. Acá lo simulamos con una variable de sesión.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema public, auth to anon, authenticated, service_role;

-- Supabase le da a anon y authenticated los mismos grants sobre las tablas
-- nuevas del schema public. Replicarlo importa: si acá le diéramos menos,
-- las pruebas de RLS pasarían por el motivo equivocado.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Aserciones
-- ---------------------------------------------------------------------------

create schema if not exists t;

create table if not exists t.results (
  id     serial primary key,
  name   text    not null,
  passed boolean not null,
  detail text    not null default ''
);

/**
 * Registra el resultado de una condición.
 *
 * Es `security definer` porque las pruebas corren haciéndose pasar por roles
 * que, justamente, no tienen permiso de escribir: si no, anotar el resultado
 * fallaría por el mismo motivo que la prueba quiere verificar.
 */
create or replace function t.check(p_name text, p_passed boolean, p_detail text default '')
returns void language sql security definer set search_path = t, public as $$
  insert into t.results (name, passed, detail) values (p_name, coalesce(p_passed, false), p_detail);
$$;

/**
 * Comprueba que una sentencia falle, y que falle por el motivo esperado.
 * Sin esto es fácil escribir una prueba que "pasa" porque la sentencia falló
 * por un error de tipeo en vez de por la regla de seguridad.
 *
 * Esta NO es `security definer`, y es a propósito: la sentencia tiene que
 * ejecutarse con los permisos de quien llama, que es lo que se está probando.
 */
create or replace function t.check_rejects(
  p_name text,
  p_sql text,
  p_expected_sqlstate text
)
returns void
language plpgsql
security invoker
as $$
begin
  execute p_sql;
  perform t.check(p_name, false, 'no falló: la operación fue permitida');
exception
  when others then
    if sqlstate = p_expected_sqlstate then
      perform t.check(p_name, true, sqlstate || ' ' || left(sqlerrm, 60));
    else
      perform t.check(p_name, false, 'falló por otro motivo: ' || sqlstate || ' ' || left(sqlerrm, 60));
    end if;
end;
$$;

-- Los roles simulados tienen que poder llamar a las aserciones.
grant usage on schema t to anon, authenticated, service_role;
grant execute on function t.check(text, boolean, text) to anon, authenticated, service_role;
grant execute on function t.check_rejects(text, text, text) to anon, authenticated, service_role;
