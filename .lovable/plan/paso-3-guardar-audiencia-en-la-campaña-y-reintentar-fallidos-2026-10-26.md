# Paso 3: Guardar audiencia en la campaña y reintentar fallidos desde el reporte

## Qué cambia
1. **Auditoría de audiencia:** cada campaña nueva guarda qué audiencia se usó, una copia de sus reglas en ese momento (plaza, giros, bloqueados) y si se aplicó la exclusión de 48 horas. Si después se edita o borra la audiencia, la campaña conserva lo que realmente se usó.
2. **Lista de campañas y reporte:** se muestra «Audiencia: Nombre» (o «Todos los contactos» / «Preselección») para cada campaña.
3. **Botón «Reintentar envíos fallidos» en el reporte**, con el número de fallidos. Solo vuelve a poner en cola a los que fallaron y vuelve a enviar la misma plantilla; los enviados con éxito no se tocan. Pide confirmación, se desactiva si no hay fallidos y recarga el reporte al terminar.
4. **Contadores correctos:** hoy, al reintentar, el total de fallidos se pone en 0 aunque vuelvan a fallar algunos. Se corrige: fallidos se reduce solo por los que se reintentan, y el envío vuelve a sumar los que fallen de nuevo. Se usa la misma lógica en el botón de la lista que ya existía.

## Detalles técnicos
- Migración: `whatsapp_campaigns` agrega `audience_id uuid NULL REFERENCES whatsapp_audiences(id) ON DELETE SET NULL`, `audience_name text`, `audience_filters jsonb`, `exclude_recent boolean`. Columnas opcionales, no rompe nada.
- `WhatsAppCampaigns.tsx`: incluir esos campos en el insert de `createCampaign`; `retryFailed` decrementa `failed_count` en `count` (mínimo 0) en lugar de ponerlo en 0, y se reutiliza desde el reporte (`reportCampaign`), recargando `openReport`.
- Función pura `retryCounters(failed_count, retried)` en `src/lib/whatsappAudience.ts` con prueba.
- Regenerar tipos, `bunx tsgo --noEmit -p tsconfig.app.json` y vitest.
