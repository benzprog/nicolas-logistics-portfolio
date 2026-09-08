import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeSupabase, argsOf, type FakeSupabase } from "@/tests/mocks/supabase";
import {
  MlRateLimitError,
  MlUnavailableError,
  MlValidationError,
} from "@/services/mercadolibre/errors";

/**
 * Enviar una respuesta es la única acción del sistema que se ve desde afuera:
 * queda publicada en Mercado Libre y no se puede borrar. Estas pruebas fijan
 * lo que tiene que pasar en cada final posible.
 */

let supabase: FakeSupabase;
const postAnswerMock = vi.fn();
const syncMock = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: () => supabase.client,
}));

vi.mock("@/services/mercadolibre/api", () => ({
  postAnswer: (...args: unknown[]) => postAnswerMock(...args),
}));

vi.mock("@/features/mercadolibre/account/server/repository", () => ({
  requireConnectedAccount: async () => ({
    integration: { id: "integracion-1", status: "connected" },
    account: { id: "cuenta-1", ml_user_id: 987654321, nickname: "PANAILUMINACION" },
  }),
}));

vi.mock("@/features/mercadolibre/account/server/token-manager", () => ({
  tokenProviderFor: () => ({ getAccessToken: async () => "token" }),
}));

vi.mock("@/features/mercadolibre/questions/server/sync-question", () => ({
  syncQuestionById: (...args: unknown[]) => syncMock(...args),
}));

vi.mock("@/lib/audit", () => ({ audit: async () => {} }));

const { sendAnswer } = await import("@/features/mercadolibre/questions/server/send-answer");

const PREGUNTA = {
  id: "pregunta-1",
  ml_question_id: 5036111111,
  status: "pending",
  deleted_at: null,
};

function setup(overrides: Record<string, unknown> = {}) {
  supabase = createFakeSupabase({
    "questions.select": { data: PREGUNTA, error: null },
    "question_answers.insert": { data: { id: "intento-1" }, error: null },
    "rpc.mark_question_answered": { data: null, error: null },
    "rpc.mark_answer_failed": { data: null, error: null },
    ...overrides,
  });
}

beforeEach(() => {
  postAnswerMock.mockReset();
  syncMock.mockReset().mockResolvedValue("updated");
  setup();
});

describe("envío exitoso", () => {
  it("registra el intento antes de llamar a Mercado Libre", async () => {
    postAnswerMock.mockResolvedValue({ id: 1 });

    await sendAnswer({ questionId: "pregunta-1", text: "Sí, hay stock.", userId: "usuario-1" });

    const intento = argsOf(supabase.on("question_answers")[0], "insert") as Record<string, unknown>;
    // El registro va primero: si el proceso muere después de publicar, queda
    // rastro de que se intentó y la reconciliación puede cerrarlo.
    expect(intento.status).toBe("sending");
    expect(intento.text).toBe("Sí, hay stock.");
    expect(intento.sent_by).toBe("usuario-1");
    expect(intento.source).toBe("pana");
  });

  it("cierra con la función atómica", async () => {
    postAnswerMock.mockResolvedValue({ id: 1 });

    await sendAnswer({ questionId: "pregunta-1", text: "Sí.", userId: "usuario-1" });

    // Marcar el intento y la pregunta en dos pasos dejaría una ventana en la
    // que la respuesta está publicada y la pregunta figura pendiente.
    expect(supabase.rpcCalls[0]?.name).toBe("mark_question_answered");
    expect(supabase.rpcCalls[0]?.args).toMatchObject({ p_answer_id: "intento-1" });
  });

  it("manda el id de Mercado Libre, no el nuestro", async () => {
    postAnswerMock.mockResolvedValue({ id: 1 });

    await sendAnswer({ questionId: "pregunta-1", text: "Sí.", userId: "usuario-1" });

    expect(postAnswerMock).toHaveBeenCalledWith(expect.anything(), {
      questionId: 5036111111,
      text: "Sí.",
    });
  });
});

describe("cuando no se puede enviar", () => {
  it("no envía si otra persona está enviando", async () => {
    setup({
      "question_answers.insert": { data: null, error: { code: "23505", message: "duplicate key" } },
    });

    await expect(
      sendAnswer({ questionId: "pregunta-1", text: "Sí.", userId: "usuario-2" }),
    ).rejects.toMatchObject({ code: "conflict" });

    // Nunca llegó a Mercado Libre: es exactamente lo que evita la respuesta doble.
    expect(postAnswerMock).not.toHaveBeenCalled();
  });

  it("no envía si ya fue respondida", async () => {
    setup({ "questions.select": { data: { ...PREGUNTA, status: "answered" }, error: null } });

    await expect(
      sendAnswer({ questionId: "pregunta-1", text: "Sí.", userId: "usuario-1" }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(postAnswerMock).not.toHaveBeenCalled();
  });

  it("no envía si la pregunta se borró en Mercado Libre", async () => {
    setup({
      "questions.select": {
        data: { ...PREGUNTA, deleted_at: "2026-09-08T10:00:00Z" },
        error: null,
      },
    });

    await expect(
      sendAnswer({ questionId: "pregunta-1", text: "Sí.", userId: "usuario-1" }),
    ).rejects.toMatchObject({ code: "ml_not_found" });
    expect(postAnswerMock).not.toHaveBeenCalled();
  });

  it("falla claro si la pregunta no existe", async () => {
    setup({ "questions.select": { data: null, error: null } });

    await expect(
      sendAnswer({ questionId: "pregunta-1", text: "Sí.", userId: "usuario-1" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("cuando Mercado Libre rechaza o no responde", () => {
  it("deja el intento como fallido y libera el candado", async () => {
    postAnswerMock.mockRejectedValue(new MlUnavailableError("timeout"));

    await expect(
      sendAnswer({ questionId: "pregunta-1", text: "Sí.", userId: "usuario-1" }),
    ).rejects.toMatchObject({ code: "ml_unavailable" });

    expect(supabase.rpcCalls[0]?.name).toBe("mark_answer_failed");
    expect(supabase.rpcCalls[0]?.args).toMatchObject({
      p_answer_id: "intento-1",
      p_error_code: "ml_unavailable",
    });
  });

  it("ante un timeout avisa que verifique antes de reintentar", async () => {
    postAnswerMock.mockRejectedValue(new MlUnavailableError("socket hang up"));

    const error = await sendAnswer({
      questionId: "pregunta-1",
      text: "Sí.",
      userId: "usuario-1",
    }).catch((e: unknown) => e);

    // No sabemos si llegó. Reintentar a ciegas puede duplicar la respuesta
    // publicada, así que el mensaje lo dice.
    expect((error as { userMessage: string }).userMessage).toMatch(/verificá/i);
  });

  it("re-sincroniza la pregunta cuando el rechazo es por su estado", async () => {
    postAnswerMock.mockRejectedValue(new MlValidationError("question already answered"));

    await expect(
      sendAnswer({ questionId: "pregunta-1", text: "Sí.", userId: "usuario-1" }),
    ).rejects.toMatchObject({ code: "ml_validation" });

    // Si Mercado Libre dice que ya está respondida, lo que tenemos guardado
    // está desactualizado: se relee para que la pantalla muestre la realidad.
    expect(syncMock).toHaveBeenCalledWith(expect.anything(), {
      accountId: "cuenta-1",
      questionId: 5036111111,
    });
  });

  it("no re-sincroniza ante un límite de tasa", async () => {
    postAnswerMock.mockRejectedValue(new MlRateLimitError("too many requests"));

    await expect(
      sendAnswer({ questionId: "pregunta-1", text: "Sí.", userId: "usuario-1" }),
    ).rejects.toMatchObject({ code: "ml_rate_limit" });

    // El estado de la pregunta no cambió: insistir contra una API que ya nos
    // está frenando solo empeora el límite.
    expect(syncMock).not.toHaveBeenCalled();
  });

  it("sigue adelante aunque la re-sincronización también falle", async () => {
    postAnswerMock.mockRejectedValue(new MlValidationError("rechazada"));
    syncMock.mockRejectedValue(new Error("tampoco responde"));

    // El error que ve la persona tiene que ser el original, no el del intento
    // de recuperación.
    await expect(
      sendAnswer({ questionId: "pregunta-1", text: "Sí.", userId: "usuario-1" }),
    ).rejects.toMatchObject({ code: "ml_validation" });
  });
});
