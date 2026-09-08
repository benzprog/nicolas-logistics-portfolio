# PANA Gestión — contexto para Claude

Panel interno de PANA Iluminación. Hoy resuelve una sola cosa: que no se pierda
ninguna pregunta de Mercado Libre y que responderlas sea rápido. La arquitectura
está armada para que después entren stock, productos, ventas, envíos,
proveedores y facturación sin rehacer nada.

Antes de tocar código, leé [`README.md`](README.md) (cómo se levanta) y
[`docs/CODESTYLE.md`](docs/CODESTYLE.md) (cómo se escribe acá).

---

## Lo primero, si esto todavía vive dentro del portfolio

El proyecto se construyó en `pana-gestion/` dentro de `benzprog/nicolas-logistics-portfolio`
porque la sesión en la nube donde se escribió no tiene permiso para crear
repositorios: su proxy rechaza todo endpoint de GitHub que no sea del
repositorio al que está atada.

**Una sesión corriendo en la máquina de Nicolás sí puede.** Si `pana-gestion/`
sigue siendo una subcarpeta, el primer trabajo es mudarlo:

```bash
./pana-gestion/scripts/publicar-en-repo-nuevo.sh benzprog/pana-gestion
```

Conserva el historial de commits de la carpeta (usa `git subtree split`), crea
el repositorio privado con `gh` y sube `main`. No borres la carpeta del
portfolio hasta que Nicolás confirme que el repositorio nuevo está bien.

---

## Comandos

```bash
pnpm check                      # lint + tipos + 142 pruebas. Correlo antes de cada commit.
pnpm test:e2e                   # 22 pruebas en navegador, escritorio y teléfono
./scripts/check-migrations.sh   # 62 pruebas de SQL contra un PostgreSQL de verdad
pnpm dev                        # desarrollo
```

Las tres suites son independientes y ninguna necesita credenciales, ni Docker,
ni tocar Mercado Libre. Si tocaste el esquema, `check-migrations.sh` no es
opcional: es lo único que verifica que las reglas de seguridad siguen en pie.

---

## Invariantes

Son decisiones tomadas con motivo. Cambiarlas rompe algo que hoy funciona; si
hay que cambiarlas, primero entendé por qué están.

**Los tokens de Mercado Libre no los ve nadie.** `mercadolibre_tokens` tiene RLS
activo y cero policies, y encima los valores están cifrados con AES-256-GCM. Hay
pruebas que lo verifican contra SQL real. Nunca le agregues una policy de
lectura ni los expongas en una consulta.

**RLS gobierna las lecturas; el código gobierna las escrituras.** Las lecturas
van por el cliente con la sesión del usuario (`lib/supabase/server.ts`), así
pasan por las policies. Las escrituras de negocio van por el service role
(`lib/supabase/service.ts`) **después** de que el código autorizó con
`requireRole`. No dupliques la regla de negocio en SQL.

**Un POST a Mercado Libre no se reintenta.** Si se pierde la respuesta, no hay
forma de saber si llegó; reintentar publicaría dos veces en la publicación. El
cliente HTTP ya lo impide y hay una prueba que lo fija.

**La renovación de tokens usa un candado en la base.** Mercado Libre invalida el
refresh token en cada uso. Dos renovaciones simultáneas dejan la cuenta muerta y
hay que reconectarla a mano. La condición del candado va dentro del `UPDATE`, no
en un `select` previo: entre leer y escribir habría una ventana.

**Un envío fallido no saca la pregunta de pendientes.** Si la sacara,
desaparecería de la bandeja justo cuando más hay que responderla. El error queda
en `questions.last_error` y en `question_answers`.

**El payload de un webhook nunca escribe datos.** Solo indica qué recurso releer
con nuestro propio token. Una notificación falsa, en el peor caso, nos hace
releer algo nuestro.

**Todo lo que sale de la aplicación pasa por Zod.** Formularios, Server Actions,
`searchParams`, variables de entorno y respuestas de Mercado Libre. Los datos de
un sistema ajeno no se tipan: se validan.

---

## Mapa del código

```
app/                    solo routing y composición. Nada de lógica.
features/               dominio, una carpeta por área
  auth/                 sesión, roles, permisos
  mercadolibre/
    account/            OAuth, tokens, estado de la conexión
    items/              copia local de publicaciones
    questions/          sincronización, listado, respuesta
    webhooks/           ingesta y procesamiento de notificaciones
services/mercadolibre/  cliente de la API oficial. No conoce la base de datos.
lib/                    entorno, cripto, errores, logs, auditoría, tiempo
components/             UI reutilizable, sin dominio
supabase/migrations/    esquema
tests/                  unit, integration, e2e y db
```

Las dependencias entre capas las hace cumplir ESLint:

```
app  →  features  →  services  →  lib
              ↘  components  ↗
```

`lib/` no importa nada del proyecto. `services/` no sabe que existe una base de
datos: recibe un proveedor de token por parámetro. `components/` no sabe qué es
una pregunta; si un componente necesita saberlo, va en
`features/<área>/components`.

---

## Trampas conocidas

**`new Date()` está prohibido por lint.** Usá `now()` de `lib/time.ts`, para que
los tests puedan congelar el reloj.

**Las fechas se muestran en hora de Buenos Aires y en 24 horas.** Los helpers de
`lib/time.ts` ya lo resuelven; no formatees a mano.

**Los tipos de la base están escritos a mano** en `types/database.types.ts`
porque todavía no hay un proyecto de Supabase. Espejan las migraciones exactamente,
incluidos los nombres de las claves foráneas, que es como supabase-js resuelve
los joins anidados. Si tocás una migración, actualizá el tipo y corré
`check-migrations.sh`: hay pruebas que verifican que esos nombres existen.
Cuando exista el proyecto, `pnpm db:types` los regenera.

**El ámbar de la marca (`#f4c430`) no se usa como fondo de botón.** Ningún texto
llega a 4.5:1 sobre ese color. Se reserva para marcar lo activo y lo que urge.

**Los componentes de `components/ui` se escribieron a mano.** Son los mismos que
instalaría la CLI de shadcn, copiados porque su registro no era alcanzable desde
donde se escribió esto. Si podés usar la CLI, usala; si no, seguí el mismo
patrón.

---

## Lo que falta

1. **Crear el repositorio propio** (arriba).
2. **Proyecto de Supabase**: `supabase db push` y `pnpm db:types`. Pasos en el README.
3. **Aplicación en el DevCenter de Mercado Libre**: redirect URI, URL de
   notificaciones con el token, topic `questions`, scopes `read write offline_access`.
4. **PKCE**: es el único dato de la API que no se pudo confirmar. Está encendido
   por defecto y se apaga con `ML_PKCE_ENABLED=0` si el canje del código falla
   con `invalid_grant`. Ver [`docs/MERCADOLIBRE.md`](docs/MERCADOLIBRE.md).
5. **Deploy en Vercel** y programar la reconciliación con
   `select public.schedule_ml_reconcile('https://<dominio>', '<CRON_SECRET>');`

Los módulos futuros aparecen apagados en la navegación
(`components/layout/nav-config.ts`). Sumar uno es crear una carpeta en
`features/` y sacarle `comingSoon`.

---

## Cómo trabajar acá

Nicolás lee en castellano rioplatense y el producto está escrito así. Los
comentarios, los mensajes de commit y los textos de la interfaz van en ese
registro. Los identificadores del código van en inglés.

No agregues dependencias sin motivo: el proyecto no usa ORM, ni librería de
estado, ni colas externas, y funciona. Cada una se puede sumar después, cuando
haya un problema concreto que resuelva.

Si encontrás un defecto mientras hacés otra cosa, arreglalo y decilo. Si el
arreglo es grande, contalo antes de meterlo.
