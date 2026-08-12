# Asesor B2B de Lubricantes Chevron (WhatsApp — número Mexicali)

Convertir el bot del número **Mexicali (686 606 1858)** en un asesor comercial y técnico con IA que representa a **Lumaggs, distribuidor autorizado Chevron para clientes empresariales de Baja California**. El menú de zonas de ese número se retira. Los números Tijuana y Galsa siguen exactamente igual.

Separación de responsabilidades, sin mezclarlas:

```text
catálogo comercial (CRM) -> qué productos vendemos (única fuente para ofrecer)
base de conocimiento      -> información técnica (digest, TDS, SDS)
búsqueda web              -> investigación de aplicaciones
IA                        -> interpreta, razona y explica; no inventa datos
```

## 1. Base de conocimiento (Spanish Digest)

- Ya está en la biblioteca el archivo **Spanish Digest.pdf** (17 MB). Se procesa una sola vez y queda indexado por fragmentos con búsqueda semántica.
- Nueva tabla de conocimiento con: fuente (digest / TDS / SDS / catálogo / interno), título, texto del fragmento, página y vector de búsqueda.
- Función de administración "reindexar documento": permite volver a procesar el digest o agregar después SDS, TDS y catálogos indicando el tipo de documento. La arquitectura queda lista para las fuentes 3–8.
- La base de conocimiento es solo información **técnica**. No se usa para decidir qué se vende ni sustituye la búsqueda estructurada del catálogo.

## 2. Catálogo comercial (búsqueda estructurada, siempre primero)

- Todo producto se busca **primero** en el catálogo del CRM con filtros estructurados (marca, línea, viscosidad, aplicación, uso, presentación). El RAG nunca reemplaza esta búsqueda.
- Búsqueda tolerante a como escribe el cliente ("delo 400", "delo400 xle", "15w40").
- Si un producto aparece en el digest o en internet pero **no** está en el catálogo, no se ofrece: se responde que un asesor puede revisar la alternativa.
- Nunca se exponen precios, costos ni existencias, aunque estén en la base.
- Como máximo dos recomendaciones: si solo hay una opción compatible, se recomienda una sola; si no hay ninguna, se deriva al asesor.

## 3. Búsqueda técnica en internet

- Para preguntas de aplicación (ej. "¿qué aceite lleva una Silverado 2018?") el bot busca en internet priorizando chevron.com y documentación oficial del fabricante.
- La respuesta se presenta como basada en la información técnica consultada, nunca como certeza absoluta, y se aterriza a un producto del catálogo cuando exista.
- Si la consulta técnica no puede resolverse con certeza con las fuentes disponibles, el bot pide **únicamente el dato faltante** (motor, año, servicio) o transfiere al asesor. Nunca completa la respuesta con una suposición.
- Requiere activar el conector de búsqueda web (Firecrawl). Si no está activo, el bot lo reconoce y deriva al asesor en lugar de inventar.

## 4. Etapas de la conversación

Cada conversación lleva un `conversation_stage` que gobierna qué puede preguntar el bot:

```text
information -> consultation -> product_identified -> quotation_requested
            -> ready_for_salesperson -> transferred -> human_active -> closed
```

- `information` y `consultation`: solo se informa y asesora. **No** se pide municipio ni datos comerciales.
- El municipio se pide solo al pasar a `ready_for_salesperson`, es decir cuando ya hay intención comercial suficiente.
- `human_active` cuando un asesor responde en la conversación: el bot se calla.
- **No se requiere un producto identificado para transferir**: un cliente puede pedir asesoría sin saber qué producto necesita y aun así pasar al asesor.

## 5. Comportamiento conversacional

El asesor recibe todo el hilo de la conversación y responde con reglas estrictas:

- Detecta intención: producto específico, cotización, aplicación, asesoría, flotilla, precio/disponibilidad.
- No pregunta por vehículo si el cliente ya nombró el producto.
- Nunca pide teléfono; usa el número de WhatsApp y los datos ya existentes del contacto/empresa en el CRM.
- No vuelve a preguntar nada que ya se haya dicho en la conversación.
- Como máximo dos recomendaciones (una sola si solo una es compatible), con una razón breve.
- Nunca precios, existencias, promesas de tiempo, ni cotizaciones.
- Municipio solo al preparar la entrega al asesor, nunca en conversaciones puramente informativas.
- Mensajes cortos, tono de asesor humano B2B de Lumaggs, distribuidor autorizado Chevron en Baja California.
- Si no tiene certeza técnica, lo dice y lo pasa a validación del asesor.

## 6. Extracción del lead y resumen

- La ficha estructurada se construye **progresivamente en cada turno** (no se reinterpreta todo el historial al momento de transferir): cliente, empresa, tipo, municipio, `conversation_stage`, intención, cotización solicitada, productos solicitados (varios), vehículos (varios, sin perder contexto), contexto de negocio (flotilla, tamaño, industria), recomendaciones, resumen y notas comerciales.
- Campos `zone` y `assigned_salesperson` quedan creados pero vacíos: la asignación automática es de la siguiente fase.
- Cuando hay intención comercial suficiente (necesidad clara, con o sin producto identificado, + municipio), el bot cierra con el mensaje de transferencia y:
  - crea o actualiza un **prospecto** en el módulo de Prospectos con los datos capturados;
  - guarda el **resumen estructurado para el vendedor**, visible en la conversación del Inbox de WhatsApp.
- Fuera de alcance de esta fase: asignación automática, notificación al vendedor, precios, inventario y otros canales.

## 7. Controles en la app

- En Configuración de WhatsApp: interruptor de asesor IA por número (solo Mexicali encendido) y pausa automática cuando un humano responde en la conversación, para que el bot no interrumpa al asesor.
- Pantalla para reindexar/agregar documentos de conocimiento y ver cuántos fragmentos hay por fuente.

## Detalles técnicos

- Nueva tabla `bot_knowledge_chunks` con `pgvector` + índice, y `bot_lead_profiles` (ficha por conversación, con `conversation_stage` y actualización incremental). RLS + GRANTs.
- Nueva Edge Function `bot-knowledge-index`: descarga el PDF del bucket `biblioteca`, extrae texto por página, fragmenta y genera embeddings con Lovable AI.
- Nueva Edge Function `whatsapp-ai-advisor`: arma el contexto (contacto/empresa del CRM + ficha actual) y usa herramientas separadas `buscar_catalogo` (SQL estructurado sobre `productos`), `buscar_conocimiento` (RAG técnico), `buscar_internet` y `actualizar_ficha_lead`. Modelo `google/gemini-3.6-flash`.
- `whatsapp-webhook`: se elimina el routing por zona del id `1128863556971458` y se invoca el asesor IA cuando el número tiene el asesor activo; se conservan opt-out, horario fuera de servicio y las reglas por palabra clave con menor prioridad.
- El envío y registro de mensajes sigue usando la infraestructura actual de `whatsapp-send-message`.

## Pruebas

Se validan los casos A–J del brief (producto específico, cotización, Silverado 2018, asesoría, flotilla mixta, precio, existencia, recomendación Chevron, segundo vehículo, cambio de aceite de flotilla), verificando que cada uno siga un camino distinto y que no aparezcan precios, inventario ni preguntas repetidas.