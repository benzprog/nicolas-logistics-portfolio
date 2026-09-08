import { describe, expect, it } from "vitest";

import { formatAge, formatDate, formatDateTime, hoursSince } from "@/lib/time";

/**
 * La antigüedad de una pregunta es el dato que más se mira en el listado:
 * decide a cuál se responde primero.
 */
describe("antigüedad", () => {
  const ahora = new Date("2026-09-08T15:00:00.000Z");

  it("resume en la unidad que corresponde", () => {
    expect(formatAge("2026-09-08T14:59:30.000Z", ahora)).toBe("recién");
    expect(formatAge("2026-09-08T14:45:00.000Z", ahora)).toBe("15 min");
    expect(formatAge("2026-09-08T12:00:00.000Z", ahora)).toBe("3 h");
    expect(formatAge("2026-09-06T15:00:00.000Z", ahora)).toBe("2 d");
  });

  it("no muestra tiempos negativos", () => {
    // Los relojes se desfasan: una fecha "del futuro" no puede mostrar -3 h.
    expect(formatAge("2026-09-08T16:00:00.000Z", ahora)).toBe("recién");
  });

  it("marca lo que no tiene fecha", () => {
    expect(formatAge(null, ahora)).toBe("—");
    expect(formatAge("no es una fecha", ahora)).toBe("—");
  });

  it("cuenta las horas para los umbrales de urgencia", () => {
    expect(hoursSince("2026-09-07T15:00:00.000Z", ahora)).toBe(24);
    expect(hoursSince("2026-09-08T13:30:00.000Z", ahora)).toBe(1.5);
  });
});

describe("fechas mostradas", () => {
  it("van en hora de Buenos Aires y formato local", () => {
    // 15:00 UTC son las 12:00 en Buenos Aires (UTC-3).
    expect(formatDateTime("2026-09-08T15:00:00.000Z")).toBe("08/09/2026, 12:00");
    expect(formatDate("2026-09-08T15:00:00.000Z")).toBe("08/09/2026");
  });

  it("una fecha de madrugada UTC cae el día anterior en Argentina", () => {
    // 02:00 UTC del 9 son las 23:00 del 8 acá: mostrar el 9 confundiría.
    expect(formatDate("2026-09-09T02:00:00.000Z")).toBe("08/09/2026");
  });

  it("tolera valores vacíos", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });
});
