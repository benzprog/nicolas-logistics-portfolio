-- ============================================================================
-- Datos de prueba para desarrollo local.
--
-- Los aplica `supabase db reset`. NO se ejecuta en producción: el comando solo
-- corre contra la base local.
--
-- Sirve para poder ver el panel con contenido sin tener que conectar una cuenta
-- real de Mercado Libre. La cuenta que se crea acá no tiene tokens, así que
-- cualquier intento de responder falla con "no hay cuenta conectada", que es
-- justamente el estado que hay que poder probar.
-- ============================================================================

-- Un usuario para entrar. La contraseña es "pana1234".
-- Supabase Auth guarda el hash con bcrypt; crypt() viene de pgcrypto.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'ana@pana.com.ar',
  crypt('pana1234', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Ana Benítez"}'::jsonb,
  now(), now()
)
on conflict (id) do nothing;

-- El trigger de la migración ya creó el perfil; acá solo se le da el rol.
update public.profiles
   set role = 'admin'
 where id = '11111111-1111-1111-1111-111111111111';

-- Una integración en estado "desconectada": es el estado real de un entorno
-- nuevo, y el que muestra el cartel de "Conectar cuenta" en el dashboard.
insert into public.integrations (id, provider, status)
values ('33333333-3333-3333-3333-333333333333', 'mercadolibre', 'disconnected')
on conflict (provider) do nothing;

-- Para ver el panel con contenido, descomentá lo que sigue. Crea una cuenta
-- simulada con dos publicaciones y cuatro preguntas en distintos estados.
--
-- update public.integrations
--    set status = 'connected', connected_at = now(), last_sync_at = now()
--  where provider = 'mercadolibre';
--
-- insert into public.mercadolibre_accounts (id, integration_id, ml_user_id, nickname)
-- values ('44444444-4444-4444-4444-444444444444',
--         '33333333-3333-3333-3333-333333333333', 987654321, 'PANAILUMINACION')
-- on conflict (ml_user_id) do nothing;
--
-- insert into public.mercadolibre_items
--   (ml_item_id, account_id, title, price, currency_id, available_quantity, status)
-- values
--   ('MLA123456789', '44444444-4444-4444-4444-444444444444',
--    'Lámpara LED 9W E27 luz fría — pack x10', 3500, 'ARS', 42, 'active'),
--   ('MLA987654321', '44444444-4444-4444-4444-444444444444',
--    'Panel LED embutir 18W cuadrado', 12800, 'ARS', 0, 'active')
-- on conflict (ml_item_id) do nothing;
--
-- insert into public.questions
--   (account_id, ml_question_id, ml_item_id, ml_seller_id, ml_buyer_id,
--    text, status, ml_status, ml_date_created)
-- values
--   ('44444444-4444-4444-4444-444444444444', 5036111111, 'MLA123456789', 987654321, 555000111,
--    'Hola, ¿tienen stock en luz cálida? Necesito 20 unidades para una obra.',
--    'pending', 'UNANSWERED', now() - interval '31 hours'),
--   ('44444444-4444-4444-4444-444444444444', 5036222222, 'MLA987654321', 987654321, 555000222,
--    '¿Hacen envío a Córdoba capital?',
--    'pending', 'UNANSWERED', now() - interval '6 hours'),
--   ('44444444-4444-4444-4444-444444444444', 5036333333, 'MLA123456789', 987654321, 555000333,
--    '¿El pack viene con garantía?',
--    'pending', 'UNANSWERED', now() - interval '2 hours')
-- on conflict (account_id, ml_question_id) do nothing;
