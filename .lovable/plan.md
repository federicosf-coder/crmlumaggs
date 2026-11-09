# Cambiar el número de Marketing de WhatsApp

## Situación actual
El número "Marketing" está registrado como +52 1 686 228 4337 (cuenta de mensajes 638737319188899, número 703809879478757). Tiene 1 conversación con 59 mensajes.

## Qué se hará
1. **Borrar la información del número anterior:** su conversación y sus 59 mensajes.
2. **Poner el número nuevo bajo el nombre "Marketing":** cuenta de mensajes 1127465449904495, número 1476909262169059. Se conservan el nombre, el color y el estado activo. El asesor de IA sigue apagado, como estaba.
3. **Registrar el número nuevo y descargar sus plantillas** con las funciones que ya existen. Así se confirma que la conexión funciona y se ve el teléfono real del número.
4. **Revisar** que Marketing aparezca con el número nuevo en la bandeja y en Campañas. Mexicali, Tijuana y Galsa no se tocan.

## Lo que se necesita de ti
- La llave de acceso actual de WhatsApp debe tener permiso sobre la nueva cuenta de mensajes. Si no lo tiene, la conexión fallará en el paso 3 y habrá que darle ese permiso en Meta.
- En Meta, el aviso de mensajes (webhook) de la nueva cuenta debe apuntar al portal. Si no, los mensajes que lleguen no se verán en el portal.

## Detalles técnicos
- Se hace un UPDATE del registro `whatsapp_accounts` 098e56ab-… (label Marketing): `waba_id`, `business_phone_number_id`, y `display_phone` toma el valor que devuelva Meta. Se conserva el mismo id para que las campañas y referencias sigan funcionando.
- Se hace un DELETE en `whatsapp_messages` y `whatsapp_conversations` filtrando por ese `whatsapp_account_id`, y también de las plantillas que pertenecen al waba 638737319188899.
- No cambia el código del portal.
