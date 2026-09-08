import { describe, expect, it } from "vitest";

import { redact } from "@/lib/logger";

/**
 * Un token en los logs es un token filtrado: los logs se comparten, se pegan
 * en tickets y se mandan por chat.
 */
describe("redacción de secretos en los logs", () => {
  it("tapa los campos sensibles", () => {
    const output = redact({
      access_token: "APP_USR-secreto",
      refresh_token: "TG-secreto",
      client_secret: "shh",
      authorization: "Bearer abc",
      nickname: "PANAILUMINACION",
    }) as Record<string, unknown>;

    expect(output.access_token).toBe("[redactado]");
    expect(output.refresh_token).toBe("[redactado]");
    expect(output.client_secret).toBe("[redactado]");
    expect(output.authorization).toBe("[redactado]");
    // Lo que no es secreto tiene que seguir siendo legible, o el log no sirve.
    expect(output.nickname).toBe("PANAILUMINACION");
  });

  it("los tapa también anidados y dentro de arrays", () => {
    const output = redact({
      cuentas: [{ tokens: { access_token: "secreto", scope: "read write" } }],
    }) as { cuentas: { tokens: Record<string, unknown> }[] };

    expect(output.cuentas[0]!.tokens.access_token).toBe("[redactado]");
    expect(output.cuentas[0]!.tokens.scope).toBe("read write");
  });

  it("no distingue mayúsculas", () => {
    const output = redact({ Access_Token: "secreto", AUTHORIZATION: "Bearer x" }) as Record<
      string,
      unknown
    >;
    expect(output.Access_Token).toBe("[redactado]");
    expect(output.AUTHORIZATION).toBe("[redactado]");
  });

  it("resume los errores sin arrastrar el stack", () => {
    const output = redact(new Error("algo falló")) as Record<string, unknown>;
    expect(output).toEqual({ name: "Error", message: "algo falló" });
  });

  it("corta las estructuras muy profundas", () => {
    let deep: Record<string, unknown> = { valor: "fondo" };
    for (let i = 0; i < 12; i += 1) deep = { nivel: deep };
    expect(JSON.stringify(redact(deep))).toContain("demasiado profundo");
  });
});
