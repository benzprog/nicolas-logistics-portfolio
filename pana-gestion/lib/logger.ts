/**
 * Logger estructurado.
 *
 * Escribe JSON en una línea (que es lo que Vercel indexa bien) y redacta
 * cualquier campo que pueda contener un secreto, incluso si viene anidado.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const REDACTED_KEYS = new Set([
  "access_token",
  "refresh_token",
  "accesstoken",
  "refreshtoken",
  "access_token_enc",
  "refresh_token_enc",
  "client_secret",
  "authorization",
  "password",
  "secret",
  "token",
  "code",
  "code_verifier",
  "apikey",
  "api_key",
  "service_role_key",
]);

const REDACTED = "[redactado]";

/** Reemplaza los valores sensibles por un marcador, recursivamente. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[demasiado profundo]";
  if (value === null || value === undefined) return value;
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = REDACTED_KEYS.has(key.toLowerCase()) ? REDACTED : redact(item, depth + 1);
    }
    return output;
  }
  return value;
}

function currentLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL;
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") return raw;
  return "info";
}

function write(level: LogLevel, message: string, context?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[currentLevel()]) return;

  const entry = {
    level,
    message,
    time: new Date(Date.now()).toISOString(),
    ...(context ? { context: redact(context) } : {}),
  };

  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => write("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => write("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => write("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => write("error", message, context),
};
