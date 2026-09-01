---
name: tabla-scroll-fijo
description: Aplica el patrón de encabezados de tabla, tabs y barras de acciones fijos (sticky) con scroll interno en pantallas de listado. Úsalo cuando una tabla larga deba conservar visibles tabs, buscador, acciones masivas y encabezados de columna al hacer scroll.
---

# Tabla con Scroll Fijo (tabs, toolbar y header sticky)

Complementa a `aplicar-tabla-refinada`. Ese skill define el estilo visual; este define el **layout de scroll**.

## Regla

En una pantalla de listado, el scroll NO debe ser el de la página: debe ser interno al contenedor de la tabla. Quedan siempre visibles:
1. La `TabsList` del módulo
2. La barra de búsqueda / acciones masivas
3. El `TableHeader`

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

## 3. Columnas sticky (opcional)

Cuando la tabla scrollea en horizontal, fija las primeras columnas:

```tsx
<TableHead className="sticky left-0 z-20 bg-background">Código</TableHead>
<TableHead className="sticky left-[7rem] z-20 bg-background">Nombre</TableHead>
```
El `z` del header sticky-vertical debe ser menor que el de la intersección: header fila `z-10`, columna `z-20`, celda esquina `z-30`.

## Errores frecuentes

- Olvidar `min-h-0` en un contenedor flex → la tabla crece y el scroll salta a la página.
- `TableHeader` sticky sin fondo sólido → las filas se transparentan detrás.
- Usar `overflow-auto` en dos niveles anidados → doble barra de scroll; solo el contenedor de la tabla debe tenerlo.
- `colSpan` de las filas de "Cargando…" / "Sin registros" desalineado con el número real de columnas.

## Referencias canónicas

- `src/pages/rvs/ReporteVentasSistema.tsx` — contenedor de módulo con tabs fijos.
- `src/pages/rvs/PersonalTab.tsx` — toolbar fija + header sticky + scroll interno.
- `src/pages/inventario/GestionCostos.tsx` — columnas sticky horizontales.
