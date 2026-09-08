/**
 * Resultado explícito para las fronteras que cruzan al cliente.
 *
 * Las Server Actions no pueden lanzar excepciones tipadas hasta el navegador
 * (Next las serializa como un error genérico en producción), así que devuelven
 * esto y el componente decide qué mostrar.
 */
export type Result<T, E = string> =
  | { ok: true; data: T }
  | { ok: false; error: E; code?: string };

export function ok<T>(data: T): Result<T, never> {
  return { ok: true, data };
}

export function fail<E = string>(error: E, code?: string): Result<never, E> {
  return { ok: false, error, code };
}
