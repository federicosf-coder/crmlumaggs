---
name: Estilo Modal Refinado
description: Default visual style for ALL dialogs, modals, and form panels across the app
type: design
---
# Estilo Modal Refinado

Aplicar automáticamente a TODOS los Dialog/Modal/Form panels nuevos y existentes salvo indicación contraria.

## Estructura
- `DialogContent`: `sm:max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden`
- Header con gradiente: `bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4 border-b shrink-0`
- Form body: `space-y-5 px-5 py-5 overflow-y-auto flex-1`
- Footer fijo: `border-t bg-muted/30 px-5 py-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end shrink-0`

## Tipografía
- Títulos: `text-lg font-semibold tracking-tight`
- Subtítulos: `text-xs text-muted-foreground font-light`
- Labels de sección: `text-xs uppercase tracking-wide text-muted-foreground`
- Inputs/Textareas/Selects: `font-light`
- Inputs altos: `h-9`

## Colores e indicadores
- Prioridad/estado por puntos: green-500 (bajo), yellow-500 (medio), red-500 (alto)
- Banners de aviso: `border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200`
- WhatsApp panel: `bg-[#e7f6d5] dark:bg-emerald-900/20`

## Botones de acción
- Cancelar: `variant="outline"`
- Acción primaria a la derecha
- WhatsApp Local: `bg-emerald-600 hover:bg-emerald-700 text-white`

## Componentes de referencia (canónicos)
- `src/components/crm/CrmTaskDetailDialog.tsx`
- `src/components/crm/CreateCrmTaskDialog.tsx`

## Cómo referenciar
El usuario puede pedir: "aplica el Estilo Modal Refinado" o "usa el diseño del CreateCrmTaskDialog".
