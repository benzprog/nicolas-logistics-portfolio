-- ============================================================================
-- PANA Gestión — Operaciones atómicas y métricas de preguntas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Cerrar una respuesta exitosa.
--
-- Marcar el intento como enviado y la pregunta como respondida tienen que
-- pasar juntos o no pasar. Si quedaran en dos llamadas separadas y el proceso
-- muriera en el medio, la pregunta se vería pendiente con una respuesta ya
-- publicada en Mercado Libre.
-- ----------------------------------------------------------------------------

create or replace function public.mark_question_answered(
  p_answer_id   uuid,
  p_ml_response jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_answer public.question_answers%rowtype;
begin
  update public.question_answers
     set status      = 'sent',
         sent_at     = now(),
         ml_response = p_ml_response
   where id = p_answer_id
     and status = 'sending'
  returning * into v_answer;

  if not found then
    raise exception 'No hay un envío en curso con id %', p_answer_id
      using errcode = 'no_data_found';
  end if;

  update public.questions
     set status        = 'answered',
         answer_text   = v_answer.text,
         answered_at   = coalesce(v_answer.sent_at, now()),
         answered_by   = v_answer.sent_by,
         answer_source = v_answer.source,
         last_error    = null
   where id = v_answer.question_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Cerrar un intento fallido.
-- ----------------------------------------------------------------------------

create or replace function public.mark_answer_failed(
  p_answer_id     uuid,
  p_error_code    text,
  p_error_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question_id uuid;
begin
  update public.question_answers
     set status        = 'failed',
         error_code    = p_error_code,
         error_message = p_error_message
   where id = p_answer_id
     and status = 'sending'
  returning question_id into v_question_id;

  if v_question_id is not null then
    update public.questions
       set last_error = p_error_message
     where id = v_question_id;
  end if;
end;
$$;

-- Estas dos las llama el servidor con el service role. Que nadie más pueda.
revoke execute on function public.mark_question_answered(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.mark_answer_failed(uuid, text, text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Métricas del dashboard.
--
-- Es `security invoker`: corre con los permisos de quien la llama, así que las
-- policies de RLS siguen aplicando. Una sola consulta en vez de cinco.
-- ----------------------------------------------------------------------------

create or replace function public.question_metrics()
returns table (
  pending_count            bigint,
  pending_over_24h_count   bigint,
  answered_today_count     bigint,
  answered_7d_count        bigint,
  avg_response_minutes_7d  numeric,
  oldest_pending_at        timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*) filter (
      where q.status = 'pending' and q.deleted_at is null
    ) as pending_count,

    count(*) filter (
      where q.status = 'pending' and q.deleted_at is null
        and q.ml_date_created < now() - interval '24 hours'
    ) as pending_over_24h_count,

    count(*) filter (
      where q.status = 'answered'
        and q.answered_at >= date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires')
              at time zone 'America/Argentina/Buenos_Aires'
    ) as answered_today_count,

    count(*) filter (
      where q.status = 'answered' and q.answered_at >= now() - interval '7 days'
    ) as answered_7d_count,

    round(
      avg(
        extract(epoch from (q.answered_at - q.ml_date_created)) / 60
      ) filter (
        where q.status = 'answered'
          and q.answered_at >= now() - interval '7 days'
          and q.answer_source = 'pana'
      )::numeric,
      1
    ) as avg_response_minutes_7d,

    min(q.ml_date_created) filter (
      where q.status = 'pending' and q.deleted_at is null
    ) as oldest_pending_at
  from public.questions q;
$$;

grant execute on function public.question_metrics() to authenticated;
