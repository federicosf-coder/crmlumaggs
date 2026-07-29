## Objetivo

Recibir prospectos de Facebook Lead Ads de forma nativa, multiempresa / multipágina / multiformulario, sin lógica específica en el webhook y sin redesplegar código al agregar páginas o formularios. Toda la creación de contacto, empresa, lead, SLA y notificaciones reutiliza la lógica que hoy vive en `lead-intake`.

## 1. Reutilizar la lógica, no duplicarla

Hoy toda la lógica de negocio está dentro de `supabase/functions/lead-intake/index.ts`. Se extrae **sin cambios de comportamiento** a un módulo compartido `supabase/functions/_shared/lead-processing.ts` que expone:

- `normalizePhone`, `splitName`, `pick`, `clean`, `isEmail`
- `processLead(admin, source, payload, meta)` → dedupe 24 h, vinculación de contacto existente, alta de empresa (solo si viene el dato), inserción en `leads`, notificación WhatsApp inmediata, disparo de automatización.

`lead-intake` pasa a ser una capa delgada: valida la API key y llama a `processLead`. El nuevo webhook de Facebook hace lo mismo tras normalizar el payload de Meta. Una sola implementación de negocio.

## 2. Modelo de datos (3 tablas nuevas)

```text
lead_integrations        (una por empresa/config)
 ├─ nombre, tipo ('facebook_lead_ads')
 ├─ source_id      → lead_sources   (plaza, marca, WhatsApp de aviso, SLA)
 ├─ automation_id  → automations    (workflow opcional)
 ├─ is_active, created_by, timestamps

lead_integration_pages   (páginas conectadas)
 ├─ integration_id, page_id, page_name
 ├─ page_access_token (cifrado/solo servidor), token_expira_at
 ├─ subscribed_at, is_active

lead_integration_forms   (formularios asociados)
 ├─ integration_id, page_id, form_id, form_name
 ├─ field_map jsonb  (mapeo campo Meta → campo CRM, editable)
 ├─ is_active
 └─ UNIQUE (page_id, form_id)
```

Ruteo del webhook: `page_id` + `form_id` → fila en `lead_integration_forms` → integración → `lead_sources` + workflow. Agregar página/formulario es solo insertar filas desde la UI.

RLS: admin/manager gestionan; `service_role` con acceso completo para las funciones. Los tokens de página nunca se exponen al cliente (columna leída solo por edge functions; la UI usa una función que devuelve el resto de columnas).

## 3. Webhook `facebook-leads-webhook` (genérico)

`GET` — verificación de Meta con `hub.verify_token` contra el secreto `FB_LEADGEN_VERIFY_TOKEN`.

`POST` — sin ninguna referencia a páginas o formularios concretos:
1. Verifica la firma `X-Hub-Signature-256` con el App Secret de la app de Meta (la misma de WhatsApp).
2. Por cada entrada `leadgen`: toma `page_id`, `form_id`, `leadgen_id`.
3. Busca la fila activa en `lead_integration_forms`; si no existe o está inactiva, registra y descarta (200 a Meta).
4. Descarga el lead completo: `GET /v21.0/{leadgen_id}?fields=field_data,created_time,ad_id,adset_id,campaign_id,form_id` con el token de página.
5. Aplana `field_data` a un objeto plano y aplica `field_map`; los UTM se derivan de la campaña (`utm_source=facebook`, `utm_medium=paid`, `utm_campaign=<nombre campaña>`).
6. Llama a `processLead(...)` con la `lead_sources` de la integración → mismo contacto/empresa/lead/SLA/WhatsApp/automatización.
7. Responde 200 siempre (Meta reintenta si no).

Se registra cada evento en `lead_integration_events` (payload crudo, resultado, error) para diagnóstico y reproceso.

## 4. Función `facebook-graph-admin` (para la UI)

Endpoint autenticado (solo admin/manager) que encapsula las llamadas a Graph API con la app de Meta de WhatsApp:
- `list_pages` → `/me/accounts` con el token de usuario configurado.
- `list_forms` → `/{page_id}/leadgen_forms`.
- `subscribe_page` → `POST /{page_id}/subscribed_apps?subscribed_fields=leadgen` y guarda el token de página.
- `unsubscribe_page`, `test_lead` (reproceso de un `leadgen_id`).

## 5. UI: pestaña "Integraciones" en Bandeja de Prospectos

Se agrega una cuarta pestaña junto a Bandeja / Recuperación / Atendidos, visible para admin y manager, con estilo de Tabla Refinada y Modal Refinado:

- Lista de integraciones: nombre, tipo, fuente, workflow, páginas, formularios activos, leads recibidos (7/30 días), switch Activo/Inactivo.
- **Nueva integración**: nombre, fuente de prospectos (crear una nueva desde ahí también), automatización opcional, activo.
- **Conectar página**: botón que lista las páginas disponibles de la app de Meta; al elegir una, se suscribe a `leadgen` y se guarda el token.
- **Formularios**: al seleccionar una página se listan sus formularios; se marcan uno o varios para asociarlos a la integración, con vista previa de campos y mapeo editable (nombre, correo, teléfono, empresa, mensaje, interés, ciudad).
- **Historial de eventos** por integración con resultado y botón de reprocesar.

Cambiar el workflow, activar/desactivar, agregar página o formulario = solo UI, sin código.

## 6. Configuración y pruebas

- Secretos: `FB_LEADGEN_VERIFY_TOKEN` (generado), y reuso de `WHATSAPP_APP_SECRET` / token de usuario de la app de Meta ya existente; si falta algún permiso (`leads_retrieval`, `pages_show_list`, `pages_manage_metadata`), se indicará qué agregar en la app de Meta.
- Al terminar te doy la URL del webhook para pegarla en la app de Meta y probamos con la herramienta oficial "Lead Ads Testing Tool": el lead debe aparecer en la Bandeja con su origen, campaña y SLA corriendo.

## Detalles técnicos

- Nuevas funciones: `facebook-leads-webhook` (`verify_jwt = false`), `facebook-graph-admin` (JWT + verificación de rol en código).
- `_shared/lead-processing.ts` compartido entre `lead-intake` y el webhook; `lead-intake` conserva su contrato público actual sin cambios.
- Idempotencia por `leadgen_id` (índice único en `lead_integration_events.leadgen_id`) para evitar duplicados por reintentos de Meta.
- Índices en `lead_integration_forms(page_id, form_id)` para ruteo O(1).
