import { describe, expect, it } from "vitest";

import {
  isDeletedInMl,
  mapQuestionToRow,
  mergeOnConflict,
  toInternalStatus,
} from "@/features/mercadolibre/questions/mappers";
import type { MlQuestion } from "@/services/mercadolibre/types";

describe("estados de pregunta", () => {
  it("traduce los estados conocidos", () => {
    expect(toInternalStatus("UNANSWERED")).toBe("pending");
    expect(toInternalStatus("UNDER_REVIEW")).toBe("pending");
    expect(toInternalStatus("ANSWERED")).toBe("answered");
    expect(toInternalStatus("CLOSED_UNANSWERED")).toBe("archived");
    expect(toInternalStatus("DELETED")).toBe("archived");
    expect(toInternalStatus("BANNED")).toBe("archived");
  });

  it("no distingue mayúsculas", () => {
    expect(toInternalStatus("unanswered")).toBe("pending");
  });

  it("un estado desconocido queda pendiente", () => {
    // Preferimos que alguien mire una pregunta de más a que una quede
    // invisible porque Mercado Libre agregó un estado nuevo.
    expect(toInternalStatus("ESTADO_QUE_NO_EXISTE_TODAVIA")).toBe("pending");
  });

  it("solo DELETED cuenta como borrada", () => {
    expect(isDeletedInMl("DELETED")).toBe(true);
    expect(isDeletedInMl("CLOSED_UNANSWERED")).toBe(false);
  });
});

describe("mapeo a fila de base de datos", () => {
  const base: MlQuestion = {
    id: 5036111111,
    seller_id: 987654321,
    item_id: "MLA123456789",
    text: "¿Tienen stock en luz cálida?",
    status: "UNANSWERED",
    date_created: "2026-09-08T10:00:00.000-03:00",
    from: { id: 555000111 },
    answer: null,
  };

  const ctx = { accountId: "cuenta-1", nowIso: "2026-09-08T13:00:00.000Z" };

  it("mapea una pregunta sin responder", () => {
    const row = mapQuestionToRow(base, ctx);
    expect(row.status).toBe("pending");
    expect(row.ml_status).toBe("UNANSWERED");
    expect(row.ml_buyer_id).toBe(555000111);
    expect(row.answer_text).toBeNull();
    expect(row.answer_source).toBeNull();
    expect(row.deleted_at).toBeNull();
  });

  it("marca como externa una respuesta que ya venía de Mercado Libre", () => {
    // Alguien respondió desde la app del celular: la respuesta existe pero no
    // la mandamos nosotros, y eso tiene que verse en el historial.
    const row = mapQuestionToRow(
      {
        ...base,
        status: "ANSWERED",
        answer: { text: "Sí, hay stock", date_created: "2026-09-08T11:00:00.000-03:00" },
      },
      ctx,
    );

    expect(row.status).toBe("answered");
    expect(row.answer_text).toBe("Sí, hay stock");
    expect(row.answer_source).toBe("external");
    expect(row.answered_at).toBe("2026-09-08T11:00:00.000-03:00");
  });

  it("marca la fecha de borrado si Mercado Libre la borró", () => {
    const row = mapQuestionToRow({ ...base, status: "DELETED" }, ctx);
    expect(row.status).toBe("archived");
    expect(row.deleted_at).toBe(ctx.nowIso);
  });

  it("tolera una pregunta sin comprador identificado", () => {
    const row = mapQuestionToRow({ ...base, from: null }, ctx);
    expect(row.ml_buyer_id).toBeNull();
  });

  it("ignora una respuesta vacía", () => {
    const row = mapQuestionToRow({ ...base, answer: { text: "   " } }, ctx);
    expect(row.answer_text).toBeNull();
  });
});

describe("re-sincronización de una pregunta ya respondida desde PANA", () => {
  const row = mapQuestionToRow(
    {
      id: 1,
      seller_id: 2,
      item_id: "MLA1",
      text: "hola",
      status: "ANSWERED",
      date_created: "2026-09-08T10:00:00Z",
      answer: { text: "respuesta" },
    },
    { accountId: "cuenta-1", nowIso: "2026-09-08T13:00:00.000Z" },
  );

  it("conserva quién respondió", () => {
    // Mercado Libre no sabe qué persona de PANA contestó. Si al re-sincronizar
    // pisáramos ese dato, el historial perdería lo único que aporta.
    const merged = mergeOnConflict(row, { answer_source: "pana", answered_by: "usuario-1" });
    expect(merged.answer_source).toBe("pana");
    expect(merged.answered_by).toBe("usuario-1");
  });

  it("no inventa autoría cuando la respuesta fue externa", () => {
    const merged = mergeOnConflict(row, { answer_source: null, answered_by: null });
    expect(merged.answer_source).toBe("external");
    expect(merged.answered_by).toBeUndefined();
  });
});
