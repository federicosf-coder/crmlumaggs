## Diagnóstico preliminar confirmado

La tabla `whatsapp_routing_sessions` tiene un índice único sobre `(wa_phone, business_phone_number_id)`, pero el webhook consulta “la última sesión” y, cuando encuentra una sesión `finalizado`, intenta insertar otra fila. En los datos recientes, la sesión existente permanece `finalizado`; no aparece una nueva sesión `esperando_zona`. Además, el código actual no revisa el error de ese `insert` y envía la bienvenida de todos modos. Esto es consistente con que la respuesta `1` vuelva a recibir la bienvenida.

No se corregirá esta lógica todavía; primero se instrumentará y se comprobará en ejecución.

## Plan de diagnóstico

1. **Agregar un bloque DEBUG correlacionado por mensaje** en `whatsapp-webhook` con el `wa_message_id` como identificador, registrando:
   - mensaje entrante;
   - `fromPhone`, `businessPhoneId`, `contact_id` y `conversation_id`;
   - criterio exacto de búsqueda de contacto, conversación y sesión;
   - cantidad de conversaciones encontradas y datos de la conversación seleccionada;
   - cantidad de sesiones encontradas, última sesión, `estado` real y `mensaje_original`;
   - rama tomada: `[NUEVA CONVERSACIÓN]` o `[ESPERANDO_ZONA]`.

2. **Instrumentar cada operación de persistencia sin cambiar decisiones**:
   - resultado y error de consulta/creación/actualización de `whatsapp_conversations`;
   - confirmación mediante lectura posterior de que la conversación existe antes de responder;
   - resultado y error del `insert` en `whatsapp_routing_sessions`, incluyendo violaciones del índice único;
   - lectura posterior para mostrar el estado realmente persistido antes de enviar la bienvenida;
   - resultado del envío y registro del mensaje automático.

3. **Desplegar únicamente la instrumentación** y reproducir la secuencia controlada `mensaje inicial → bienvenida → “1”` en la línea Mexicali.

4. **Revisar logs y base de datos** para entregar un diagnóstico concluyente que responda los 10 puntos solicitados, identificando la operación exacta donde el estado deja de recuperarse o persistirse. No se modificará el flujo, restricciones ni estados en esta etapa.