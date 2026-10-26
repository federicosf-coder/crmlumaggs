# Paso 2: Conectar Audiencias con Campañas

## Qué cambia en «Nueva campaña»
1. **Selector «Seleccionar audiencia»** en lugar de los filtros sueltos de Plaza y Giro. Lista las audiencias guardadas (nombre y número de contactos). Opción «Todos los contactos (sin audiencia)» para no romper el uso actual.
2. Al elegir una audiencia, la campaña toma sus reglas (plaza, giros, excluir bloqueados) y se muestra debajo un resumen de solo lectura: «Plaza: Tijuana · Giros: Industrial, Transporte». Enlace «Administrar audiencias» a la pantalla de Audiencias.
3. **Casilla de 48 horas** se conserva (marcada por defecto). Al marcar/desmarcar se recalcula en vivo el contador «N contactos coinciden» y la tabla de destinatarios.
4. **Tabla de destinatarios al pie**: se filtra según la audiencia y las exclusiones; al cambiar audiencia o la casilla se limpia la selección para no enviar a quien ya no aplica. Se muestra el desglose: coinciden con la audiencia / excluidos por 48 h / excluidos por bloqueo / destinatarios finales.
5. La preselección que llega desde Seguimiento → Productos sigue funcionando igual.

## Reglas (iguales a Audiencias)
- Plaza del contacto, o la de su empresa si no tiene.
- Varios giros: basta con uno.
- Solo contactos con WhatsApp o celular; bloqueados se excluyen si la audiencia lo indica (por seguridad, siempre se excluyen los bloqueados activos al enviar, como hoy).

## Detalles técnicos
- `src/lib/whatsappAudience.ts`: nueva función pura `filterContactsByAudience(contacts, filters, { recentIds, blockedPhones, excludeRecent })` que devuelve elegibles y el desglose; la usan Campañas (reemplaza el `useMemo eligible`) para que coincida con `count_audience_contacts`.
- `WhatsAppCampaigns.tsx`: cargar `whatsapp_audiences`; estado `audienceId`; quitar `plazaFilter`/`giroFilter` del UI; guardar `audience_id`/filtros en la campaña solo si la columna ya existe (si no, no se toca la BD en este paso).
- Pruebas nuevas en `whatsappAudience.test.ts`: plaza heredada de empresa, giro OR, exclusión 48 h on/off, bloqueados.
- Correr `bunx tsgo --noEmit -p tsconfig.app.json` y vitest.
