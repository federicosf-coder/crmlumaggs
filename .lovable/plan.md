## Objetivo
Dejar el webhook de Meta Lead Ads verificable y con validación de firma activa.

## Datos para pegar en Meta (App Dashboard → Webhooks → Leadgen)

- **URL de devolución de llamada:**
  `https://fnqeicdqblkhfpyboxre.supabase.co/functions/v1/facebook-leads-webhook`
- **Token de verificación:** el valor nuevo que definamos (ver abajo).
- Después de verificar, suscribirse al campo **`leadgen`** y a la página correspondiente.

## Estado actual verificado

- La función `facebook-leads-webhook` ya responde correctamente al GET de verificación: valida `hub.mode = subscribe` y `hub.verify_token` contra `FB_LEADGEN_VERIFY_TOKEN`, y devuelve `hub.challenge` con status 200 (403 si no coincide). Está publicada sin requerir autenticación (`verify_jwt = false`).
- `FB_LEADGEN_VERIFY_TOKEN` ya existe como secreto, pero su valor está cifrado y no es recuperable.
- No existe `FB_APP_SECRET` ni `WHATSAPP_APP_SECRET`, por lo que hoy la validación de firma `x-hub-signature-256` se omite: el endpoint aceptaría POSTs de cualquier origen.

## Pasos

1. **Rotar el token de verificación**: abrir el formulario seguro para reescribir `FB_LEADGEN_VERIFY_TOKEN` con un valor que tú conozcas (por ejemplo `clave_meta_123`, aunque recomiendo algo más largo y aleatorio). Ese mismo valor va en el campo "Token de verificación" de Meta.
2. **Guardar el App Secret**: abrir el formulario seguro para crear `FB_APP_SECRET` con el valor de *Configuración → Básica → Clave secreta de la app* en el panel de desarrolladores de Meta. Con eso el webhook empieza a rechazar POSTs sin firma válida (401), sin cambios de código.
3. **Verificar en Meta**: pegar URL + token y pulsar "Verificar y guardar"; luego suscribir el campo `leadgen`.
4. **Prueba end-to-end**: usar la herramienta de pruebas de Lead Ads de Meta y revisar la bitácora de eventos en *Bandeja de Prospectos → Fuentes y API* para confirmar que el lead llega y se procesa.

## Notas técnicas

- No hace falta tocar código: la verificación GET y la validación HMAC-SHA256 ya están implementadas; solo faltan los valores de entorno.
- Cada página de Facebook debe tener su Page ID y su Page Access Token registrados en *Fuentes y API*, y la integración debe estar activa y ligada a una fuente de prospectos; de lo contrario el evento se registra como `sin_integracion` o `sin_token`.
