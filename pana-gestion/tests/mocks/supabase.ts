/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Doble de Supabase para tests.
 *
 * No simula PostgREST entero: registra la cadena de llamadas y devuelve el
 * resultado que el test configuró. Alcanza para verificar decisiones de
 * lógica (¿se guardó?, ¿con qué datos?, ¿se descartó el evento ajeno?).
 *
 * Lo que este doble NO puede verificar es si las consultas son válidas contra
 * el esquema real: de eso se ocupan las pruebas de base de datos
 * (scripts/check-migrations.sh), que corren SQL de verdad.
 */

export type FakeResult = { data: unknown; error: unknown };

export type RecordedCall = {
  table: string;
  ops: { name: string; args: unknown[] }[];
};

export type FakeSupabase = {
  client: any;
  calls: RecordedCall[];
  rpcCalls: { name: string; args: unknown }[];
  /** Devuelve las llamadas hechas sobre una tabla. */
  on: (table: string) => RecordedCall[];
};

/**
 * @param results  Resultado por `tabla.operación` (por ejemplo `questions.upsert`).
 *                 Puede ser un valor fijo o una función, para respuestas que
 *                 cambian entre llamadas.
 */
export function createFakeSupabase(
  results: Record<string, FakeResult | ((call: RecordedCall) => FakeResult)> = {},
): FakeSupabase {
  const calls: RecordedCall[] = [];
  const rpcCalls: { name: string; args: unknown }[] = [];

  const client = {
    from(table: string) {
      const record: RecordedCall = { table, ops: [] };
      calls.push(record);

      const proxy: any = new Proxy(
        {},
        {
          get(_target, prop: string | symbol) {
            if (prop === "then") {
              return (resolve: (value: FakeResult) => unknown) => {
                const key = `${table}.${record.ops[0]?.name ?? "select"}`;
                const configured = results[key] ?? { data: null, error: null };
                const value = typeof configured === "function" ? configured(record) : configured;
                return resolve(value);
              };
            }
            return (...args: unknown[]) => {
              record.ops.push({ name: String(prop), args });
              return proxy;
            };
          },
        },
      );

      return proxy;
    },

    rpc(name: string, args: unknown) {
      rpcCalls.push({ name, args });
      const configured = results[`rpc.${name}`] ?? { data: null, error: null };
      const value =
        typeof configured === "function" ? configured({ table: name, ops: [] }) : configured;
      return Promise.resolve(value);
    },
  };

  return {
    client,
    calls,
    rpcCalls,
    on: (table: string) => calls.filter((call) => call.table === table),
  };
}

/** Busca los argumentos con los que se llamó a una operación. */
export function argsOf(call: RecordedCall | undefined, op: string): unknown {
  return call?.ops.find((operation) => operation.name === op)?.args[0];
}
