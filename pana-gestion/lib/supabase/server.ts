import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getClientEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

/**
 * Cliente de Supabase con la sesión del usuario.
 *
 * Es el que se usa para LEER desde componentes de servidor: cada consulta pasa
 * por las policies de RLS, así que aunque el código se equivoque, nadie ve más
 * de lo que le corresponde.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const env = getClientEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Los Server Components no pueden escribir cookies. El refresh de
            // sesión lo hace el middleware, así que ignorar acá es correcto.
          }
        },
      },
    },
  );
}
