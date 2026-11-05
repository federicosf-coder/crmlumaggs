
## Contabilidad: Lista de Costos
- [x] Crear filtros por empresa, búsqueda y marcas múltiples; tabla con edición de costos inicialmente bloqueada.
- [x] Guardar costos y recalcular precios con reglas del catálogo, autorización exclusiva y registro consultable.
- [x] Permitir carga de costos con vista previa, actualización de precios y verificar nueve pruebas; guardado real con producto temporal, recálculo, historial, estabilidad de fecha y conflicto concurrente comprobados; prueba retirada sin modificar productos comerciales.

## Ventas CONTPAQ y Guía de Batalla
- [x] Guardar originales privados idénticos y cargar 1,022 clientes, 79 agentes y 3,673 documentos; reimportación verificada sin duplicados.
- [x] Agregar catálogos y carga de actualizaciones; 32 agentes heredan usuario mediante personas de RVS.
- [x] Conectar Guía de Batalla exclusivamente a CONTPAQ con corte histórico fijo; verificar reporte de Aleida, PDF, originales y rechazo anónimo; ocho pruebas aprobadas.
- [ ] Completar equivalencias de nueve códigos no identificados y usuarios de agentes pendientes; requiere selección de Federico en Catálogos. Los reportes afectados muestran advertencia y no inventan cantidades.

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

## PDF de cotizaciones
- [x] Recuperar el PDF de COT-16933 y confirmar que almacenamiento devuelve 504 al guardar desde la función.
- [x] Añadir comprobación de errores de archivo y vínculo para evitar éxito falso.
- [x] Entregar el PDF en ~10 s aunque el almacenamiento tarde; guardado y vínculo terminan en segundo plano y se confirman aunque el servicio responda 504 (verificado con COT-16935).
- [ ] Lentitud de fondo del almacenamiento (~60 s por archivo, responde 504); depende de reiniciar el backend o del servicio.
- [x] Verificar apertura del PDF recuperado desde el documento real con la sesión de Federico.
