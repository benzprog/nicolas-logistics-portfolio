-- Reglas del modelo de datos que el código da por ciertas.

-- El perfil se crea solo al aparecer el usuario en auth.
select t.check('perfil creado por trigger al registrarse',
  (select count(*) = 3 from public.profiles),
  (select count(*)::text from public.profiles));

select t.check('el nombre sale de la metadata de auth',
  (select full_name = 'Ana Operadora' from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'),
  (select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'));

-- V1 admite una sola cuenta por proveedor.
select t.check_rejects('no entran dos integraciones del mismo proveedor',
  $$insert into public.integrations (provider) values ('mercadolibre')$$,
  '23505');

-- Idempotencia: el mismo webhook procesado dos veces actualiza, no duplica.
insert into public.questions
  (account_id, ml_question_id, ml_item_id, ml_seller_id, text, ml_status, ml_date_created)
values ('44444444-4444-4444-4444-444444444444', 5036111111, 'MLA123456789', 987654321,
        'Hola, tienen stock en luz cálida?', 'ANSWERED', now() - interval '3 hours')
on conflict (account_id, ml_question_id)
do update set ml_status = excluded.ml_status, last_synced_at = now();

select t.check('el mismo evento no duplica la pregunta',
  (select count(*) = 1 from public.questions where ml_question_id = 5036111111),
  (select count(*)::text from public.questions where ml_question_id = 5036111111));

select t.check('el reproceso actualiza el estado de Mercado Libre',
  (select ml_status = 'ANSWERED' from public.questions where ml_question_id = 5036111111),
  (select ml_status from public.questions where ml_question_id = 5036111111));

-- Doble envío: dos personas respondiendo la misma pregunta al mismo tiempo.
insert into public.question_answers (id, question_id, text, status, sent_by)
values ('55555555-5555-5555-5555-555555555555', 'aaaaaaaa-0000-0000-0000-000000000001',
        'Sí, tenemos stock en luz cálida.', 'sending', '11111111-1111-1111-1111-111111111111');

select t.check_rejects('no se puede enviar dos respuestas a la vez',
  $$insert into public.question_answers (question_id, text, status)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'respuesta simultánea', 'sending')$$,
  '23505');

-- Cierre atómico.
select public.mark_question_answered('55555555-5555-5555-5555-555555555555', '{"id":5036111111}'::jsonb);

select t.check('la RPC deja la pregunta respondida y atribuida',
  (select status = 'answered'
      and answer_text = 'Sí, tenemos stock en luz cálida.'
      and answered_by = '11111111-1111-1111-1111-111111111111'
      and answer_source = 'pana'
      and last_error is null
     from public.questions where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  (select status::text from public.questions where id = 'aaaaaaaa-0000-0000-0000-000000000001'));

select t.check('al cerrar se libera el candado de envío',
  (select count(*) = 0 from public.question_answers where status = 'sending'),
  (select count(*)::text from public.question_answers where status = 'sending'));

select t.check_rejects('cerrar dos veces el mismo envío falla',
  $$select public.mark_question_answered('55555555-5555-5555-5555-555555555555')$$,
  'P0002');

-- Un fallo de envío deja la pregunta pendiente, no la esconde.
insert into public.question_answers (id, question_id, text, status, sent_by)
values ('66666666-6666-6666-6666-666666666666', 'aaaaaaaa-0000-0000-0000-000000000002',
        'Sí, enviamos a todo el país.', 'sending', '11111111-1111-1111-1111-111111111111');

select public.mark_answer_failed('66666666-6666-6666-6666-666666666666', 'ml_unavailable',
                                 'Mercado Libre no respondió');

select t.check('un envío fallido NO saca la pregunta de pendientes',
  (select status = 'pending' and last_error is not null
     from public.questions where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  (select status::text || ' / ' || coalesce(last_error, 'sin error')
     from public.questions where id = 'aaaaaaaa-0000-0000-0000-000000000002'));

select t.check('el intento fallido queda en el historial',
  (select status = 'failed' and error_code = 'ml_unavailable'
     from public.question_answers where id = '66666666-6666-6666-6666-666666666666'),
  (select status::text from public.question_answers where id = '66666666-6666-6666-6666-666666666666'));

-- Coherencia: una respondida siempre tiene respuesta.
select t.check_rejects('una pregunta respondida no puede quedar sin texto',
  $$update public.questions set answer_text = null
     where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514');

-- Idempotencia de la ingesta de webhooks.
insert into public.webhook_events (provider, external_id, topic, resource, payload)
values ('mercadolibre', 'evt_abc123', 'questions', '/questions/5036111111', '{}'::jsonb)
on conflict (provider, external_id) do nothing;

select t.check('el mismo webhook no entra dos veces',
  (select count(*) = 1 from public.webhook_events where external_id = 'evt_abc123'),
  (select count(*)::text from public.webhook_events where external_id = 'evt_abc123'));

-- Borrar la cuenta se lleva todo lo que cuelga de ella, menos la auditoría.
select t.check('las preguntas cuelgan de la cuenta con borrado en cascada',
  (select count(*) = 1 from information_schema.referential_constraints rc
     join information_schema.table_constraints tc
       on tc.constraint_name = rc.constraint_name
    where tc.table_name = 'questions' and rc.delete_rule = 'CASCADE'
      and tc.constraint_name like '%account%'),
  'fk questions.account_id');

-- Métricas del dashboard.
select t.check('las métricas cuentan bien',
  (select pending_count = 1 and pending_over_24h_count = 1 and answered_today_count = 1
     from public.question_metrics()),
  (select format('pendientes=%s +24h=%s hoy=%s promedio=%s min',
                 pending_count, pending_over_24h_count, answered_today_count,
                 coalesce(avg_response_minutes_7d::text, '—'))
     from public.question_metrics()));
