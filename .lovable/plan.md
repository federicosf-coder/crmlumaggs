# Rediseño del sistema de direcciones

## Hallazgo importante sobre el esquema actual

La tabla `direcciones_empresa` **ya tiene** equivalentes de varias columnas que pides agregar. Para no duplicar columnas y dejar inconsistencias, propongo **reutilizar** las existentes en vez de crear nuevas:

| Pides agregar | Ya existe como | Acción |
|---|---|---|
| `lat`, `lng` | `coordenadas_lat`, `coordenadas_lng` | Reutilizar |
| `alias` | `nombre` | Reutilizar (renombramos en UI como "Alias") |
| `google_place_id` | `codigo_google` | Reutilizar |
| `formatted_address` | `direccion_completa` | Reutilizar |
| `is_active`, `tipos[]` | Ya existen | OK |

Si prefieres que se creen las columnas nuevas tal cual (`lat`, `lng`, `alias`, `google_place_id`, `formatted_address`) duplicadas, dímelo y las agrego, pero recomiendo no hacerlo.

## 1. Migración (un solo archivo)

- `ALTER TABLE documentos ADD COLUMN IF NOT EXISTS direccion_envio_id uuid REFERENCES direcciones_empresa(id) ON DELETE SET NULL`
- `CREATE INDEX IF NOT EXISTS idx_documentos_direccion_envio_id ON documentos(direccion_envio_id)`
- Sin backfill automático (queda NULL; el UI obliga a asignarla)
- Sin CHECK constraint; la regla "pedido en pool sólo si `direccion_envio_id IS NOT NULL`" se aplica en código

## 2. Direcciones en la empresa

Refactor de `CompanyAddressDialog` + integración en `CompanyFormDialog` y vista de detalle:

- Sección **"Direcciones"** con tabla de direcciones activas (alias, `direccion_completa`, chips de `tipos[]`, mini-pin estático)
- Botón **Agregar** abre formulario con:
  - **Google Places Autocomplete** (Places API New vía gateway, igual que el resto del proyecto) → llena `direccion_completa`, `coordenadas_lat/lng`, `codigo_google`, `ciudad`, `estado`, `codigo_postal`, `pais`
  - Campos manuales de lat/lng → al cambiar dispara **reverse geocoding** vía gateway → llena `direccion_completa`
  - Multi-select de `tipos` desde `tipos_direccion`
  - Campo Alias (= `nombre`)
- Editar inline; **borrado lógico** (`is_active = false`)
- Botón **"Reasignar a otra empresa"** abre modal de búsqueda de empresas (reusa `SearchableSelect` ya disponible) y hace `UPDATE direcciones_empresa SET empresa_id = ? WHERE id = ?`
- Vista previa: mini-mapa estático (Google Static Maps vía gateway) por cada dirección

## 3. Pedido: dirección de envío obligatoria

En `DocumentForm.tsx` (cuando `tipo_documento = pedido`) y en el detalle:

- Nuevo `<Select>` **"Dirección de envío"** que consulta `direcciones_empresa` con `company_id = empresa_id AND is_active = true AND 'envio' = ANY(tipos)`
- Si no hay ninguna: botón **"Agregar dirección de entrega"** abre el formulario de direcciones inline, refresca y auto-selecciona
- Al guardar: persiste `direccion_envio_id` **y copia** `direccion_completa` → `direccion_envio` (fallback texto)
- **Bloqueos** (en el cliente + verificación al programar):
  - No permitir cambio a `estatus_pedido = 'programado_entrega'` si `direccion_envio_id IS NULL`
  - En `DeliverySchedule.tsx` el pool de pedidos filtra `direccion_envio_id IS NOT NULL`
  - Banner rojo en el pedido: *"Este pedido no puede programarse sin una dirección de envío asignada."*

## 4. Chofer: actualizar ubicación al entregar

En `EntregaDetalle.tsx`, al pulsar **Registrar entrega**:

- Abrir dialog con mapa Google (ya usado en `DeliveryMapView`) centrado en `direccion_envio_lat/lng` (o en la dir. seleccionada)
- Pin **draggable**; botón **"Usar mi ubicación actual"** (`navigator.geolocation`)
- Al confirmar:
  - `UPDATE documentos SET direccion_envio_lat = ?, direccion_envio_lng = ?, fecha_entrega_real = now(), ...`
  - `INSERT INTO documento_direccion_bitacora (..., origen = 'gps_chofer', usuario_id = auth.uid())`

## 5. Directorio → Direcciones (mapa)

Reescribir `src/pages/directory/DeliveryAddresses.tsx`:

- Mapa Google a pantalla completa con un pin por dirección que tenga `coordenadas_lat/lng`
- Color de pin:
  - **Azul** si la empresa tiene al menos una `factura` activa (no cancelada)
  - **Rojo** en caso contrario (prospecto)
- Sidebar **colapsable** (mismo estilo que filtros de Rutas) con:
  - Checkboxes de `tipos` desde `tipos_direccion`
  - Select de `plazas`
  - Toggle cliente/prospecto
  - Búsqueda por nombre de empresa o dirección
- Popup en pin: nombre empresa, dirección, chips de tipos, link a `/directorio/empresa/:id`

## 6. Intacto

- `documento_direccion_bitacora` (sólo se le inserta)
- `entregas_programadas`
- Generación de PDFs (siguen leyendo `direccion_envio` texto)
- Catálogo `tipos_direccion`

---

## Detalles técnicos

**Archivos a tocar (≈10):**

- `supabase/migrations/<timestamp>_direccion_envio_fk.sql` (nuevo)
- `src/components/directory/CompanyAddressDialog.tsx` (rework completo)
- `src/components/CompanyFormDialog.tsx` (incluir sección direcciones)
- `src/pages/documents/DocumentForm.tsx` (selector + validación)
- `src/pages/documents/DeliverySchedule.tsx` (filtro pool por `direccion_envio_id`)
- `src/pages/documents/EntregaDetalle.tsx` (dialog draggable pin + bitácora)
- `src/pages/directory/DeliveryAddresses.tsx` (mapa + filtros)
- `src/hooks/useDireccionesEmpresa.ts` (nuevo: CRUD + reasignar)
- `src/lib/googleMapsGeocoding.ts` (extender con reverse geocode si falta)
- `src/components/directory/ReassignDireccionDialog.tsx` (nuevo)

**Stack para mapas:** Google Maps JS API + Places API (New) + gateway (ya configurado en el proyecto, ver `useGoogleMaps.ts` y `DeliveryMapView.tsx`). No introduzco Leaflet.

**Compatibilidad PDF:** seguimos escribiendo `direccion_envio` (texto) cada vez que se asigna una `direccion_envio_id`, así nada se rompe.

**Riesgos:**
- Pedidos existentes en `programado_entrega` sin `direccion_envio_id` quedarían fuera del pool. ¿Quieres un fallback que use la dirección de empresa principal automáticamente, o que aparezcan marcados como "requiere asignar dirección" en una sección separada? Por defecto los oculto y muestro alerta en el detalle.

---

## ¿Confirmas?

1. ¿Reutilizo columnas existentes (`coordenadas_lat/lng`, `nombre`, `codigo_google`, `direccion_completa`) o agrego las nuevas duplicadas tal cual pediste?
2. Pedidos antiguos en `programado_entrega` sin dirección: **ocultar del pool** (default) o **mostrarlos en sección "Requieren dirección"**.
