## Unificar Facebook Lead Ads en "Fuentes y API"

### Objetivo
Consolidar la gestión de todas las fuentes de prospectos (landings con API key + Facebook Lead Ads) en un solo lugar: el botón "Fuentes y API" que abre `LeadSourcesDialog`.

### Cambios

**1. `LeadSourcesDialog.tsx` — Agregar sección de Facebook Lead Ads**
- Reutilizar los hooks ya existentes de `useLeadIntegrations.ts` (integraciones, páginas, eventos, guardar/eliminar).
- Agregar una nueva sección dentro del dialog, debajo de las fuentes de landing, con título "Facebook Lead Ads".
- Incluir:
  - Botón "Nueva integración" → dialog con nombre, fuente de prospectos (lead_source), workflow/automatización y activo.
  - Lista de integraciones existentes (nombre, fuente, workflow, estado activo/inactivo, switch, editar, eliminar).
  - Por cada integración: tabla de páginas registradas (page_id, page_name, token configurado/pendiente, eliminar) y botón "Registrar página" (page_id, page_name, page_access_token).
  - Botón "Datos del webhook" que abre el dialog con la URL del webhook y el token de verificación.
  - Botón de historial de eventos por integración.
- Migrar los sub-componentes `PageDialog`, `EventsDialog` y `WebhookConfigDialog` desde `LeadIntegrationsPanel.tsx` hacia `LeadSourcesDialog.tsx`.

**2. `LeadsInbox.tsx` — Eliminar la pestaña "Integraciones"**
- Quitar el `TabsTrigger` y `TabsContent` de "integraciones".
- Quitar el import de `LeadIntegrationsPanel`.
- El dialog "Fuentes y API" ya contendrá todo.

**3. `LeadIntegrationsPanel.tsx` — Eliminar o dejar como respaldo**
- Ya no se usará; se puede eliminar el archivo o dejarlo sin importar.

### Resultado
Un solo botón "Fuentes y API" donde el admin gestiona tanto las claves de landing pages como las integraciones de Facebook Lead Ads (páginas, tokens, webhook, eventos), sin necesidad de cambiar de pestaña.

### Alcance
- Frontend solamente (presentación). Sin cambios en base de datos, edge functions ni lógica de negocio.
- Los hooks de `useLeadIntegrations.ts` se reutilizan intactos.