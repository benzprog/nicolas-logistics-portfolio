-- ============================================================================
-- Contrato entre la base y el código TypeScript.
--
-- supabase-js resuelve los joins anidados por el NOMBRE de la clave foránea.
-- `types/database.types.ts` los declara y una consulta los usa explícitamente
-- (`profiles!questions_answered_by_fkey`). Si alguien renombra una restricción
-- en una migración, el typecheck pasa igual y la consulta falla recién en
-- producción. Esto lo detecta antes.
-- ============================================================================

do $$
declare
  esperadas text[] := array[
    'audit_logs_actor_user_id_fkey',
    'integrations_connected_by_fkey',
    'mercadolibre_accounts_integration_id_fkey',
    'mercadolibre_items_account_id_fkey',
    'mercadolibre_tokens_account_id_fkey',
    'question_answers_question_id_fkey',
    'question_answers_sent_by_fkey',
    'questions_account_id_fkey',
    'questions_answered_by_fkey',
    'questions_ml_item_id_fkey'
  ];
  faltante text;
begin
  foreach faltante in array esperadas loop
    perform t.check(
      format('existe la clave foránea %s', faltante),
      exists (
        select 1 from pg_constraint
         where conname = faltante
           and contype = 'f'
           and connamespace = 'public'::regnamespace
      ),
      faltante
    );
  end loop;
end $$;

-- Los índices que sostienen las promesas del sistema. Sin ellos el código
-- sigue compilando, pero deja de cumplir lo que dice hacer.
select t.check('índice único que impide dos envíos simultáneos',
  exists (
    select 1 from pg_indexes
     where schemaname = 'public' and indexname = 'question_answers_one_in_flight_idx'
  ),
  'question_answers_one_in_flight_idx');

select t.check('unicidad de pregunta por cuenta (idempotencia)',
  exists (
    select 1 from pg_constraint
     where conname = 'questions_ml_unique' and contype = 'u'
  ),
  'questions_ml_unique');

select t.check('unicidad de evento de webhook (idempotencia)',
  exists (
    select 1 from pg_constraint
     where conname = 'webhook_events_external_unique' and contype = 'u'
  ),
  'webhook_events_external_unique');

select t.check('índice de búsqueda de texto en español',
  exists (
    select 1 from pg_indexes
     where schemaname = 'public' and indexname = 'questions_text_search_idx'
  ),
  'questions_text_search_idx');

-- RLS activo en todas las tablas. Una tabla nueva sin RLS queda abierta a
-- cualquiera con la anon key, que es pública por diseño.
do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'profiles', 'audit_logs', 'integrations', 'mercadolibre_accounts',
    'mercadolibre_tokens', 'mercadolibre_items', 'questions',
    'question_answers', 'webhook_events'
  ] loop
    perform t.check(
      format('RLS activo en %s', tabla),
      (select relrowsecurity from pg_class where oid = ('public.' || tabla)::regclass),
      tabla
    );
  end loop;
end $$;

-- Y la más importante: los tokens no tienen ninguna policy. Con RLS activo y
-- cero policies, ningún cliente ve una sola fila.
select t.check('mercadolibre_tokens sigue sin policies de lectura',
  (select count(*) = 0 from pg_policies
    where schemaname = 'public' and tablename = 'mercadolibre_tokens'),
  (select count(*)::text from pg_policies
    where schemaname = 'public' and tablename = 'mercadolibre_tokens'));
