import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageBanner } from "@/components/PageBanner";
import { BackButton } from "@/components/BackButton";
import { cn } from "@/lib/utils";
import { ChevronDown, Download } from "lucide-react";
import * as XLSX from "xlsx";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PRODUCTO_IDS = [
  "36a85ea1-dfa5-46bf-9863-8f27cca12ee1",
  "d8356bf0-ed8a-4bff-b787-55d2c61fc04f",
  "65b586dd-be9a-4f6c-a559-0fd6591c0404",
  "e10a5967-3a53-48dc-bc06-a1b360507ea8",
  "50f66dda-575b-4a8b-83c0-865a9d06a988",
];

const COLORES = [
  "hsl(221 83% 53%)",
  "hsl(262 83% 58%)",
  "hsl(160 84% 39%)",
  "hsl(25 95% 53%)",
  "hsl(340 82% 52%)",
];

const MESES_ABBR = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function DeloXLEReport() {
  const [plazasSel, setPlazasSel] = useState<string[]>([]);
  const [initPlazas, setInitPlazas] = useState(false);
  const [presSel, setPresSel] = useState<string[]>([]);
  const [initPres, setInitPres] = useState(false);

  const { desde, hasta, meses } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const keys: string[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      keys.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
    }
    return {
      desde: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`,
      hasta: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      meses: keys,
    };
  }, []);

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

  const { data: productos = [] } = useQuery({
    queryKey: ["delo-xle-productos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select("id, codigo, presentaciones(nombre)")
        .in("id", PRODUCTO_IDS);
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        id: p.id as string,
        codigo: p.codigo as string,
        presentacion: (p.presentaciones?.nombre as string) ?? p.codigo,
      }));
    },
  });

  useEffect(() => {
    if (!initPres && productos.length) {
      setPresSel(productos.map((p) => p.id));
      setInitPres(true);
    }
  }, [productos, initPres]);

  const todasPres = productos.length > 0 && presSel.length === productos.length;
  const productosSel = useMemo(
    () => productos.filter((p) => presSel.includes(p.id)),
    [productos, presSel]
  );

  const { data: lineas = [], isLoading } = useQuery({
    queryKey: ["delo-xle", desde, hasta, todas ? "all" : plazasSel.join(",")],
    enabled: initPlazas,
    queryFn: async () => {
      let q = supabase
        .from("documento_productos")
        .select("producto_id, unidades_equivalentes, documentos!inner(fecha_documento, plaza_id)")
        .in("producto_id", PRODUCTO_IDS)
        .eq("documentos.tipo_documento", "factura")
        .neq("documentos.estatus_factura", "cancelada")
        .eq("documentos.is_active", true)
        .gte("documentos.fecha_documento", desde)
        .lte("documentos.fecha_documento", hasta);
      if (!todas && plazasSel.length) q = q.in("documentos.plaza_id", plazasSel);
      const { data, error } = await q.limit(20000);
      if (error) throw error;
      return (data ?? []) as unknown as {
        producto_id: string | null;
        unidades_equivalentes: number | null;
        documentos: { fecha_documento: string | null; plaza_id: string | null } | null;
      }[];
    },
  });

  const rows = useMemo(() => {
    const map = new Map<string, number>();
    meses.forEach((m) => map.set(m, 0));
    for (const l of lineas) {
      if (l.producto_id && !presSel.includes(l.producto_id)) continue;
      const f = l.documentos?.fecha_documento;
      if (!f) continue;
      const key = f.slice(0, 7);
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + Number(l.unidades_equivalentes ?? 0));
    }
    return meses.map((m, i) => {
      const ue = map.get(m) ?? 0;
      const prev = i > 0 ? map.get(meses[i - 1]) ?? 0 : null;
      const [y, mm] = m.split("-");
      return {
        key: m,
        label: `${MESES_ABBR[Number(mm) - 1]} ${y}`,
        ue,
        delta: prev === null ? null : ue - prev,
        pct: prev === null || prev === 0 ? null : ((ue - prev) / prev) * 100,
      };
    });
  }, [lineas, meses, presSel]);

  const porPresentacion = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    meses.forEach((m) => map.set(m, new Map()));
    for (const l of lineas) {
      const pid = l.producto_id ?? "";
      if (!presSel.includes(pid)) continue;
      const f = l.documentos?.fecha_documento;
      if (!f) continue;
      const key = f.slice(0, 7);
      const mm = map.get(key);
      if (!mm) continue;
      mm.set(pid, (mm.get(pid) ?? 0) + Number(l.unidades_equivalentes ?? 0));
    }
    const chart = meses.map((m) => {
      const [y, mo] = m.split("-");
      const row: Record<string, any> = { label: `${MESES_ABBR[Number(mo) - 1]} ${y.slice(2)}` };
      productosSel.forEach((p) => {
        row[p.id] = map.get(m)?.get(p.id) ?? 0;
      });
      return row;
    });
    const totales = productosSel.map((p) => ({
      ...p,
      total: meses.reduce((s, m) => s + (map.get(m)?.get(p.id) ?? 0), 0),
    }));
    return { chart, totales, map };
  }, [lineas, meses, presSel, productosSel]);

  const total = rows.reduce((a, r) => a + r.ue, 0);
  const fmt = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 2 });

  const togglePlaza = (id: string) =>
    setPlazasSel((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const togglePres = (id: string) =>
    setPresSel((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  return (
    <>
      <div className="container mx-auto px-4 pt-4">
        <BackButton fallback="/reports" label="Volver a Reportes" />
      </div>
      <PageBanner
        title="Ventas Delo XLE 15W40 — Comparativo Mensual"
        description="Unidades equivalentes facturadas por mes en los últimos 12 meses (todas las presentaciones)."
      />
      <div className="container mx-auto p-4 space-y-4">
        <Card>
          <CardContent className="pt-6 flex flex-wrap items-end gap-4">
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
              <Label className="text-xs uppercase tracking-wide">Presentaciones</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="min-w-[260px] justify-between font-light">
                    {todasPres
                      ? "Todas las presentaciones"
                      : `${presSel.length} presentaciones seleccionadas`}
                    <ChevronDown className="h-4 w-4 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-2" align="start">
                  <div className="flex justify-between pb-2 mb-2 border-b">
                    <Button variant="ghost" size="sm" onClick={() => setPresSel(productos.map((p) => p.id))}>
                      Todas
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setPresSel([])}>
                      Ninguna
                    </Button>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {productos.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={presSel.includes(p.id)} onCheckedChange={() => togglePres(p.id)} />
                        {p.presentacion}
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal uppercase tracking-wide text-muted-foreground">
              Unidades equivalentes por presentación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porPresentacion.chart} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => fmt(Number(v))} />
                  <Legend />
                  {productosSel.map((p, i) => (
                    <Bar
                      key={p.id}
                      dataKey={p.id}
                      name={p.presentacion}
                      fill={COLORES[i % COLORES.length]}
                      radius={[3, 3, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

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
              Detalle mensual por presentación
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  {productosSel.map((p) => (
                    <TableHead key={p.id} className="text-right">
                      {p.presentacion}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meses.map((m) => {
                  const [y, mo] = m.split("-");
                  const fila = productosSel.map((p) => porPresentacion.map.get(m)?.get(p.id) ?? 0);
                  return (
                    <TableRow key={m}>
                      <TableCell className="font-medium">{`${MESES_ABBR[Number(mo) - 1]} ${y}`}</TableCell>
                      {fila.map((v, i) => (
                        <TableCell key={i} className="text-right">
                          {fmt(v)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-medium">
                        {fmt(fila.reduce((a, b) => a + b, 0))}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>Total</TableCell>
                  {porPresentacion.totales.map((t) => (
                    <TableCell key={t.id} className="text-right">
                      {fmt(t.total)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">{fmt(total)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead className="text-right">Unidades Equivalentes</TableHead>
                  <TableHead className="text-right">Variación (UE)</TableHead>
                  <TableHead className="text-right">Variación (%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="font-medium">{r.label}</TableCell>
                      <TableCell className="text-right">{fmt(r.ue)}</TableCell>
                      <TableCell
                        className={cn(
                          "text-right",
                          r.delta === null ? "" : r.delta >= 0 ? "text-emerald-600" : "text-red-600"
                        )}
                      >
                        {r.delta === null ? "—" : `${r.delta >= 0 ? "+" : ""}${fmt(r.delta)}`}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right",
                          r.pct === null ? "" : r.pct >= 0 ? "text-emerald-600" : "text-red-600"
                        )}
                      >
                        {r.pct === null ? "—" : `${r.pct >= 0 ? "+" : ""}${r.pct.toFixed(1)}%`}
                      </TableCell>
                    </TableRow>
                  ))
                )}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{fmt(total)}</TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
