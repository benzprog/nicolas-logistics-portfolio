# Integración con Mercado Libre

Guía operativa: qué hace el sistema, qué revisar cuando algo no anda, y qué
datos hay que confirmar contra la documentación oficial.

---

## Datos a verificar

El código se escribió sin acceso a `developers.mercadolibre.com.ar`. Los valores
que dependen de esa documentación están juntos en
[`services/mercadolibre/constants.ts`](../services/mercadolibre/constants.ts),
marcados con `VERIFICAR`. Confirmarlos **antes** de conectar la cuenta real:

| Constante                  | Valor asumido      | Qué pasa si está mal                                                               |
| -------------------------- | ------------------ | ---------------------------------------------------------------------------------- |
| `ML_QUESTIONS_API_VERSION` | `4`                | La respuesta puede venir con otra forma; Zod la rechaza y el evento queda fallado. |
| `ML_ANSWER_MAX_LENGTH`     | `2000`             | Se rechazan respuestas válidas, o Mercado Libre rechaza las nuestras.              |
| `ML_QUESTION_STATUSES`     | 7 estados          | Un estado nuevo cae en "pendiente", que es el lado seguro.                         |
| Vida del access token      | 6 h                | Solo afecta cuándo se renueva; el sistema usa el `expires_in` real.                |
| Rotación del refresh token | sí, de un solo uso | Si **no** rotara, el candado sería innecesario pero inofensivo.                    |
| Soporte de PKCE            | sí                 | Si no lo soportara, hay que sacar `code_challenge` del flujo.                      |
| Endpoint `/missed_feeds`   | existe             | La reconciliación igual cubre el hueco con `/questions/search`.                    |

Los tests usan estas mismas constantes: cambiar el valor acá mantiene las
pruebas alineadas.

---

## Flujo de conexión

1. Un administrador entra a **Mercado Libre → Configuración** y toca
   _Conectar cuenta_.
2. `GET /api/mercadolibre/oauth/start` verifica el rol, genera `state` y
   `code_verifier`, los guarda en una cookie firmada de 10 minutos y redirige a
   Mercado Libre.
3. Mercado Libre vuelve a `/api/mercadolibre/oauth/callback`. Se valida el
   `state` contra la cookie y se canjea el código por el par de tokens.
4. Se piden los datos de la cuenta, se guarda todo y los tokens quedan cifrados.
5. En segundo plano se importan las preguntas sin responder.

Reconectar una cuenta ya conocida no duplica nada: actualiza los tokens. Es lo
que hay que hacer cuando el estado dice _Hay que reconectar_.

---

## Ciclo de vida de una pregunta

```
notificación → webhook_events (idempotente por _id)
             → se relee /questions/{id} con nuestro token
             → se asegura la publicación en mercadolibre_items
             → upsert en questions por (account_id, ml_question_id)
```

Estados internos y su correspondencia:

| Estado en Mercado Libre                   | Estado interno            |
| ----------------------------------------- | ------------------------- |
| `UNANSWERED`, `UNDER_REVIEW`              | `pending`                 |
| `ANSWERED`                                | `answered`                |
| `CLOSED_UNANSWERED`, `BANNED`, `DISABLED` | `archived`                |
| `DELETED`                                 | `archived` + `deleted_at` |
| cualquier otro                            | `pending`                 |

Un estado desconocido cae en `pending` a propósito: es preferible que alguien
mire una pregunta de más a que una quede invisible.

---

## Envío de una respuesta

1. Se valida el texto y se verifica el rol.
2. Se inserta una fila en `question_answers` con estado `sending`. Un índice
   único parcial hace que solo pueda haber una por pregunta: es el candado que
   impide dos envíos simultáneos.
3. Se llama a `POST /answers`. **No se reintenta**: no hay forma de saber si la
   primera llegó.
4. Si sale bien, `mark_question_answered` cierra el intento y la pregunta en una
   sola transacción.
5. Si falla, `mark_answer_failed` deja el error en el historial y la pregunta
   sigue pendiente.

Caso borde: Mercado Libre aceptó pero el proceso murió antes del paso 4. La
pregunta queda `pending` con un intento en `sending`. La reconciliación la
relee, la ve `ANSWERED` en Mercado Libre y la actualiza.

---

## Qué revisar cuando algo no anda

### No entran preguntas nuevas

1. **Mercado Libre → Configuración**: ¿el estado dice _Conectada_?
2. ¿Cuándo fue la última notificación? Si hace horas, revisar en el panel de
   Mercado Libre que la URL de notificaciones esté bien, con el token incluido.
3. ¿Hay notificaciones con error? Aparecen en esa misma pantalla con el motivo.
4. Forzar una sincronización con el botón **Sincronizar** en Preguntas.

### Dice "Hay que reconectar"

El refresh token dejó de servir. Pasa si se rotó `ML_TOKEN_ENCRYPTION_KEY`, si
alguien revocó los permisos de la aplicación desde Mercado Libre, o si hubo tres
renovaciones fallidas seguidas. La solución es siempre la misma: un
administrador toca _Reconectar_.

### Una respuesta no se envía

El detalle está en el historial de la pregunta. Los casos típicos:

| Mensaje                           | Qué pasó                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| "Otra persona está enviando…"     | Dos personas a la vez. Esperar y recargar.                                          |
| "Esta pregunta ya fue respondida" | Se respondió desde otro lado. La lista se actualiza sola.                           |
| "Mercado Libre no respondió"      | **Verificar en la publicación antes de reintentar**: puede haberse publicado igual. |
| "La conexión venció"              | Reconectar la cuenta.                                                               |

### Reprocesar eventos a mano

```sql
-- Ver los que fallaron
select id, topic, resource, process_attempts, last_error
  from webhook_events where status = 'failed' order by received_at desc;

-- Volver a encolarlos
update webhook_events
   set status = 'received', process_attempts = 0, next_retry_at = now()
 where status = 'failed';
```

La próxima corrida de la reconciliación los toma.

---

## Consultas útiles

```sql
-- Auditoría de las últimas 24 horas
select created_at, action, entity_type, entity_id, metadata
  from audit_logs where created_at > now() - interval '24 hours'
 order by created_at desc;

-- Preguntas pendientes hace más de un día
select ml_question_id, text, ml_date_created, last_error
  from questions
 where status = 'pending' and deleted_at is null
   and ml_date_created < now() - interval '24 hours'
 order by ml_date_created;

-- Salud de la renovación de tokens
select account_id, access_token_expires_at, refresh_failures, refreshed_at
  from mercadolibre_tokens;
```
