# Cómo se escribe código acá

No son reglas por gusto: cada una está porque su ausencia ya costó algo, en este
proyecto o en otros parecidos. Los ejemplos salen del código real.

El lint y el typecheck hacen cumplir lo que se puede automatizar. Lo demás es
criterio, y este documento existe para que el criterio sea el mismo.

---

## Idioma

**El código en inglés, todo lo demás en castellano rioplatense.**

Nombres de variables, funciones, tipos, tablas y columnas: inglés, como el resto
del ecosistema. Comentarios, mensajes de commit, textos de la interfaz, mensajes
de error y nombres de pruebas: castellano, con voseo.

```ts
// bien
/** Devuelve un access token vigente. Renueva si está por vencer. */
export async function getValidAccessToken(accountId: string): Promise<string> {}

// mal: mezcla registros y suena a traducción automática
/** Returns a valid token */
export async function obtenerTokenValido(idCuenta: string) {}
```

Los textos que ve una persona nunca son técnicos:

```ts
// bien
"La conexión con Mercado Libre venció. Un administrador tiene que reconectar la cuenta.";

// mal
"MlAuthError: invalid_grant (401)";
```

---

## Comentarios

**Un comentario explica por qué, nunca qué.** Lo que hace el código ya lo dice
el código. Lo que no se puede leer del código es la razón: qué alternativa se
descartó, qué se rompe si esto cambia, qué caso raro justifica la vuelta de más.

```ts
// bien: dice algo que el código no puede decir
// Un POST no se reintenta solo: si la primera llamada llegó a Mercado Libre y
// se perdió la respuesta, el reintento publicaría la respuesta dos veces.
const maxRetries = options.maxRetries ?? (isIdempotent ? DEFAULT_MAX_RETRIES : 0);

// mal: repite la línea de abajo en prosa
// Si es idempotente usa los reintentos por defecto, si no cero
const maxRetries = options.maxRetries ?? (isIdempotent ? DEFAULT_MAX_RETRIES : 0);
```

Los comentarios de encabezado de archivo dicen para qué existe el módulo y qué
problema resuelve, no qué exporta.

Si un comentario se puede borrar sin perder nada, borralo. Un comentario que
miente es peor que ninguno.

---

## Errores

**Dos capas.** Adentro se lanzan excepciones tipadas; en la frontera con el
navegador se devuelve un `Result`.

Las Server Actions devuelven `Result<T>` porque Next serializa las excepciones
como un error genérico en producción, y el componente no podría distinguir un
problema de permisos de una caída de Mercado Libre:

```ts
export async function answerQuestion(input): Promise<Result<null>> {
  try {
    // ...
    return ok(null);
  } catch (error) {
    return fail(toUserMessage(error), error instanceof AppError ? error.code : "unknown");
  }
}
```

Adentro del dominio, excepciones: `AppError` con un código y un mensaje para la
persona. Los errores de Mercado Libre se clasifican **por status HTTP, nunca por
el texto del mensaje**: los textos cambian y llegan en distintos idiomas.

Todo error que llega a una persona tiene que decirle qué hacer:

| En vez de        | Escribí                                                                              |
| ---------------- | ------------------------------------------------------------------------------------ |
| "Error 429"      | "Mercado Libre está limitando las solicitudes. Esperá unos segundos y reintentá."    |
| "Falló el envío" | "Mercado Libre no respondió. Verificá en la publicación si la respuesta se publicó." |
| "No autorizado"  | "No tenés permisos para esta acción."                                                |

Ese segundo ejemplo importa: cuando no sabemos si la operación se aplicó, el
mensaje lo dice, para que nadie reintente a ciegas y termine publicando dos
veces.

---

## Validación

**Zod en toda frontera.** Formulario, Server Action, `searchParams`, variables
de entorno, respuesta de una API ajena. Un tipo de TypeScript no valida nada en
tiempo de ejecución.

Los filtros que vienen de la URL usan `.catch()`, no `.parse()` a secas: alguien
puede editar la barra de direcciones o mandar un enlace viejo, y eso no puede
romper la página.

```ts
export const questionFiltersSchema = z.object({
  estado: questionFilterStatus.catch("pending"),
  pagina: z.coerce.number().int().min(1).max(1000).catch(1),
});
```

Las respuestas de Mercado Libre se validan aunque tengamos el tipo declarado:
son datos de un sistema que puede cambiar sin avisar. Los campos que no usamos
quedan fuera del schema y se conservan igual en la columna `raw`.

---

## Capas

```
app  →  features  →  services  →  lib
              ↘  components  ↗
```

Lo hace cumplir ESLint (`no-restricted-imports` en `eslint.config.mjs`). Las
reglas en una línea:

- **`app/`** solo arma páginas. Si tiene un `if` de negocio, está en el lugar equivocado.
- **`features/`** es el dominio, una carpeta por área. Adentro: `actions.ts` (mutaciones), `queries.ts` (lecturas), `schemas.ts`, `components/`, `server/` (casos de uso y repositorio).
- **`services/`** habla con APIs externas. **No conoce la base de datos**: si necesita un token, lo recibe por parámetro. Eso es lo que permite probarlo sin levantar nada.
- **`lib/`** es infraestructura transversal y no importa nada del proyecto.
- **`components/`** es UI sin dominio. Un componente que sabe qué es una pregunta vive en `features/mercadolibre/questions/components`.

Los repositorios son la única capa que conoce los nombres de las tablas.

---

## Server y cliente

Server Components por defecto. `"use client"` solo cuando hace falta estado,
efectos o eventos: un formulario, un menú, un filtro.

Los módulos de servidor que tocan secretos llevan `import "server-only"` arriba
de todo. Si alguien los arrastra sin querer a un componente de cliente, la
compilación falla en vez de mandar la clave al navegador.

Para las mutaciones, `useTransition` y botón deshabilitado mientras está en
curso. Y una regla que no se negocia: **si la operación falla, el texto que la
persona escribió no se pierde.**

---

## Base de datos

Las migraciones se agregan, no se editan. Cada una explica arriba qué resuelve.

Las restricciones van en la base, no solo en el código: una `unique` que
garantiza idempotencia, un índice único parcial que impide dos envíos
simultáneos, un `check` que evita una pregunta respondida sin respuesta. El
código puede tener un bug; la base no lo deja pasar igual.

Lo que tiene que ser atómico va en una función de PostgreSQL. Marcar un intento
como enviado y la pregunta como respondida son dos escrituras que no pueden
quedar a medias, así que están en `mark_question_answered`.

Toda tabla nueva lleva `enable row level security`. Una tabla sin RLS queda
abierta a cualquiera que tenga la anon key, que es pública por diseño.

---

## Pruebas

**El nombre de la prueba dice el comportamiento, no el método.**

```ts
// bien
it("un envío fallido NO saca la pregunta de pendientes");
it("no se puede enviar dos respuestas a la vez");

// mal
it("sendAnswer returns error");
it("test 3");
```

Cuando lo que se prueba tiene una razón de ser que no es obvia, va un comentario
adentro:

```ts
it("NO borra lo escrito cuando falla", async () => {
  // Es lo que más cuida el trabajo de la persona: si Mercado Libre no
  // responde, lo último que tiene que pasar es que además pierda el texto.
});
```

Cuatro niveles, cada uno para lo suyo:

| Suite                              | Para qué                                                    |
| ---------------------------------- | ----------------------------------------------------------- |
| `tests/unit`                       | lógica pura y componentes sueltos                           |
| `tests/integration`                | flujos con Mercado Libre simulado (MSW) y Supabase simulado |
| `tests/e2e`                        | la aplicación entera en un navegador real                   |
| `tests/db` + `check-migrations.sh` | el esquema y las reglas de seguridad, contra SQL real       |

Una prueba que verifica que algo **falla** tiene que verificar además **por qué**
falla. Si no, pasa por un error de tipeo y nadie se entera:

```sql
select t.check_rejects('operadora: NO llega a los tokens de Mercado Libre',
  $$select access_token_enc from public.mercadolibre_tokens$$,
  '42501');  -- insufficient_privilege, no cualquier error
```

---

## Interfaz

Los estados de carga, vacío y error no son opcionales. Un vacío puede ser buena
noticia ("no hay preguntas pendientes, está todo respondido") o un callejón ("el
filtro no encontró nada"): el texto lo dice.

Los filtros viven en la URL, no en estado local. Así se comparten por chat, el
botón de atrás funciona y el servidor renderiza la página ya filtrada.

Las acciones que no se pueden deshacer llevan confirmación, y la confirmación
explica la consecuencia real:

> Se saca de la bandeja de pendientes sin responderla. En Mercado Libre queda
> como está, así que el comprador va a seguir esperando una respuesta.

Los números que se comparan en columna llevan la clase `tabular`, para que no
bailen al cambiar.

---

## Formato

Prettier y ESLint deciden; `pnpm format` y `pnpm lint:fix` los aplican. No
discutas comillas ni comas: no vale el tiempo.

Lo que sí es criterio:

- Archivos en kebab-case, componentes en PascalCase.
- Nada de `any`. Si no sabés el tipo, es `unknown` y lo validás.
- Funciones cortas con un nombre honesto. Si el nombre necesita un "y", son dos funciones.
- Un archivo que pasa las 300 líneas suele estar haciendo dos cosas.
