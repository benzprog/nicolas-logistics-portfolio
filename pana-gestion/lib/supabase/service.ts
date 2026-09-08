import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getClientEnv, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

/**
 * Cliente con permisos de servicio. Se saltea RLS por completo.
 *
 * Se usa para las escrituras de negocio, para los webhooks y para el job de
 * reconciliación, donde no hay ningún usuario con sesión. La regla del
 * proyecto: antes de cada llamada, el código ya tiene que haber autorizado
 * explícitamente (requireRole y compañía).
 *
 * El import de "server-only" hace que la compilación falle si alguien lo
 * arrastra sin querer a un componente de cliente. Es la red que evita que la
 * service key termine en el navegador.
 */
let cached: SupabaseClient<Database> | null = null;

export function createSupabaseServiceClient(): SupabaseClient<Database> {
  if (cached) return cached;

  cached = createClient<Database>(
    getClientEnv().NEXT_PUBLIC_SUPABASE_URL,
    getServerEnv().SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "x-application-name": "pana-gestion" } },
    },
  );

  return cached;
}

/** Solo para tests. */
export function resetSupabaseServiceClient() {
  cached = null;
}
