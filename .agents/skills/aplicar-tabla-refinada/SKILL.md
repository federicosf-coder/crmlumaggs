---
name: aplicar-tabla-refinada
description: Aplicar el "Estilo Tabla Refinada" del proyecto (gradiente violet/blue en header, columnas uppercase tracked, divisores verticales, filas zebra, hover blue-50/40) a cualquier lista o tabla nueva o existente. Invocar cuando el usuario pida estilizar una tabla, lista, grid de datos o "aplicar el estilo de tabla", o usar el formato de /admin/templates en otras vistas.
---

# Aplicar Tabla Refinada

Estilo visual por defecto para TODAS las listas/tablas de datos del proyecto. Implementado vía el primitive compartido `src/components/ui/table.tsx`.

## Cómo aplicarlo

1. Importar el primitive:
   ```tsx
   import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
   ```
2. Envolver la tabla dentro de un `<Card>` (de `@/components/ui/card`) cuando sea una lista principal de página.
3. NO agregar clases de color/border personalizadas a `<th>` o `<tr>`; el primitive ya incluye:
   - Header con gradiente `from-violet-50/60 to-blue-50/60`
   - Columnas con `text-[10px] font-semibold uppercase tracking-widest text-muted-foreground`
   - Divisores verticales entre columnas (`border-l border-border/30`, primer th sin borde)
   - Filas zebra (`odd:bg-muted/20`)
   - Hover (`hover:bg-blue-50/40`) y selección (`data-[state=selected]:bg-blue-50/60`)
   - Tipografía `text-[13px] font-light` en celdas
   - Contenedor `rounded-xl border border-border/60 bg-background/80 shadow-sm backdrop-blur-xl`

## Estructura canónica

```tsx
<Card>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Nombre</TableHead>
        <TableHead>Tipo</TableHead>
        <TableHead className="text-right">Acciones</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {items.map((it) => (
        <TableRow key={it.id}>
          <TableCell>{it.name}</TableCell>
          <TableCell>{it.type}</TableCell>
          <TableCell className="text-right">…</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</Card>
```

## Reglas

- Idioma de columnas y textos: español (ES).
- Usar `Badge` (variants `outline` / `secondary` / default) para tipos, categorías y estados activo/inactivo.
- Acciones de fila: `Button variant="ghost" size="icon"` con íconos de `lucide-react`, alineadas a la derecha (`<TableCell className="text-right">`).
- Fechas: `text-xs text-muted-foreground`.
- Estado vacío y carga: una sola `<TableRow>` con `<TableCell colSpan={N} className="text-center text-muted-foreground py-8">Cargando…</TableCell>` o "Sin registros…".
- NO usar colores hardcodeados; respetar tokens semánticos del design system.

## Referencia canónica

- `src/pages/admin/TemplatesManagement.tsx` — implementación de referencia (vista `/admin/templates`).
- `src/components/ui/table.tsx` — primitive con todos los estilos ya aplicados.

Si una tabla existente trae clases manuales redundantes en header/celdas, eliminarlas para que el primitive imponga el estilo uniforme.