# Asesor B2B de Lubricantes Chevron (WhatsApp — número Mexicali)

Convertir el bot del número **Mexicali (686 606 1858)** en un asesor comercial y técnico con IA. El menú de zonas de ese número se retira; el municipio se pregunta al final, cuando se prepara la entrega al asesor. Los números Tijuana y Galsa siguen exactamente igual.

## 1. Base de conocimiento (Spanish Digest)

- Ya está en la biblioteca el archivo **Spanish Digest.pdf** (17 MB). Se procesa una sola vez y queda indexado por fragmentos con búsqueda semántica.
- Nueva tabla de conocimiento con: fuente (digest / TDS / SDS / catálogo / interno), título, texto del fragmento, página y vector de búsqueda.
- Función de administración "reindexar documento": permite volver a procesar el digest o agregar después SDS, TDS y catálogos indicando el tipo de documento. La arquitectura queda lista para las fuentes 3–8.
- Prioridad de fuentes al responder: catálogo comercial > documentos internos validados > digest > internet.

## 2. Catálogo comercial

- El bot solo puede ofrecer productos activos del catálogo de la empresa (marca, línea, viscosidad, aplicación, uso, presentación).
- Búsqueda tolerante a como escribe el cliente ("delo 400", "delo400 xle", "15w40").
- Si un producto aparece en el digest o en internet pero **no** está en el catálogo, no se ofrece: se responde que un asesor puede revisar la alternativa.
- Nunca se exponen precios, costos ni existencias, aunque estén en la base.

## 3. Búsqueda técnica en internet

- Para preguntas de aplicación (ej. "¿qué aceite lleva una Silverado 2018?") el bot busca en internet priorizando chevron.com y documentación oficial del fabricante.
- La respuesta se presenta como basada en la información técnica consultada, nunca como certeza absoluta, y siempre se aterriza a un producto del catálogo.
- Requiere activar el conector de búsqueda web (Firecrawl). Si no está activo, el bot lo reconoce y deriva al asesor en lugar de inventar.

## 4. Comportamiento conversacional

El asesor recibe todo el hilo de la conversación y responde con reglas estrictas:

- Detecta intención: producto específico, cotización, aplicación, asesoría, flotilla, precio/disponibilidad.
- No pregunta por vehículo si el cliente ya nombró el producto.
- Nunca pide teléfono; usa el número de WhatsApp y los datos ya existentes del contacto/empresa en el CRM.
- No vuelve a preguntar nada que ya se haya dicho en la conversación.
- Máximo dos recomendaciones, con una razón breve.
- Nunca precios, existencias, promesas de tiempo, ni cotizaciones.
- Municipio solo al final, para preparar la entrega al asesor.
- Mensajes cortos, tono de asesor humano de Lumaggs, distribuidor autorizado Chevron en Mexicali.
- Si no tiene certeza técnica, lo dice y lo pasa a validación del asesor.

## 5. Extracción del lead y resumen

- En cada turno se actualiza una ficha estructurada: cliente, empresa, tipo, municipio, intención, cotización solicitada, productos solicitados (varios), vehículos (varios, sin perder contexto), contexto de negocio (flotilla, tamaño, industria), recomendaciones, resumen y notas comerciales.
- Campos `zone` y `assigned_salesperson` quedan creados pero vacíos: la asignación automática es de la siguiente fase.
- Cuando la ficha alcanza lo mínimo (necesidad + producto o aplicación + municipio), el bot cierra con el mensaje de transferencia y:
  - crea o actualiza un **prospecto** en el módulo de Prospectos con los datos capturados;
  - guarda el **resumen estructurado para el vendedor**, visible en la conversación del Inbox de WhatsApp.
- No se envía notificación al vendedor todavía.

## 6. Controles en la app

- En Configuración de WhatsApp: interruptor de asesor IA por número (solo Mexicali encendido) y pausa automática cuando un humano responde en la conversación, para que el bot no interrumpa al asesor.
- Pantalla para reindexar/agregar documentos de conocimiento y ver cuántos fragmentos hay por fuente.

## Detalles técnicos

- Nueva tabla `bot_knowledge_chunks` con `pgvector` + índice, y `bot_lead_profiles` (ficha por conversación). RLS + GRANTs.
- Nueva Edge Function `bot-knowledge-index`: descarga el PDF del bucket `biblioteca`, extrae texto por página, fragmenta y genera embeddings con Lovable AI.
- Nueva Edge Function `whatsapp-ai-advisor`: arma el contexto (contacto/empresa del CRM + ficha actual) y usa herramientas `buscar_catalogo`, `buscar_conocimiento`, `buscar_internet` y `guardar_ficha_lead`. Modelo `google/gemini-3.6-flash`.
- `whatsapp-webhook`: se elimina el routing por zona del id `1128863556971458` y se invoca el asesor IA cuando el número tiene el asesor activo; se conservan opt-out, horario fuera de servicio y las reglas por palabra clave con menor prioridad.
- El envío y registro de mensajes sigue usando la infraestructura actual de `whatsapp-send-message`.

## Pruebas

Se validan los casos A–J del brief (producto específico, cotización, Silverado 2018, asesoría, flotilla mixta, precio, existencia, recomendación Chevron, segundo vehículo, cambio de aceite de flotilla), verificando que cada uno siga un camino distinto y que no aparezcan precios, inventario ni preguntas repetidas.