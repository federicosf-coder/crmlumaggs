# WhatsApp: asignación de conversaciones + permisos de Bandeja de Prospectos

## Qué está pasando con Ricardo

Revisé la base: **las 138 conversaciones de WhatsApp no tienen responsable asignado**, incluida la del número +52 1 686 229 7899. La bandeja muestra a cada persona solo las conversaciones asignadas a ella o a su equipo, así que Ricardo (Gerente, acceso "Equipo") ve la bandeja vacía. No es un problema de permisos mal configurados: es que nunca se asigna un responsable a las conversaciones.

Como pediste que las conversaciones sin responsable sigan siendo visibles solo para administradores, la solución es dar una forma clara de asignarlas.

## Lo que voy a hacer

### 1. Asignar responsable en la bandeja de WhatsApp

- En el encabezado de cada conversación abierta, un selector "Responsable" con la lista de usuarios activos (buscable). Admin y Gerente pueden cambiarlo; los demás solo lo ven.
- En la lista de conversaciones, el nombre del responsable (o "Sin asignar") bajo el nombre del contacto.
- Filtro rápido "Sin asignar" en la lista, visible solo para administradores (que son quienes ven esas conversaciones).
- Al asignar la conversación al vendedor correspondiente, este y su gerente la ven de inmediato.

Regla de visibilidad que queda explícita: sin responsable = solo administradores; con responsable = el responsable, su equipo (según el permiso del rol) y administradores.

### 2. Nuevo módulo de permisos "Bandeja de Prospectos"

- Se agrega el módulo `prospectos` al catálogo de permisos.
- Accesos iniciales iguales a los actuales: Administrador y Gerente "Todos", Ventas "Propio", Servicio al Cliente "Equipo", el resto "Ninguno".
- Aparece como fila nueva en la matriz de Permisos por Módulo, con las mismas opciones (Todos / Equipo / Propio / Ninguno).
- La pantalla de Bandeja de Prospectos y su entrada en el menú lateral pasan a respetar ese permiso: sin acceso no se muestra el menú y la pantalla indica que no tiene permiso; con "Propio" o "Equipo" solo se listan los prospectos propios o del equipo.

## Detalle técnico

- `src/pages/whatsapp/WhatsAppInbox.tsx`: selector de responsable (update de `whatsapp_conversations.assigned_to`), columna de responsable en la lista, filtro "Sin asignar" solo si `accessLevel === "todos"`. El filtro actual de `accessLevel` se mantiene tal cual (los `null` siguen ocultos para no-admin).
- Migración: `ALTER TYPE public.app_module ADD VALUE 'prospectos'` y, en un paso posterior, inserción de las filas en `role_module_permissions` con los niveles indicados.
- `src/hooks/useModuleAccess.ts`: agregar `"prospectos"` al tipo `AppModule`.
- `src/pages/admin/PermissionsManagement.tsx`: agregar el módulo a `ALL_MODULES` y su etiqueta "Bandeja de Prospectos".
- `src/pages/leads/LeadsInbox.tsx`: usar `useModuleAccess("prospectos")` y filtrar por `created_by`/`asignado_a` según el nivel; `src/components/AppSidebar.tsx`: mostrar el ítem según el permiso en vez de la lista fija de roles.
- No se toca `recompute_seguimiento_ventas`, ni el webhook de WhatsApp, ni la lógica de cobranza.

## Verificación

- Asignar la conversación +52 1 686 229 7899 a Ricardo y confirmar que aparece en su bandeja.
- Revisar la matriz de permisos con la fila nueva y comprobar que cambiar el nivel afecta la Bandeja de Prospectos.
