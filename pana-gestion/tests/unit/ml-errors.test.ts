import { describe, expect, it } from "vitest";

import {
  MlAuthError,
  MlNotFoundError,
  MlRateLimitError,
  MlUnavailableError,
  MlValidationError,
  mlErrorFromResponse,
} from "@/services/mercadolibre/errors";

/**
 * La clasificación se hace por status, no por el texto del mensaje: Mercado
 * Libre cambia los textos y los devuelve en distintos idiomas.
 */
describe("clasificación de errores de Mercado Libre", () => {
  it("401 y 403 son problemas de autenticación", () => {
    expect(mlErrorFromResponse(401, { message: "invalid token" })).toBeInstanceOf(MlAuthError);
    expect(mlErrorFromResponse(403, {})).toBeInstanceOf(MlAuthError);
  });

  it("404 es recurso inexistente", () => {
    expect(mlErrorFromResponse(404, { message: "not found" })).toBeInstanceOf(MlNotFoundError);
  });

  it("429 trae los segundos de espera del header", () => {
    const error = mlErrorFromResponse(429, {}, "30");
    expect(error).toBeInstanceOf(MlRateLimitError);
    expect((error as MlRateLimitError).retryAfterSeconds).toBe(30);
  });

  it("429 sin header usa una espera por defecto", () => {
    expect((mlErrorFromResponse(429, {}) as MlRateLimitError).retryAfterSeconds).toBe(5);
  });

  it("5xx es indisponibilidad", () => {
    expect(mlErrorFromResponse(500, {})).toBeInstanceOf(MlUnavailableError);
    expect(mlErrorFromResponse(503, {})).toBeInstanceOf(MlUnavailableError);
  });

  it("4xx restantes son rechazos de validación y conservan el código", () => {
    const error = mlErrorFromResponse(400, { error: "invalid_grant", message: "expired" });
    expect(error).toBeInstanceOf(MlValidationError);
    expect((error as MlValidationError).mlErrorCode).toBe("invalid_grant");
  });

  it("saca el mensaje de donde esté", () => {
    expect(mlErrorFromResponse(400, { message: "campo inválido" }).message).toBe("campo inválido");
    expect(mlErrorFromResponse(400, { error_description: "otro" }).message).toBe("otro");
    expect(mlErrorFromResponse(400, "texto plano").message).toBe("texto plano");
    expect(mlErrorFromResponse(418, null).message).toContain("418");
  });
});
