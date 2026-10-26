# Paso 1 — Audiencias de WhatsApp

## Qué se construye
1. **Nueva tabla de audiencias** en la base de datos: nombre, descripción, criterios guardados (plaza, giros, excluir números bloqueados, excluir contactados recientemente), fecha de creación y quién la creó.
2. **Conteo dinámico de contactos**: los contactos no se copian a la audiencia; cada vez se calcula cuántos coinciden con la regla, usando la misma lógica que hoy usa Campañas (plaza del contacto o de su empresa, giro con "al menos uno", con teléfono WhatsApp/móvil, excluyendo bloqueados).
3. **Pantalla "Audiencias"** dentro de WhatsApp (menú lateral junto a Campañas, mismos permisos: admin y gerente):
   - Tabla con estilo refinado: Nombre, Descripción, Plaza, Giros, Contactos que coinciden, Fecha.
   - Botón "Nueva audiencia" y editar/eliminar con el estilo de modal refinado (nombre, descripción, plaza, giros).
   - Al crear/editar se muestra en vivo cuántos contactos coinciden.

No se modifica todavía el flujo de envío de campañas (eso sería el Paso 2: elegir una audiencia guardada al crear campaña).

## Detalles técnicos
- Migración: `public.whatsapp_audiences` (id uuid, name text not null, description text, filters_json jsonb default '{}', created_by uuid, created_at, updated_at) + GRANT a authenticated/service_role, RLS con `has_role` admin/manager. Se nombra con prefijo whatsapp_ para no chocar con tablas existentes.
- Función SQL `count_audience_contacts(filters jsonb)` (security invoker) que aplica plaza/giros/bloqueados sobre contacts + companies + contacto_intereses + whatsapp_numeros_bloqueados; usada para el conteo por fila.
- Helper compartido `src/lib/whatsappAudience.ts` con el tipo de filtros para que Campañas lo reutilice en el Paso 2.
- Ruta `/whatsapp/audiencias`, página `src/pages/whatsapp/WhatsAppAudiences.tsx`, entrada en AppSidebar.
- Prueba unitaria del parseo/normalización de filtros; typecheck.
