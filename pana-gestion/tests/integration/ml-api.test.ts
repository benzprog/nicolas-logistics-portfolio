import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";

import { mlServer } from "@/tests/mocks/mercadolibre/server";
import { itemResponse, questionResponse, userResponse } from "@/tests/mocks/mercadolibre/fixtures";
import {
  fetchCurrentUser,
  fetchItem,
  fetchQuestion,
  postAnswer,
  searchQuestions,
} from "@/services/mercadolibre/api";
import { MlValidationError } from "@/services/mercadolibre/errors";
import { ML_ANSWER_MAX_LENGTH } from "@/services/mercadolibre/constants";
import { idFromResource } from "@/services/mercadolibre/types";

beforeAll(() => mlServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mlServer.resetHandlers());
afterAll(() => mlServer.close());

const auth = { getAccessToken: async () => "token" };

describe("lecturas", () => {
  it("trae la cuenta conectada", async () => {
    mlServer.use(
      http.get("https://api.mercadolibre.com/users/me", () => HttpResponse.json(userResponse)),
    );
    const user = await fetchCurrentUser(auth);
    expect(user.nickname).toBe("PANAILUMINACION");
  });

  it("trae una pregunta con la versión de API correcta", async () => {
    let url = "";
    mlServer.use(
      http.get("https://api.mercadolibre.com/questions/5036111111", ({ request }) => {
        url = request.url;
        return HttpResponse.json(questionResponse);
      }),
    );

    const question = await fetchQuestion(auth, 5036111111);
    expect(question.item_id).toBe("MLA123456789");
    expect(url).toContain("api_version=4");
  });

  it("busca preguntas sin responder, de la más vieja a la más nueva", async () => {
    let url = "";
    mlServer.use(
      http.get("https://api.mercadolibre.com/questions/search", ({ request }) => {
        url = request.url;
        return HttpResponse.json({ total: 1, questions: [questionResponse] });
      }),
    );

    const result = await searchQuestions(auth, { sellerId: 987654321, status: "UNANSWERED" });

    expect(result.total).toBe(1);
    expect(result.questions).toHaveLength(1);
    expect(url).toContain("seller_id=987654321");
    expect(url).toContain("status=UNANSWERED");
    // Las más viejas primero: son las que más urgen.
    expect(url).toContain("sort_types=ASC");
  });

  it("no se rompe si la búsqueda no trae total", async () => {
    mlServer.use(
      http.get("https://api.mercadolibre.com/questions/search", () =>
        HttpResponse.json({ questions: [questionResponse] }),
      ),
    );
    expect((await searchQuestions(auth, { sellerId: 1 })).total).toBe(1);
  });

  it("pide de la publicación solo los campos que se muestran", async () => {
    let url = "";
    mlServer.use(
      http.get("https://api.mercadolibre.com/items/MLA123456789", ({ request }) => {
        url = request.url;
        return HttpResponse.json(itemResponse);
      }),
    );

    const item = await fetchItem(auth, "MLA123456789");
    expect(item.title).toContain("Lámpara LED");
    expect(url).toContain("attributes=");
    expect(decodeURIComponent(url)).toContain("available_quantity");
  });
});

describe("envío de respuestas", () => {
  it("manda la pregunta y el texto", async () => {
    let body: Record<string, unknown> = {};
    mlServer.use(
      http.post("https://api.mercadolibre.com/answers", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 1 });
      }),
    );

    await postAnswer(auth, { questionId: 5036111111, text: "  Sí, hay stock.  " });

    expect(body.question_id).toBe(5036111111);
    // El texto va sin espacios de sobra.
    expect(body.text).toBe("Sí, hay stock.");
  });

  it("no llega a llamar a la API con una respuesta vacía", async () => {
    // Sin handler registrado: si intentara la llamada, MSW haría fallar el test.
    await expect(postAnswer(auth, { questionId: 1, text: "   " })).rejects.toBeInstanceOf(
      MlValidationError,
    );
  });

  it("corta antes si la respuesta supera el máximo", async () => {
    await expect(
      postAnswer(auth, { questionId: 1, text: "a".repeat(ML_ANSWER_MAX_LENGTH + 1) }),
    ).rejects.toThrow(/supera/);
  });
});

describe("id dentro del recurso de una notificación", () => {
  it("lo extrae", () => {
    expect(idFromResource("/questions/5036111111")).toBe(5036111111);
    expect(idFromResource("/orders/2000003508419013")).toBe(2000003508419013);
    expect(idFromResource("  /questions/42  ")).toBe(42);
  });

  it("devuelve null si no hay número", () => {
    expect(idFromResource("/questions/")).toBeNull();
    expect(idFromResource("/items/MLA123ABC")).toBeNull();
  });
});
