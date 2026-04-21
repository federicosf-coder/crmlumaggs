

## Cambios en la lista del Catálogo de Productos

Voy a reemplazar la columna actual "Base UF1" en la tabla de productos por **dos columnas compactas** que muestren todos los precios en texto pequeño.

### Nueva estructura de columnas

| Acciones | Descripción | Marca | **Precios UF** | **Precios R** | Activo |
|---|---|---|---|---|---|

- **Precios UF**: muestra UF1, UF2, UF3, UF4 apilados con etiquetas cortas.
- **Precios R**: muestra R1, R2, R3, R4 apilados con etiquetas cortas.
- Todos los valores se renderizan en `text-xs` (texto chiquito) con formato `$0.00`.
- Las etiquetas (UF1:, R1:, etc.) en `text-muted-foreground` para no saturar visualmente.

### Ejemplo visual de cada celda

```text
UF1: $12.34
UF2: $11.20
UF3: $10.50
UF4: $9.80
```

### Detalles técnicos (`src/pages/inventory/ProductCatalog.tsx`)

- Reemplazar el `<TableHead>Base UF1</TableHead>` por dos `<TableHead>` ("Precios UF" y "Precios R"), también en `text-xs`.
- En cada fila, reemplazar la `<TableCell>` de `precio_base_uf1` por dos celdas que rendericen un pequeño bloque vertical:
  ```tsx
  <TableCell className="text-xs whitespace-nowrap">
    <div>UF1: ${Number(p.precio_base_uf1 ?? 0).toFixed(2)}</div>
    <div>UF2: ${Number(p.precio_uf2 ?? 0).toFixed(2)}</div>
    <div>UF3: ${