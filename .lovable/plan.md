# Tabla de Accionistas — alineación y expansión por fila

## Contexto

El bloque "Solo Personas Morales" de la plantilla de Solicitud de Crédito (vista previa/impresión) renderiza:

```text
| Nombre accionistas        | No. acciones |
| {{accionistas_html}}                     |
```

Hoy:
- `accionistas_html` se construye en `src/lib/creditoTemplates.ts` con `slice(0, 4)` y rellena con filas vacías hasta llegar a 4. No se expande con los registros reales.
- El segundo `<th>` ("No. acciones") está centrado, mientras el `<td>` correspondiente va alineado a la derecha — por eso el encabezado no "cierra" en el mismo margen derecho que los valores.
- El ancho está definido por `<colgroup>` (70 / 30) sobre `table.grid` con `table-layout: fixed`, pero al renderizar el `th` con `text-align:center` y los `td` con `text-align:right`, visualmente el ancho efectivo del contenido no coincide.

## Cambios

### 1. `src/lib/creditoTemplates.ts`
- Eliminar el límite de 4 accionistas y las filas vacías de relleno.
- Generar **una fila por cada accionista** registrado (sin tope, sin mínimo).
- Reforzar la alineación: `<td>` del nombre alineado a la izquierda, `<td>` de acciones a la derecha; ambos con `width` explícito (70% / 30%) para que coincidan con el `colgroup`.
- Si no hay accionistas, mostrar una sola fila vacía con `colspan=2` (para no romper el layout).

### 2. Nueva migración SQL — actualizar plantilla Lumaggs y Galsa
- Encabezado de la tabla de accionistas:
  - `<th style="width:70%; text-align:left">Nombre accionistas</th>`
  - `<th style="width:30%; text-align:right">No. acciones</th>`
- Mantener `table.grid { width:100%; table-layout:fixed }` y el `<colgroup>` 70/30.
- Aplicar el mismo patrón en la plantilla equivalente de Galsa (si no tiene el bloque de accionistas con encabezado homologado, agregarlo con la misma estructura).

### 3. Verificación
- Abrir el editor/preview de la plantilla `solicitud` para `lumaggs` y `galsa` con: 0, 1, 3 y 7 accionistas.
- Confirmar que:
  - El encabezado "No. acciones" termina alineado al margen derecho de la tabla, igual que los valores numéricos.
  - "Nombre accionistas" inicia en el mismo margen izquierdo que los nombres.
  - La tabla crece dinámicamente fila por fila según los registros relacionados.

## Detalles técnicos

Archivos a tocar:
- `src/lib/creditoTemplates.ts` — función que arma `accionistasHtml`.
- `supabase/migrations/<nueva>_credito_accionistas_layout.sql` — `UPDATE public.credit_doc_templates SET contenido_html = ...` para `key='solicitud'` y `entidad IN ('lumaggs','galsa')`.

No se modifica:
- Lógica de guardado, esquema de DB, ni otras secciones de la plantilla (datos bancarios, referencias, aval).
