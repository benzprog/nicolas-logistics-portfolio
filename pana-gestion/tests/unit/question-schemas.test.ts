import { describe, expect, it } from "vitest";

import { answerSchema, questionFiltersSchema } from "@/features/mercadolibre/questions/schemas";
import { ML_ANSWER_MAX_LENGTH } from "@/services/mercadolibre/constants";

/**
 * Los filtros llegan de la URL, así que pueden venir con cualquier cosa: un
 * enlace viejo, alguien editando la barra de direcciones, un bot. Nunca pueden
 * romper la página; caen al valor razonable.
 */
describe("filtros del listado", () => {
  it("usa valores por defecto cuando no hay nada", () => {
    const filters = questionFiltersSchema.parse({});
    expect(filters).toMatchObject({ estado: "pending", orden: "oldest", pagina: 1 });
  });

  it("acepta los valores válidos", () => {
    const filters = questionFiltersSchema.parse({
      estado: "answered",
      orden: "newest",
      pagina: "3",
      q: "  luz cálida  ",
      publicacion: "MLA123456789",
    });

    expect(filters.estado).toBe("answered");
    expect(filters.pagina).toBe(3);
    expect(filters.q).toBe("luz cálida");
  });

  it("ignora un estado inventado en vez de fallar", () => {
    expect(questionFiltersSchema.parse({ estado: "borradas" }).estado).toBe("pending");
  });

  it("ignora páginas absurdas", () => {
    expect(questionFiltersSchema.parse({ pagina: "-5" }).pagina).toBe(1);
    expect(questionFiltersSchema.parse({ pagina: "abc" }).pagina).toBe(1);
    expect(questionFiltersSchema.parse({ pagina: "999999" }).pagina).toBe(1);
  });

  it("corta una búsqueda desmedida", () => {
    expect(questionFiltersSchema.parse({ q: "x".repeat(500) }).q).toBeUndefined();
  });
});

describe("validación de la respuesta", () => {
  it("acepta una respuesta normal", () => {
    const result = answerSchema.safeParse({
      questionId: "3f6b1a1e-6d24-4f6e-9c1e-2f9a1b3c4d5e",
      text: "  Sí, tenemos stock.  ",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.text).toBe("Sí, tenemos stock.");
  });

  it("rechaza una respuesta vacía o de puros espacios", () => {
    const id = "3f6b1a1e-6d24-4f6e-9c1e-2f9a1b3c4d5e";
    expect(answerSchema.safeParse({ questionId: id, text: "" }).success).toBe(false);
    expect(answerSchema.safeParse({ questionId: id, text: "     " }).success).toBe(false);
  });

  it("rechaza una respuesta más larga de lo que acepta Mercado Libre", () => {
    const result = answerSchema.safeParse({
      questionId: "3f6b1a1e-6d24-4f6e-9c1e-2f9a1b3c4d5e",
      text: "a".repeat(ML_ANSWER_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un id que no es de una pregunta nuestra", () => {
    expect(answerSchema.safeParse({ questionId: "5036111111", text: "hola" }).success).toBe(false);
  });
});
