import { NextResponse, type NextRequest } from "next/server";

import { processPendingEvents } from "@/features/mercadolibre/webhooks/server/processor";
import {
  refreshStalePendingQuestions,
  syncUnansweredQuestions,
} from "@/features/mercadolibre/questions/server/sync-question";
import {
  findConnectedAccount,
  updateIntegration,
} from "@/features/mercadolibre/account/server/repository";
import { tokenProviderFor } from "@/features/mercadolibre/account/server/token-manager";
import { getServerEnv } from "@/lib/env";
import { safeCompare } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { audit } from "@/lib/audit";
import { now } from "@/lib/time";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Reconciliación periódica.
 *
 * Existe porque los webhooks fallan: se pierde una notificación, el
 * procesamiento en segundo plano se corta, o alguien responde desde la app de
 * Mercado Libre en el celular. Cada 5 minutos esto cierra esos huecos.
 *
 * Lo dispara pg_cron desde Supabase (ver la migración del cron).
 */
export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${getServerEnv().CRON_SECRET}`;

  if (!safeCompare(authorization, expected)) {
    return new NextResponse(null, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    // 1. Lo que quedó a medias: eventos recibidos sin procesar o fallados.
    const { processed } = await processPendingEvents(25);

    const connected = await findConnectedAccount();
    if (!connected || connected.integration.status !== "connected") {
      return NextResponse.json({
        ok: true,
        processed,
        skipped: "sin cuenta conectada",
      });
    }

    const auth = tokenProviderFor(connected.account.id);

    // 2. Preguntas sin responder que no llegaron por webhook.
    const { imported } = await syncUnansweredQuestions(auth, {
      accountId: connected.account.id,
      sellerId: connected.account.ml_user_id,
      maxPages: 3,
    });

    // 3. Nuestras pendientes viejas: puede que ya estén respondidas allá.
    const refreshed = await refreshStalePendingQuestions(auth, {
      accountId: connected.account.id,
      olderThanHours: 6,
      limit: 20,
    });

    await updateIntegration(connected.integration.id, {
      last_sync_at: now().toISOString(),
      last_error: null,
    });

    const durationMs = Date.now() - startedAt;
    logger.info("Reconciliación terminada", { processed, imported, refreshed, durationMs });

    return NextResponse.json({ ok: true, processed, imported, refreshed, durationMs });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.error("Falló la reconciliación", { reason });

    await audit({
      action: "ml.sync.failed",
      actorType: "cron",
      metadata: { reason: reason.slice(0, 300) },
    });

    // 200 igual: si devolviéramos 500, pg_net lo registraría como error de red
    // y no tendríamos el detalle. El resultado va en el cuerpo.
    return NextResponse.json({ ok: false, error: reason.slice(0, 200) }, { status: 200 });
  }
}
