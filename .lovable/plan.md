# Unidades Lumaggs de Miguel Zavala: reporte (104) contra Seguimiento (383)

## Lo que ya revisé (octubre, del 1 al 20)
- Facturas Lumaggs vigentes donde Miguel aparece como ejecutivo: 20 facturas, 32 renglones, **104 unidades**. El reporte suma bien con la regla actual (se cuenta el ejecutivo que viene en la factura).
- Todos los productos de esas facturas tienen presentación, así que no se pierden renglones al convertir a unidades.
- Seguimiento de ventas, clientes Lumaggs que tiene asignados en el Directorio: 24 empresas, **69.25 unidades** en el mes.
- Lumaggs + Galsa de sus facturas: 104 + 79 = 183.
- Su plaza completa en Lumaggs suma más de 1,400 unidades.

Ninguna de estas cuentas da 383, así que todavía no sé por qué no cuadra. No voy a cambiar ningún cálculo hasta encontrar la causa.

## Pasos
1. Abrir Seguimiento → Chevron con la cuenta de Miguel. Ver de qué pantalla o columna sale el 383 (acumulado del mes, promedio, histórico, o empresas de su grupo comercial).
2. Comparar empresa por empresa esa lista contra las facturas del reporte. Así se ven las empresas o facturas que están en una lista y no en la otra, por ejemplo facturas que tienen otro ejecutivo, facturas de otra plaza o sumas por grupo.
3. Mostrarte las diferencias y decidir contigo cuál regla es la correcta:
   - A) Mantener el ejecutivo de la factura (la regla que pidió Federico) y corregir lo que esté mal asignado en las facturas.
   - B) Que el reporte use la misma regla que Seguimiento.
4. Aplicar la regla elegida en los dos lugares donde el reporte suma unidades (el periodo y el acumulado del mes), revisar los tipos y comprobarlo con la cuenta de Miguel.

## Detalle técnico
- Reporte: `src/pages/seguimiento/ReporteDiario.tsx`. Filtra `documentos` por `ejecutivo_venta_id` y calcula las unidades con `documento_productos × presentaciones.unidades_equivalentes`.
- Seguimiento: `seguimiento_ventas.acum_mes` se calcula por empresa (`owner_id` / `company_ejecutivos`) y puede sumar el grupo comercial en el detalle.
