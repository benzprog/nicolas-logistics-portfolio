/**
 * Levanta el Supabase simulado y la aplicación, con un entorno de mentira.
 *
 * Los secretos de acá no abren nada: son valores con la forma correcta para
 * que pase la validación de lib/env.ts. La aplicación nunca llama a Mercado
 * Libre en estas pruebas.
 */
import { spawn } from "node:child_process";

import { startSupabaseStub } from "./supabase-stub.mjs";

const PORT = process.argv[2] ?? "3123";
const STUB_PORT = 54400;

await startSupabaseStub(STUB_PORT);

const entorno = {
  ...process.env,
  NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
  NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${STUB_PORT}`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-de-prueba",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-de-prueba",
  ML_APP_ID: "1234567890",
  ML_CLIENT_SECRET: "secreto-de-prueba",
  ML_REDIRECT_URI: `http://localhost:${PORT}/api/mercadolibre/oauth/callback`,
  ML_SITE_ID: "MLA",
  ML_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  ML_WEBHOOK_TOKEN: "webhook-token-de-prueba-largo",
  OAUTH_STATE_SECRET: "un-secreto-de-al-menos-32-caracteres-largo",
  CRON_SECRET: "cron-secret-de-prueba-suficiente",
  LOG_LEVEL: "error",
};

const next = spawn("pnpm", ["exec", "next", "dev", "--port", PORT], {
  env: entorno,
  stdio: "inherit",
});

const apagar = () => {
  next.kill("SIGTERM");
  process.exit(0);
};
process.on("SIGTERM", apagar);
process.on("SIGINT", apagar);
next.on("exit", (code) => process.exit(code ?? 0));
