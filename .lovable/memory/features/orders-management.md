---
name: Orders Management - Pool + Visual Planning
description: Delivery module uses Pool + Kanban drag-and-drop planning. No date-based filtering; pedidos live in pool until scheduled.
type: feature
---
## Modelo Pool + Planeación Visual

- **Pool de Pedidos** (panel izquierdo): Muestra todos los pedidos con estatus confirmado_cliente, espera_autorizacion_precio, precio_autorizado, validado_contabilidad
- Excluye: programados, entregados, cancelados
- También incluye tareas CRM con `programable_entrega = true`

## Estatus de Pedido (enum)
- confirmado_cliente (🔴 rojo)
- espera_autorizacion_precio (🟡 amarillo)  
- precio_autorizado (🟢 verde)
- validado_contabilidad (🔵 azul)
- programado_entrega (🟣 morado)
- entregado
- cancelado

## Tablero de Rutas (panel derecho)
- Agrupado por Plaza
- Cada ruta: fecha, camión, múltiples repartidores (tabla ruta_repartidores)
- Drag & drop: Pool → Ruta, Ruta → Pool, Ruta → Ruta, reordenar dentro de ruta
- Al hacer drop: asigna plaza, ruta, fecha, camión; cambia estatus a programado_entrega

## Tablas involucradas
- `rutas_entrega`: plaza_id, vehiculo_id, repartidor_id (legacy), fecha_entrega, capacidad_kg, capacidad_volumen
- `ruta_repartidores`: junction table para múltiples repartidores por ruta
- `entregas_programadas`: documento_id, ruta_id, orden_ruta
- `crm_tasks.programable_entrega`: boolean para tareas que aparecen en el pool
