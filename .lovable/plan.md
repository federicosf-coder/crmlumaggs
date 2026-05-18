# Plan — Módulo "Solicitudes de Crédito"

Por tamaño del entregable (8 tablas nuevas, RLS, storage, módulo interno con 5 pestañas, portal público con OTP y parseo de CSF), lo entrego en **3 fases incrementales**. Cada fase es funcional por sí sola y puede revisarse antes de continuar.

---

## Fase 1 — Base de datos, Storage, navegación y catálogo

**Migración única** con:
- 4 enums: `credito_tipo`, `credito_estado`, `credito_doc_estado`, `credito_visibilidad`.
- 8 tablas: `credit_requests`, `credit_request_parties`, `credit_doc_types`, `credit_request_docs`, `credit_request_comments`, `credit_request_history`, `credit_client_sessions` + columnas tal cual el spec.
- Función `generate_credito_folio()` + trigger `BEFORE INSERT`.
- Función `credit_request_completeness(req_id uuid)` que devuelve `{form_pct, docs_pct, sigs_pct, …}`.
- Triggers `update_updated_at_column()` en las 3 tablas indicadas.
- 6 índices definidos.
- RLS exactamente como en sección 1m (incluye lectura anónima por token).
- Seed de 11 `credit_doc_types`.
- Seed `role_module_permissions` para módulo `credito`.

**Storage**: bucket privado `credit-docs` con RLS:
- Lectura/escritura para roles internos autenticados.
- Insert para anónimos sólo si el path comienza con un `credit_request_id` cuyo `client_token` (en `credit_requests` o `credit_request_parties`) fue validado vía RPC `validate_credit_token(token, request_id)`.

**Enum `app_module`**: agregar valor `credito`. **(Esto técnicamente es una alteración de enum, no de tabla — pediré confirmación si la validación del agente lo bloquea.)**

**Frontend Fase 1**:
- Item en `AppSidebar` "Solicitudes de Crédito" (icon `FileCheck`) visible para admin/manager/sales/customer_service/accounting.
- Rutas vacías `/credito`, `/credito/:id`, `/credito/configuracion`, `/portal/credito/:token` registradas (con placeholders).
- Página `/credito/configuracion` completa: tabla de `credit_doc_types` con toggles inline, drag-to-reorder, drawer de edición y "+ Nuevo".

Entrega Fase 1 = base sólida + admin de catálogo. Sin lógica de workflow aún.

---

## Fase 2 — Módulo interno `/credito` y `/credito/:id`

- **Lista** con filtros (estado, tipo, búsqueda folio/empresa/RFC, "Solo mis solicitudes"), columnas incluyendo 3 mini-barras de progreso desde `credit_request_completeness`, badge "Recordatorio" según regla de 3 días.
- **Drawer "Nueva Solicitud"**: select de empresas, tipo, fecha límite, contacto principal, monto, días. Crea request + party principal + history.
- **Detalle `/credito/:id` con header global** (folio, empresa, badges, 3 progress bars, botones Copiar link / Enviar recordatorio / kebab).
- **Tab 1 Formulario**: 7 secciones acordeón, autosave debounced 1.5s, banner si `csf_parseado`, resaltado azul en campos auto-llenados, "Guardar formulario" manual.
- **Tab 2 Documentos**: sección cliente (cards con aprobar/rechazar inline), sección interna (uploads `visibilidad='interna'`), sección partes adicionales.
- **Tab 3 Formatos y Firmas**: 5 tarjetas con modal full-screen por documento. Cada plantilla con sustitución `{{var}}` desde el request. Validación de campos previo a firmar. Persistencia en `firma_*_fecha`/`firma_*_nombre`.
- **Tab 4 Seguimiento**: stepper visual, panel de acciones contextual por estado (todos los casos del spec: borrador → activo, incl. lista 69, branch Cescemex/Directo, dirección, jurídico, contratos), panel de partes adicionales con agregar/reenviar, timeline desde `credit_request_history`. Botón global "⛔ Rechazar".
- **Tab 5 Comentarios**: lista descendente, nuevo comentario con toggle interna/pública.
- **Edge function `credit-send-portal`**: envía correo a `client_email` + todas las parties usando `send-transactional-email` y nuevas plantillas React Email: `credit-portal-invitation` y `credit-portal-reminder` (incluye lista de docs pendientes, firmas faltantes, `fecha_limite`). Botón "Enviar recordatorio" actualiza `ultimo_recordatorio_enviado` y `recordatorio_count`.

---

## Fase 3 — Portal público `/portal/credito/:token`

- **Acceso OTP**: landing → email → genera código de 6 dígitos en `credit_client_sessions` (15 min TTL) → envía vía plantilla `credit-portal-otp` → 6 inputs auto-advance → marca `verified` → guarda sesión en `localStorage` (24h).
- Edge function `credit-portal-auth` (verify_jwt=false) con acciones `request_otp` y `verify_otp` (resuelve token contra `credit_requests` y `credit_request_parties`).
- Edge function `credit-portal-data` que devuelve datos del request + parties + docs aplicables + comentarios públicos a partir de `{token, email}` validados.
- Edge function `credit-portal-save` para autosave de formulario y `credit-portal-sign` para firmas (valida token + email cada vez).
- Edge function `credit-portal-upload` que genera URL firmada de upload al bucket `credit-docs` bajo path validado.
- **UI mobile-first**: header sticky con barra de 4 segmentos, secciones: Tu información (acordeón con contadores y banner CSF), Documentos requeridos (cards grandes, vigencia, upload tap-target 64px, reemplazo, rechazo con motivo), Documentos a firmar (overlay full-screen con scroll-to-bottom + checkbox + nombre, sustitución `{{var}}` con `[pendiente]` en naranja para faltantes), Mensajes del equipo (solo públicos), Estado de tu solicitud.
- **Parseo CSF en cliente**: pdf.js vía CDN dentro del componente de upload. Regex spec exacto. POST a edge `credit-portal-parse-csf` que aplica `UPDATE` a campos `csf_*` + auto-fill (`razon_social`, `rfc`, `domicilio_fiscal`, etc.) y devuelve resumen para mostrar la tarjeta "✅ Detectamos tus datos".

---

## Notas técnicas y guardrails

- Todos los formularios/modales usan **Estilo Modal Refinado** (regla del proyecto).
- Map de colores de badge tal cual spec.
- Idioma 100% español, formatos DD/MM/YYYY y MXN.
- Sin paquetes nuevos: pdf.js sólo vía CDN en portal.
- No se modifican tablas/rutas/navegación existentes.
- Permisos en queries del lado cliente usan `module_owner_allows(user, 'credito', created_by)` para `sales` (acceso `propio`).
- Historial: cada transición de estado se inserta en `credit_request_history` desde un helper compartido en frontend (no trigger, para capturar `nota` libre del usuario).

---

## Confirmación

¿Apruebas el plan? Si dices "sí", arranco con **Fase 1 (migración + storage + sidebar + `/credito/configuracion`)**. Cuando la valides, sigo con Fase 2 y luego Fase 3. Si prefieres otro orden o quieres ajustar el alcance de alguna fase, dímelo.
