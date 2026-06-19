## Objetivo

Confirmado por SQL: `inv_demanda_plaza` está vacía (0 filas) aunque hay 5 cargas registradas de `kardex_unidades`. Algo en `procesarKardexUnidades` no está insertando movimientos. Para ubicar la causa sin tocar la lógica, agregar diagnóstico visible.

## Cambios (solo `src/pages/inventario/KardexCarga.tsx`)

### 1. Toast de diagnóstico al cargar la pantalla
Al montar el componente, ejecutar las dos consultas y mostrar el resultado con `toast.info`:

- `SELECT count FROM inv_demanda_plaza`
- `SELECT count, max(created_at) FROM inv_kardex_cargas WHERE tipo='kardex_unidades'`

Toast: `"inv_demanda_plaza: N filas · kardex_unidades cargas: M (última: fecha)"`.

### 2. Instrumentar `procesarKardexUnidades`
Agregar `toast.info` (o `console.log` + toast) en puntos clave, sin alterar el flujo:

- Después del parser: `"Movimientos parseados: X · ventas agrupadas: Y"`.
- Antes del upsert a `inv_demanda_plaza`: `"demandaRows a insertar: N"`.
- Si `demandaRows.length === 0`: `toast.warning` explícito indicando que no hay ventas detectadas (parser no encontró filas de salida).
- Capturar y mostrar el `error` del upsert con `toast.error` (actualmente puede estar silenciado).

### 3. Nada más
- No tocar el parser ni la lógica de upsert.
- No tocar otros archivos.
- Es código temporal de diagnóstico; se retirará después de identificar la causa.

## Resultado esperado
Tras volver a subir un Kárdex en Unidades, los toasts dirán exactamente dónde se rompe: parser sin movimientos, agrupación vacía, o error del upsert.
