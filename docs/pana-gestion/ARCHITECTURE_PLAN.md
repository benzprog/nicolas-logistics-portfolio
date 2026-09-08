# PANA Gestión — Architecture & Product Plan

Versión: 0.1 (Fase 0, pendiente de aprobación)
Fecha: 2026-09-08
Estado: **NO implementado. Este documento define la base sobre la que se construye todo lo demás.**

---

## 0. Auditoría del entorno

| Ítem | Estado encontrado |
|---|---|
| Repositorio | `benzprog/nicolas-logistics-portfolio` contiene solo scripts Python de flyers y la skill del catálogo. No hay ninguna app web. |
| Repositorio destino | Se pidió un repo nuevo y exclusivo: `benzprog/pana-gestion`. Debe crearse manualmente (la integración de GitHub de esta sesión no tiene permiso para crear repos). |
| Runtime | Node 22.22, npm 10.9, pnpm 10.33 disponibles. |
| Documentación de Mercado Libre | `developers.mercadolibre.com.ar` está bloqueado por el proxy de red de la sesión. Los datos de la API que figuran abajo salen de conocimiento previo y están marcados con **[verificar]** donde un cambio afectaría el diseño. |
| Supabase / Vercel / App de ML | No existen todavía. Son prerrequisitos manuales (ver §11). |

---

## A. Arquitectura general

PANA Gestión es un **monolito modular** sobre Next.js (App Router) desplegado en Vercel, con Supabase (PostgreSQL + Auth) como única base de datos y proveedor de identidad. Un único proyecto, un único deploy, sin microservicios ni colas externas en V1.

```
┌───────────────────────────────────────────────────────────────────────┐
│  Navegador (usuarios internos de PANA)                                │
│  React Server Components + Client Components (shadcn/ui, Tailwind)    │
└───────────────┬───────────────────────────────────────────────────────┘
                │ HTTPS (cookies de sesión Supabase)
┌───────────────▼───────────────────────────────────────────────────────┐
│  Next.js en Vercel                                                    │
│                                                                       │
│  ┌─ UI ──────────────┐  ┌─ Server Actions ─────┐  ┌─ Route Handlers ┐ │
│  │ app/(app)/...     │  │ features/*/actions   │  │ /api/webhooks/* │ │
│  │ features/*/       │  │ (mutaciones del      │  │ /api/mercadolibre│ │
│  │   components      │  │  usuario logueado)   │  │   /oauth/*      │ │
│  └───────┬───────────┘  └─────────┬────────────┘  │ /api/cron/*     │ │
│          │ lee                    │ escribe        └───────┬─────────┘ │
│  ┌───────▼───────────────────────▼────────────────────────▼─────────┐ │
│  │  Capa de dominio (features/*/server): casos de uso, repositorios │ │
│  └───────┬──────────────────────────────────────┬───────────────────┘ │
│  ┌───────▼──────────────┐             ┌─────────▼────────────────────┐ │
│  │ lib/supabase         │             │ services/mercadolibre        │ │
│  │ (cliente user / RLS, │             │ (HTTP client, OAuth, tokens, │ │
│  │  cliente service)    │             │  questions, items, errors)   │ │
│  └───────┬──────────────┘             └─────────┬────────────────────┘ │
└──────────┼──────────────────────────────────────┼─────────────────────┘
           │                                      │ HTTPS
┌──────────▼──────────────┐            ┌──────────▼────────────────────┐
│ Supabase                │            │ Mercado Libre API oficial     │
│ Postgres + RLS + Auth   │◄───────────│ OAuth · /questions · /answers │
│ pg_cron (reconciliación)│  webhook   │ /items · /users · notificac.  │
└─────────────────────────┘            └───────────────────────────────┘
```

### Capas y responsabilidades

| Capa | Ubicación | Responsabilidad | Reglas |
|---|---|---|---|
| **UI** | `app/`, `features/*/components`, `components/` | Render, formularios, estados de carga/vacío/error. | Sin lógica de negocio. Sin acceso directo a servicios externos. |
| **Acciones y consultas** | `features/*/actions.ts`, `features/*/queries.ts` | Entrada del usuario: valida (Zod), autoriza (rol), llama al dominio, revalida. | Toda Server Action valida sesión y rol antes de tocar datos. |
| **Dominio / casos de uso** | `features/*/server/*` | Orquesta: "responder pregunta", "sincronizar pregunta", "conectar cuenta". | Independiente del framework. Testeable sin Next. |
| **Repositorios** | `features/*/server/repository.ts` | Acceso a tablas de Supabase con tipos generados. | Única capa que conoce nombres de tablas. |
| **Servicios externos** | `services/mercadolibre/*` | Cliente HTTP de ML: auth, refresh, reintentos, rate limit, mapeo de errores. | No conoce la base de datos, salvo el `TokenStore` inyectado. |
| **Infra transversal** | `lib/*` | Env tipado, crypto, logger, errores, resultado, utilidades. | Sin dependencias de features. |

### Dos clientes de Supabase, dos contextos

1. **Cliente de usuario** (`@supabase/ssr`, cookies): usado en RSC y Server Actions para **lecturas** bajo RLS. Si RLS está mal, el usuario igual no ve más de lo permitido.
2. **Cliente de servicio** (`SUPABASE_SERVICE_ROLE_KEY`, solo servidor): usado para **escrituras** de negocio (después de autorizar explícitamente en código), y para webhooks/cron donde no hay usuario. Nunca llega al bundle del cliente.

Justificación: mantener las políticas RLS de escritura simples (ninguna para usuarios) evita duplicar reglas de negocio en SQL y en TypeScript. RLS protege lecturas; el código protege escrituras. Ver decisión D4.

### Ingesta de eventos: webhook + reconciliación (no polling puro)

- **Camino principal:** Mercado Libre notifica → `POST /api/webhooks/mercadolibre` → se persiste el evento (idempotente) → se responde `200` en milisegundos → el procesamiento corre en segundo plano con `after()` de Next.js (Vercel lo mantiene vivo hasta que termina).
- **Red de seguridad:** un job de reconciliación cada 5 minutos (disparado por **pg_cron + pg_net desde Supabase**, no por Vercel Cron; ver D6) reprocesa eventos fallidos, consulta `missed_feeds` y hace un `GET /questions/search?status=UNANSWERED` liviano para cerrar cualquier hueco.

Esto cumple "no depender exclusivamente de polling" sin agregar una cola externa. Si el volumen crece (miles de eventos/hora), el punto de cambio está aislado en `features/mercadolibre/webhooks/processor.ts` y se reemplaza `after()` por una cola (ver Riesgo R3).

---

## B. Stack confirmado

| Área | Elección | Versión objetivo | Notas |
|---|---|---|---|
| Framework | Next.js (App Router) | 16.x estable (o 15.5 LTS si alguna dependencia no acompaña) | RSC, Server Actions, `after()`, Route Handlers. |
| UI runtime | React | 19.x | Viene con Next. |
| Lenguaje | TypeScript | 5.x, `strict: true`, `noUncheckedIndexedAccess` | Tipos de DB generados con Supabase CLI. |
| Estilos | Tailwind CSS | 4.x | Tokens de diseño en `globals.css`. |
| Componentes | shadcn/ui | última (compatible Tailwind 4) | Solo los componentes que se usen. Instalados en `components/ui`. |
| Iconos | lucide-react | última | Ya es la dependencia de shadcn. |
| Toasts | sonner | última | Default de shadcn. |
| Formularios | react-hook-form + @hookform/resolvers | última | Solo en formularios con estado (respuesta, login). |
| Validación | Zod | 4.x | Un schema por entrada: forms, actions, env, payloads de ML. |
| DB / Auth | Supabase (`@supabase/supabase-js` 2.x, `@supabase/ssr`) | última | Sin ORM en V1 (ver D5). |
| Migraciones | Supabase CLI | última | `supabase/migrations/*.sql`, tipos con `supabase gen types`. |
| Fechas | date-fns + `date-fns/locale/es` | 4.x | Zona horaria fija `America/Argentina/Buenos_Aires` para display. |
| Tests | Vitest + @testing-library/react; Playwright (e2e, Fase 4) | última | MSW para simular la API de ML. |
| Calidad | ESLint 9 (flat) + `eslint-config-next` + Prettier + `prettier-plugin-tailwindcss` | última | Script `pnpm check` = lint + typecheck + test. |
| Package manager | pnpm | 10.x | Ya disponible en el entorno. |
| Hosting | Vercel | — | Región `gru1` (São Paulo) por cercanía a ML y a Supabase. |
| Estado cliente | Ninguna librería | — | RSC + Server Actions + `useTransition` + searchParams en URL. |

**Lo que deliberadamente NO entra:** TanStack Query, Redux/Zustand, Prisma/Drizzle, tRPC, NextAuth (Supabase Auth ya resuelve), colas externas (Inngest/QStash), i18n (la app es solo es-AR).

No cambio ninguna tecnología pedida. Los agregados (sonner, react-hook-form, date-fns, MSW) son utilitarios de bajo riesgo, y cualquiera puede sacarse en una tarde.

---

## C. Estructura de carpetas

Repositorio `benzprog/pana-gestion`, app en la raíz (no monorepo: hoy hay un solo deployable).

```
pana-gestion/
├── app/                                   # Solo routing y composición de páginas
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (app)/                             # Requiere sesión (layout verifica)
│   │   ├── layout.tsx                     # Sidebar + Header + <Toaster/>
│   │   ├── page.tsx                       # Dashboard
│   │   ├── mercadolibre/
│   │   │   ├── preguntas/
│   │   │   │   ├── page.tsx               # Listado (filtros vía searchParams)
│   │   │   │   ├── loading.tsx
│   │   │   │   └── [id]/page.tsx          # Detalle + responder
│   │   │   └── configuracion/page.tsx     # Cuenta conectada, webhooks, sync
│   │   └── configuracion/page.tsx         # Usuario actual, permisos
│   ├── api/
│   │   ├── mercadolibre/oauth/start/route.ts
│   │   ├── mercadolibre/oauth/callback/route.ts
│   │   ├── webhooks/mercadolibre/route.ts
│   │   └── cron/mercadolibre/reconcile/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   ├── error.tsx
│   └── not-found.tsx
│
├── features/                              # Código por dominio
│   ├── auth/
│   │   ├── actions.ts                     # login, logout
│   │   ├── components/login-form.tsx
│   │   └── server/session.ts              # getCurrentUser(), requireRole()
│   ├── dashboard/
│   │   ├── components/
│   │   └── queries.ts                     # métricas ML
│   └── mercadolibre/
│       ├── account/                       # Conexión OAuth, estado, desconexión
│       │   ├── actions.ts
│       │   ├── components/
│       │   └── server/{connect.ts,disconnect.ts,repository.ts}
│       ├── items/                         # Snapshot de publicaciones
│       │   └── server/{sync-item.ts,repository.ts}
│       ├── questions/
│       │   ├── actions.ts                 # sendAnswer, archiveQuestion, syncNow
│       │   ├── queries.ts                 # listQuestions, getQuestion (RLS)
│       │   ├── schemas.ts                 # Zod: filtros, respuesta
│       │   ├── mappers.ts                 # ML question -> fila de DB
│       │   ├── components/
│       │   │   ├── questions-table.tsx
│       │   │   ├── questions-filters.tsx
│       │   │   ├── question-detail.tsx
│       │   │   ├── answer-form.tsx
│       │   │   ├── question-status-badge.tsx
│       │   │   └── question-history.tsx
│       │   └── server/
│       │       ├── sync-question.ts       # upsert idempotente desde ML
│       │       ├── send-answer.ts         # caso de uso completo
│       │       └── repository.ts
│       └── webhooks/
│           └── server/{ingest.ts,processor.ts,repository.ts}
│
├── services/
│   └── mercadolibre/                      # Cliente de la API oficial (sin DB)
│       ├── client.ts                      # fetch con timeout, retry, 429, logs
│       ├── oauth.ts                       # URLs, exchange, refresh
│       ├── token-manager.ts               # getValidToken() con lease anti-carrera
│       ├── questions.api.ts
│       ├── items.api.ts
│       ├── users.api.ts
│       ├── notifications.api.ts           # missed_feeds
│       ├── errors.ts                      # MlAuthError, MlRateLimitError, ...
│       └── types.ts                       # Tipos de respuesta de ML (Zod)
│
├── lib/
│   ├── env.ts                             # Zod sobre process.env (server/client separados)
│   ├── supabase/{server.ts,client.ts,service.ts,middleware.ts}
│   ├── crypto.ts                          # AES-256-GCM para tokens
│   ├── logger.ts                          # JSON estructurado, redacta secretos
│   ├── errors.ts                          # AppError + mapeo a mensajes de usuario
│   ├── result.ts                          # type Result<T,E>
│   ├── audit.ts                           # audit(actor, action, entity, meta)
│   └── utils.ts                           # cn(), formatos de fecha/moneda
│
├── components/
│   ├── ui/                                # shadcn (generado)
│   ├── layout/{sidebar.tsx,header.tsx,nav-config.ts,user-menu.tsx}
│   └── shared/{empty-state.tsx,error-state.tsx,page-header.tsx,data-table/*}
│
├── hooks/                                 # use-debounce, use-confirm
├── types/
│   ├── database.types.ts                  # generado: supabase gen types
│   └── domain.ts                          # enums y tipos derivados
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   └── seed.sql                           # perfiles de prueba (solo local)
├── tests/
│   ├── unit/
│   ├── integration/
│   └── mocks/mercadolibre/                # handlers MSW + fixtures JSON
├── docs/
│   ├── ARCHITECTURE.md
│   ├── MERCADOLIBRE.md
│   └── adr/0001-*.md
├── middleware.ts                          # refresh de sesión Supabase + redirect a /login
├── .env.example
├── package.json · tsconfig.json · eslint.config.mjs · vitest.config.ts
└── README.md
```

Reglas de dependencia (se hace cumplir con `eslint-plugin-boundaries` o `no-restricted-imports`):
- `app` → `features`, `components`, `lib`
- `features` → `services`, `lib`, `components/ui`, otras `features` solo por su `index.ts` público
- `services` → `lib`
- `lib` → nada del proyecto

Los módulos futuros (`features/stock`, `features/ventas`, `features/mercadolibre/publications`) se agregan como carpetas hermanas y una entrada en `components/layout/nav-config.ts`. Ninguno requiere tocar el resto.

---

## D. Base de datos (Supabase / PostgreSQL)

### Diagrama

```
auth.users 1──1 profiles
                  │ (answered_by, connected_by, actor_user_id)
                  │
integrations 1──1 mercadolibre_accounts 1──1 mercadolibre_tokens   (secretos, sin acceso de cliente)
                        │
                        ├──< mercadolibre_items          (snapshot de publicaciones)
                        │         │
                        ├──< questions ──< question_answers   (intentos / historial)
                        │
                        └──< webhook_events

audit_logs   (append-only, referencia libre a entity_type/entity_id)
```

### Enums

```sql
create type app_role            as enum ('admin', 'operator', 'viewer');
create type integration_provider as enum ('mercadolibre');
create type integration_status  as enum ('connected', 'needs_reauth', 'disconnected', 'error');
create type question_status     as enum ('pending', 'answered', 'archived');
create type answer_status       as enum ('sending', 'sent', 'failed');
create type answer_source       as enum ('pana', 'external');
create type webhook_event_status as enum ('received', 'processing', 'processed', 'failed', 'ignored');
```

### Tablas

**`profiles`** — 1:1 con `auth.users`, creada por trigger al registrarse.
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK, FK auth.users(id) on delete cascade | |
| full_name | text not null | |
| role | app_role not null default 'operator' | |
| is_active | boolean not null default true | Baja lógica de usuarios. |
| created_at / updated_at | timestamptz | |

**`integrations`** — registro genérico de integraciones (lo que muestra la pantalla de Configuración).
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| provider | integration_provider not null | unique(provider) en V1 (una cuenta por proveedor; ver D2). |
| status | integration_status not null default 'disconnected' | |
| connected_by | uuid FK profiles | |
| connected_at / disconnected_at | timestamptz | |
| last_sync_at | timestamptz | Última reconciliación OK. |
| last_webhook_at | timestamptz | Último webhook recibido. |
| last_error | text | Mensaje técnico corto. |
| settings | jsonb not null default '{}' | Config por proveedor (p. ej. topics suscriptos). |
| created_at / updated_at | timestamptz | |

**`mercadolibre_accounts`** — identidad de la cuenta de ML conectada (datos no sensibles).
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| integration_id | uuid FK integrations unique | |
| ml_user_id | bigint not null unique | Del `GET /users/me`. |
| nickname | text not null | |
| site_id | text not null default 'MLA' | |
| email | text | Solo si ML lo devuelve. |
| permalink | text | |
| raw | jsonb | Respuesta de `/users/me` sin campos sensibles. |
| created_at / updated_at | timestamptz | |

**`mercadolibre_tokens`** — secretos. **Sin ninguna policy RLS para roles de cliente**; solo el service role puede leerla.
| Columna | Tipo | Notas |
|---|---|---|
| account_id | uuid PK, FK mercadolibre_accounts on delete cascade | |
| access_token_enc | text not null | AES-256-GCM, formato `v1:iv:tag:ciphertext`. |
| refresh_token_enc | text not null | Idem. |
| access_token_expires_at | timestamptz not null | |
| scope | text | |
| refreshed_at | timestamptz | |
| refresh_lock_until | timestamptz | Lease para evitar dos refresh simultáneos. |
| refresh_failures | int not null default 0 | Al 3.° fallo → integrations.status = needs_reauth. |
| updated_at | timestamptz | |

**`mercadolibre_items`** — snapshot mínimo de publicaciones. Semilla del módulo "Publicaciones".
| Columna | Tipo | Notas |
|---|---|---|
| ml_item_id | text PK | p. ej. `MLA123456789`. |
| account_id | uuid FK mercadolibre_accounts | |
| title | text not null | |
| thumbnail_url / permalink | text | |
| price | numeric(14,2) | |
| currency_id | text | |
| available_quantity | int | |
| status | text | `active`, `paused`, `closed`… tal cual ML. |
| raw | jsonb | |
| synced_at | timestamptz not null | Se refresca si tiene > 24 h al abrir una pregunta. |

**`questions`**
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| account_id | uuid FK mercadolibre_accounts not null | |
| ml_question_id | bigint not null | **unique(account_id, ml_question_id)** → idempotencia. |
| ml_item_id | text not null, FK mercadolibre_items | |
| ml_seller_id | bigint not null | |
| ml_buyer_id | bigint | `from.id` de ML. |
| text | text not null | |
| status | question_status not null default 'pending' | Estado interno. |
| ml_status | text not null | `UNANSWERED`, `ANSWERED`, `CLOSED_UNANSWERED`, `UNDER_REVIEW`, `BANNED`, `DISABLED`, `DELETED` **[verificar lista]**. |
| ml_date_created | timestamptz not null | Antigüedad = now() − esto. |
| answer_text | text | Respuesta vigente (desnormalizada para listar). |
| answered_at | timestamptz | |
| answered_by | uuid FK profiles | Null si se respondió fuera de PANA. |
| answer_source | answer_source | |
| last_error | text | Último error al enviar; se limpia al enviar OK. |
| raw | jsonb not null | Último payload de ML. |
| last_synced_at | timestamptz not null | |
| deleted_at | timestamptz | Soft delete (pregunta borrada en ML). |
| created_at / updated_at | timestamptz | |

Índices: `(account_id, status, ml_date_created desc)` para el listado; `(ml_item_id)`; `gin (to_tsvector('spanish', text))` para búsqueda; parcial `where status = 'pending'` para el contador del dashboard.

**`question_answers`** — historial de intentos de respuesta (auditoría funcional + anti doble envío).
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| question_id | uuid FK questions on delete cascade | |
| text | text not null | |
| status | answer_status not null | |
| source | answer_source not null default 'pana' | |
| sent_by | uuid FK profiles | |
| sent_at | timestamptz | |
| ml_response | jsonb | |
| error_code / error_message | text | |
| created_at | timestamptz | |

Índice único parcial: `unique (question_id) where status = 'sending'` → dos usuarios no pueden enviar a la vez; el segundo recibe un mensaje claro.

**`webhook_events`**
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| provider | integration_provider not null | |
| external_id | text not null | `_id` de la notificación de ML. **unique(provider, external_id)** → idempotencia. |
| topic | text not null | `questions`, futuro `orders_v2`, `items`… |
| resource | text not null | `/questions/123`. |
| ml_user_id | bigint | |
| application_id | bigint | |
| ml_attempts | int | Campo `attempts` de ML. |
| sent_at / received_at | timestamptz | |
| payload | jsonb not null | |
| status | webhook_event_status not null default 'received' | |
| process_attempts | int not null default 0 | Nuestros reintentos. |
| next_retry_at | timestamptz | Backoff exponencial: 1, 5, 15, 60 min. |
| processed_at | timestamptz | |
| last_error | text | |

Índice: `(status, next_retry_at) where status in ('received','failed')`.

**`audit_logs`** — append-only.
| Columna | Tipo | Notas |
|---|---|---|
| id | bigint identity PK | |
| actor_type | text not null | `user`, `system`, `webhook`, `cron`. |
| actor_user_id | uuid FK profiles | |
| action | text not null | `auth.login`, `ml.account.connected`, `ml.account.disconnected`, `ml.token.refreshed`, `ml.token.refresh_failed`, `ml.webhook.received`, `question.created`, `question.answer.sent`, `question.answer.failed`, `question.archived`, `ml.api.error`. |
| entity_type / entity_id | text | |
| metadata | jsonb not null default '{}' | Nunca contiene tokens. |
| ip / user_agent | text | |
| created_at | timestamptz not null default now() | |

Índices: `(created_at desc)`, `(entity_type, entity_id)`, `(actor_user_id)`.

### Row Level Security

| Tabla | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| profiles | usuarios activos leen todos (para mostrar "respondida por"). | El propio usuario: `full_name`. `role`/`is_active`: solo admin. |
| integrations, mercadolibre_accounts, mercadolibre_items, questions, question_answers | usuarios activos autenticados. | Ninguna policy → solo service role. |
| mercadolibre_tokens | **ninguna** para clientes. | ninguna. |
| webhook_events, audit_logs | solo admin. | ninguna (service role). |

Función helper `auth_role()` en SQL que lee `profiles.role` del usuario actual, marcada `security definer` y `stable`.

### Mapeo de estados ML → internos

| `ml_status` | `status` interno |
|---|---|
| UNANSWERED, UNDER_REVIEW | pending |
| ANSWERED | answered |
| CLOSED_UNANSWERED, DELETED, BANNED, DISABLED | archived (+ `deleted_at` si DELETED) |

---

## E. Flujo Mercado Libre, paso por paso

### E.1 Prerrequisito: aplicación en el DevCenter de ML
Crear la app en `developers.mercadolibre.com.ar` con: nombre, **Redirect URI** (`https://<dominio>/api/mercadolibre/oauth/callback`), **URL de notificaciones** (`https://<dominio>/api/webhooks/mercadolibre?token=<ML_WEBHOOK_TOKEN>`), topic **`questions`**, scopes `read write offline_access`. Se obtienen `APP_ID` y `SECRET_KEY`. Ambas URLs deben ser HTTPS públicas → en desarrollo local se necesita un túnel (ver R6).

### E.2 OAuth (conectar cuenta)
1. Admin hace clic en "Conectar Mercado Libre" → `GET /api/mercadolibre/oauth/start`.
2. El servidor verifica rol admin, genera `state` aleatorio + `code_verifier` (PKCE **[verificar soporte]**), los guarda en una cookie `httpOnly`, firmada (HMAC) y con vida de 10 min, y redirige a
   `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=APP_ID&redirect_uri=...&state=...&code_challenge=...&code_challenge_method=S256`.
3. ML redirige a `/api/mercadolibre/oauth/callback?code=...&state=...`.
4. El servidor: valida `state` contra la cookie (anti-CSRF), hace `POST https://api.mercadolibre.com/oauth/token` con `grant_type=authorization_code`, `client_id`, `client_secret`, `code`, `redirect_uri`, `code_verifier`.
5. Respuesta: `access_token` (≈6 h **[verificar]**), `refresh_token` (≈6 meses, **de un solo uso** **[verificar]**), `user_id`, `scope`, `expires_in`.
6. `GET /users/me` con el token → upsert de `integrations` + `mercadolibre_accounts`; tokens cifrados en `mercadolibre_tokens`; `audit: ml.account.connected`; redirect a `/mercadolibre/configuracion?connected=1`.
7. Sincronización inicial en segundo plano (`after()`): importa las preguntas `UNANSWERED` (y las `ANSWERED` de los últimos 30 días para historial).

### E.3 Tokens: obtención y renovación
`getValidToken(accountId)` en `services/mercadolibre/token-manager.ts`:
1. Lee `mercadolibre_tokens` (service role), descifra.
2. Si `access_token_expires_at > now() + 5 min` → devuelve el token.
3. Si no, toma un **lease**: `update ... set refresh_lock_until = now() + 30s where account_id = ? and (refresh_lock_until is null or refresh_lock_until < now()) returning *`.
   - Si no obtiene el lease: espera 500 ms y relee (otro proceso está renovando). Máx. 6 intentos.
   - Si lo obtiene: `POST /oauth/token grant_type=refresh_token`, guarda **ambos** tokens nuevos (ML rota el refresh token), `refresh_failures = 0`, `audit: ml.token.refreshed`.
4. Ante `invalid_grant`: `refresh_failures++`; al 3.° → `integrations.status = needs_reauth`, `audit: ml.token.refresh_failed`, el panel muestra "Reconectar".
5. Cualquier llamada de la API que reciba `401` fuerza un refresh y reintenta **una** vez.

Por qué el lease en DB y no un mutex en memoria: en Vercel cada request puede correr en una instancia distinta; sin coordinación en Postgres dos refresh concurrentes invalidan el refresh token y obligan a reconectar a mano.

### E.4 Webhook / notificación
`POST /api/webhooks/mercadolibre?token=...`

Payload esperado **[verificar]**:
```json
{ "_id": "abc123", "resource": "/questions/5036111111", "user_id": 123456789,
  "topic": "questions", "application_id": 1234567890, "attempts": 1,
  "sent": "2026-09-08T14:00:00.000-04:00", "received": "2026-09-08T14:00:00.100-04:00" }
```
Pasos (objetivo: responder `200` en < 500 ms):
1. Verificar `token` de la query contra `ML_WEBHOOK_TOKEN` (ML no firma las notificaciones; el token es nuestra autenticación). Opcional: allowlist de IPs de ML **[verificar lista vigente]**.
2. Validar el body con Zod. `application_id` debe ser nuestro `ML_APP_ID`; `user_id` debe corresponder a una cuenta conectada. Si no → `200` + `status = ignored` (no dar pistas a un atacante, no provocar reintentos).
3. `insert into webhook_events ... on conflict (provider, external_id) do nothing`. Si ya existía → `200` inmediato (idempotencia).
4. Responder `200 {}`.
5. En `after()`: `processWebhookEvent(id)`.

Nunca se confía en el contenido del payload para modificar datos: solo se usa como **puntero** al recurso, que se vuelve a leer desde la API con nuestro token.

### E.5 Procesamiento del evento (topic `questions`)
1. `status = processing`.
2. `GET /questions/{id}?api_version=4` **[verificar parámetro]** con `getValidToken()`.
3. Si `404` → marcar pregunta como `archived`, `deleted_at = now()`.
4. Asegurar `mercadolibre_items[item_id]` (si no existe o tiene > 24 h: `GET /items/{id}?attributes=id,title,thumbnail,permalink,price,currency_id,available_quantity,status`).
5. `upsert questions on conflict (account_id, ml_question_id)` mapeando estados (§D). Si ML la muestra `ANSWERED` y no tenemos `answered_by`, se registra `answer_source = external` y se inserta una fila en `question_answers` con `source = external` (respondida desde la app de ML).
6. Si es nueva → `audit: question.created`.
7. `status = processed`, `integrations.last_webhook_at = now()`.
8. Ante error: `status = failed`, `process_attempts++`, `next_retry_at` con backoff. Tras 5 fallos queda `failed` definitivo y visible en Configuración.

### E.6 Reconciliación (cron cada 5 min)
`POST /api/cron/mercadolibre/reconcile` con header `Authorization: Bearer CRON_SECRET`, invocado por `pg_cron` + `pg_net` desde Supabase.
1. Reprocesar `webhook_events` con `status in ('received','failed') and next_retry_at <= now()` (cubre el caso de que `after()` no haya terminado).
2. `GET /missed_feeds?app_id=...` **[verificar]** → encolar como eventos.
3. `GET /questions/search?seller_id=...&status=UNANSWERED&api_version=4&limit=50&offset=...` → upsert. Además, para nuestras `pending` con más de 24 h que ML ya no lista como UNANSWERED, releer una por una (cierra el caso "respondida desde el celular").
4. `integrations.last_sync_at = now()`.

### E.7 Panel → respuesta
Server Action `sendAnswer({ questionId, text })`:
1. Sesión válida + rol `admin` u `operator` (viewer no puede).
2. Zod: `text` trim, 1–2000 caracteres **[verificar límite]**.
3. Cargar pregunta: debe estar `pending` y no `deleted_at`.
4. `insert question_answers (status='sending')` → si viola el índice único parcial → error "Otro usuario está enviando una respuesta".
5. `POST https://api.mercadolibre.com/answers { "question_id": ..., "text": ... }` con token válido, timeout 10 s.
6. Éxito → en una sola transacción (RPC `mark_question_answered`): `question_answers.status = sent`, `questions.status = answered`, `answer_text`, `answered_at`, `answered_by`, `answer_source = pana`, `last_error = null`; `audit: question.answer.sent`; `revalidatePath`.
7. Fallo → `question_answers.status = failed` con `error_code/message`; `questions.last_error`; `audit: question.answer.failed`; mensaje al usuario según tipo (§F). Si ML responde que la pregunta ya fue respondida o cerrada, se dispara `syncQuestion` para reflejar el estado real.
8. Caso borde: ML aceptó pero el proceso murió antes del paso 6. La reconciliación detecta una fila `sending` con más de 2 min, relee la pregunta en ML: si está `ANSWERED` con el mismo texto → `sent`; si no → `failed`.

### E.8 Frontend
- Listado: RSC lee `questions` (RLS) con filtros de URL `?estado=pending&q=texto&orden=antiguedad&pagina=2`. Paginación server-side de 25.
- Detalle: RSC compone pregunta + item + historial. `answer-form.tsx` es Client Component con `useTransition`, deshabilita el botón mientras envía, `sonner` para confirmación/error.
- Después de enviar: `revalidatePath('/mercadolibre/preguntas')` + `router.refresh()`; la UI cambia a `answered` sin recargar a mano.

---

## F. Seguridad: riesgos y mitigaciones

| # | Riesgo | Mitigación |
|---|---|---|
| S1 | Tokens de ML expuestos al cliente | Tabla `mercadolibre_tokens` sin policies RLS; solo service role. Cifrado AES-256-GCM con `ML_TOKEN_ENCRYPTION_KEY`. `lib/env.ts` separa variables server/client; el linter prohíbe importar `lib/supabase/service.ts` desde componentes cliente. |
| S2 | Filtración de `SUPABASE_SERVICE_ROLE_KEY` | Solo en variables de entorno de Vercel (server). Nunca con prefijo `NEXT_PUBLIC_`. |
| S3 | CSRF / fijación de sesión en OAuth | `state` aleatorio firmado en cookie httpOnly; PKCE si está soportado; expira a los 10 min; un solo uso. |
| S4 | Open redirect tras OAuth | Redirect fijo a `/mercadolibre/configuracion`; nunca a un `returnTo` de la query. |
| S5 | Webhooks falsificados | Token secreto en la URL de notificaciones; validación de `application_id` y de `user_id` conectado; el payload nunca modifica datos, solo dispara una lectura autenticada. Opcional allowlist IPs de ML. |
| S6 | Webhooks duplicados / replay | `unique (provider, external_id)`; upsert por `(account_id, ml_question_id)`; procesamiento idempotente. |
| S7 | Doble envío de respuesta | Índice único parcial en `question_answers` (`sending`); botón deshabilitado; `useTransition`. |
| S8 | Carrera en refresh token (invalida la cuenta) | Lease en DB (`refresh_lock_until`). |
| S9 | Usuarios no autorizados ejecutando acciones admin | `requireRole('admin')` en cada Server Action y Route Handler sensible; RLS bloquea escritura de `role`. Registro abierto **deshabilitado** en Supabase Auth: los usuarios se crean por invitación desde el dashboard de Supabase (V1) o desde Configuración (futuro). |
| S10 | Endpoint de cron público | `CRON_SECRET` en `Authorization`; comparación en tiempo constante. |
| S11 | Inputs maliciosos | Zod en toda frontera: forms, actions, searchParams, payloads de ML, env. |
| S12 | Secretos en logs | `lib/logger.ts` redacta claves `access_token`, `refresh_token`, `authorization`, `client_secret`. `audit_logs.metadata` nunca recibe tokens. |
| S13 | Rate limit de ML (429) | Cliente con backoff exponencial + jitter, respeta `Retry-After`, máx. 3 reintentos; el cron pagina de a 50 y corre cada 5 min, no cada minuto. |
| S14 | `.env` commiteado | `.gitignore` desde el primer commit; `.env.example` sin valores; `gitleaks` en pre-commit (Fase 5). |
| S15 | Dependencias | `pnpm audit` en CI; lockfile commiteado; versiones fijadas. |
| S16 | RLS mal configurada | Tests de integración contra Supabase local que verifican que `viewer` no escribe y que nadie lee `mercadolibre_tokens` con anon key. |
| S17 | XSS con texto de compradores | React escapa por defecto; nunca `dangerouslySetInnerHTML` con texto de ML. |

### Manejo de errores (taxonomía)

| Error técnico | Clase | Mensaje al usuario | Acción del sistema |
|---|---|---|---|
| 401 tras refresh, `invalid_grant` | `MlAuthError` | "La conexión con Mercado Libre venció. Un administrador debe reconectar la cuenta." | `needs_reauth`, audit. |
| 404 pregunta/ítem | `MlNotFoundError` | "Esta pregunta ya no existe en Mercado Libre." | Archivar. |
| 400 al responder (ya respondida, cerrada) | `MlValidationError` | "Mercado Libre rechazó la respuesta: {motivo legible}." | Re-sincronizar pregunta. |
| 429 | `MlRateLimitError` | "Mercado Libre está limitando las solicitudes. Probá en unos segundos." | Backoff. |
| 5xx / timeout / red | `MlUnavailableError` | "Mercado Libre no respondió. La respuesta no se envió; podés reintentar." | Reintento automático solo en lecturas, nunca en `POST /answers` (evita duplicar). |
| Error de Supabase | `AppError('db')` | "Ocurrió un error interno. Ya quedó registrado." | Log + audit. |
| Sin permisos | `AppError('forbidden')` | "No tenés permisos para esta acción." | Audit. |

---

## G. Roadmap por fases

Cada fase termina con: `pnpm check` en verde, commit, resumen de lo hecho y lo pendiente.

### Fase 0 — Arquitectura (este documento) ✅ pendiente de aprobación

### Fase 1 — Foundation (2 entregas)
**1a. Proyecto**
- `create-next-app` con TS, Tailwind 4, ESLint, `src`-less, pnpm.
- Prettier, `lib/env.ts` con Zod, `.env.example`, README inicial, `vitest` con un test de humo.
- shadcn/ui: `button`, `input`, `label`, `card`, `badge`, `table`, `dialog`, `dropdown-menu`, `sheet`, `sonner`, `skeleton`, `separator`, `tooltip`, `textarea`, `select`.
- Layout: sidebar colapsable con `nav-config.ts` (Dashboard, Mercado Libre › Preguntas/Configuración, Configuración; el resto de módulos como entradas deshabilitadas "Próximamente"), header con usuario, breadcrumb, `Toaster`.
- Design system mínimo: tokens de color, tipografía, espaciado, estados (`badge` de estados), `PageHeader`, `EmptyState`, `ErrorState`.

**1b. Supabase + Auth**
- `supabase init`, migración `0001_foundation`: enums, `profiles` + trigger, `audit_logs`, `auth_role()`, RLS.
- Clientes Supabase (server/client/service/middleware), `middleware.ts`, `/login`, logout, `requireRole()`.
- `lib/audit.ts` + `lib/logger.ts`. Login registrado en audit.
- Tests: `env.ts`, `requireRole`, RLS de `profiles` contra Supabase local.

### Fase 2 — Mercado Libre (2 entregas)
**2a. Cuenta + tokens**
- Migración `0002_mercadolibre_accounts`: `integrations`, `mercadolibre_accounts`, `mercadolibre_tokens`.
- `lib/crypto.ts`, `services/mercadolibre/{client,oauth,token-manager,users.api,errors}`.
- Rutas OAuth start/callback. Pantalla Configuración › Mercado Libre: estado, nickname, conectado por, fecha, botones Conectar/Reconectar/Desconectar (con confirmación).
- Tests: crypto, token-manager (lease, refresh, `invalid_grant`), OAuth callback con MSW.

**2b. Webhooks + cron**
- Migración `0003_webhook_events`.
- `POST /api/webhooks/mercadolibre`, `processor.ts` (esqueleto con dispatch por topic), `POST /api/cron/mercadolibre/reconcile`, `pg_cron` + `pg_net` en migración `0004_cron`.
- Estado de webhooks en Configuración (último recibido, fallidos).
- Tests: idempotencia del webhook, token inválido, `application_id` ajeno, reintento con backoff.

### Fase 3 — Preguntas (3 entregas)
**3a. Datos + sync**
- Migración `0005_questions`: `mercadolibre_items`, `questions`, `question_answers`, índices, RPC `mark_question_answered`.
- `questions.api.ts`, `items.api.ts`, `mappers.ts`, `sync-question.ts`, procesador del topic `questions`, sincronización inicial y reconciliación completa.
- Tests: mapeo de estados, upsert idempotente, ítem cacheado.

**3b. Listado**
- Página de preguntas con tabs Pendientes / Respondidas / Archivadas, búsqueda (`tsvector`), orden por antigüedad/fecha, filtro por publicación, paginación, chip de antigüedad con color por umbral (<1 h, <24 h, >24 h), botón "Sincronizar ahora".
- Loading/empty/error states.

**3c. Detalle + respuesta**
- Página de detalle: publicación (foto, título, precio, stock, link a ML), pregunta, comprador, historial.
- `answer-form.tsx` + `sendAnswer` + toasts + manejo de cada error de §F.
- Archivar manualmente (con confirmación).
- Tests: `send-answer.ts` con MSW (éxito, 400, 429, timeout, doble envío).

### Fase 4 — QA
- Playwright: login, listado, responder con ML simulado (MSW en modo server o `ML_MOCK=1`).
- Prueba real con **usuarios de prueba de ML** (`POST /users/test_user` **[verificar]**) en un deploy de preview: pregunta desde comprador de prueba → llega al panel → se responde.
- Revisión de RLS, roles, responsive (desktop primero; mobile: listado y detalle usables), Lighthouse.

### Fase 5 — Production
- Vercel: proyecto, variables, región, dominio. Supabase Pro o keep-alive (R5).
- App de ML apuntando al dominio final; migrar `redirect_uri` y URL de notificaciones.
- Backups (PITR de Supabase), alertas por `webhook_events.failed` y `needs_reauth` (email vía Supabase o simple página de estado en Dashboard).
- Docs finales: README, `docs/MERCADOLIBRE.md` (runbook: reconectar, reprocesar eventos), ADRs.

Después de V1 (no planificado en detalle): Publicaciones, Ventas, plantillas de respuesta, sugerencias con IA, invitación de usuarios desde la app.

---

## H. MVP: qué entra y qué no

**Entra en V1**
- Login por email/contraseña (usuarios creados por invitación), roles admin/operator/viewer.
- Layout completo con navegación preparada para todos los módulos (los futuros aparecen deshabilitados).
- Conexión OAuth de **una** cuenta de Mercado Libre, renovación automática, reconexión.
- Recepción de notificaciones `questions`, reconciliación cada 5 min, sincronización inicial.
- Listado de preguntas con tabs, búsqueda, filtros, orden, antigüedad, paginación.
- Detalle con publicación, pregunta, historial; redacción y envío de respuesta; archivado manual.
- Snapshot de publicaciones solo como apoyo a preguntas.
- Dashboard: pendientes, respondidas hoy / 7 días, tiempo medio de respuesta (7 días), pendiente más antigua, estado de conexión y última sincronización.
- Configuración: cuenta ML, estado de webhooks, usuario actual y rol.
- Audit log completo (sin UI de consulta; se lee desde Supabase).
- README, `.env.example`, docs de ML, ADRs.

**NO entra en V1**
- Stock, Productos, Ventas, Envíos, Proveedores, Facturación, Clientes, Catálogo, Publicaciones como módulo.
- Respuestas automáticas, sugerencias, IA, plantillas, detección de repetidas.
- Múltiples cuentas de ML en simultáneo (el modelo lo soporta; la UI no).
- Gestión de usuarios desde la app (alta/baja/roles): se hace desde el dashboard de Supabase.
- Vista del audit log en la UI.
- Notificaciones push / email por pregunta nueva.
- Mensajería post-venta de ML (es otra API, `/messages`).
- i18n, tema oscuro (los tokens quedan preparados, no se implementa el toggle).
- App mobile nativa / PWA.

---

## I. Decisiones que necesitan tu confirmación

| # | Decisión | Recomendación | Alternativa |
|---|---|---|---|
| D1 | **Repositorio** | Repo nuevo `benzprog/pana-gestion`, app en la raíz, sin monorepo. | Carpeta dentro del portfolio con "Root Directory" en Vercel. Peor: mezcla historiales y CI. |
| D2 | **Cantidad de cuentas de ML** | Modelo preparado para N cuentas (`account_id` en todo), UI para 1. | Solo 1 sin `account_id`: ahorra poco y obliga a migrar todas las tablas después. |
| D3 | **Tabla `integrations` genérica + `mercadolibre_accounts` + `mercadolibre_tokens`** | Sí, las tres. Tokens separados permiten RLS "cero acceso" sin vistas. | Fusionar `integrations` en `mercadolibre_accounts`: menos tablas hoy, refactor cuando entre la 2.ª integración (AFIP, correo). |
| D4 | **Escrituras de negocio vía service role tras autorizar en código; RLS solo para lecturas** | Sí. | Policies de escritura para usuarios: duplica reglas en SQL y TS. |
| D5 | **Sin ORM** (supabase-js + tipos generados + RPC para transacciones) | Sí para V1. | Drizzle: mejor para joins complejos; agregarlo después es viable porque los repositorios están aislados. |
| D6 | **Cron desde Supabase (`pg_cron` + `pg_net`) en vez de Vercel Cron** | Sí. Vercel Hobby limita crons a 1/día; pg_cron no depende del plan. | Vercel Cron si se contrata Vercel Pro. |
| D7 | **Procesamiento de webhooks con `after()`** + reconciliación, sin cola externa | Sí para V1. | Inngest/QStash: más robusto, una dependencia y un vendor más. |
| D8 | **Estados de pregunta: `pending / answered / archived` + `last_error`**, fallos en `question_answers` | Sí. Una pregunta con envío fallido sigue pendiente; "error" como estado la sacaría de la bandeja. | Los 4 estados sugeridos (`error` incluido). |
| D9 | **Cifrado de tokens en la app (AES-256-GCM)** | Sí. Testeable, sin dependencia del plan de Supabase. | Supabase Vault. |
| D10 | **Registro cerrado**: usuarios creados desde el dashboard de Supabase | Sí en V1. | Pantalla de invitación en la app (Fase posterior). |
| D11 | **Snapshot `mercadolibre_items`** | Sí: evita un `GET /items` por cada apertura y es la base de Publicaciones. | Desnormalizar título/foto en `questions`. |
| D12 | **Región Vercel `gru1`, zona horaria `America/Argentina/Buenos_Aires`, copy en es-AR con voseo** | Sí. | — |
| D13 | **Next.js 16** (o 15.5 si hay incompatibilidad) | Verificar al iniciar la Fase 1 con shadcn/Supabase. | — |

---

## J. Riesgos de refactor futuro y otros riesgos

| # | Riesgo | Impacto | Mitigación desde el inicio |
|---|---|---|---|
| R1 | Cambios en la API de ML (versiones de `/questions`, formato de notificaciones) | Medio | Todo pasa por `services/mercadolibre`; respuestas validadas con Zod; fixtures reales guardadas en `tests/mocks`. |
| R2 | Refresh token invalidado (rotación single-use + concurrencia) | Alto operativo: hay que reconectar a mano | Lease en DB, alerta `needs_reauth`, botón Reconectar visible. |
| R3 | `after()` no alcanza si crece el volumen o si Vercel corta la función | Medio | Eventos persistidos antes de procesar; reconciliación reprocesa; el reemplazo por cola es local a `processor.ts`. |
| R4 | Límite de tiempo de funciones en Vercel (10 s Hobby por defecto) | Bajo | Procesar 1 evento por invocación; reconciliación paginada; `maxDuration = 60`. |
| R5 | Supabase Free pausa el proyecto tras 7 días sin actividad → webhooks fallan | Alto | Plan Pro, o el propio cron mantiene actividad. Decidir en Fase 5. |
| R6 | OAuth y webhooks requieren HTTPS público → desarrollo local incómodo | Medio | Túnel (`cloudflared`/`ngrok`) documentado; `ML_MOCK=1` con MSW para trabajar sin ML. |
| R7 | Multi-tenant (varias empresas) | No previsto | Descartado a propósito. Si algún día hace falta, `account_id` ya segmenta datos; faltaría `organization_id` en `profiles`. |
| R8 | Datos de ML no verificados (marcados **[verificar]**) | Bajo | Se confirman contra la documentación al inicio de la Fase 2, antes de escribir el cliente. |
| R9 | Búsqueda en `tsvector` insuficiente | Bajo | Se puede sumar `pg_trgm` sin migrar datos. |
| R10 | Crecimiento de `webhook_events` y `audit_logs` | Bajo | Retención: job mensual que archiva eventos `processed` de más de 90 días (Fase 5). |
| R11 | Mensajería post-venta confundida con preguntas | Bajo | Fuera de alcance explícito; el modelo de `webhook_events` acepta el topic `messages` cuando toque. |

---

## 11. Prerrequisitos manuales (tu lado)

1. Crear el repo `benzprog/pana-gestion` (privado) en GitHub y habilitarlo para esta integración de Claude.
2. Crear un proyecto de Supabase (región `sa-east-1`, São Paulo). Deshabilitar registro público.
3. Crear la app en el DevCenter de Mercado Libre (§E.1). Guardar `APP_ID` y `SECRET_KEY`.
4. Crear el proyecto en Vercel apuntando al repo (puede esperar a Fase 5, pero la URL de preview sirve para OAuth y webhooks antes).

## 12. Variables de entorno previstas (`.env.example`)

```
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ML_APP_ID=
ML_CLIENT_SECRET=
ML_REDIRECT_URI=
ML_SITE_ID=MLA
ML_TOKEN_ENCRYPTION_KEY=        # 32 bytes en base64
ML_WEBHOOK_TOKEN=               # secreto en la URL de notificaciones
OAUTH_STATE_SECRET=             # HMAC de la cookie de state
CRON_SECRET=
LOG_LEVEL=info
ML_MOCK=0                       # 1 = usar MSW en lugar de la API real
```
