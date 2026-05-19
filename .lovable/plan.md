# Firmas con PDF imprimible + Editor de Formatos en Configuración

## Objetivo
Sustituir el flujo actual "Registrar firma" por:
1. **Generar PDF** del documento (Solicitud, Confidencialidad, Buró, Subsistencia, BC sí / BC no) prellenado con datos del crédito.
2. **Imprimir y firmar a mano**.
3. **Subir el documento firmado** (registra firma + archivo).
4. Dejar la puerta abierta para **firma en línea** en el futuro (placeholder, sin implementar).

Y agregar en **Configuración** una sección donde se pueden **diseñar y editar los formatos**, usando como base el XLSX adjunto (hoja `SOLICITUD - Llenar`).

---

## Alcance de los 6 formatos

| # | Clave firma          | Documento                         | Página XLSX |
|---|----------------------|-----------------------------------|-------------|
| 1 | `solicitud`          | Solicitud de crédito              | 1           |
| 2 | `confidencialidad`   | Contrato de confidencialidad      | 2           |
| 3 | `buro`               | Autorización Buró de Crédito      | 3           |
| 4 | `subsistencia`       | Carta de Subsistencia de Poderes  | 4           |
| 5 | `bc_si`              | LFPIORPI – Sí hay BC              | 5           |
| 6 | `bc_no`              | LFPIORPI – No hay BC              | 6           |

> El template 5 ó 6 se elige automáticamente según `lfpiorpi_beneficiario_controlador` del crédito.

---

## Cambios de Backend (DB)

Nueva tabla `credit_doc_templates`:
- `key` (texto, único entre los 6): `solicitud`, `confidencialidad`, `buro`, `subsistencia`, `bc_si`, `bc_no`
- `nombre` (texto)
- `entidad`: `lumaggs` | `galsa` | `ambas`
- `contenido_html` (texto): cuerpo del documento con tokens `{{razon_social}}`, `{{rfc}}`, `{{rep_legal_nombre}}`, etc.
- `header_html`, `footer_html` (opcional)
- `pagina_tamano` (`letter` por defecto), márgenes
- `activo` (bool), `updated_by`, `updated_at`

RLS: lectura para internos; edición solo admin/manager.

Migración seed: insertar los 6 templates con el contenido inicial extraído del XLSX V6.

Extender `credit_requests` con columnas opcionales por firma:
- `firma_<key>_doc_id` (FK a `credit_request_docs`) — apunta al PDF firmado subido.

---

## Cambios de UI

### Tab Firmas (CreditoDetail)
Reemplazar el botón **"Registrar firma"** por una tarjeta con tres acciones:
- **Generar PDF** → abre el PDF generado en otra pestaña (descargable e imprimible).
- **Subir firmado** → file input; al cargar:
  - Sube el archivo a `credit-docs` (bucket existente) con metadata `{ firma_key }`.
  - Setea `firma_<key>_fecha = now()`, pide/confirma `firma_<key>_nombre`, guarda `firma_<key>_doc_id`.
- **Firmar en línea** → botón deshabilitado con tooltip "Próximamente".

Cuando ya está firmado: mostrar nombre, fecha, link al PDF firmado y botón "Reemplazar / Limpiar".

### Configuración › Formatos (nueva ruta `/configuracion/formatos`)
Lista de los 6 templates con:
- Vista previa del PDF generado con datos de ejemplo.
- Editor de contenido (HTML/Markdown enriquecido con barra de tokens disponibles).
- Editor de encabezado/pie y márgenes.
- Botón "Guardar" / "Restaurar a base V6".
- Selector de entidad (Lumaggs/Galsa/Ambas) para tener variantes.

Solo accesible a roles `admin` / `manager`.

---

## Generación de PDF

Opción elegida: **Edge Function** `generate-credit-pdf` que recibe `{ credit_request_id, firma_key }`:
1. Carga el crédito (joins a companies, contactos, productos, etc.).
2. Carga el template activo de esa `firma_key` y entidad.
3. Renderiza tokens (`{{...}}`) sobre `contenido_html`.
4. Genera PDF con `npm:@react-pdf/renderer` o `npm:html-pdf-node` adaptado a Deno (alternativa: `npm:pdf-lib` componiendo a partir de HTML simple).
5. Devuelve el PDF inline.

> Si la cadena HTML→PDF en Deno resulta problemática, fallback a generar PDF en cliente con `@react-pdf/renderer` directo en el front (no requiere edge function).

---

## Plan de implementación (fases)

1. **Migración DB** (`credit_doc_templates` + columnas `firma_*_doc_id`) + seed con los 6 templates.
2. **Edge function** `generate-credit-pdf` con render de tokens y PDF.
3. **UI Tab Firmas**: nuevo card con 3 acciones, file upload y vinculación al doc subido.
4. **UI Configuración › Formatos**: listado, editor de tokens, vista previa, guardado.
5. **Cleanup**: quitar `prompt()` y `markFirma` antiguo; documentar tokens disponibles.

---

## Decisiones que necesito confirmar

1. **Editor de formatos** — ¿prefieres editor estilo Markdown/HTML simple con barra de tokens, o un WYSIWYG (más caro de mantener)?
2. **Generación de PDF** — ¿OK con edge function + HTML→PDF, o prefieres render en cliente con `@react-pdf/renderer` (más rápido pero pesa más el bundle)?
3. **Variantes por entidad** — ¿los 6 formatos deben tener versión distinta Lumaggs vs Galsa, o por ahora basta con una sola versión (Lumaggs) y luego clonamos?
4. **"Generar PDF"** — ¿debe guardar también una copia sin firmar en el expediente, o sólo se abre para imprimir y no se guarda hasta que se sube el firmado?
