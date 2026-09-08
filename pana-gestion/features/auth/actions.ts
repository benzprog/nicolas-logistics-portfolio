"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { fail, ok, type Result } from "@/lib/result";
import { loginSchema, type LoginInput } from "@/features/auth/schemas";
import { getCurrentUser } from "@/features/auth/server/session";

/**
 * Inicia sesión.
 *
 * Devuelve un mensaje genérico cuando falla: decirle a alguien "el email no
 * existe" le confirma qué direcciones son usuarias del sistema.
 */
export async function signIn(input: LoginInput): Promise<Result<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Revisá los datos ingresados");
  }

  const { email, password, redirectTo } = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    logger.warn("Intento de inicio de sesión fallido", { email, reason: error?.message });
    await audit({
      action: "auth.login_failed",
      actorType: "system",
      metadata: { email, reason: error?.message ?? "sin usuario" },
      ...(await requestMetadata()),
    });
    return fail("Email o contraseña incorrectos");
  }

  // El usuario existe en auth pero está dado de baja en la aplicación.
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile?.is_active) {
    await supabase.auth.signOut();
    await audit({
      action: "auth.login_failed",
      actorType: "system",
      metadata: { email, reason: "usuario inactivo" },
      ...(await requestMetadata()),
    });
    return fail("Tu usuario está desactivado. Hablá con un administrador.");
  }

  await audit({
    action: "auth.login",
    actorUserId: data.user.id,
    entityType: "user",
    entityId: data.user.id,
    ...(await requestMetadata()),
  });

  return ok({ redirectTo });
}

export async function signOut(): Promise<void> {
  const user = await getCurrentUser();
  const supabase = await createSupabaseServerClient();

  await supabase.auth.signOut();

  if (user) {
    await audit({
      action: "auth.logout",
      actorUserId: user.id,
      entityType: "user",
      entityId: user.id,
      ...(await requestMetadata()),
    });
  }

  redirect("/login");
}

/** IP y navegador, para que la auditoría sirva de algo cuando haga falta. */
async function requestMetadata() {
  try {
    const headerList = await headers();
    return {
      ip: headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: headerList.get("user-agent"),
    };
  } catch {
    return { ip: null, userAgent: null };
  }
}
