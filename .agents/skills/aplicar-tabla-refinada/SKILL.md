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

## Tabs Refinados (acompañan a las tablas)

Cuando una vista combine varias listas/secciones bajo pestañas, usar el patrón de Tabs del CreditoDetail: contenedor con gradiente multicolor pastel y un color de acento distinto por pestaña activa (gradiente saturado + texto blanco + shadow).

### TabsList contenedor

```tsx
<TabsList className="grid grid-cols-N w-full sm:w-auto bg-gradient-to-r from-violet-50 via-blue-50 to-emerald-50 p-1 h-auto gap-1 border border-violet-100">
```

- `grid grid-cols-N` según número de pestañas (responsive: `w-full sm:w-auto`).
- Fondo `bg-gradient-to-r from-violet-50 via-blue-50 to-emerald-50` (o `from-blue-50 to-indigo-50` para sub-tabs internos).
- Borde sutil `border border-violet-100` (o `border-blue-100`).
- `p-1 gap-1 h-auto` para densidad compacta.

### TabsTrigger por pestaña

Clases base obligatorias (idénticas en todos los triggers):
```
text-[10px] sm:text-xs px-1 sm:px-2 py-1.5 leading-tight text-center whitespace-normal break-words min-w-0 h-auto
```

Color de acento por pestaña — elegir uno distinto para cada `TabsTrigger`:

| Acento | Texto inactivo | Activo |
|---|---|---|
| Violeta | `text-violet-700` | `data-[state=active]:bg-gradient-to-br data-[state=active]:from-violet-500 data-[state=active]:to-fuchsia-600 data-[state=active]:text-white data-[state=active]:shadow-md` |
| Azul | `text-blue-700` | `from-blue-500 to-indigo-600` |
| Esmeralda | `text-emerald-700` | `from-emerald-500 to-teal-600` |
| Ámbar | `text-amber-700` | `from-amber-500 to-orange-600` |
| Slate | `text-slate-700` | `from-slate-600 to-slate-800` |
| Rosa | `text-rose-700` | `from-rose-500 to-pink-600` |

Ejemplo:
```tsx
<TabsTrigger
  value="firmas"
  className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-500 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-md text-emerald-700 text-[10px] sm:text-xs px-1 sm:px-2 py-1.5 leading-tight text-center whitespace-normal break-words min-w-0 h-auto"
>
  Formatos y Firmas
</TabsTrigger>
```

### Sub-tabs (anidados dentro de una pestaña)

Estilo más sobrio: fondo blanco al activar, sin gradiente saturado.
```tsx
<TabsList className="grid grid-cols-3 w-full bg-gradient-to-r from-blue-50 to-indigo-50 p-1 h-auto gap-1 border border-blue-100">
  <TabsTrigger
    value="empresa"
    className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-blue-700 text-[10px] sm:text-xs h-auto whitespace-normal break-words min-w-0 leading-tight flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 py-1.5"
  >
    Empresa
  </TabsTrigger>
</TabsList>
```

### Botones de acción dentro de las pestañas

Para botones primarios que viven dentro del card de la pestaña (ej. "Generar Todos"), usar variante outline con el mismo gradiente que la TableHeader:

```tsx
<Button
  size="sm"
  variant="outline"
  className="border-violet-200 bg-gradient-to-r from-violet-50 to-blue-50 text-violet-700 hover:from-violet-100 hover:to-blue-100 hover:text-violet-800 text-[10px] font-semibold uppercase tracking-widest"
>
  <Printer className="h-3.5 w-3.5 mr-1.5" />Acción
</Button>
```

### Referencia canónica de Tabs

- `src/pages/credito/CreditoDetail.tsx` (líneas ~1510 TabsList principal y ~1535 sub-TabsList).