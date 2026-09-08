# Diagnóstico: la plataforma va lenta y "no tengo permisos"

## Qué está fallando

El servidor de datos del portal está saturado. No es un problema de tu cuenta ni de la configuración de permisos.

Lo comprobado en este momento:

- Tu usuario (h.riveraa@lumaggs.com.mx) está activo, aprobado y **sí tiene rol de administrador**.
- El servidor responde de forma intermitente: varias consultas simples de prueba tardaron mucho o directamente se cortaron por tiempo de espera. Incluso los paneles internos de estado no cargaron.
- El tamaño del servidor asignado al portal es el más pequeño disponible ("Tiny"), y el portal ya creció mucho (CRM, documentos, cobranza, inventario, WhatsApp, reportes, correos automáticos).

Por qué eso se ve como "no tengo permisos": al abrir cada sección, el portal le pregunta al servidor qué puede ver el usuario. Si esa pregunta se corta por lentitud, el código actual asume lo más restrictivo ("ninguno") y muestra el mensaje de sin permiso. Lo mismo pasa con los vendedores: sus empresas y contactos existen, pero la consulta no alcanza a responder y la lista sale vacía.

## Plan de solución

### 1. Ampliar el servidor (causa raíz)
Subir el tamaño del servidor de datos de "Tiny" a un tamaño acorde al uso real. Esto requiere tu aprobación porque cambia el costo mensual, e implica un reinicio breve (unos minutos de indisponibilidad).

### 2. Que la lentitud nunca se muestre como "sin permiso"
Cambiar la lógica de permisos para distinguir tres casos: sin permiso, cargando y error de conexión. Si la consulta falla, se reintenta y se muestra "No se pudo verificar tus permisos, reintentar" en vez de negar el acceso. Igual para las listas de empresas y contactos: mostrar un error con botón de reintento en vez de una lista vacía.

### 3. Reducir la carga que genera el portal
Revisar las pantallas más pesadas (Directorio, Documentos, Cobranza, Reportes) para: pedir solo las columnas necesarias, paginar en vez de traer todo, y guardar en memoria por unos minutos los datos que casi no cambian (permisos, catálogos, equipos), en vez de volver a pedirlos en cada pantalla.

### 4. Revisar consultas y faltantes de índice
Una vez estable el servidor, revisar el listado de consultas más lentas y agregar los índices que falten en las tablas grandes (documentos, actividades, mensajes).

## Detalle técnico

- Instancia actual: `Tiny`. Plan: `resize_compute` a Small/Medium según métricas tras estabilizar.
- `useModuleAccess`: hoy `queryFn` captura el error y devuelve `"ninguno"`, colapsando "sin permiso" con "falló la consulta". Añadir `status: 'error'` diferenciado, `retry: 2` y `staleTime` alto para `get_user_module_access` y `get_user_team_member_ids`.
- Revisar `select("*")` en listados grandes y sustituir por columnas explícitas + rangos paginados.
- Tras el resize: `slow_queries` + `linter` para detectar políticas RLS sin índice de apoyo.

## Orden sugerido
1. Ampliar servidor y confirmar que la lentitud desaparece.
2. Ajustes de permisos y mensajes de error.
3. Optimización de consultas e índices.
