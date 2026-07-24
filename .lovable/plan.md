## Objetivo
Registrar una tercera línea de WhatsApp (etiqueta **Galsa**, WABA distinto) usando los secrets ya cargados `WHATSAPP_PHONE_NUMBER_ID_3` y `WHATSAPP_WABA_ID_3`, dejarla operativa en todos los flujos (envío directo, campañas, plantillas, webhook) y validarla con pruebas reales.

Contexto actual verificado:
- Ya existen los secrets: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` (Mexicali), `WHATSAPP_PHONE_NUMBER_ID_2` (Tijuana), `WHATSAPP_PHONE_NUMBER_ID_3` (Galsa, pendiente de alta), `WHATSAPP_WABA_ID`, `WHATSAPP_WABA_ID_3`.
- Ya hay 2 filas en `whatsapp_accounts` (Mexicali, Tijuana). Falta la de Galsa.
- `whatsapp-send-message` y `whatsapp-campaign-runner` usan `PHONE_ID_1 ?? PHONE_ID_2` como fallback (no contemplan el `_3`).
- `whatsapp-sync-templates` agrupa por `waba_id` leyendo las filas activas de `whatsapp_accounts`, así que basta con dar de alta la fila para que sincronice el nuevo WABA.

## Cambios

### 1. Nueva edge function `whatsapp-bootstrap-account-3`
Función administrativa de un solo uso. Lee `WHATSAPP_PHONE_NUMBER_ID_3`, `WHATSAPP_WABA_ID_3` y `WHATSAPP_ACCESS_TOKEN`; consulta a Meta `GET /{phone_id}?fields=display_phone_number,verified_name` para obtener el número visible; y hace `upsert` en `whatsapp_accounts` con:
- `label`: "Galsa"
- `business_phone_number_id`: valor del secret
- `waba_id`: valor del secret
- `display_phone`: valor devuelto por Meta
- `color`: por ejemplo `#f59e0b`
- `is_active`: true

Devuelve el registro insertado/actualizado para verificación.

### 2. Actualizar fallbacks en dos funciones existentes
- `supabase/functions/whatsapp-send-message/index.ts`: agregar `PHONE_ID_3 = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID_3")` y considerarlo en los `??` de las líneas 33, 156 y 178.
- `supabase/functions/whatsapp-campaign-runner/index.ts`: incluir `WHATSAPP_PHONE_NUMBER_ID_3` en la cadena de fallback (línea 26-27).

### 3. Deploy de las 3 funciones (bootstrap, send-message, campaign-runner).

## Pruebas de validación
1. **Bootstrap**: invocar `whatsapp-bootstrap-account-3` y confirmar que devuelve el `display_phone` de Meta y que la fila queda en `whatsapp_accounts`.
2. **Templates**: invocar `whatsapp-sync-templates` y confirmar que aparecen plantillas nuevas asociadas al `WHATSAPP_WABA_ID_3`.
3. **Envío directo**: invocar `whatsapp-send-message` con `business_phone_number_id` = el de Galsa, `to_phone` = `6867383963`, `kind` = `template`, usando una plantilla APPROVED del WABA nuevo (por ejemplo `hello_world` si está o la primera plantilla APPROVED devuelta por el paso 2).
4. **Verificaciones**: revisar `edge_function_logs` de `whatsapp-send-message`, confirmar `messages[0].id` en la respuesta y ver la fila `outbound` en `whatsapp_messages`.

Si la plantilla de prueba no existe en el WABA nuevo (WhatsApp no permite mensajes de sesión sin ventana de 24h abierta), el paso 3 se hará con `hello_world` (plantilla estándar de Meta) o se documentará que se necesita una plantilla aprobada para completar la validación end-to-end.

## Fuera de alcance
- UI en `WhatsAppSettings.tsx` (la cuenta se puede editar desde ahí después del bootstrap).
- Cambios al flujo de routing por zonas (Mexicali/Costa) — Galsa no forma parte de esa lógica.
