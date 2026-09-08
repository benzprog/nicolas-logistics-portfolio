/**
 * Stub de `server-only` para los tests.
 *
 * En la aplicación, ese paquete hace fallar la compilación si un módulo de
 * servidor se importa desde un componente de cliente. Bajo Vitest el entorno
 * parece un navegador, así que sin este alias todo módulo con esa guarda no se
 * podría probar.
 */
export {};
