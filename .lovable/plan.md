# Error 132001: la plantilla se envía desde una línea de otra cuenta

## Diagnóstico (confirmado con los datos)
- La campaña fallida usó la plantilla `prueba` con el idioma `es`. Meta respondió: «template name (prueba) does not exist in es». Esto confirma que el nombre ya llega limpio, sin «(es)».
- La plantilla `prueba` existe y está aprobada en la cuenta de WhatsApp de **Tijuana/Mexicali**.
- La campaña se envió desde la línea **Galsa (686 561 8533)**, que pertenece a **otra cuenta de WhatsApp Business** y además aparece como «desconectada». Esa cuenta no tiene la plantilla `prueba`, y por eso Meta contesta que no existe.

## Cambios
1. **Limpieza estricta del nombre** (lo que pediste, como protección extra): el nombre que se manda a Meta queda limpio, por ejemplo «prueba (es)» pasa a ser `prueba`. El idioma entre paréntesis se manda aparte como `language.code`. Si la campaña tiene guardado un idioma distinto al del paréntesis, gana el del paréntesis.
2. **Validar que la línea y la plantilla sean de la misma cuenta** antes de enviar. Si no coinciden, la campaña no se manda y aparece un mensaje claro: «La plantilla X no existe en la cuenta de la línea Galsa; elige Tijuana o Mexicali».
3. **Filtro en «Nueva campaña»:** al elegir una línea, el selector solo muestra las plantillas de su cuenta. Las líneas desconectadas no se pueden elegir.
4. **Reintento:** también se revisa la cuenta al reintentar. Así, la campaña de `prueba` puede reintentarse desde la línea de Tijuana.

## Detalles técnicos
- `_shared/whatsapp-template.ts`: aplicar `replace(/\s*\([a-z_]+\)\s*$/i,'').trim()`. Si existe, el idioma del sufijo tiene prioridad. Se actualizan las pruebas.
- `whatsapp-campaign-runner`: buscar `waba_id` en `whatsapp_accounts` usando la línea, y filtrar `whatsapp_templates` por `name`, `language` y `waba_id`. Si no se encuentra, la campaña queda en estado fallido con un mensaje explicativo, sin llamar a Meta.
- `WhatsAppCampaigns.tsx`: filtrar las plantillas por el `waba_id` de la línea elegida, y permitir cambiar la línea al reintentar.
- Volver a desplegar las funciones y correr `bunx tsgo --noEmit` y vitest.
