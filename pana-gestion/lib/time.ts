import { formatDistanceToNowStrict, format } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Punto único de "ahora". Todo el código lo usa en vez de `new Date()` para
 * que los tests puedan congelar el reloj sin parchear globales.
 */
export function now(): Date {
  return new Date(Date.now());
}

export const TIMEZONE = "America/Argentina/Buenos_Aires";

const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  // 24 horas: es como se escribe la hora en Argentina, y en una tabla el
  // "a. m. / p. m." ocupa lugar sin aportar nada.
  hourCycle: "h23",
});

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** "08/09/2026 14:35" en hora de Buenos Aires. */
export function formatDateTime(value: Date | string | null | undefined): string {
  const date = toDate(value);
  return date ? dateTimeFormatter.format(date) : "—";
}

/** "08/09/2026" en hora de Buenos Aires. */
export function formatDate(value: Date | string | null | undefined): string {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : "—";
}

/** "hace 3 horas" */
export function formatRelative(value: Date | string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return formatDistanceToNowStrict(date, { locale: es, addSuffix: true });
}

/** "3 h" / "2 d" — compacto, para columnas de tabla. */
export function formatAge(
  value: Date | string | null | undefined,
  reference: Date = now(),
): string {
  const date = toDate(value);
  if (!date) return "—";

  const minutes = Math.max(0, Math.floor((reference.getTime() - date.getTime()) / 60_000));
  if (minutes < 1) return "recién";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d`;

  return format(date, "dd/MM/yy", { locale: es });
}

/** Horas transcurridas desde una fecha. Sirve para los umbrales de urgencia. */
export function hoursSince(
  value: Date | string | null | undefined,
  reference: Date = now(),
): number {
  const date = toDate(value);
  if (!date) return 0;
  return (reference.getTime() - date.getTime()) / 3_600_000;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
