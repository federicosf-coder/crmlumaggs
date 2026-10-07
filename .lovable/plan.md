# Métrica de conversión Prospecto → Cliente (auditoría + implementación)

## 1. Hallazgos de la auditoría (datos reales de hoy)

```text
Prospecto (leads) ──contact_id──> Contacto (contacts) ──company_id──> Empresa (companies)
                  ──company_id──────────────────────────────────────> Empresa
                  ──source_id───> Fuente (lead_sources)
Conversación WhatsApp ──contact_id──> Contacto          (no crea prospecto)
Documento (cotización/pedido/factura) ──empresa_id──> Empresa
                                      ──contacto_id──> Contacto (opcional)
Factura ──cotizacion_original_id──> Cotización ;  ──pedido_relacionado_id──> Pedido
```

| Relación | Estado real |
|---|---|
| Contacto → Empresa | 1,120 de 1,567 contactos (71%) tienen empresa |
| Prospecto → Contacto | **2 de 685** prospectos |
| Prospecto → Empresa | **1 de 685** prospectos |
| Prospecto → Fuente | **681 de 685 sin fuente** registrada |
| WhatsApp → Contacto | 24 de 164 conversaciones; 16 llegan a empresa |
| WhatsApp → Prospecto | No existe: una conversación no genera registro de prospecto |
| Factura → Empresa | Siempre (es la relación confiable) |
| Factura → Contacto | 969 de 2,108 (46%) |
| Factura → Cotización origen | 627 de 2,108 (30%) |

**Respuesta directa:** hoy el sistema solo puede saber que alguien compró **a nivel empresa** (Prospecto → Empresa → Compra), y aun así casi ningún prospecto está ligado a una empresa ni tiene fuente. La trazabilidad Prospecto → Cotización → Venta no es confiable. Con los datos actuales la métrica por fuente daría casi cero, no porque no haya ventas sino porque falta el vínculo.

## 2. Cambios mínimos para una atribución correcta

1. **Fuente siempre registrada:** cada prospecto debe guardar su canal (WhatsApp, Facebook, Web, Formulario, Campaña, Carga manual, Otro). Agregar canal a los prospectos y rellenar los existentes según su origen conocido; los que no se puedan deducir quedan «Otro / desconocido».
2. **WhatsApp usa el mismo modelo:** cuando entra un número nuevo por WhatsApp (dentro de cobertura), se crea/vincula un prospecto con canal WhatsApp ligado a la conversación y al contacto, igual que Facebook o Web.
3. **Vinculación obligatoria al convertir:** al ligar un prospecto a un contacto/empresa (o crear la cotización desde él), se guarda el vínculo prospecto ↔ empresa. Herramienta para vincular manualmente los prospectos ya existentes (ya existe «Vincular prospecto», se reutiliza).
4. **Atribución opcional a nivel venta:** campo opcional «prospecto de origen» en cotizaciones creadas desde un prospecto; la factura lo hereda vía su cotización origen. Permite medir después Prospecto → Cotización → Venta cuando exista; si no, cae a nivel empresa (indicado como tal).

## 3. Mecanismo central «Prospecto / Cliente» (una sola fuente de verdad)

- Una vista en base de datos que calcula por empresa: es cliente si tiene al menos una factura no cancelada; fecha de primera y última compra, número de facturas y monto total. Se deriva siempre de las facturas existentes, sin copiar datos.
- Una consulta derivada por prospecto/contacto que lee esa vista a través de su empresa.

## 4. Lo que verá el usuario

- **Bandeja de Prospectos y Directorio de contactos:** etiqueta «Cliente» (verde) o «Prospecto», con primera/última compra, número de compras y monto total al pasar el cursor o abrir el detalle. Si no hay empresa ligada se muestra «Prospecto · sin empresa vinculada» para que se note la falta de vínculo.
- **Bandeja de WhatsApp:** la misma etiqueta, leída del mismo mecanismo (sin lógica propia).
- Sin dashboard por ahora; la estructura queda lista para el futuro reporte Fuente | Prospectos | Clientes | Conversión | Facturación con datos reales.

## Detalles técnicos
- Migración: columna `canal` (texto con valor por defecto 'otro') en `leads`; `lead_id` nullable en `whatsapp_conversations` y `origen_lead_id` nullable en `documentos`; vista `v_empresa_conversion` (security invoker, respeta permisos) sobre `documentos` tipo factura con estatus distinto de cancelada; RPC `get_conversion_por_contactos(ids)` / `por_empresas(ids)`.
- Backfill de `canal` según `lead_sources` y `origen_lead` del contacto.
- `whatsapp-webhook`: crear/vincular lead canal whatsapp al primer mensaje entrante en cobertura (respetando la regla de cobertura existente).
- Hook compartido `useConversionStatus` + componente `ConversionBadge` usado en LeadsInbox, Directorio y WhatsAppInbox.
- Typecheck `bunx tsgo --noEmit -p tsconfig.app.json`.
