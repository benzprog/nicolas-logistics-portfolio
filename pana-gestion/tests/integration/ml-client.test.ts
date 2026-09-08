import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";

import { mlServer } from "@/tests/mocks/mercadolibre/server";
import { mlRequest } from "@/services/mercadolibre/client";
import {
  MlAuthError,
  MlNotFoundError,
  MlRateLimitError,
  MlUnavailableError,
  MlValidationError,
} from "@/services/mercadolibre/errors";

/**
 * El cliente HTTP es el que decide cuándo reintentar. Equivocarse acá tiene
 * dos formas de doler: no reintentar un error pasajero (se pierde una
 * pregunta) o reintentar un envío (se publica la respuesta dos veces).
 */
beforeAll(() => mlServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mlServer.resetHandlers());
afterAll(() => mlServer.close());

const auth = { getAccessToken: async () => "token-valido" };

describe("cliente de Mercado Libre", () => {
  it("manda el token y devuelve el cuerpo", async () => {
    let authorization: string | null = null;

    mlServer.use(
      http.get("https://api.mercadolibre.com/users/me", ({ request }) => {
        authorization = request.headers.get("authorization");
        return HttpResponse.json({ id: 1, nickname: "PANA" });
      }),
    );

    const result = await mlRequest<{ nickname: string }>("/users/me", { auth });

    expect(result.nickname).toBe("PANA");
    expect(authorization).toBe("Bearer token-valido");
  });

  it("arma la query con los parámetros dados", async () => {
    let url = "";
    mlServer.use(
      http.get("https://api.mercadolibre.com/questions/search", ({ request }) => {
        url = request.url;
        return HttpResponse.json({ questions: [] });
      }),
    );

    await mlRequest("/questions/search", {
      auth,
      query: { seller_id: 42, limit: 50, vacio: undefined },
    });

    expect(url).toContain("seller_id=42");
    expect(url).toContain("limit=50");
    expect(url).not.toContain("vacio");
  });

  it("reintenta ante un 500 y sale adelante", async () => {
    let calls = 0;
    mlServer.use(
      http.get("https://api.mercadolibre.com/items/MLA1", () => {
        calls += 1;
        if (calls === 1) return new HttpResponse(null, { status: 503 });
        return HttpResponse.json({ id: "MLA1" });
      }),
    );

    const result = await mlRequest<{ id: string }>("/items/MLA1", { auth, maxRetries: 1 });

    expect(result.id).toBe("MLA1");
    expect(calls).toBe(2);
  });

  it("se rinde cuando se agotan los reintentos", async () => {
    mlServer.use(
      http.get(
        "https://api.mercadolibre.com/items/MLA1",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    await expect(mlRequest("/items/MLA1", { auth, maxRetries: 1 })).rejects.toBeInstanceOf(
      MlUnavailableError,
    );
  });

  it("NO reintenta un POST", async () => {
    // Es la regla más importante del cliente: reintentar un POST /answers a
    // ciegas puede publicar la misma respuesta dos veces en la publicación.
    let calls = 0;
    mlServer.use(
      http.post("https://api.mercadolibre.com/answers", () => {
        calls += 1;
        return new HttpResponse(null, { status: 500 });
      }),
    );

    await expect(
      mlRequest("/answers", { method: "POST", auth, body: { question_id: 1, text: "hola" } }),
    ).rejects.toBeInstanceOf(MlUnavailableError);

    expect(calls).toBe(1);
  });

  it("renueva el token una sola vez ante un 401", async () => {
    let calls = 0;
    let refreshes = 0;
    let currentToken = "token-vencido";

    mlServer.use(
      http.get("https://api.mercadolibre.com/users/me", ({ request }) => {
        calls += 1;
        if (request.headers.get("authorization") === "Bearer token-nuevo") {
          return HttpResponse.json({ id: 1 });
        }
        return HttpResponse.json({ message: "invalid token" }, { status: 401 });
      }),
    );

    await mlRequest("/users/me", {
      auth: {
        getAccessToken: async () => currentToken,
        refreshAccessToken: async () => {
          refreshes += 1;
          currentToken = "token-nuevo";
          return currentToken;
        },
      },
    });

    expect(calls).toBe(2);
    expect(refreshes).toBe(1);
  });

  it("no entra en bucle si sigue dando 401 después de renovar", async () => {
    let refreshes = 0;

    mlServer.use(
      http.get("https://api.mercadolibre.com/users/me", () =>
        HttpResponse.json({ message: "invalid token" }, { status: 401 }),
      ),
    );

    await expect(
      mlRequest("/users/me", {
        auth: {
          getAccessToken: async () => "token",
          refreshAccessToken: async () => {
            refreshes += 1;
            return "otro";
          },
        },
      }),
    ).rejects.toBeInstanceOf(MlAuthError);

    expect(refreshes).toBe(1);
  });

  it("respeta el Retry-After de un 429", async () => {
    let calls = 0;
    mlServer.use(
      http.get("https://api.mercadolibre.com/items/MLA1", () => {
        calls += 1;
        if (calls === 1) {
          return new HttpResponse(null, { status: 429, headers: { "retry-after": "0" } });
        }
        return HttpResponse.json({ id: "MLA1" });
      }),
    );

    await mlRequest("/items/MLA1", { auth, maxRetries: 1 });
    expect(calls).toBe(2);
  });

  it("propaga el límite de tasa cuando no quedan reintentos", async () => {
    mlServer.use(
      http.get(
        "https://api.mercadolibre.com/items/MLA1",
        () => new HttpResponse(null, { status: 429, headers: { "retry-after": "60" } }),
      ),
    );

    const error = await mlRequest("/items/MLA1", { auth, maxRetries: 0 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MlRateLimitError);
    expect((error as MlRateLimitError).retryAfterSeconds).toBe(60);
  });

  it("no reintenta un 404 ni un 400", async () => {
    let notFound = 0;
    let badRequest = 0;

    mlServer.use(
      http.get("https://api.mercadolibre.com/questions/1", () => {
        notFound += 1;
        return HttpResponse.json({ message: "no existe" }, { status: 404 });
      }),
      http.get("https://api.mercadolibre.com/questions/2", () => {
        badRequest += 1;
        return HttpResponse.json({ message: "parámetro inválido" }, { status: 400 });
      }),
    );

    await expect(mlRequest("/questions/1", { auth })).rejects.toBeInstanceOf(MlNotFoundError);
    await expect(mlRequest("/questions/2", { auth })).rejects.toBeInstanceOf(MlValidationError);
    expect(notFound).toBe(1);
    expect(badRequest).toBe(1);
  });

  it("convierte un corte de red en indisponibilidad", async () => {
    mlServer.use(http.get("https://api.mercadolibre.com/items/MLA1", () => HttpResponse.error()));

    await expect(mlRequest("/items/MLA1", { auth, maxRetries: 0 })).rejects.toBeInstanceOf(
      MlUnavailableError,
    );
  });

  it("aborta si la API tarda demasiado", async () => {
    mlServer.use(
      http.get("https://api.mercadolibre.com/items/MLA1", async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return HttpResponse.json({ id: "MLA1" });
      }),
    );

    await expect(
      mlRequest("/items/MLA1", { auth, timeoutMs: 30, maxRetries: 0 }),
    ).rejects.toBeInstanceOf(MlUnavailableError);
  });

  it("tolera una respuesta vacía", async () => {
    mlServer.use(
      http.get(
        "https://api.mercadolibre.com/items/MLA1",
        () => new HttpResponse(null, { status: 200 }),
      ),
    );
    await expect(mlRequest("/items/MLA1", { auth })).resolves.toBeNull();
  });
});

afterEach(() => vi.restoreAllMocks());
