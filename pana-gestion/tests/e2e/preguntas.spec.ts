import { test, expect, type Page } from "@playwright/test";

/**
 * Recorrido de punta a punta.
 *
 * Lo que se prueba acá no se puede probar con componentes sueltos: que el
 * middleware saque del paso a quien no inició sesión, que los filtros vivan en
 * la URL, y que la aplicación entera se arme y se vea.
 */

const USUARIO_ID = "11111111-1111-1111-1111-111111111111";

/** Planta la cookie de sesión con la forma que guarda @supabase/ssr. */
async function iniciarSesion(page: Page) {
  const sesion = {
    access_token: "token-de-prueba",
    refresh_token: "refresh-de-prueba",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user: { id: USUARIO_ID, email: "ana@pana.com.ar", aud: "authenticated", role: "authenticated" },
  };

  await page.context().addCookies([
    {
      name: "sb-localhost-auth-token",
      value: "base64-" + Buffer.from(JSON.stringify(sesion)).toString("base64"),
      domain: "localhost",
      path: "/",
    },
  ]);
}

test.describe("sin sesión", () => {
  test("no se puede entrar a las preguntas", async ({ page }) => {
    await page.goto("/mercadolibre/preguntas");

    // El middleware redirige y se acuerda de a dónde quería ir.
    await expect(page).toHaveURL(/\/login\?volver=%2Fmercadolibre%2Fpreguntas/);
    await expect(page.getByRole("heading", { name: /entrar a pana gestión/i })).toBeVisible();
  });

  test("el formulario de ingreso está completo", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  });

  test("un destino externo no sobrevive al redirect", async ({ page }) => {
    // Si aceptáramos una URL completa, tendríamos un redirect abierto servido
    // desde nuestro propio dominio.
    await page.goto("/login?volver=https://sitio-ajeno.example/phishing");
    await expect(page.locator('input[name="redirectTo"]')).toHaveValue("/");
  });
});

test.describe("con sesión", () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page);
  });

  test("el dashboard resume la operación", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(page.getByText("Pendientes", { exact: true })).toBeVisible();
    await expect(page.getByText("Esperando hace más de 24 h")).toBeVisible();
    await expect(page.getByText("Tiempo medio de respuesta")).toBeVisible();
  });

  test("el listado muestra las pendientes con su antigüedad", async ({ page }) => {
    await page.goto("/mercadolibre/preguntas");

    await expect(page.getByRole("heading", { name: "Preguntas" })).toBeVisible();
    await expect(page.getByText(/tienen stock en luz cálida/i)).toBeVisible();

    // La de 31 horas se ve como un día; la de 6 horas, en horas.
    await expect(page.getByText("1 d")).toBeVisible();
    await expect(page.getByText("6 h")).toBeVisible();

    // Un envío fallido se distingue de una pregunta que nadie tocó.
    await expect(page.getByText("Falló el envío")).toBeVisible();
  });

  test("las respondidas no se mezclan con las pendientes", async ({ page }) => {
    await page.goto("/mercadolibre/preguntas");
    await expect(page.getByText(/sirve para exterior/i)).toHaveCount(0);

    await page.getByRole("tab", { name: "Respondidas" }).click();

    // El filtro queda en la URL: se puede compartir y el botón de atrás anda.
    await expect(page).toHaveURL(/estado=answered/);
    await expect(page.getByText(/sirve para exterior/i)).toBeVisible();
  });

  test("el detalle trae todo lo que hace falta para responder", async ({ page }) => {
    await page.goto("/mercadolibre/preguntas");
    await page.getByText(/tienen stock en luz cálida/i).click();

    await expect(page).toHaveURL(/\/mercadolibre\/preguntas\/q1$/);

    // La publicación: sin saber precio y stock no se puede contestar.
    await expect(page.getByText("Lámpara LED 9W E27 luz fría — pack x10")).toBeVisible();
    await expect(page.getByText("42 en stock")).toBeVisible();

    // El historial muestra también lo que falló, y por qué.
    await expect(page.getByText("no se envió")).toBeVisible();
    await expect(page.getByText("Mercado Libre no respondió a tiempo").first()).toBeVisible();
  });

  test("no se puede enviar una respuesta vacía", async ({ page }) => {
    await page.goto("/mercadolibre/preguntas/q1");

    const boton = page.getByRole("button", { name: /enviar respuesta/i });
    await expect(boton).toBeDisabled();

    await page.getByLabel(/tu respuesta/i).fill("Sí, tenemos stock en luz cálida.");
    await expect(boton).toBeEnabled();

    // Y avisa que lo que se manda no se puede editar después.
    await expect(page.getByText(/no se puede editar/i)).toBeVisible();
  });

  test("la configuración muestra el estado de la conexión", async ({ page }) => {
    await page.goto("/mercadolibre/configuracion");

    await expect(page.getByText("PANAILUMINACION")).toBeVisible();
    await expect(page.getByText("Conectada", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /volver a autorizar/i })).toBeVisible();
  });

  test("una pregunta que no existe no rompe la aplicación", async ({ page }) => {
    // Se mira lo que ve la persona, no el código HTTP: estas pruebas corren
    // contra el servidor de desarrollo, que responde 200 incluso al renderizar
    // la página de "no encontrado".
    await page.goto("/mercadolibre/preguntas/no-existe");
    await expect(page.getByText(/no encontramos esta página/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /ir al dashboard/i })).toBeVisible();
  });
});

test.describe("responsive", () => {
  test("en pantalla angosta nada se desborda", async ({ page, isMobile }) => {
    test.skip(!isMobile, "solo aplica al proyecto de teléfono");

    await iniciarSesion(page);
    await page.goto("/mercadolibre/preguntas");

    // El sidebar se guarda detrás del botón de menú.
    await expect(page.getByRole("button", { name: /abrir navegación/i })).toBeVisible();

    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(desborde).toBe(false);
  });

  test("el menú lateral se abre y navega", async ({ page, isMobile }) => {
    test.skip(!isMobile, "solo aplica al proyecto de teléfono");

    await iniciarSesion(page);
    await page.goto("/mercadolibre/preguntas");

    await page.getByRole("button", { name: /abrir navegación/i }).click();
    await page.getByRole("link", { name: "Dashboard" }).click();

    await expect(page).toHaveURL("/");
  });
});
