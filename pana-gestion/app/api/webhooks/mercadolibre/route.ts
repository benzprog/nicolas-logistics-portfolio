import { NextResponse, after, type NextRequest } from "next/server";

import {
  ingestNotification,
  isAuthorizedWebhook,
} from "@/features/mercadolibre/webhooks/server/ingest";
import { processWebhookEvent } from "@/features/mercadolibre/webhooks/server/processor";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Endpoint de notificaciones de Mercado Libre.
 *
 * Guarda y responde. Nada más. El trabajo real ocurre en `after()`, que
 * mantiene viva la función después de haber contestado.
 *
 * Casi todo devuelve 200, incluso cuando rechazamos la notificación: un error
 * HTTP hace que Mercado Libre reintente, y no queremos reintentos de algo que
 * nunca vamos a aceptar. Los rechazos quedan en los logs.
 */
export async function POST(request: NextRequest) {
  // El secreto va en la URL porque Mercado Libre no firma las notificaciones.
  if (!isAuthorizedWebhook(request.nextUrl.searchParams.get("token"))) {
    logger.warn("Notificación con token inválido", {
      ip: request.headers.get("x-forwarded-for"),
    });
    // 401 acá es correcto: quien llame sin el secreto no es Mercado Libre.
    return new NextResponse(null, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ received: true, ignored: "cuerpo ilegible" }, { status: 200 });
  }

  const result = await ingestNotification(payload);

  if (result.outcome === "queued") {
    // El procesamiento arranca después de responder.
    after(async () => {
      await processWebhookEvent(result.eventId);
    });
  }

  return NextResponse.json({ received: true, outcome: result.outcome }, { status: 200 });
}

/** Mercado Libre puede probar el endpoint con un GET al configurarlo. */
export async function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
