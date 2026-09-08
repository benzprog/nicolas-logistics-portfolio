import { ML_API_BASE } from "@/services/mercadolibre/constants";
import {
  MlAuthError,
  MlRateLimitError,
  MlUnavailableError,
  mlErrorFromResponse,
} from "@/services/mercadolibre/errors";
import { logger } from "@/lib/logger";

/**
 * Cliente HTTP de Mercado Libre.
 *
 * No conoce la base de datos ni el dominio: recibe una función que le da un
 * token válido. Eso lo hace probable sin levantar nada y deja la política de
 * renovación en un solo lugar.
 */

export type TokenProvider = {
  /** Devuelve un access token vigente. */
  getAccessToken: () => Promise<string>;
  /** Fuerza una renovación. Se llama una sola vez ante un 401. */
  refreshAccessToken?: () => Promise<string>;
};

export type MlRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Autenticación. Sin esto, la llamada va sin token (solo endpoints públicos). */
  auth?: TokenProvider;
  timeoutMs?: number;
  /** Reintentos ante 5xx, timeout o red caída. Solo para operaciones idempotentes. */
  maxRetries?: number;
  signal?: AbortSignal;
};

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;

export async function mlRequest<T>(path: string, options: MlRequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const isIdempotent = method === "GET" || method === "DELETE";

  // Un POST no se reintenta solo: si la primera llamada llegó a Mercado Libre y
  // se perdió la respuesta, el reintento publicaría la respuesta dos veces.
  const maxRetries = options.maxRetries ?? (isIdempotent ? DEFAULT_MAX_RETRIES : 0);

  const url = buildUrl(path, options.query);
  let refreshed = false;
  let attempt = 0;

  for (;;) {
    const token = options.auth ? await options.auth.getAccessToken() : undefined;

    let response: Response;
    try {
      response = await fetchWithTimeout(url, {
        method,
        headers: {
          Accept: "application/json",
          ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        signal: options.signal,
      });
    } catch (cause) {
      // Timeout, DNS, conexión cortada. No sabemos si llegó a destino.
      if (attempt < maxRetries) {
        attempt += 1;
        await sleep(backoffMs(attempt));
        continue;
      }
      const reason = cause instanceof Error ? cause.message : String(cause);
      logger.warn("No se pudo contactar a Mercado Libre", { path, method, reason });
      throw new MlUnavailableError(`No se pudo contactar a Mercado Libre: ${reason}`, { cause });
    }

    let body: unknown;
    try {
      body = await parseBody(response);
    } catch (cause) {
      if (attempt < maxRetries) {
        attempt += 1;
        await sleep(backoffMs(attempt));
        continue;
      }
      throw new MlUnavailableError("La respuesta de Mercado Libre se cortó", { cause });
    }

    if (response.ok) return body as T;

    const error = mlErrorFromResponse(response.status, body, response.headers.get("retry-after"));

    // Un 401 puede ser simplemente que el token venció entre medio. Se renueva
    // y se reintenta UNA vez: hasta acá la operación no tuvo efecto.
    if (error instanceof MlAuthError && options.auth?.refreshAccessToken && !refreshed) {
      refreshed = true;
      logger.info("Token rechazado por Mercado Libre: renovando y reintentando", { path });
      await options.auth.refreshAccessToken();
      continue;
    }

    if (error instanceof MlRateLimitError && attempt < maxRetries) {
      attempt += 1;
      await sleep(error.retryAfterSeconds * 1000 + jitter());
      continue;
    }

    if (error instanceof MlUnavailableError && attempt < maxRetries) {
      attempt += 1;
      await sleep(backoffMs(attempt));
      continue;
    }

    logger.warn("Mercado Libre devolvió un error", {
      path,
      method,
      status: response.status,
      error: error.message,
    });
    throw error;
  }
}

function buildUrl(path: string, query?: MlRequestOptions["query"]): string {
  const url = new URL(path.startsWith("http") ? path : `${ML_API_BASE}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs: number },
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs);

  // Si quien llama ya trajo su propia señal, cancelar por cualquiera de las dos.
  if (init.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Espera creciente con algo de azar, para que varios procesos no reintenten a la vez. */
function backoffMs(attempt: number): number {
  return Math.min(8_000, 2 ** attempt * 250) + jitter();
}

function jitter(): number {
  return Math.floor(Math.random() * 250);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
