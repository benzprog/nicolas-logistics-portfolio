import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

const here = import.meta.dirname;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // `server-only` aborta bajo un entorno de navegador, que es el que usa
      // jsdom. Se reemplaza por un módulo vacío para poder probar la lógica
      // de servidor; la protección real sigue actuando en el build.
      "server-only": path.resolve(here, "./tests/mocks/server-only.ts"),
      "@": path.resolve(here, "./"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    css: false,
  },
});
