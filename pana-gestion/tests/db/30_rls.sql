-- Seguridad a nivel de fila. Estas pruebas son el contrato: si alguna deja de
-- pasar, alguien puede ver o hacer algo que no debería.
--
-- Cada bloque se hace pasar por un usuario igual que lo haría Supabase:
-- el rol de Postgres correspondiente y el id en el claim del JWT.

begin;

-- ------------------------------------------------- Ana, operadora, activa
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select t.check('operadora: ve las preguntas',
  (select count(*) = 2 from public.questions), (select count(*)::text from public.questions));

select t.check('operadora: ve los perfiles (para saber quién respondió)',
  (select count(*) = 3 from public.profiles), (select count(*)::text from public.profiles));

select t.check('operadora: ve las publicaciones',
  (select count(*) = 1 from public.mercadolibre_items),
  (select count(*)::text from public.mercadolibre_items));

-- Lo más importante de todo el sistema.
select t.check_rejects('operadora: NO llega a los tokens de Mercado Libre',
  $$select access_token_enc from public.mercadolibre_tokens$$, '42501');

select t.check_rejects('operadora: NO puede ascenderse a admin',
  $$update public.profiles set role = 'admin'
     where id = '11111111-1111-1111-1111-111111111111'$$, '42501');

select t.check_rejects('operadora: NO puede desactivar a otro usuario',
  $$update public.profiles set is_active = false
     where id = '22222222-2222-2222-2222-222222222222'$$, '42501');

update public.profiles set full_name = 'Ana Benítez'
  where id = '11111111-1111-1111-1111-111111111111';
select t.check('operadora: sí puede corregir su propio nombre',
  (select full_name = 'Ana Benítez' from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'),
  (select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'));

select t.check_rejects('operadora: NO puede inventar una pregunta',
  $$insert into public.questions
      (account_id, ml_question_id, ml_item_id, ml_seller_id, text, ml_status, ml_date_created)
    values ('44444444-4444-4444-4444-444444444444', 777, 'MLA123456789', 1,
            'pregunta inventada', 'UNANSWERED', now())$$, '42501');

select t.check_rejects('operadora: NO puede marcar una pregunta como respondida a mano',
  $$update public.questions set status = 'answered'
     where id = 'aaaaaaaa-0000-0000-0000-000000000002'$$, '42501');

select t.check_rejects('operadora: NO puede escribir en la auditoría',
  $$insert into public.audit_logs (actor_type, action) values ('user', 'inventado')$$, '42501');

select t.check_rejects('operadora: NO puede llamar a la RPC de cierre',
  $$select public.mark_question_answered('55555555-5555-5555-5555-555555555555')$$, '42501');

select t.check('operadora: NO ve la auditoría',
  (select count(*) = 0 from public.audit_logs), (select count(*)::text from public.audit_logs));

select t.check('operadora: NO ve los webhooks',
  (select count(*) = 0 from public.webhook_events),
  (select count(*)::text from public.webhook_events));

-- ------------------------------------------------------------ Administrador
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select t.check('admin: ve los webhooks',
  (select count(*) = 1 from public.webhook_events),
  (select count(*)::text from public.webhook_events));

select t.check('admin: ve la auditoría',
  (select count(*) = 1 from public.audit_logs),
  (select count(*)::text from public.audit_logs));

select t.check_rejects('admin: tampoco llega a los tokens',
  $$select access_token_enc from public.mercadolibre_tokens$$, '42501');

select t.check_rejects('admin: tampoco escribe preguntas directo',
  $$update public.questions set text = 'editada'
     where id = 'aaaaaaaa-0000-0000-0000-000000000002'$$, '42501');

-- --------------------------------------------------------- Usuario dado de baja
set local request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';

select t.check('usuario inactivo: no ve preguntas',
  (select count(*) = 0 from public.questions), (select count(*)::text from public.questions));

select t.check('usuario inactivo: no ve perfiles',
  (select count(*) = 0 from public.profiles), (select count(*)::text from public.profiles));

-- ------------------------------------------------------------- Sin sesión
set local role anon;
set local request.jwt.claim.sub = '';

select t.check('sin sesión: no ve preguntas',
  (select count(*) = 0 from public.questions), (select count(*)::text from public.questions));

select t.check('sin sesión: no ve perfiles',
  (select count(*) = 0 from public.profiles), (select count(*)::text from public.profiles));

select t.check('sin sesión: no ve la cuenta de Mercado Libre',
  (select count(*) = 0 from public.mercadolibre_accounts),
  (select count(*)::text from public.mercadolibre_accounts));

select t.check_rejects('sin sesión: no llega a los tokens',
  $$select access_token_enc from public.mercadolibre_tokens$$, '42501');

reset role;
commit;
