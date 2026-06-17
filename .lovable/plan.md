## Cambios en el panel derecho de Conversaciones (WhatsApp)

Reemplazo el bloque "Negocios abiertos" por dos nuevas secciones por contacto/empresa:

1. **Productos de interés (a cotizar)** — lista rápida de productos seleccionados en la conversación + botón **+ Cotización**.
2. **Solicitudes del cliente** — historial de "solicitudes" formales (cada una con N productos), con botón **Nueva solicitud**.

---

### 1. Productos de interés + botón "+ Cotización"

Dentro del panel, debajo de la tarjeta de Empresa:

- Selector de productos (SearchableSelect con catálogo `productos`, filtrado por marca de la cuenta WA activa: Lumaggs/Galsa).
- Chips con los productos agregados; cada uno se puede quitar.
- Botón **+ Cotización** (deshabilitado si no hay productos o empresa).

Comportamiento del botón:
- Si `companies.lista_precios` está vacío → abre **modal rápido "Asignar lista de precios"** (UF1–UF4, R1–R4), guarda en la empresa y continúa.
- Crea un borrador en `documentos` (tipo `cotizacion`, status `borrador`) con: empresa_id, contacto_id, ejecutivo_venta_id (tomado de `company_ejecutivos`), empresa_vendedora derivada de la cuenta WA, fecha hoy.
- Inserta líneas en `documento_productos` con cada producto seleccionado (cantidad 1, precio resuelto vía `lista_precios` igual que en `DocumentForm.getDefaultPrice`).
- Navega a `/documents/:id/edit` para que el usuario revise y guarde.
- Limpia la lista local de productos de interés tras crear la cotización.

### 2. Solicitudes del cliente

Las "solicitudes" representan paquetes de productos que el cliente pide a través de las conversaciones. Se acumulan por empresa (cada chat suele desencadenar nuevas).

> Nota técnica: la tabla `solicitudes_producto` que ya existe es de **abastecimiento de almacén** (cantidad_solicitada, justificación, fotos, estatus `solicitado/aprobado/pedido/recibido`). Su semántica no coincide con "el cliente pide cotizar estos productos". Por eso creo dos tablas dedicadas en la migración (ver sección técnica).

UI del bloque:
- Lista compacta de las últimas solicitudes de la empresa: fecha, # productos, estatus (`abierta`, `cotizada`, `cerrada`).
- Cada solicitud expandible → muestra sus productos; botones por solicitud: **+ Cotización** (mismo flujo) y **Cerrar**.
- Botón **+ Nueva solicitud** → abre dialog con título opcional + selector multi-producto (mismo SearchableSelect) → guarda solicitud y sus líneas.

### 3. Limpieza del bloque actual

- Elimino del panel: "Negocios abiertos", lista de deals y botón "Agregar negocio" (queda accesible desde el módulo CRM).

---

## Detalles técnicos

### Migración (nueva)

```sql
-- Cabecera
CREATE TABLE public.cliente_solicitudes (
  id uuid PK,
  empresa_id uuid NOT NULL REFERENCES companies,
  contacto_id uuid REFERENCES contacts,
  whatsapp_conversation_id uuid REFERENCES whatsapp_conversations,
  empresa_vendedora text CHECK IN ('lumaggs','galsa'),
  titulo text,
  estatus text DEFAULT 'abierta' CHECK IN ('abierta','cotizada','cerrada'),
  documento_id uuid REFERENCES documentos,
  created_by uuid REFERENCES auth.users,
  created_at, updated_at
);

-- Líneas
CREATE TABLE public.cliente_solicitud_lineas (
  id uuid PK,
  solicitud_id uuid NOT NULL REFERENCES cliente_solicitudes ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES productos,
  cantidad numeric DEFAULT 1,
  notas text,
  created_at
);
```

GRANTs a `authenticated` + `service_role`, RLS habilitado, políticas: SELECT/INSERT/UPDATE para autenticados; DELETE sólo admin/manager. Trigger `update_updated_at_column` en la cabecera.

### Frontend

- `src/pages/whatsapp/WhatsAppInbox.tsx`: reemplazo del bloque Negocios abiertos por los dos nuevos bloques. Estado local `interestProductIds: string[]`, query `useQuery` para `cliente_solicitudes` por empresa, mutaciones para crear solicitud y crear cotización.
- Nuevo `src/components/whatsapp/AssignListaPreciosDialog.tsx`: modal con Select de lista (UF1–UF4, R1–R4), guarda `companies.lista_precios`.
- Nuevo `src/components/whatsapp/NuevaSolicitudDialog.tsx`: título + selector multi-producto.
- Helper `src/lib/createCotizacionDraft.ts`: crea documento + líneas (resuelve precio replicando `getDefaultPrice`) y devuelve `documento.id`.
- `src/pages/documents/DocumentForm.tsx`: acepta nuevo parámetro `productos_ids` (csv) en query — si está presente y el documento es nuevo, pre-carga las líneas. (No se usará en este flujo porque creamos el borrador directo, pero queda como respaldo opcional.)

### Sin cambios

- DocumentForm general, tabla `documentos`, lógica de precios — sólo se invocan.
- Módulo CRM y deals — sólo se quita del panel WA; siguen disponibles en su módulo.
