## Resumen
1. Confirmación al completar tarea desde checkbox (Completar / Completar y Crear Nueva).
2. Reestructurar tipos: `seguimiento` y `cobranza` como **categorías padre**; los demás (`call`, `email`, `meeting`, `field_visit`, `whatsapp`, `note`) como **tipos de acción hija**. Una tarea puede tener `parent_category` + `task_type`.
3. Soportar **secuencias / línea de tiempo**: una tarea padre (seguimiento o cobranza) agrupa varias sub-tareas en orden cronológico.
4. UI: separar visualmente "Seguimiento" y "Cobranza" en una fila superior (selector de categoría) y debajo los tipos de acción.

---

## Cambios de Base de Datos

Migración nueva sobre `crm_tasks`:

```sql
ALTER TABLE public.crm_tasks
  ADD COLUMN parent_task_id uuid REFERENCES public.crm_tasks(id) ON DELETE CASCADE,
  ADD COLUMN parent_category text CHECK (parent_category IN ('seguimiento','cobranza')) NULL,
  ADD COLUMN sequence_order int DEFAULT 0;

CREATE INDEX idx_crm_tasks_parent ON public.crm_tasks(parent_task_id);
CREATE INDEX idx_crm_tasks_category ON public.crm_tasks(parent_category);
```

Reglas:
- Si `parent_category` está definido (seguimiento/cobranza), la tarea es **cabecera de línea de tiempo**.
- Sub-tareas tienen `parent_task_id` apuntando a la cabecera y `task_type` con la acción concreta (call, email, etc.).
- Tareas existentes con `task_type = 'follow_up'` o `'cobranza'` se migran a `parent_category` correspondiente con `task_type = NULL`.

```sql
UPDATE public.crm_tasks SET parent_category = 'seguimiento', task_type = NULL WHERE task_type = 'follow_up';
UPDATE public.crm_tasks SET parent_category = 'cobranza',    task_type = NULL WHERE task_type = 'cobranza';
```

RLS: hereda las políticas existentes de `crm_tasks` (no requiere cambios).

---

## Cambios de Código

### `src/lib/taskTypes.tsx`
- Separar en dos grupos:
  - `PARENT_CATEGORIES`: `seguimiento`, `cobranza` (con su color e icono).
  - `ACTION_TYPES`: `call`, `email`, `meeting`, `field_visit`, `whatsapp`, `note` (sin `follow_up` ni `cobranza`).
- Helpers: `getCategoryMeta(key)`, `getActionMeta(key)`.

### `src/hooks/useCrmTasks.ts`
- Añadir `parent_task_id`, `parent_category`, `sequence_order` al tipo `CrmTask`.
- Nuevo hook `useTaskTimeline(parentId)` que devuelve sub-tareas ordenadas por `sequence_order` / `created_at`.

### `src/components/crm/CrmTaskDetailDialog.tsx`
- **Fila superior nueva**: selector de **Categoría** (Ninguna / Seguimiento / Cobranza) con dos botones grandes coloreados.
- **Fila existente** (tipo de actividad): se mantiene pero solo muestra los 6 tipos de acción.
- Si la tarea tiene `parent_category` (es cabecera): mostrar bloque "Línea de tiempo" con sub-tareas + botón "Agregar paso".
- Si tiene `parent_task_id`: mostrar breadcrumb "Parte de: <título padre>".
- **Confirmación al completar desde checkbox**: AlertDialog con dos botones "Completar" y "Completar y crear nueva". El segundo abre `CreateCrmTaskDialog` precargado con misma empresa/contacto/categoría.

### `src/components/crm/CrmTaskItem.tsx`
- Mismo `AlertDialog` al marcar checkbox.
- Mostrar badge de categoría padre si aplica.

### `src/components/crm/CreateCrmTaskDialog.tsx` y `CreateCrmActivityTaskDialog.tsx`
- Aceptar props opcionales: `parentTaskId`, `parentCategory`, valores default para "crear siguiente paso de la secuencia".
- Selector de categoría arriba + selector de tipo de acción.

### Lugares con `TASK_TYPE_META` (CrmItemsPage, etc.)
- Mostrar categoría padre además del tipo de acción cuando exista.

---

## Detalles técnicos

- La confirmación usa `AlertDialog` de shadcn (ya disponible).
- "Crear nueva" reusa `CreateCrmTaskDialog` con mismos `company_id`, `contact_id`, `deal_id`, `parent_category`, `parent_task_id` (si la completada era sub-tarea, la nueva queda en la misma secuencia).
- Línea de tiempo: render simple vertical con icono coloreado por `task_type`, fecha y estado.
- No se borra `follow_up`/`cobranza` del enum de `taskTypes.tsx` porque la BD aún puede tener referencias antiguas — se filtran del selector pero `TASK_TYPE_META` los mantiene para retrocompatibilidad de íconos.

---

## Pregunta antes de empezar
Antes de migrar la BD necesito confirmar dos puntos. ¿Procedo con esta estructura o ajustamos algo?
