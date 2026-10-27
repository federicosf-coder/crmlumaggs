# Agregar la línea de WhatsApp «Marketing»

## Qué se hará
1. Registrar la nueva línea **Marketing** junto a Tijuana, Mexicali y Galsa (ID de número 703809879478757, cuenta 638737319188899), activa y con el asesor de IA apagado, como Tijuana.
2. Comprobar con Meta, usando la misma llave que ya usan las otras líneas, que la app puede leer este número: se obtiene el teléfono visible y su calidad, y se guarda el estado «conectado». Si Meta lo rechaza, te aviso con el motivo exacto (sería un permiso pendiente en Meta).
3. Sincronizar las plantillas de esta cuenta para que aparezcan al crear campañas desde Marketing.
4. Suscribir la cuenta a los mensajes entrantes para que las respuestas lleguen a la bandeja, igual que en las otras líneas.
5. Verificar que Marketing aparezca en Bandeja, Campañas, Plantillas y Configuración.

## Lo que debes saber
- Esta línea está en una cuenta de WhatsApp distinta a Tijuana/Mexicali, así que **no comparte sus plantillas**: hay que crear o aprobar plantillas propias en Marketing antes de enviar campañas.
- Elegiré un color para identificarla (lo puedes cambiar después).

## Detalles técnicos
- Insertar en `whatsapp_accounts` (label Marketing, business_phone_number_id, waba_id, status según la verificación).
- Llamada GET `/{phone_id}?fields=display_phone_number,quality_rating,verified_name` y POST `/{waba_id}/subscribed_apps` con el token compartido existente; luego invocar `whatsapp-sync-templates`.
- Sin cambios de esquema ni de código esperados.
