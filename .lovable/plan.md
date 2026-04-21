

## Importar dinámicamente cualquier columna que coincida con la tabla `productos`

Hoy el botón **Importar** del Catálogo de Productos solo procesa una lista fija de columnas (precios, marca, presentación, etc.). Voy a hacerlo **dinámico**: cualquier columna del CSV cuyo nombre coincida con un campo real de `productos` se actualizará. Las columnas que **no** estén en el archivo se conservan tal cual están en la app (no se sobrescriben).

### Comportamiento

1. **Match por `codigo`** (case-insensitive), igual que ahora.
2. Para cada fila del CSV se construye un payload **solo con las columnas presentes** en el archivo y con valor no vacío.
3. Las celdas vacías **no sobrescriben** el valor existente (mantienen lo que ya hay en la app).
4. Las columnas del CSV que **no existen** en `productos` simplemente se ignoran (con un toast informativo listando las omitidas).
5. Si el `codigo` no existe en la base, se crea el producto con los campos del CSV.

### Mapa de columnas reconocidas

| Tipo | Columnas CSV aceptadas |
|---|---|
| Texto directo | `codigo`, `nombre_producto`, `descripcion` |
| Booleano | `is_active` (`true`/`false`) |
| Numérico | `costo_actual`, `precio_base_uf1`, `precio_uf2`, `precio_uf3`, `precio_uf4`, `precio_r1`, `precio_r2`, `precio_r3`, `precio_r4`, `precio_lista_galper` |
| Lookup por nombre → UUID | `presentacion` → `presentacion_id`, `marca` → `marca_id`, `aplicacion` → `aplicacion_id`, `uso` → `uso_id`, `formula` → `formula_id`, `viscosidad` → `viscosidad_id`, `categoria` → `categoria_id`, `linea` → `linea_id` |

Si el archivo trae una columna que no encaja en ninguna de las anteriores (ej. `marca_extra`, `proveedor`, etc.), se omite y se reporta.

### Detalles técnicos

- Archivo único modificado: `src/pages/inventory/ProductCatalog.tsx`, función `handleImport`.
- Reemplazo el bloque que arma el `payload` por un loop que itera **sobre los headers del CSV**:
  - Si el header está en la lista de columnas directas (texto/numérico/booleano) → se asigna con su parser correspondiente solo si el valor no es vacío.
  - Si está en la lista de lookups → se resuelve a UUID; si no existe en el catálogo se omite sin error.
  - Si no está en ninguna lista → se acumula en `unknownCols` para reportar al final.
- El parser numérico (`toNum`) y la lógica de "skip si payload vacío" se conservan.
- Toast final amplía con: `X creados, Y actualizados, Z sin cambios, N errores. Columnas ignoradas: foo, bar`.
- No se tocan campos de sistema (`id`, `created_at`, `created_by`, `updated_at`).
- No requiere migración ni cambios en otros archivos.

### Archivos afectados

- `src/pages/inventory/ProductCatalog.tsx` — solo `handleImport`.

