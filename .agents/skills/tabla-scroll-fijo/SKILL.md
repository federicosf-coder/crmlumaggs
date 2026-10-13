---
name: tabla-scroll-fijo
description: Aplica el patrón de scroll interno con encabezado, toolbar, columnas de identidad (izquierda) y columna de acciones (derecha) fijos en pantallas de listado. Úsalo en cualquier tabla larga o ancha: tablas con scroll horizontal (columnas cortadas), listados largos (scroll vertical) o ambas.
---

# Tabla con Scroll Fijo (tabs, toolbar, header sticky y columnas congeladas)

Complementa a `aplicar-tabla-refinada`. Ese skill define el estilo visual; este define el **layout de scroll**.

## Regla

En una pantalla de listado, el scroll NO debe ser el de la página: debe ser interno al contenedor de la tabla. Quedan siempre visibles:
1. La `TabsList` del módulo
2. La barra de búsqueda / acciones masivas
3. El `TableHeader`
4. Las **columnas de identidad** (Nombre, Código, Folio…) congeladas a la IZQUIERDA si hay scroll horizontal
5. La columna de **Acciones** congelada a la DERECHA si hay scroll horizontal

La barra de scroll horizontal debe quedar siempre visible en pantalla (al pie del área visible de la tabla), no al final de la página.

## 1. Página contenedora (nivel módulo con tabs)

```tsx
<div className="flex flex-col h-[calc(100vh-3.5rem)]">
  <header className="shrink-0 …">…título / acciones globales…</header>

  <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0">
    <TabsList className="shrink-0 …">…</TabsList>

    <TabsContent value="personal" className="flex-1 min-h-0 overflow-hidden mt-2">
      <PersonalTab />
    </TabsContent>
  </Tabs>
</div>
```

Claves:
- `h-[calc(100vh-3.5rem)]` (3.5rem = alto del topbar) en el contenedor raíz.
- Cada nivel intermedio necesita `flex-1 min-h-0`; sin `min-h-0` el flex hijo desborda y el scroll se va a la página.
- `shrink-0` en headers y `TabsList`.

Si la pantalla no usa tabs y la tabla vive dentro de una Card, basta limitar la altura del contenedor de scroll:
`max-h-[calc(100vh-13rem)]` (ajustar el offset según banner/tabs/paginación de la pantalla).

## 2. Tab / pantalla con tabla

```tsx
<div className="flex flex-col h-full gap-3">
  {/* Toolbar fija: buscador + acciones masivas */}
  <div className="shrink-0 flex flex-wrap items-center gap-2">
    <Input placeholder="Buscar…" className="max-w-xs" />
    <Button variant="outline" size="sm">Unir duplicadas</Button>
    <Button variant="outline" size="sm">Desactivar</Button>
    <Button variant="ghost" size="sm">Limpiar</Button>
  </div>

  {/* Área con scroll interno */}
  <Card className="flex-1 min-h-0 overflow-auto">
    <Table>
      <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur">
        <TableRow>…</TableRow>
      </TableHeader>
      <TableBody>…</TableBody>
    </Table>
  </Card>
</div>
```

## 3. Columnas congeladas (obligatorio cuando hay scroll horizontal)

### Izquierda — identidad
Fija las columnas que identifican la fila (Nombre, Código, Folio). Cada columna sticky necesita su `left` acumulado (suma del ancho de las columnas fijas anteriores):

```tsx
<TableHead className="sticky left-0 z-20 bg-background">Código</TableHead>
<TableHead className="sticky left-[7rem] z-20 bg-background">Nombre</TableHead>
```

Las celdas del cuerpo usan las mismas clases `sticky left-* z-10 bg-background`.

### Derecha — acciones
La columna de acciones se fija con `sticky right-0`:

```tsx
<TableHead className="sticky right-0 z-20 bg-background text-right">Acciones</TableHead>
// celda:
<TableCell className="sticky right-0 z-10 bg-background text-right">…</TableCell>
```

Para una celda doble (dos columnas de acciones), la segunda usa `right-[width-de-la-primera]` (p. ej. `right-[5.5rem]` tras una de 5.5rem).

### Z-index de intersecciones
- header fila: `z-10`
- columna (head o celda): `z-20`
- celda esquina (header ∩ columna fija): `z-30`

### Fondo opaco obligatorio
Toda celda o header sticky debe llevar fondo opaco (`bg-background`; en header sticky-vertical se usa `bg-background/95 backdrop-blur`). Sin fondo, las filas se transparentan detrás.

### Celdas que crecen bajo la columna fija
Si una celda fija es más corta que el contenido que pasa por debajo (p. ej. texto largo en la columna vecina), agrega un bloque de relleno para tapar:

```tsx
<TableCell className="sticky left-0 z-10 bg-background">
  <div className="min-w-[14rem]">…contenido…</div>
</TableCell>
```

## 4. Optimización de ancho (reducir el scroll horizontal)

Cuando la tabla tenga demasiadas columnas, unifica celdas de texto relacionado en una sola vertical antes de recurrir a más scroll:

```tsx
<TableCell>
  <div className="font-medium">Nombre del cliente</div>
  <div className="text-xs text-muted-foreground">correo@dominio.com</div>
</TableCell>
```

Ahorra 200px+ de ancho y suele permitir que casi todas las columnas quepan sin desplazamiento.

## Errores frecuentes

- Olvidar `min-h-0` en un contenedor flex → la tabla crece y el scroll salta a la página.
- `TableHeader` sticky sin fondo sólido → las filas se transparentan detrás.
- Usar `overflow-auto` en dos niveles anidados → doble barra de scroll; solo el contenedor de la tabla debe tenerlo.
- `colSpan` de las filas de "Cargando…" / "Sin registros" desalineado con el número real de columnas.
- Columna sticky sin `bg-background` → el contenido scrollea visible detrás de la celda fija.
- Olvidar el `left` acumulado en la segunda columna fija → las columnas fijas se superponen.
- Poner `overflow-x-hidden` en un contenedor padre (p. ej. `<main>`) y esperar scroll horizontal: el overflow se trunca; el scroll debe vivir en el contenedor de la tabla.

## Referencias canónicas

- `src/pages/rvs/ReporteVentasSistema.tsx` — contenedor de módulo con tabs fijos.
- `src/pages/rvs/PersonalTab.tsx` — toolbar fija + header sticky + scroll interno.
- `src/pages/inventario/GestionCostos.tsx` — columnas sticky horizontales.
- `src/pages/admin/UserManagement.tsx` — patrón completo: identidad congelada a la izquierda (Nombre+Correo unificados), Acciones congeladas a la derecha, header sticky y scroll interno acotado con `max-h-[calc(100vh-13rem)]`.

## Exclusiones

No aplicar a: `src/pages/admin/PreciosConfigTab.tsx`, módulos RVS (`src/pages/rvs/*` salvo `ReporteVentasSistema.tsx`/`PersonalTab.tsx` que ya lo definen), `src/pages/inventario/KardexCarga.tsx` ni `leadTime` de `RotacionInventario`. Son áreas protegidas por reglas permanentes del proyecto.
