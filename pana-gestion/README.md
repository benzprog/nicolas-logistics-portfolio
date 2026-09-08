# PANA Gestión

Sistema interno de gestión de **PANA Iluminación**.

Empieza resolviendo un problema concreto: **no perder preguntas de Mercado Libre
y poder responderlas rápido desde un solo panel.** La arquitectura está pensada
para que después crezca hacia stock, productos, ventas, envíos, proveedores y
facturación sin rehacer lo que ya está.

---

## Cómo funciona

```
Mercado Libre  ──notificación──▶  /api/webhooks/mercadolibre
                                          │ guarda el evento y responde 200
                                          ▼
                                  procesamiento en segundo plano
                                          │ relee la pregunta con nuestro token
                                          ▼
                                       Supabase
                                          │
                                          ▼
                                   Panel PANA Gestión
                                          │ una persona redacta y envía
                                          ▼
                              POST /answers de Mercado Libre
```

Además, cada 5 minutos corre una **reconciliación** que reprocesa lo que falló y
vuelve a preguntar por lo que pudo haberse perdido. El webhook es el camino
rápido; la reconciliación es la garantía.

**En esta versión no hay respuestas automáticas.** El sistema trae las preguntas
solo; responder es siempre una decisión de una persona.

---

## Stack

|               |                                                                     |
| ------------- | ------------------------------------------------------------------- |
| Framework     | Next.js 16 (App Router, React 19, Server Components)                |
| Lenguaje      | TypeScript en modo estricto                                         |
| Estilos       | Tailwind CSS 4 + componentes propios sobre Radix (estilo shadcn/ui) |
| Base de datos | Supabase (PostgreSQL con RLS)                                       |
| Autenticación | Supabase Auth                                                       |
| Validación    | Zod                                                                 |
| Tests         | Vitest + Testing Library + MSW                                      |
| Deploy        | Vercel                                                              |

Sin ORM, sin librería de estado global, sin colas externas. Cada una de esas
piezas se puede sumar después; ninguna hace falta hoy.

---

## Arrancar en local

Hace falta Node 20 o superior y pnpm.

```bash
pnpm install
cp .env.example .env.local     # completar con los valores reales
pnpm dev
```

### Variables de entorno

Están todas documentadas en [`.env.example`](.env.example). Las que hay que
generar:

```bash
openssl rand -base64 32   # ML_TOKEN_ENCRYPTION_KEY (32 bytes exactos)
openssl rand -hex 32      # ML_WEBHOOK_TOKEN, OAUTH_STATE_SECRET, CRON_SECRET
```

`ML_TOKEN_ENCRYPTION_KEY` cifra los tokens de Mercado Libre guardados en la
base. Si se pierde o se rota, hay que reconectar la cuenta.

### Supabase

```bash
pnpm dlx supabase link --project-ref <ref>
pnpm dlx supabase db push      # aplica supabase/migrations en orden
pnpm db:types                  # regenera types/database.types.ts
```

Después, una sola vez por entorno, programar la reconciliación:

```sql
select public.schedule_ml_reconcile('https://<dominio>', '<CRON_SECRET>');
```

**Registro cerrado.** Los usuarios se crean por invitación desde el panel de
Supabase (Authentication → Users). El perfil y el rol `operator` se crean solos;
para hacer a alguien administrador:

```sql
update public.profiles set role = 'admin' where id = '<uuid>';
```

### Mercado Libre

En [developers.mercadolibre.com.ar](https://developers.mercadolibre.com.ar),
crear una aplicación con:

| Campo                 | Valor                                                                  |
| --------------------- | ---------------------------------------------------------------------- |
| Redirect URI          | `https://<dominio>/api/mercadolibre/oauth/callback`                    |
| URL de notificaciones | `https://<dominio>/api/webhooks/mercadolibre?token=<ML_WEBHOOK_TOKEN>` |
| Topics                | `questions`                                                            |
| Scopes                | `read`, `write`, `offline_access`                                      |

Las dos URLs tienen que ser **HTTPS públicas**, así que en desarrollo hace falta
un túnel:

```bash
cloudflared tunnel --url http://localhost:3000
# y poner esa URL en NEXT_PUBLIC_APP_URL y ML_REDIRECT_URI
```

Con la aplicación creada, la cuenta se conecta desde
**Mercado Libre → Configuración → Conectar cuenta** (requiere rol administrador).

---

## Comandos

```bash
pnpm dev             # desarrollo
pnpm build           # build de producción
pnpm check           # lint + typecheck + tests (lo que corre antes de subir)
pnpm test            # tests unitarios y de integración
pnpm test:watch      # los mismos, en watch
pnpm test:e2e        # recorrido completo en el navegador
pnpm test:e2e:ui     # el mismo, con la interfaz de Playwright
pnpm db:types        # regenerar tipos desde Supabase

./scripts/check-migrations.sh   # aplica las migraciones a un PostgreSQL limpio
                                # y verifica el modelo y las reglas de RLS
```

`check-migrations.sh` levanta su propio PostgreSQL, simula lo poco que aporta
Supabase (schema `auth`, `auth.uid()`, los tres roles) y corre 62 pruebas contra
SQL de verdad: idempotencia, candado de doble envío, y sobre todo que nadie
pueda leer los tokens ni ascenderse a administrador. No necesita Docker.

`pnpm test:e2e` levanta la aplicación entera contra un Supabase simulado
(`tests/e2e/supabase-stub.mjs`) y la recorre con un navegador de verdad, en
tamaño de escritorio y de teléfono. Tampoco necesita credenciales.

---

## Estructura

```
app/                    rutas y composición de páginas, nada de lógica
  (auth)/login          pantalla de ingreso
  (app)/                todo lo que requiere sesión
  api/                  webhooks, OAuth y el job de reconciliación

features/               código por dominio
  auth/                 sesión, roles, permisos
  mercadolibre/
    account/            conexión OAuth, tokens, estado
    items/              copia local de las publicaciones
    questions/          preguntas: sincronización, listado, respuesta
    webhooks/           ingesta y procesamiento de notificaciones

services/mercadolibre/  cliente de la API oficial (no conoce la base de datos)
lib/                    entorno, criptografía, errores, logs, auditoría, tiempo
components/             UI reutilizable sin dominio
supabase/migrations/    esquema de la base
tests/                  unitarios, integración y pruebas SQL
```

Las reglas de dependencia entre capas las hace cumplir ESLint:

```
app  →  features  →  services  →  lib
              ↘  components  ↗
```

`lib/` no importa nada del proyecto. `services/` no sabe que existe una base de
datos. `components/` no sabe qué es una pregunta.

---

## Decisiones que conviene conocer

**Los tokens de Mercado Libre viven en su propia tabla, sin ninguna policy.**
Con RLS activo y cero policies, ningún cliente ve una fila. Además están
cifrados con AES-256-GCM. Hay una prueba que lo verifica contra SQL real.

**RLS gobierna las lecturas; el código gobierna las escrituras.** Las escrituras
de negocio pasan por el service role, después de que el código autorizó
explícitamente. Así la regla de negocio vive en un solo lugar en vez de estar
duplicada en SQL y en TypeScript.

**La renovación de tokens usa un candado en la base.** Mercado Libre invalida el
refresh token cada vez que se usa; dos renovaciones simultáneas dejan la cuenta
muerta. En Vercel no hay memoria compartida, así que el candado es una columna
con vencimiento y la condición va dentro del `UPDATE`.

**Un `POST` nunca se reintenta solo.** Si la respuesta se perdió en el camino, no
hay forma de saber si Mercado Libre la recibió. Reintentar publicaría dos veces.

**Un envío fallido no saca la pregunta de "pendiente".** Si la sacara,
desaparecería de la bandeja justo cuando más hay que responderla. El error queda
en la pregunta y en el historial.

**El payload de un webhook nunca escribe datos.** Solo dice qué recurso releer
con nuestro propio token. Una notificación falsa, en el peor caso, nos hace
releer algo nuestro.

**El ámbar de la marca no se usa como fondo de botón.** Ningún texto llega a
4.5:1 sobre `#f4c430`. Se reserva para marcar lo activo y lo que urge.

---

## Estado

Funciona de punta a punta el flujo de preguntas: conexión de la cuenta,
recepción de notificaciones, sincronización, listado con filtros, detalle,
respuesta e historial.

Los datos de la API de Mercado Libre están confirmados contra su documentación,
con una excepción: si PKCE hay que mandarlo siempre o solo cuando la aplicación
lo tiene activado. Por eso es una variable de entorno y no una decisión fija.
Está en [`docs/MERCADOLIBRE.md`](docs/MERCADOLIBRE.md).

Los módulos de stock, productos, ventas, envíos, proveedores y facturación
figuran en la navegación apagados: están para mostrar hacia dónde crece esto,
y para que sumarlos sea agregar una carpeta en `features/`.
