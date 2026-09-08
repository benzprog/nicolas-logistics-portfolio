import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { AppError } from "@/lib/errors";
import type { Tables } from "@/types/database.types";

export type Integration = Tables<"integrations">;
export type MercadoLibreAccount = Tables<"mercadolibre_accounts">;
export type MercadoLibreTokens = Tables<"mercadolibre_tokens">;

export type ConnectedAccount = {
  integration: Integration;
  account: MercadoLibreAccount;
};

/**
 * Acceso a las tablas de la integración.
 *
 * Es la única capa que sabe cómo se llaman las tablas. Si mañana cambia el
 * esquema, se cambia acá y el resto del código no se entera.
 */

export async function findIntegration(): Promise<Integration | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("provider", "mercadolibre")
    .maybeSingle();

  if (error) throw new AppError("database", { message: error.message });
  return data;
}

/** La cuenta conectada, o null si nunca se conectó ninguna. */
export async function findConnectedAccount(): Promise<ConnectedAccount | null> {
  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("integrations")
    .select("*, mercadolibre_accounts(*)")
    .eq("provider", "mercadolibre")
    .maybeSingle();

  if (error) throw new AppError("database", { message: error.message });
  if (!data) return null;

  const { mercadolibre_accounts: accounts, ...integration } = data as Integration & {
    mercadolibre_accounts: MercadoLibreAccount[] | MercadoLibreAccount | null;
  };

  const account = Array.isArray(accounts) ? accounts[0] : accounts;
  if (!account) return null;

  return { integration: integration as Integration, account };
}

/**
 * La cuenta con la que hay que trabajar, o un error explicando por qué no.
 *
 * Distinguir "nunca se conectó" de "la conexión venció" importa: el mensaje
 * que ve el usuario y lo que tiene que hacer son distintos.
 */
export async function requireConnectedAccount(): Promise<ConnectedAccount> {
  const connected = await findConnectedAccount();

  if (!connected) throw new AppError("integration_disconnected");
  if (connected.integration.status === "needs_reauth") {
    throw new AppError("integration_needs_reauth");
  }
  if (connected.integration.status === "disconnected") {
    throw new AppError("integration_disconnected");
  }

  return connected;
}

export async function findAccountByMlUserId(mlUserId: number): Promise<MercadoLibreAccount | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("mercadolibre_accounts")
    .select("*")
    .eq("ml_user_id", mlUserId)
    .maybeSingle();

  if (error) throw new AppError("database", { message: error.message });
  return data;
}

export async function updateIntegration(
  integrationId: string,
  patch: Partial<{
    status: Integration["status"];
    last_sync_at: string | null;
    last_webhook_at: string | null;
    last_error: string | null;
    connected_by: string | null;
    connected_at: string | null;
    disconnected_at: string | null;
  }>,
): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("integrations").update(patch).eq("id", integrationId);
  if (error) throw new AppError("database", { message: error.message });
}
