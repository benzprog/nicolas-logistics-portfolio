"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getClientEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

/** Cliente del navegador. Solo lleva la anon key: RLS hace el resto. */
export function createSupabaseBrowserClient() {
  const env = getClientEnv();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
