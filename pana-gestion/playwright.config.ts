import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas end-to-end.
 *
 * Levantan la aplicación real contra un Supabase simulado (tests/e2e/
 * supabase-stub.mjs), así que ejercitan el middleware, la sesión, los Server
 * Components y el render de verdad, sin necesitar un proyecto de Supabase ni
 * credenciales de Mercado Libre.
 */
const PORT = 3123;

/**
 * Algunos entornos traen Chromium ya instalado en una ruta fija, con una
 * versión que no coincide con la que espera esta versión de Playwright y sin
 * poder descargar otra. Si está, se usa ese; si no, Playwright resuelve solo
 * el navegador que instaló `playwright install`.
 */
const CHROMIUM_PREINSTALADO = "/opt/pw-browsers/chromium";
const launchOptions = existsSync(CHROMIUM_PREINSTALADO)
  ? { executablePath: CHROMIUM_PREINSTALADO }
  : {};

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    launchOptions,
  },

  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"] } },
    // La herramienta se usa en la computadora, pero tiene que servir desde el
    // teléfono cuando alguien está fuera del depósito.
    { name: "teléfono", use: { ...devices["Pixel 7"] } },
  ],

  webServer: {
    command: `node tests/e2e/start-server.mjs ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
