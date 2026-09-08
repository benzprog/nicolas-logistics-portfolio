/**
 * Errores de la aplicación.
 *
 * La idea es que el usuario nunca lea un error técnico: cada error sabe
 * traducirse a un mensaje útil, y el detalle crudo queda en los logs.
 */

export type AppErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation"
  | "conflict"
  | "database"
  | "integration_disconnected"
  | "integration_needs_reauth"
  | "ml_auth"
  | "ml_not_found"
  | "ml_validation"
  | "ml_rate_limit"
  | "ml_unavailable"
  | "unknown";

const USER_MESSAGES: Record<AppErrorCode, string> = {
  unauthorized: "Tenés que iniciar sesión para hacer esto.",
  forbidden: "No tenés permisos para esta acción.",
  not_found: "No encontramos lo que buscabas.",
  validation: "Revisá los datos ingresados.",
  conflict: "Otra persona hizo un cambio al mismo tiempo. Actualizá y probá de nuevo.",
  database: "Ocurrió un error interno. Ya quedó registrado y lo vamos a revisar.",
  integration_disconnected:
    "No hay ninguna cuenta de Mercado Libre conectada. Un administrador tiene que conectarla en Configuración.",
  integration_needs_reauth:
    "La conexión con Mercado Libre venció. Un administrador tiene que reconectar la cuenta en Configuración.",
  ml_auth:
    "La conexión con Mercado Libre venció. Un administrador tiene que reconectar la cuenta en Configuración.",
  ml_not_found: "Este contenido ya no existe en Mercado Libre.",
  ml_validation: "Mercado Libre rechazó la operación.",
  ml_rate_limit: "Mercado Libre está limitando las solicitudes. Esperá unos segundos y reintentá.",
  ml_unavailable: "Mercado Libre no respondió. Reintentá en un momento.",
  unknown: "Ocurrió un error inesperado. Ya quedó registrado.",
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  /** Mensaje pensado para mostrarle a la persona que usa el sistema. */
  readonly userMessage: string;
  /** Contexto técnico para los logs. Nunca contiene tokens. */
  readonly context: Record<string, unknown>;

  constructor(
    code: AppErrorCode,
    options: {
      message?: string;
      userMessage?: string;
      context?: Record<string, unknown>;
      cause?: unknown;
    } = {},
  ) {
    super(options.message ?? code, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.userMessage = options.userMessage ?? USER_MESSAGES[code];
    this.context = options.context ?? {};
  }
}

/** Traduce cualquier error a un mensaje mostrable. */
export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) return error.userMessage;
  return USER_MESSAGES.unknown;
}

export function isAppError(error: unknown, code?: AppErrorCode): error is AppError {
  if (!(error instanceof AppError)) return false;
  return code ? error.code === code : true;
}
