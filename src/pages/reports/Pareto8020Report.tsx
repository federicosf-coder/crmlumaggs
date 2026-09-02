import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageBanner } from "@/components/PageBanner";
import { BackButton } from "@/components/BackButton";
import { cn } from "@/lib/utils";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function Pareto8020Report() {
  const [marca, setMarca] = useState<string>("todas");
  const [plazasSel, setPlazasSel] = useState<string[]>([]);
  const [initPlazas, setInitPlazas] = useState(false);
  const [nivel, setNivel] = useState<"base" | "individual">("base");

  const defaultRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    return {
      desde: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`,
      hasta: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    };
  }, []);

  const [desde, setDesde] = useState<string>(defaultRange.desde);
  const [hasta, setHasta] = useState<string>(defaultRange.hasta);

  const { data: plazas = [] } = useQuery({
    queryKey: ["plazas-activas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plazas")
        .select("id, nombre")
        .eq("is_active", true)
        .order("nombre");
      if (error) throw error;
      return (data ?? []) as { id: string; nombre: string }[];
    },
  });

  useEffect(() => {
    if (!initPlazas && plazas.length) {
      setPlazasSel(plazas.map((p) => p.id));
      setInitPlazas(true);
    }
  }, [plazas, initPlazas]);

  const todas = plazas.length > 0 && plazasSel.length === plazas.length;

  const { data: lineas = [], isLoading } = useQuery({
    queryKey: ["pareto-8020", marca, desde, hasta, todas ? "all" : plazasSel.join(",")],
    enabled: initPlazas,
    queryFn: async () => {
      let q = supabase
        .from("documento_productos")
        .select(
          "unidades_equivalentes, producto_id, documentos!inner(fecha_documento, plaza_id, empresa_vendedora), productos(id, nombre_producto, producto_base_id, productos_base(nombre))"
        )
        .eq("documentos.tipo_documento", "factura")
        .neq("documentos.estatus_factura", "cancelada")
        .eq("documentos.is_active", true)
        .gte("documentos.fecha_documento", desde)
        .lte("documentos.fecha_documento", hasta);
      if (marca !== "todas") q = q.eq("documentos.empresa_vendedora", marca as never);
      if (!todas && plazasSel.length) q = q.in("documentos.plaza_id", plazasSel);
      const { data, error } = await q.limit(50000);
      if (error) throw error;
      return (data ?? []) as unknown as {
        unidades_equivalentes: number | null;
        producto_id: string | null;
        productos: {
          id: string;
          nombre_producto: string | null;
          producto_base_id: string | null;
          productos_base: { nombre: string | null } | null;
        } | null;
      }[];
    },
  });

  const { rows, total, top80Count } = useMemo(() => {
    const map = new Map<string, { nombre: string; ue: number; skus: Set<string> }>();
    for (const l of lineas) {
      if (nivel === "base") {
        const baseId = l.productos?.producto_base_id ?? "__sin_base__";
        const nombre = l.productos?.productos_base?.nombre ?? "Sin producto base";
        const entry = map.get(baseId) ?? { nombre, ue: 0, skus: new Set<string>() };
        entry.ue += Number(l.unidades_equivalentes ?? 0);
        if (l.productos?.id) entry.skus.add(l.productos.id);
        map.set(baseId, entry);
      } else {
        const prodId = l.productos?.id ?? "__sin_producto__";
        const nombre = l.productos?.nombre_producto ?? "Sin producto";
        const entry = map.get(prodId) ?? { nombre, ue: 0, skus: new Set<string>() };
        entry.ue += Number(l.unidades_equivalentes ?? 0);
        map.set(prodId, entry);
      }
    }
    const sorted = [...map.entries()].sort((a, b) => b[1].ue - a[1].ue);
    const tot = sorted.reduce((a, [, v]) => a + v.ue, 0);
    let acc = 0;
    let reached = false;
    let count = 0;
    const out = sorted.map(([key, v], i) => {
      const ue = v.ue;
      acc += ue;
      const accPct = tot > 0 ? (acc / tot) * 100 : 0;
      const isTop = !reached;
      if (isTop) count++;
      if (accPct >= 80) reached = true;
      return {
        key,
        pos: i + 1,
        nombre: v.nombre,
        skus: v.skus.size,
        ue,
        pct: tot > 0 ? (ue / tot) * 100 : 0,
        accPct,
        isTop,
        isBoundary: isTop && reached,
      };
    });
    return { rows: out, total: tot, top80Count: count };
  }, [lineas, nivel]);

  const fmt = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 2 });

  const togglePlaza = (id: string) =>
    setPlazasSel((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  return (
    <>
      <div className="container mx-auto px-4 pt-4">
        <BackButton fallback="/reports" label="Volver a Reportes" />
      </div>
      <PageBanner
        title="Análisis 80/20 — Productos Más Vendidos"
        description={
          nivel === "base"
            ? "Concentración de unidades equivalentes por producto base en los últimos 12 meses."
            : "Concentración de unidades equivalentes por SKU individual en los últimos 12 meses."
        }
      />
      <div className="container mx-auto p-4 space-y-4">
        <Card>
          <CardContent className="pt-6 flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide">Marca</Label>
              <Select value={marca} onValueChange={setMarca}>
                <SelectTrigger className="w-[200px] font-light">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="lumaggs_chevron">Chevron</SelectItem>
                  <SelectItem value="galsa_phillips66">Phillips 66</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide">Plazas</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="min-w-[220px] justify-between font-light">
                    {todas ? "Todas las plazas" : `${plazasSel.length} plazas seleccionadas`}
                    <ChevronDown className="h-4 w-4 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <div className="flex justify-between pb-2 mb-2 border-b">
                    <Button variant="ghost" size="sm" onClick={() => setPlazasSel(plazas.map((p) => p.id))}>
                      Todas
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setPlazasSel([])}>
                      Ninguna
                    </Button>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {plazas.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={plazasSel.includes(p.id)} onCheckedChange={() => togglePlaza(p.id)} />
                        {p.nombre}
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide">Nivel</Label>
              <Select value={nivel} onValueChange={(v) => setNivel(v as "base" | "individual")}>
                <SelectTrigger className="w-[200px] font-light">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="base">Por Producto Base</SelectItem>
                  <SelectItem value="individual">Por SKU Individual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-normal uppercase tracking-wide text-muted-foreground">
                Unidades Equivalentes (12 meses)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-semibold">{fmt(total)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-normal uppercase tracking-wide text-muted-foreground">
                Concentración 80/20
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-semibold">
                {top80Count} <span className="text-xl font-light text-muted-foreground">de {rows.length}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-light">
                {nivel === "base" ? "productos base" : "SKUs individuales"} concentran el 80% de las ventas
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>{nivel === "base" ? "Producto Base" : "Producto"}</TableHead>
                  {nivel === "base" && (
                    <TableHead className="text-right">Presentaciones</TableHead>
                  )}
                  <TableHead className="text-right">Unidades Equivalentes</TableHead>
                  <TableHead className="text-right">% del total</TableHead>
                  <TableHead className="text-right">% acumulado</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={nivel === "base" ? 7 : 6} className="text-center text-muted-foreground py-8">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={nivel === "base" ? 7 : 6} className="text-center text-muted-foreground py-8">
                      Sin datos para los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow
                      key={r.key}
                      className={cn(r.isBoundary && "border-b-2 border-emerald-500/60")}
                    >
                      <TableCell className="text-muted-foreground">{r.pos}</TableCell>
                      <TableCell className="font-medium">{r.nombre}</TableCell>
                      {nivel === "base" && (
                        <TableCell className="text-right">{r.skus}</TableCell>
                      )}
                      <TableCell className="text-right">{fmt(r.ue)}</TableCell>
                      <TableCell className="text-right">{r.pct.toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{r.accPct.toFixed(1)}%</TableCell>
                      <TableCell>
                        {r.isTop && (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
                            Top 80%
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {rows.length > 0 && (
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell />
                    <TableCell>Total</TableCell>
                    {nivel === "base" && <TableCell />}
                    <TableCell className="text-right">{fmt(total)}</TableCell>
                    <TableCell className="text-right">100.0%</TableCell>
                    <TableCell />
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
