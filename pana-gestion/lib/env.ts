import { z } from "zod";

/**
 * Variables de entorno tipadas.
 *
 * Están separadas en dos: las del servidor (que incluyen secretos y nunca
 * deben terminar en el bundle del navegador) y las públicas.
 *
 * La validación del servidor es perezosa a propósito: `next build` corre sin
 * secretos en muchos entornos de CI, y no queremos que la compilación explote
 * por eso. La primera vez que alguien pide una variable en runtime, si falta,
 * el error dice exactamente cuál.
 */

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "Falta SUPABASE_SERVICE_ROLE_KEY"),

  ML_APP_ID: z.string().min(1, "Falta ML_APP_ID"),
  ML_CLIENT_SECRET: z.string().min(1, "Falta ML_CLIENT_SECRET"),
  ML_REDIRECT_URI: z.url("ML_REDIRECT_URI tiene que ser una URL absoluta"),
  ML_SITE_ID: z.string().default("MLA"),

  /** 32 bytes en base64: cifra los tokens de Mercado Libre en la base. */
  ML_TOKEN_ENCRYPTION_KEY: z
    .string()
    .refine((value) => {
      try {
        return Buffer.from(value, "base64").length === 32;
      } catch {
        return false;
      }
    }, "ML_TOKEN_ENCRYPTION_KEY tiene que ser 32 bytes en base64 (openssl rand -base64 32)"),

  /** Secreto que viaja en la URL de notificaciones de Mercado Libre. */
  ML_WEBHOOK_TOKEN: z.string().min(16, "ML_WEBHOOK_TOKEN tiene que tener al menos 16 caracteres"),

  /** Firma la cookie de `state` del flujo OAuth. */
  OAUTH_STATE_SECRET: z.string().min(32, "OAUTH_STATE_SECRET tiene que tener al menos 32 caracteres"),

  /** Autoriza al job de reconciliación. */
  CRON_SECRET: z.string().min(16, "CRON_SECRET tiene que tener al menos 16 caracteres"),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  /** 1 = no llamar a la API real de Mercado Libre (desarrollo y tests). */
  ML_MOCK: z
    .string()
    .optional()
    .transform((value) => value === "1" || value === "true"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cachedServerEnv: ServerEnv | null = null;

/** Variables del servidor. Falla con un mensaje claro si falta alguna. */
export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const detalle = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(raíz)"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Configuración inválida del servidor. Revisá el archivo .env (ver .env.example):\n${detalle}`,
    );
  }

  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

/** Solo para tests: olvida la validación memoizada. */
export function resetServerEnvCache() {
  cachedServerEnv = null;
}

/**
 * Variables públicas. Se referencian una por una y no por índice dinámico
 * porque Next.js las reemplaza literalmente al compilar.
 */
const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL tiene que ser una URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "Falta NEXT_PUBLIC_SUPABASE_ANON_KEY"),
});

export type ClientEnv = z.infer<typeof clientSchema>;

let cachedClientEnv: ClientEnv | null = null;

export function getClientEnv(): ClientEnv {
  if (cachedClientEnv) return cachedClientEnv;

  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    const detalle = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(raíz)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Configuración inválida del cliente:\n${detalle}`);
  }

  cachedClientEnv = parsed.data;
  return cachedClientEnv;
}

export function resetClientEnvCache() {
  cachedClientEnv = null;
}
