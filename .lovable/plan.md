# Auto-cierre de campañas de WhatsApp

## Problema

`whatsapp-campaign-runner` procesa un lote de hasta 500 destinatarios pendientes por invocación. Si quedan pendientes al terminar, deja la campaña como `running` y **nada la vuelve a invocar**, así que la campaña nunca se marca como `completed` y los contadores nunca se cierran. Tampoco existe un límite de tiempo o de reintentos, por lo que una campaña grande, un teléfono inválido o una línea sin sesión de 24h dejan a la campaña "corriendo" indefinidamente.

## Solución

Introducir dos mecanismos complementarios sobre el runner existente, sin cambiar el esquema de tablas:

1. **Continuación automática del lote**: si al terminar el lote quedan pendientes y no está pausada, la función se auto-invoca (fire-and-forget) para procesar el siguiente lote.
2. **Timeout duro por campaña**: si `now() - started_at` supera un umbral (ver constante abajo), se marca a los pendientes restantes como `failed` con `error_message = "timeout: campaña excedió el tiempo máximo"` y la campaña pasa a `completed` con `finished_at = now()`.

Con esto:
- Campañas chicas terminan y quedan `completed` de forma natural.
- Campañas grandes avanzan solas lote tras lote hasta terminar.
- Campañas que no pueden progresar (sin sesión, sin destinatarios válidos, línea caída) se cierran solas al vencer el timeout.

## Cambios

### `supabase/functions/whatsapp-campaign-runner/index.ts`

- Constantes nuevas al inicio del archivo:
  - `MAX_CAMPAIGN_MINUTES = 60` — tiempo máximo total desde `started_at`.
  - `BATCH_SIZE = 200` — reducir de 500 a 200 para dar margen al límite de ejecución de la función y permitir más lotes continuos.
- Antes de leer los `pending`, calcular `expired = started_at && (Date.now() - started_at) > MAX_CAMPAIGN_MINUTES * 60_000`.
  - Si `expired`: marcar todos los `pending` de esa campaña como `failed` con `error_message = "timeout: campaña excedió el tiempo máximo"`, actualizar `failed_count`, poner `status = "completed"` y `finished_at = now()`, retornar `{ ok: true, timedOut: true }`.
- Cambiar el `limit(500)` por `limit(BATCH_SIZE)` en la lectura de destinatarios pendientes.
- Al final, si `stillPending > 0` y el estado final calculado sería `running` (no `paused`, no `completed`):
  - Disparar `fetch` (sin `await` bloqueante) al mismo endpoint `/functions/v1/whatsapp-campaign-runner` con el `campaign_id`, reutilizando el header `Authorization` recibido, para encadenar el siguiente lote.
  - Envolver en `try/catch` para que un fallo de auto-invocación no rompa la respuesta actual.
- No se toca `verify_jwt` ni `supabase/config.toml`; la auto-invocación reutiliza el JWT del llamador original.

### Sin cambios de esquema

No se agrega ninguna columna. El campo `error_message` de `whatsapp_campaign_recipients` ya sirve para registrar la razón del cierre por timeout.

### Retroactivo (una sola pasada opcional)

Para las campañas que ya quedaron colgadas hoy, puedo (previa autorización) ejecutar una actualización puntual que:
- Detecte campañas con `status = 'running'` y `started_at` anterior al umbral,
- Marque a sus `pending` como `failed` (motivo timeout) y las cierre como `completed`.

Dime si quieres que lo incluya en este mismo cambio o lo dejemos para después.

## Verificación

1. Crear una campaña con 3 destinatarios válidos → debe terminar `completed` en una sola invocación.
2. Crear una campaña con >200 destinatarios → debe encadenar lotes y terminar `completed` sin intervención.
3. Simular una campaña que no puede progresar (línea sin plantilla aprobada ya devuelve `failed` inmediato; para timeout, forzar `started_at` a hace 61 min en una campaña `running` con pendientes y re-invocar el runner) → debe cerrarse como `completed` con los pendientes en `failed` por timeout.

## Notas técnicas

- El runner ya respeta `paused`: la auto-invocación solo se dispara cuando `finalStatus === "running"`.
- El runner ya respeta `scheduled_at`: si la campaña aún no vence, retorna sin tocar destinatarios; la auto-invocación no se disparará porque no procesa lote.
- El throttle actual de 300 ms por destinatario se mantiene.
