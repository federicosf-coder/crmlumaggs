# Conversión Prospecto → Cliente centrada en la Bandeja de Prospectos

## 1. Auditoría (datos reales)

```text
Prospecto (leads) ─contact_id─> Contacto ─company_id─> Empresa <─empresa_id─ Factura
                  ─company_id──────────────────────────> Empresa
                  ─source_id──> Fuente (lead_sources)
Conversación WhatsApp ─contact_id─> Contacto   (hoy NO crea prospecto)
```

| Relación | Estado hoy |
|---|---|
| Prospecto → Contacto | 2 de 685 |
| Prospecto → Empresa | 1 de 685 |
| Prospecto con fuente | 4 de 685 (681 sin fuente) |
| WhatsApp → Contacto → Empresa | 24 de 164 conversaciones con contacto; 16 con empresa |
| Factura → Empresa | 100% (relación confiable) |
| Factura → Contacto | 46% |
| Factura → Cotización origen | 30% |

**Conclusión:** la atribución posible hoy es **Prospecto → Empresa → Compra**, no Prospecto → Cotización → Venta. Los 685 históricos casi no tienen vínculos ni origen, así que la métrica arrancará prácticamente en cero y crecerá con los prospectos nuevos.

## 2. Campos que se usarán

| Concepto | Dónde vive |
|---|---|
| Origen del prospecto | Nuevo campo **canal** en el prospecto: whatsapp, facebook, web, formulario, campaña, carga_manual, otro, desconocido. Obligatorio en nuevos. Históricos = **desconocido** (sin adivinar), salvo los 4 que ya tienen fuente registrada (carga manual / web demo). |
| Prospecto ↔ Contacto | `contact_id` del prospecto (ya existe) |
| Prospecto ↔ Empresa | `company_id` del prospecto; si está vacío, la empresa del contacto ligado |
| Factura válida | Documento tipo factura con estatus vigente, vencida o pagada (se excluye **cancelada**; cotizaciones y pedidos no cuentan) |
| Estado de conversión | Calculado al vuelo (sin copiar datos) comparando la fecha de la primera factura válida de la empresa con la fecha de creación del prospecto |
| Facturación | Suma del total de facturas válidas de la empresa, contada **una sola vez por empresa** |

## 3. Reglas para evitar doble conteo

Conversión y facturación se calculan por separado.

**Estado del prospecto (fecha de corte = fecha de creación del prospecto):**
- **Prospecto:** la empresa no tiene factura válida, o no hay empresa ligada.
- **Cliente convertido:** primera factura válida de la empresa **en o después** de la creación del prospecto.
- **Cliente previo:** la empresa ya tenía factura válida **antes** de la creación del prospecto. No cuenta como conversión ni suma facturación atribuida al canal.
- **Desconocido:** sin fecha de creación confiable; no cuenta como conversión.

Tres preguntas separadas, cada una con su propio dato en pantalla: ¿ya era cliente? (Cliente previo), ¿este prospecto convirtió a la empresa? (Cliente convertido), ¿qué canal generó la venta? (Facturación atribuida / no atribuida).

**Conversión = clientes convertidos / prospectos elegibles** (elegibles = todos menos clientes previos y desconocidos). Cuenta por prospecto, sin importar cuántos otros prospectos tenga esa empresa.

**Facturación atribuida (conservadora, por empresa única):**
- La empresa tiene **un solo prospecto**, con canal conocido → su facturación se atribuye a ese canal.
- La empresa tiene **varios prospectos** de canales distintos, o el canal es **desconocido** → su facturación va a **«Facturación no atribuida»**, aunque sus prospectos sí cuentan como convertidos.
- Al filtrar por un canal, una empresa con varias fuentes aparece en ese canal con atribuida $0 y su monto en no atribuida (ejemplo Empresa X: WhatsApp, Facebook y Web muestran 1 cliente, $0 atribuida, $100,000 no atribuida).
- **Sin filtro:** prospectos y clientes se cuentan uno por uno, pero la facturación total (atribuida + no atribuida) se suma **una vez por empresa**, así la factura de Empresa X cuenta $100,000 una sola vez.
- La pantalla indica «Conversión a nivel empresa» para no afirmar que esa persona compró personalmente.

**Futuro:** cuando exista el vínculo Prospecto → Cotización → Pedido → Factura, la factura ligada se atribuirá directo a su prospecto y fuente. Por ahora no se crea ni se inventa esa relación.

## 4. WhatsApp a partir de ahora

Al primer mensaje de un número dentro de cobertura (respetando la regla geográfica vigente):
1. Busca el contacto por teléfono; si no existe, lo crea (sin duplicar).
2. Toma su empresa si la tiene.
3. Crea o vincula el prospecto con canal **whatsapp** y lo liga a la conversación.
Fuera de cobertura no se crea prospecto. La bandeja de WhatsApp solo muestra la etiqueta Cliente/Prospecto leída del mismo cálculo.

Facebook, la API web y la carga manual graban su canal correspondiente.

## 5. Bandeja de Prospectos

- **Bloque de indicadores arriba:** Prospectos, Clientes convertidos, Clientes previos, Tasa de conversión, Facturación atribuida, Facturación no atribuida. Responden al filtro de origen.
- **Columnas nuevas:** Origen, Estado (Prospecto / Cliente convertido / Cliente previo / Desconocido), Empresa, Primera y última compra, Compras, Facturación. Las de compras se pueden ocultar con un selector de columnas; el detalle completo en el panel lateral del prospecto.
- **Filtros:** Origen (todos los canales + desconocido), Estado (Todos / Prospectos / Clientes convertidos / Clientes previos), Compra (Nunca ha comprado / Ya compró).
- Prospectos sin empresa vinculada muestran «Sin empresa vinculada» como recordatorio para ligarlos (con el botón Vincular que ya existe).

## Detalles técnicos
- Migración: `leads.canal text not null default 'desconocido'` + validación por trigger de valores permitidos; `whatsapp_conversations.lead_id uuid null`; backfill solo de los 4 leads con `source_id` (según `lead_sources`).
- Vista `v_empresa_compras` (security_invoker): por `empresa_id`, count, sum(total), min/max(fecha) de facturas no canceladas.
- RPC `get_leads_conversion(filtros)` STABLE: une lead → empresa efectiva (`coalesce(lead.company_id, contact.company_id)`), estado, cliente previo, y devuelve totales con facturación deduplicada por empresa y canal/ambigua.
- `lead-processing.ts`, `facebook-leads-webhook`, `NuevoLeadDialog`, `ImportarLeadsDialog`: grabar `canal`. `whatsapp-webhook`: alta/vínculo de lead canal whatsapp en cobertura.
- Hook compartido `useConversion` + `ConversionBadge` usados en `LeadsInbox.tsx` y `WhatsAppInbox.tsx`.
- Typecheck `bunx tsgo --noEmit -p tsconfig.app.json`.
