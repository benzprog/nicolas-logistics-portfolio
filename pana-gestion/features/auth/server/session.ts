import "server-only";

import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import type { Enums, Tables } from "@/types/database.types";

export type AppRole = Enums<"app_role">;
export type Profile = Tables<"profiles">;

export type SessionUser = {
  id: string;
  email: string | null;
  profile: Profile;
};

/**
 * Usuario de la request actual, o null.
 *
 * Va envuelto en `cache()` de React: el layout, la página y las acciones lo
 * piden por separado, y así se resuelve una sola vez por request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSupabaseServerClient();

  // getUser valida el token contra Supabase. getSession leería la cookie sin
  // verificarla, y con eso no se decide un permiso.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // Sin perfil activo no hay usuario: es como se da de baja a alguien sin
  // borrar lo que hizo.
  if (!profile || !profile.is_active) return null;

  return { id: user.id, email: user.email ?? null, profile };
});

/** Igual que getCurrentUser pero falla si no hay sesión. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("unauthorized");
  return user;
}

/**
 * Exige uno de los roles indicados.
 *
 * Se llama al principio de cada Server Action y de cada ruta sensible. RLS
 * cubre las lecturas; esto cubre las acciones.
 */
export async function requireRole(...roles: AppRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.profile.role)) {
    throw new AppError("forbidden", {
      message: `Rol ${user.profile.role} sin acceso; se requiere ${roles.join(" o ")}`,
      context: { userId: user.id, role: user.profile.role, required: roles },
    });
  }
  return user;
}

/** Quien puede responder preguntas y operar el día a día. */
export function canAnswerQuestions(role: AppRole): boolean {
  return role === "admin" || role === "operator";
}

/** Quien puede conectar y desconectar integraciones. */
export function canManageIntegrations(role: AppRole): boolean {
  return role === "admin";
}

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  operator: "Operador",
  viewer: "Solo lectura",
};
