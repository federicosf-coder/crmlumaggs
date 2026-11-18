# Bot de Galsa sin respuesta

## Causa encontrada
Probé al bot de Galsa en modo simulado con un mensaje real de hoy. La inteligencia artificial respondió **"sin créditos"**. Los mensajes sí llegan al portal y el bot sí los recibe, pero no puede pensar la respuesta, así que se queda callado. El último mensaje que contestó solo fue el 12 de noviembre. Lo mismo le pasa al bot de **Mexicali**, que usa la misma IA.

## Paso 1 (lo haces tú o Federico)
Recargar créditos de IA en el espacio de trabajo de Lovable: **Configuración → Plan y créditos**. Con eso el bot vuelve a contestar solo, sin cambios en el portal.

## Paso 2 (lo hago yo al aprobar)
- **Aviso cuando falten créditos:** si la IA vuelve a quedarse sin créditos, el bot manda al cliente un mensaje corto ("Gracias por escribir a Proveedora Galsa, en breve un asesor te atiende") y la conversación queda marcada como pendiente para un asesor. Así nadie se queda sin respuesta.
- **Clientes que esperan:** cuando haya créditos, reviso las 4 conversaciones de Galsa sin contestar (desde el 15 de noviembre) y dejo que el bot les responda, o te las paso para que las atienda un asesor.

## Detalles técnicos
- `whatsapp-ai-advisor` devuelve 402 `payment_required` del gateway de IA; el webhook lo registra y no hay respaldo.
- Respaldo: ante 402/429 enviar texto fijo por número (Galsa/Mexicali) una sola vez por conversación y marcar `conversation_stage = human_active`.
- Mexicali, Tijuana y Marketing no cambian en nada más.
