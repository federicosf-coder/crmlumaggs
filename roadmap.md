
## Plantillas WhatsApp
- [x] Separar nombre técnico e idioma antes del envío individual, campañas y respuestas/alertas automáticas; 14 pruebas aprobadas, funciones desplegadas, sin enviar mensajes reales.

## RVS (Reporte de Ventas Sistema)
- [x] Tablas por plaza/zona/sucursal vacías: derivar de rvs_ventas_mes usando la plaza de la pestaña Personal cuando rvs_ventas_mes_plaza no tiene datos
- [x] Mostrar variación absoluta (Δ en unidades/$/pp de margen) además del %, en pantalla y en Excel

## Solicitud de crédito
- [x] Organizar el formulario del cliente en pasos con referencias y cuentas bancarias separadas.
- [x] Verificar guardado con pruebas y presentación con datos de ejemplo sin modificar reglas de crédito.

## Entregas corporativas
- [x] Facilitar registro directo de entregado y entrega parcial, conservando evidencia y ubicación.
- [x] Verificar presentación con datos de ejemplo y ejecutar cinco pruebas de captura y pendientes.
- [ ] Verificar guardado real con sesión del usuario; bloqueado hasta que inicie sesión en la vista previa.

## Reclamos de pedidos
- [x] Agregar resumen del listado filtrado en PDF descargable y adjunto por correo, sin cambiar el aviso oficial ni el estatus de los reclamos; pruebas del PDF y adjunto aprobadas, tres páginas revisadas visualmente y ancho de tabla corregido.
- [ ] Verificar descarga y envío del resumen desde el listado real; requiere sesión del usuario en la vista previa (la recuperación automática de sesión falló).
- [x] Añadir confirmación de facturación por producto y ajustar el formato a una hoja horizontal con evidencias posteriores; 11 pruebas y muestra visual verificadas.
- [x] Empaque desde el catálogo de Presentaciones y Descripción desde el catálogo de Productos (por código, con lo capturado como respaldo); typecheck y 10 pruebas ok.
- [ ] Verificar guardado de la confirmación en un reclamo real; requiere iniciar sesión en la vista previa (no se pudo recuperar la sesión).
- [x] Añadir plaza, ficha centrada, correo editable con adjuntos e hilo cronológico.
- [x] Desplegar envío y recepción de correos sin migraciones ni cambios al alta o recepción de pedidos.
- [ ] Verificar envío y respuesta reales; requiere sesión del usuario y conexión del nuevo receptor en Resend.

## Panel de Cobranza y equipos
- [x] Reemplazar HTML idéntico y conectar lectura, guardado, destinatarios y envío; función desplegada y rechazo de sesión inválida verificado.
- [x] Agregar selección múltiple de gerentes y verificar permisos y pruebas; 26 pruebas aprobadas y HTML de ambas marcas abre sin errores.
- [ ] Verificar lectura, carga y envío con sesión real; recuperación de sesión propia falló, requiere iniciar sesión en la vista previa.
