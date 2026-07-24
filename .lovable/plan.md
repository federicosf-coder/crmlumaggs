# Ruteo de 4 zonas — Cuenta Galsa

Extender el flujo de ruteo por zonas (hoy Mexicali/Costa en las cuentas Mexicali y Tijuana) para agregar la cuenta **Galsa** (`phone_number_id` que corresponde a +52 1 686 561 8533) con **4 zonas** en vez de 2.

## Comportamiento

Cuando llegue un mensaje a Galsa y no exista sesión activa (o la sesión esté `finalizado`):

1. El bot responde:
   > ¿De dónde nos contactas?
   > 1) Mexicali
   > 2) Tijuana, Ensenada, Tecate, San Quintín, Rosarito
   > 3) Valle de Mexicali
   > 4) San Luis R.C.
   >
   > Responde con el número de la opción.
2. Estado de sesión pasa a `esperando_zona`.
3. Si el cliente responde `1`, `2`, `3` o `4` (aceptando también variantes tipo "opcion 1", "1.", etc.), el bot envía un mensaje con el enlace `wa.me` al encargado correspondiente, precargando el mensaje original del cliente:
   - 1 → **Mexicali** — `5216861790126`
   - 2 → **Tijuana / Costa** — `5216645634361`
   - 3 → **Valle de Mexicali** — `5216861682488`
   - 4 → **San Luis R.C.** — `5216531517816`
   Luego marca la sesión como `finalizado`.
4. Si responde algo distinto mientras está en `esperando_zona`, el bot re-pregunta sin reiniciar.
5. Cualquier mensaje nuevo con sesión `finalizado` reinicia el flujo desde el paso 1.

Todos los mensajes salientes se registran en `whatsapp_messages` como `outbound` (mismo helper `sendAndLogText` que ya existe).

## Cambios técnicos

- `supabase/functions/whatsapp-webhook/index.ts`:
  - Agregar entrada en `ROUTING_ACCOUNTS` para el `business_phone_number_id` de Galsa con las 4 zonas y sus destinos.
  - Generalizar `handleZoneRouting` (si aún está hardcodeado a 2 opciones) para aceptar N zonas definidas por cuenta: mensaje de bienvenida generado desde la lista de zonas y parseo de la respuesta contra los índices `1..N`.
  - Mantener el manejo de sesión existente (`whatsapp_routing_sessions`, reuso de fila por `(wa_phone, business_phone_number_id)`, estados `esperando_zona`/`finalizado`).
- Deploy de `whatsapp-webhook`.

## Validación

1. Consultar en la BD el `business_phone_number_id` real de la cuenta Galsa para configurar `ROUTING_ACCOUNTS`.
2. Revisar logs del webhook al enviar un mensaje de prueba a +52 686 561 8533 y responder `1`, `2`, `3`, `4` y una opción inválida.
3. Confirmar en `whatsapp_messages` que quedan registrados el saludo, la respuesta del cliente y el mensaje con el link `wa.me` correspondiente.

## Fuera de alcance

- No se toca el flujo de Mexicali/Tijuana existente.
- No se agregan tablas nuevas ni cambios de UI.
