/**
 * Errores de la API de Mercado Libre.
 *
 * Cada uno existe porque el sistema reacciona distinto: uno pide reconectar la
 * cuenta, otro esperar, otro archivar la pregunta. Un `Error` genérico obligaría
 * a leer el mensaje para decidir, que es exactamente lo que rompe cuando ellos
 * cambian un texto.
 */

export class MlError extends Error {
  readonly status: number | undefined;
  readonly body: unknown;

  constructor(message: string, options: { status?: number; body?: unknown; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.status = options.status;
    this.body = options.body;
  }
}

/** 401 / 403: el token no sirve. Hay que renovar o reconectar la cuenta. */
export class MlAuthError extends MlError {}

/** 404: la pregunta, la publicación o el recurso ya no existe. */
export class MlNotFoundError extends MlError {}

/** 400 / 422: Mercado Libre rechazó la operación por su contenido. */
export class MlValidationError extends MlError {
  /** Segundos sugeridos, si los hubiera. */
  readonly mlErrorCode: string | undefined;

  constructor(
    message: string,
    options: { status?: number; body?: unknown; mlErrorCode?: string } = {},
  ) {
    super(message, options);
    this.mlErrorCode = options.mlErrorCode;
  }
}

/** 429: hay que bajar el ritmo. */
export class MlRateLimitError extends MlError {
  readonly retryAfterSeconds: number;

  constructor(
    message: string,
    options: { status?: number; body?: unknown; retryAfterSeconds?: number } = {},
  ) {
    super(message, options);
    this.retryAfterSeconds = options.retryAfterSeconds ?? 5;
  }
}

/** 5xx, timeout o problema de red. No dice nada sobre si la operación se aplicó. */
export class MlUnavailableError extends MlError {}

/**
 * Traduce una respuesta HTTP al error que corresponde.
 *
 * Se mira el status, no el texto: los mensajes de Mercado Libre cambian y
 * llegan en distintos idiomas.
 */
export function mlErrorFromResponse(
  status: number,
  body: unknown,
  retryAfter?: string | null,
): MlError {
  const message = extractMessage(body) ?? `Mercado Libre respondió ${status}`;

  if (status === 401 || status === 403) {
    return new MlAuthError(message, { status, body });
  }
  if (status === 404) {
    return new MlNotFoundError(message, { status, body });
  }
  if (status === 429) {
    const seconds = retryAfter ? Number.parseInt(retryAfter, 10) : Number.NaN;
    return new MlRateLimitError(message, {
      status,
      body,
      retryAfterSeconds: Number.isFinite(seconds) ? seconds : 5,
    });
  }
  if (status >= 500) {
    return new MlUnavailableError(message, { status, body });
  }
  return new MlValidationError(message, { status, body, mlErrorCode: extractCode(body) });
}

function extractMessage(body: unknown): string | null {
  if (typeof body === "string" && body.trim()) return body.slice(0, 300);
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    for (const key of ["message", "error_description", "error"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.slice(0, 300);
    }
  }
  return null;
}

function extractCode(body: unknown): string | undefined {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    for (const key of ["error", "code"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return undefined;
}
