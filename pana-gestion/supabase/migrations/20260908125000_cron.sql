-- ============================================================================
-- PANA Gestión — Reconciliación programada.
--
-- Por qué pg_cron y no Vercel Cron: el plan Hobby de Vercel permite un cron
-- por día, y necesitamos uno cada 5 minutos para que un webhook perdido no se
-- transforme en una pregunta sin responder. pg_cron vive en Supabase y no
-- depende del plan de Vercel.
--
-- La programación no se hace acá con valores fijos: la URL y el secreto
-- cambian por entorno y no van a git. Se corre una vez por entorno:
--
--   select public.schedule_ml_reconcile(
--     'https://gestion.pana.com.ar',
--     '<CRON_SECRET>'
--   );
-- ============================================================================

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

create or replace function public.schedule_ml_reconcile(
  p_app_url     text,
  p_cron_secret text,
  p_schedule    text default '*/5 * * * *'
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_job_name constant text := 'pana-ml-reconcile';
begin
  if p_app_url is null or p_app_url = '' then
    raise exception 'Falta la URL de la aplicación';
  end if;
  if p_cron_secret is null or length(p_cron_secret) < 16 then
    raise exception 'El CRON_SECRET tiene que tener al menos 16 caracteres';
  end if;

  -- Si ya existía, se reemplaza: correr esto dos veces no deja dos jobs.
  perform cron.unschedule(v_job_name)
  where exists (select 1 from cron.job where jobname = v_job_name);

  perform cron.schedule(
    v_job_name,
    p_schedule,
    format(
      $cmd$
      select net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', %L
        ),
        body    := '{}'::jsonb,
        timeout_milliseconds := 30000
      );
      $cmd$,
      rtrim(p_app_url, '/') || '/api/cron/mercadolibre/reconcile',
      'Bearer ' || p_cron_secret
    )
  );
end;
$$;

revoke execute on function public.schedule_ml_reconcile(text, text, text) from public, anon, authenticated;

comment on function public.schedule_ml_reconcile is
  'Programa el job de reconciliación. Correr una vez por entorno con la URL y el CRON_SECRET de ese entorno.';
