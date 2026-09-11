# Plan: separar prospectos de recuperación de la bandeja de alertas

## Origen del problema (confirmado)
- La función `recompute_lead_sla` escala todo prospecto sin atender: Nuevo → Pendiente (15 min) → **Alerta (1 h)** → Frío (24 h) → Recuperación (72 h).
- Las listas importadas desde "Importar lista" entran como `estatus: "nuevo"` con fecha actual, así que horas después aparecen como "Alerta", indistinguibles de prospectos recientes que sí requieren prioridad.
- Además, el monitor (`lead-sla-monitor`) envía avisos de WhatsApp por cada lead que llega a alerta/frío/recuperación, incluidos los importados.

## Cambios

### 1. Importación directa como "Recuperación"
En `ImportarLeadsDialog.tsx`:
- Agregar un selector "¿Qué tipo de lista es?" con dos opciones:
  - **Prospectos nuevos** (comportamiento actual: entran a la bandeja como "Nuevo").
  - **Lista de recuperación** (contactos viejos a reactivar).
- Al elegir "Lista de recuperación", cada fila se inserta con `estatus: "recuperacion"` y `alerta_enviada_at` ya marcado, de modo que:
  - Van directo a la pestaña "Recuperación", sin pasar por Bandeja ni marcarse como alerta.
  - No disparan avisos de WhatsApp.
  - El semáforo automático no los toca (ya están en recuperación).

### 2. Corrección de los datos ya importados
Actualización única en base de datos: los leads que ya fueron importados desde la fuente de importación masiva y siguen sin atenderse pasan a `estatus = "recuperacion"` (con `alerta_enviada_at` marcado para que no disparen WhatsApp). Los que ya fueron tomados o descartados no se tocan.

### 3. Contador del menú
En `usePendingLeadsCount` (el número que aparece en el menú lateral): excluir `recuperacion` del conteo para que el distintivo refleje solo prospectos recientes que requieren atención (nuevo, pendiente, alerta, frío).

## Resultado
- La pestaña "Bandeja" y sus alertas (Nuevo / Pendiente / Alerta / Frío) mostrarán solo prospectos recientes.
- Los contactos de recuperación vivirán únicamente en la pestaña "Recuperación", sin mezclarse ni generar avisos.

## Detalles técnicos
- Archivos: `src/components/leads/ImportarLeadsDialog.tsx` (selector + payload), `src/hooks/useLeads.ts` (conteo), una migración SQL con el UPDATE único acotado a la fuente de importación (`source_id = 7d615fa2-...`) y `primer_contacto_at IS NULL`.
- No se toca `recompute_lead_sla` ni el monitor de WhatsApp; los prospectos web reales siguen escalando igual.
