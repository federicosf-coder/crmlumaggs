---
name: Último envío bajo botones de correo/WhatsApp
description: Patrón estándar para mostrar "Último envío: dd/MM/yyyy HH:mm" bajo cualquier botón etiquetado que dispare automatizaciones (correo o WhatsApp)
type: design
---
Cualquier botón etiquetado (con texto) que dispare una automatización para enviar correo o WhatsApp debe mostrar inmediatamente debajo un sello con el último envío exitoso para esa entidad y trigger_key.

Implementación estándar:
- Hook: `useLastAutomationRuns(entityId, triggerKeys[])` en `src/hooks/useLastAutomationRuns.ts` — devuelve `{ [trigger_key]: ISOString | null }` con el último `automation_runs.run_at` con `status='success'`.
- Componente: `<LastSendStamp at={...} />` en `src/components/automations/LastSendStamp.tsx` — texto `text-[10px] text-muted-foreground` centrado. Si no hay envío previo muestra "Sin envíos previos".
- Envolver el `<Button>` en `<div className="flex flex-col items-stretch">` y colocar el `<LastSendStamp>` debajo.
- Después de `fireAutomation(...)` llamar `setTimeout(() => refetch(), 800)` para refrescar el sello.

No aplicar a botones de icono dentro de tablas/celdas (rompe layout). Para esos casos usar tooltip si se requiere.
