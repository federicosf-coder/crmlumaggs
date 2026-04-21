

## Actualizar `presentacion_id` de productos desde CSV

Mapear el archivo `catalogo_productos_2026-04-21_presentaciones.csv` por `codigo` y actualizar la presentación de cada producto vinculándola al catálogo `presentaciones` existente.

### Cómo se hará

1. Cargar el CSV (382 filas) y, para cada fila con `presentacion` no vacía, buscar el `id` en `public.presentaciones` por `nombre` (coincidencia exacta).
2. Actualizar `productos.presentacion_id` haciendo match por `codigo` (case-insensitive).
3. Filas con `presentacion` vacía (ej. `013-1106-000`) se omiten — no se sobreescribe el valor existente.
4. Si algún `codigo` no existe en `productos` o algún nombre de presentación no existe en el catálogo, se reporta sin abortar el lote.

### Detalles técnicos

- Operación batch vía `supabase--insert` con un único:
  ```sql
  UPDATE productos p
  SET presentacion_id = v.presentacion_id, updated_at = now()
  FROM (VALUES
    ('212046718'::text, '41e4b8b8-112a-4456-a346-18059f48159d'::uuid),
    ...
  ) AS v(codigo, presentacion_id)
  WHERE lower(p.codigo) = lower(v.codigo);
  ```
- Verificación posterior con `read_query`: contar productos actualizados y mostrar 5 muestras (`codigo`, `nombre_producto`, nombre de presentación) para validar.
- No se modifican otros campos (precios, costo, descripción, etc.).
- No se requieren cambios de esquema ni archivos de código del front-end.

### Archivos / objetos afectados

- Tabla `public.productos`: solo columna `presentacion_id` (y `updated_at`).
- Catálogo `public.presentaciones`: solo lectura, sin cambios.

