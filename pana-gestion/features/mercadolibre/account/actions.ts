"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/features/auth/server/session";
import { disconnectAccount } from "@/features/mercadolibre/account/server/connect";
import { AppError, toUserMessage } from "@/lib/errors";
import { fail, ok, type Result } from "@/lib/result";
import { logger } from "@/lib/logger";

/**
 * Desconecta la cuenta de Mercado Libre.
 *
 * Solo admin: desconectar deja al equipo entero sin poder responder.
 */
export async function disconnectMercadoLibre(): Promise<Result<null>> {
  try {
    const user = await requireRole("admin");
    await disconnectAccount({ userId: user.id });

    revalidatePath("/mercadolibre/configuracion");
    revalidatePath("/");

    return ok(null);
  } catch (error) {
    logger.error("No se pudo desconectar la cuenta", {
      reason: error instanceof Error ? error.message : String(error),
    });
    return fail(toUserMessage(error), error instanceof AppError ? error.code : "unknown");
  }
}
