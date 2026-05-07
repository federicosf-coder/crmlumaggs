## Sí es posible y es un cambio sencillo

Actualmente el cálculo suma 30 días naturales a la fecha del documento (6 abril + 30 = 6 mayo). Para que el día del documento cuente como día 1 del crédito (6 abril → vence 5 mayo), basta con sumar **29 días** en lugar de 30 (regla general: `días_credito - 1`).

## Lugares a cambiar

1. **`src/pages/documents/DocumentForm.tsx`**
   - Auto-cálculo al crear factura por `tipo_pago` (línea ~306): cambiar `30` → `29`.
   - Auto-cálculo del vencimiento por defecto (línea ~280): cambiar `7` → `6` para mantener la misma regla (o dejarlo si solo aplica a facturas con crédito).

2. **`src/components/cobranza/FacturasListEmbedded.tsx`**
   - Función `fechaVencimientoEfectiva` (línea ~95): cambiar `setDate(d.getDate() + 30)` → `+ 29`.

3. **Contado**: se queda igual (mismo día = fecha_documento).

## Datos existentes

Las facturas ya guardadas en la base tienen `fecha_vencimiento` calculada con la regla anterior (+30). Tengo dos opciones:

- **A) Solo aplicar la nueva regla a facturas nuevas** y dejar las históricas como están.
- **B) Recalcular las facturas existentes** con tipo_pago crédito / crédito_cescemex mediante una migración que reste 1 día a `fecha_vencimiento` cuando coincida con `fecha_documento + 30`.

Antes de implementar necesito confirmar:

1. ¿La regla "el día del documento cuenta como día 1" aplica también al vencimiento por defecto de cotizaciones/pedidos (los 7 días), o solo a facturas a crédito?
2. ¿Recalculamos las facturas históricas (opción B) o solo aplicamos a nuevas (opción A)?
