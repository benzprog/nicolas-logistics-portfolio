-- Datos de prueba: una cuenta conectada, una publicación y dos preguntas.
-- Los ids son fijos para que las pruebas puedan referirse a ellos.

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ana@pana.com.ar',   '{"full_name":"Ana Operadora"}'),
  ('22222222-2222-2222-2222-222222222222', 'admin@pana.com.ar', '{"full_name":"Admin PANA"}'),
  ('99999999-9999-9999-9999-999999999999', 'exempleado@pana.com.ar', '{"full_name":"Ex Empleado"}');

update public.profiles set role = 'admin'  where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set is_active = false where id = '99999999-9999-9999-9999-999999999999';

insert into public.integrations (id, provider, status, connected_by, connected_at)
values ('33333333-3333-3333-3333-333333333333', 'mercadolibre', 'connected',
        '22222222-2222-2222-2222-222222222222', now() - interval '10 days');

insert into public.mercadolibre_accounts (id, integration_id, ml_user_id, nickname)
values ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333',
        987654321, 'PANAILUMINACION');

insert into public.mercadolibre_tokens (account_id, access_token_enc, refresh_token_enc, access_token_expires_at)
values ('44444444-4444-4444-4444-444444444444', 'v1:iv:tag:cipher', 'v1:iv:tag:cipher',
        now() + interval '6 hours');

insert into public.mercadolibre_items (ml_item_id, account_id, title, price, currency_id, available_quantity, status)
values ('MLA123456789', '44444444-4444-4444-4444-444444444444',
        'Lámpara LED 9W E27 luz fría', 3500.00, 'ARS', 42, 'active');

insert into public.questions
  (id, account_id, ml_question_id, ml_item_id, ml_seller_id, ml_buyer_id, text, ml_status, ml_date_created)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444',
   5036111111, 'MLA123456789', 987654321, 555000111,
   'Hola, tienen stock en luz cálida?', 'UNANSWERED', now() - interval '3 hours'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444',
   5036222222, 'MLA123456789', 987654321, 555000222,
   'Hacen envío a Córdoba?', 'UNANSWERED', now() - interval '30 hours');

insert into public.webhook_events (provider, external_id, topic, resource, payload)
values ('mercadolibre', 'evt_abc123', 'questions', '/questions/5036111111', '{"topic":"questions"}'::jsonb);

insert into public.audit_logs (actor_type, actor_user_id, action, entity_type, entity_id)
values ('user', '22222222-2222-2222-2222-222222222222', 'ml.account.connected', 'integration',
        '33333333-3333-3333-3333-333333333333');
