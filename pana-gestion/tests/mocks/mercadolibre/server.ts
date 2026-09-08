import { setupServer } from "msw/node";

/**
 * Servidor de Mercado Libre simulado.
 *
 * Permite probar todo el camino (tokens, reintentos, límites de tasa, envío de
 * respuestas) sin depender de la API real ni de una cuenta de prueba. Los
 * handlers los define cada test con `server.use(...)`.
 */
export const mlServer = setupServer();
