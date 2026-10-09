# Solicitud de Devolución de Productos (módulo Documentos)

## Qué verá el usuario
- En **Documentos**, nueva pestaña/vista **Devoluciones** con lista (Estilo Tabla Refinada): folio DEV-####, cliente, factura relacionada, fecha de venta, fecha de solicitud, motivo, estado y resolución.
- Botón **Nueva devolución** (Estilo Modal Refinado):
  1. Elegir la **factura** (venta) del cliente; se muestran fecha de venta, ejecutivo y productos.
  2. Marcar los productos y cantidades a devolver (no más de lo facturado).
  3. **Motivo** de una lista editable (inicia con: Producto no es el requerido, Producto no es el solicitado, Producto o envase presenta daños).
  4. Fecha de solicitud (hoy por defecto), comentarios.
  5. **Evidencias**: fotos y PDFs (varios archivos, se ven en miniatura).
- Detalle de la devolución con línea de tiempo de estados:
  `Solicitada → En revisión → Autorizada / Rechazada → Resuelta`
- **Resolución**: Nota de crédito, Reembolso o Cambio de producto, con referencia (folio de nota de crédito, monto reembolsado o pedido de reposición) y fecha.
- **Botones del PDF**: Imprimir / Descargar y **Enviar por correo** al contacto del cliente con el PDF en liga para imprimir.
- En la factura original aparece un aviso "Tiene devolución DEV-####" con liga.
- Configuración: catálogo de motivos editable (agregar, renombrar, activar/desactivar, ordenar) por admin/manager.

## PDF imprimible (para llenar a mano)
- Encabezado con logo y colores de la marca (Lumaggs/Galsa según la factura), folio DEV y código de barras/QR al registro.
- Datos precargados: cliente, RFC, factura, fecha de venta, fecha de solicitud, ejecutivo.
- Tabla de productos a devolver (código, descripción, presentación, cant. facturada, cant. a devolver, lote) con renglones vacíos extra para llenar a mano.
- Motivos con **casillas** para marcar a pluma (todos los del catálogo + "Otro: ____").
- Recuadro grande con renglones "Descripción del problema (puño y letra del cliente)".
- Estado del producto: casillas Sellado / Abierto / Dañado; ¿Envase original? Sí/No.
- Resolución solicitada por el cliente: casillas Nota de crédito / Reembolso / Cambio.
- Firmas: Cliente (nombre, firma, fecha), Recibe (Lumaggs), Autoriza.
- Sección "Uso interno": resolución final, folio de NC/reembolso/reposición, fecha.
- Leyenda con política de devolución (texto editable, sugerido abajo).
- El formato firmado se puede escanear y subir como evidencia ("Formato firmado").

## Sugerencias incluidas
- **Plazo máximo** para solicitar (ej. 15 días desde la venta) con aviso si se excede (no bloquea; queda marcado).
- **Lote / fecha de fabricación** del producto, útil para reclamar a Chevron/Phillips.
- **Recolección**: quién recoge, fecha programada y si el producto ya llegó a almacén (Recibido en almacén).
- Notificación por correo al ejecutivo y al responsable de la plaza cuando se crea una devolución.
- Reporte simple: devoluciones por motivo, producto y ejecutivo del mes.

## Pendiente de definir (puedo dejar valores por defecto)
- Texto de política de devolución y plazo en días (propongo 15 días, producto sellado y en envase original salvo daños de origen).
- Quién autoriza: propongo manager/admin.

## Detalles técnicos
- Tablas nuevas: `devolucion_motivos` (catálogo), `devoluciones` (documento_id factura, empresa_id, folio, fechas, motivo_id, estado, resolucion_tipo, resolucion_ref, resolucion_monto, resolucion_fecha, plazo_excedido), `devolucion_lineas` (documento_producto_id, cantidad, lote), `devolucion_archivos` (bucket privado, tipo foto/pdf/formato_firmado). RLS reutilizando `can_view_documento` sobre la factura; GRANTs a authenticated/service_role.
- Folio automático DEV-#### por trigger con secuencia.
- PDF generado en el cliente con el mismo patrón de PDFs del proyecto (colores por marca); correo vía la función de correos existente con liga firmada al PDF.
- No se modifica `saldo_pendiente_cobranza`: la nota de crédito solo se registra como referencia.
