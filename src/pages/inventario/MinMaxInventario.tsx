import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sliders, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

const ALMACEN_LABELS: Record<string, string> = {
  "1001": "Mexicali (hub)",
  "1002": "Tijuana (hub)",
  "1003": "Morelos",
  "1004": "Ensenada",
};

const COBERTURA: Record<string, number> = { A: 60, B: 45, C: 30 };
const SEGURIDAD: Record<string, number> = { A: 15, B: 10, C: 7 };

export type Row = {
  id: string;
  codigo_producto: string;
  almacen: string;
  clasificacion_abc: string | null;
  demanda_diaria_hub: number | null;
  dias_cobertura_objetivo: number;
  dias_stock_seguridad: number;
  lead_time_dias: number;
  minimo_calc: number;
  maximo_calc: number;
  cantidad_reorden_calc: number;
  minimo_manual: number | null;
  maximo_manual: number | null;
  cantidad_reorden_manual: number | null;
  minimo_efectivo: number;
  maximo_efectivo: number;
  cantidad_reorden_efectiva: number;
  ajustado_manualmente: boolean;
  notas: string | null;
};

export type NivelRow = {
  codigo_producto: string;
  nombre_producto: string | null;
  clasificacion_abc: string | null;
  lead_time_dias: number | null;
  piezas_por_tarima: number | null;
  fuente_suministro: string | null;
  stock_almacen_1001: number | null;
  stock_almacen_1002: number | null;
  stock_almacen_1003: number | null;
  stock_almacen_1004: number | null;
};

const stockOf = (n: NivelRow | undefined, alm: string) =>
  Number((n as any)?.[`stock_almacen_${alm}`] ?? 0);

export default function MinMaxInventario() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-light tracking-tight">Mínimos y Máximos</h1>
        <p className="text-sm text-muted-foreground">Revisión y ajuste de niveles de reorden por SKU y almacén.</p>
      </div>
      <MinMaxTabContent />
    </div>
  );
}

export function MinMaxTabContent() {
  const qc = useQueryClient();
  const [almacenSel, setAlmacenSel] = useState<string>("todos");
  const [abcSel, setAbcSel] = useState<string>("todos");
  const [ajusteSel, setAjusteSel] = useState<string>("todos");
  const [estadoSel, setEstadoSel] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [empAbcSel, setEmpAbcSel] = useState<string>("todos");
  const [empEstadoSel, setEmpEstadoSel] = useState<string>("todos");
  const [empSearch, setEmpSearch] = useState("");

  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: ["inv_minmax"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("inv_minmax")
        .select("*")
        .order("codigo_producto");
      if (error) throw error;
      return data as Row[];
    },
  });

  const { data: niveles = [] } = useQuery<NivelRow[]>({
    queryKey: ["inv_niveles_inventario_min"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("inv_niveles_inventario")
        .select("codigo_producto, nombre_producto, clasificacion_abc, lead_time_dias, piezas_por_tarima, fuente_suministro, stock_almacen_1001, stock_almacen_1002, stock_almacen_1003, stock_almacen_1004");
      if (error) throw error;
      return data as NivelRow[];
    },
  });

  const nivMap = useMemo(() => {
    const m = new Map<string, NivelRow>();
    for (const n of niveles) m.set(n.codigo_producto, n);
    return m;
  }, [niveles]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return rows.filter((r) => {
      if (almacenSel !== "todos" && r.almacen !== almacenSel) return false;
      if (abcSel !== "todos" && (r.clasificacion_abc ?? "") !== abcSel) return false;
      if (ajusteSel === "manual" && !r.ajustado_manualmente) return false;
      if (ajusteSel === "sin_ajustar" && r.ajustado_manualmente) return false;
      if (estadoSel !== "todos" && estadoKey(r) !== estadoSel) return false;
      if (s) {
        const n = nivMap.get(r.codigo_producto);
        const text = `${r.codigo_producto} ${n?.nombre_producto ?? ""}`.toLowerCase();
        if (!text.includes(s)) return false;
      }
      return true;
    });
  }, [rows, almacenSel, abcSel, ajusteSel, estadoSel, search, nivMap]);

  const kpis = useMemo(() => {
    const conMin = filtered.filter((r) => (r.minimo_calc ?? 0) > 0 || (r.minimo_manual ?? 0) > 0).length;
    const manuales = filtered.filter((r) => r.ajustado_manualmente).length;
    const bajoMin = filtered.filter((r) => {
      const stock = stockOf(nivMap.get(r.codigo_producto), r.almacen);
      return r.minimo_efectivo > 0 && stock < r.minimo_efectivo;
    }).length;
    const sinDem = filtered.filter((r) => !(r.demanda_diaria_hub && r.demanda_diaria_hub > 0)).length;
    return { conMin, manuales, bajoMin, sinDem };
  }, [filtered, nivMap]);

  const recalcularTodo = async () => {
    setRecalculating(true);
    try {
      const { data: dem } = await (supabase as any)
        .from("inv_demanda_plaza")
        .select("codigo_producto, almacen, demanda_diaria_promedio, periodo_inicio")
        .order("periodo_inicio", { ascending: false });
      // Tomar la demanda más reciente por (codigo, almacen)
      const ultimaDem = new Map<string, number>();
      for (const d of (dem || [])) {
        const k = `${d.codigo_producto}|${d.almacen}`;
        if (!ultimaDem.has(k)) ultimaDem.set(k, Number(d.demanda_diaria_promedio || 0));
      }
      const updates: any[] = [];
      const hoyIso = new Date().toISOString().slice(0, 10);
      for (const r of rows) {
        const k = `${r.codigo_producto}|${r.almacen}`;
        const ddia = ultimaDem.get(k) ?? Number(r.demanda_diaria_hub ?? 0);
        const n = nivMap.get(r.codigo_producto);
        const abc = n?.clasificacion_abc ?? r.clasificacion_abc ?? null;
        const cobertura = abc && COBERTURA[abc] ? COBERTURA[abc] : 45;
        const seguridad = abc && SEGURIDAD[abc] ? SEGURIDAD[abc] : 10;
        const lead = Number(n?.lead_time_dias ?? r.lead_time_dias ?? 10) || 10;
        const ppt = Math.max(1, Number(n?.piezas_por_tarima ?? 1) || 1);
        const minCalc = Math.ceil((ddia * (lead + seguridad)) / ppt) * ppt;
        const maxCalc = Math.ceil((ddia * (lead + cobertura)) / ppt) * ppt;
        const stock = stockOf(n, r.almacen);
        const reordenCalc = Math.max(0, minCalc - stock);
        updates.push({
          id: r.id,
          demanda_diaria_hub: ddia,
          clasificacion_abc: abc,
          dias_cobertura_objetivo: cobertura,
          dias_stock_seguridad: seguridad,
          lead_time_dias: lead,
          minimo_calc: minCalc,
          maximo_calc: maxCalc,
          cantidad_reorden_calc: reordenCalc,
          ultima_actualizacion_calc: hoyIso,
        });
      }
      const batch = 200;
      for (let i = 0; i < updates.length; i += batch) {
        for (const u of updates.slice(i, i + batch)) {
          const { id, ...rest } = u;
          await (supabase as any).from("inv_minmax").update(rest).eq("id", id);
        }
      }
      toast.success(`Recalculado: ${updates.length} registros`);
      qc.invalidateQueries({ queryKey: ["inv_minmax"] });
    } catch (e: any) {
      toast.error("Error: " + (e?.message || ""));
    } finally {
      setRecalculating(false);
    }
  };

  const estadoKey = (r: Row): "sin_demanda" | "bajo_minimo" | "manual" | "ok" => {
    if (!(r.demanda_diaria_hub && r.demanda_diaria_hub > 0)) return "sin_demanda";
    const stock = stockOf(nivMap.get(r.codigo_producto), r.almacen);
    if (r.minimo_efectivo > 0 && stock < r.minimo_efectivo) return "bajo_minimo";
    if (r.ajustado_manualmente) return "manual";
    return "ok";
  };

  const estadoBadge = (r: Row) => {
    const key = estadoKey(r);
    if (key === "sin_demanda") return <Badge variant="outline" className="text-muted-foreground">SIN DEMANDA</Badge>;
    if (key === "bajo_minimo") return <Badge variant="destructive">BAJO MÍNIMO</Badge>;
    if (key === "manual") return <Badge className="bg-emerald-600 hover:bg-emerald-600">MANUAL</Badge>;
    return <Badge className="bg-blue-600 hover:bg-blue-600">OK</Badge>;
  };

  const abcBadge = (abc: string | null) => {
    if (!abc) return <span className="text-muted-foreground">—</span>;
    const cls = abc === "A" ? "bg-red-100 text-red-700" : abc === "B" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700";
    return <Badge variant="outline" className={cls}>{abc}</Badge>;
  };

  const porEmpresa = useMemo(() => {
    const map = new Map<string, {
      codigo_producto: string;
      nombre_producto: string | null;
      clasificacion_abc: string | null;
      demanda: number;
      minimo: number;
      maximo: number;
      reorden: number;
      stock: number;
      mixto: boolean;
    }>();
    for (const r of rows) {
      let acc = map.get(r.codigo_producto);
      if (!acc) {
        const n = nivMap.get(r.codigo_producto);
        const stockTotal = ["1001", "1002", "1003", "1004"].reduce((s, a) => s + stockOf(n, a), 0);
        acc = {
          codigo_producto: r.codigo_producto,
          nombre_producto: n?.nombre_producto ?? null,
          clasificacion_abc: n?.clasificacion_abc ?? r.clasificacion_abc ?? null,
          demanda: 0, minimo: 0, maximo: 0, reorden: 0,
          stock: stockTotal,
          mixto: false,
        };
        map.set(r.codigo_producto, acc);
      }
      acc.demanda += Number(r.demanda_diaria_hub ?? 0);
      acc.minimo += Number(r.minimo_efectivo ?? 0);
      acc.maximo += Number(r.maximo_efectivo ?? 0);
      acc.reorden += Number(r.cantidad_reorden_efectiva ?? 0);
      if (r.ajustado_manualmente) acc.mixto = true;
    }
    return Array.from(map.values()).sort((a, b) => a.codigo_producto.localeCompare(b.codigo_producto));
  }, [rows, nivMap]);

  const empEstadoKey = (e: (typeof porEmpresa)[number]): "sin_demanda" | "bajo_minimo" | "mixto" | "ok" => {
    if (!(e.demanda > 0)) return "sin_demanda";
    if (e.minimo > 0 && e.stock < e.minimo) return "bajo_minimo";
    if (e.mixto) return "mixto";
    return "ok";
  };

  const empEstadoBadge = (e: (typeof porEmpresa)[number]) => {
    const key = empEstadoKey(e);
    if (key === "sin_demanda") return <Badge variant="outline" className="text-muted-foreground">SIN DEMANDA</Badge>;
    if (key === "bajo_minimo") return <Badge variant="destructive">BAJO MÍNIMO</Badge>;
    if (key === "mixto") return <Badge className="bg-emerald-600 hover:bg-emerald-600">MIXTO</Badge>;
    return <Badge className="bg-blue-600 hover:bg-blue-600">OK</Badge>;
  };

  const empresaFiltrada = useMemo(() => {
    const s = empSearch.toLowerCase().trim();
    return porEmpresa.filter((e) => {
      if (empAbcSel !== "todos" && (e.clasificacion_abc ?? "") !== empAbcSel) return false;
      if (empEstadoSel !== "todos" && empEstadoKey(e) !== empEstadoSel) return false;
      if (s && !`${e.codigo_producto} ${e.nombre_producto ?? ""}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [porEmpresa, empAbcSel, empEstadoSel, empSearch]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-end gap-4">
        <Button onClick={recalcularTodo} disabled={recalculating} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${recalculating ? "animate-spin" : ""}`} />
          Recalcular todo
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="SKUs con mínimo calc." value={kpis.conMin} />
        <KpiCard label="Ajustados manualmente" value={kpis.manuales} accent="emerald" />
        <KpiCard label="Bajo mínimo ahora" value={kpis.bajoMin} accent="red" />
        <KpiCard label="Sin dato de demanda" value={kpis.sinDem} accent="muted" />
      </div>

      <Tabs defaultValue="plaza" className="space-y-6">
        <TabsList>
          <TabsTrigger value="plaza">Por Plaza</TabsTrigger>
          <TabsTrigger value="empresa">Por Empresa</TabsTrigger>
        </TabsList>

        <TabsContent value="plaza" className="space-y-6 mt-0">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Almacén</Label>
            <Select value={almacenSel} onValueChange={setAlmacenSel}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="1001">Mexicali (hub)</SelectItem>
                <SelectItem value="1002">Tijuana (hub)</SelectItem>
                <SelectItem value="1003">Morelos</SelectItem>
                <SelectItem value="1004">Ensenada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Clase ABC</Label>
            <Select value={abcSel} onValueChange={setAbcSel}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="A">A</SelectItem>
                <SelectItem value="B">B</SelectItem>
                <SelectItem value="C">C</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Ajuste</Label>
            <Select value={ajusteSel} onValueChange={setAjusteSel}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="manual">Solo ajustados manualmente</SelectItem>
                <SelectItem value="sin_ajustar">Solo sin ajustar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Estado</Label>
            <Select value={estadoSel} onValueChange={setEstadoSel}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="sin_demanda">Sin demanda</SelectItem>
                <SelectItem value="bajo_minimo">Bajo mínimo</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="ok">OK</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[240px]">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Búsqueda</Label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Código o nombre..." className="pl-8" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-gradient-to-r from-violet-50 to-blue-50">
              <TableRow>
                <Th>ABC</Th>
                <Th>Código</Th>
                <Th>Producto</Th>
                <Th>Almacén</Th>
                <Th className="text-right">Dem/día</Th>
                <Th className="text-right">Dem/mes</Th>
                <Th className="text-right">Lead</Th>
                <Th className="text-right">Seg.</Th>
                <Th className="text-right">Mín calc</Th>
                <Th className="text-right">Mín efect.</Th>
                <Th className="text-right">Máx efect.</Th>
                <Th className="text-right">Stock</Th>
                <Th className="text-right">Reorden</Th>
                <Th>Estado</Th>
                <Th></Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={15} className="text-center py-10 text-muted-foreground">Cargando...</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={15} className="text-center py-10 text-muted-foreground">Sin resultados</TableCell></TableRow>
              )}
              {filtered.map((r, i) => {
                const n = nivMap.get(r.codigo_producto);
                const stock = stockOf(n, r.almacen);
                const bajo = r.minimo_efectivo > 0 && stock < r.minimo_efectivo;
                const ddiaMes = (r.demanda_diaria_hub ?? 0) * 30;
                return (
                  <TableRow key={r.id} className={i % 2 === 0 ? "bg-background hover:bg-blue-50/40" : "bg-muted/20 hover:bg-blue-50/40"}>
                    <TableCell>{abcBadge(r.clasificacion_abc)}</TableCell>
                    <TableCell className="font-mono text-xs">{r.codigo_producto}</TableCell>
                    <TableCell className="text-xs max-w-[280px] truncate" title={n?.nombre_producto ?? ""}>{n?.nombre_producto ?? "—"}</TableCell>
                    <TableCell className="text-xs">{ALMACEN_LABELS[r.almacen] ?? r.almacen}</TableCell>
                    <TableCell className="text-right tabular-nums">{(r.demanda_diaria_hub ?? 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{ddiaMes.toFixed(0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.lead_time_dias}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.dias_stock_seguridad}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{Number(r.minimo_calc).toFixed(0)}</TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${r.minimo_manual != null ? "text-emerald-700" : "text-blue-700"}`}>{Number(r.minimo_efectivo).toFixed(0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(r.maximo_efectivo).toFixed(0)}</TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${bajo ? "text-red-600" : "text-emerald-700"}`}>{stock.toFixed(0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(r.cantidad_reorden_efectiva).toFixed(0)}</TableCell>
                    <TableCell>{estadoBadge(r)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                        <Sliders className="h-3.5 w-3.5 mr-1" /> Ajustar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="empresa" className="space-y-4 mt-0">
          <p className="text-xs text-muted-foreground font-light">
            Vista consolidada de las 4 plazas (Mexicali, Tijuana, Morelos, Ensenada). Útil para decidir cuánto pedir en total antes de repartir por plaza o hacer traspasos internos.
          </p>
          <Card>
            <CardContent className="p-4 flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Clase ABC</Label>
                <Select value={empAbcSel} onValueChange={setEmpAbcSel}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="A">A</SelectItem>
                    <SelectItem value="B">B</SelectItem>
                    <SelectItem value="C">C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Estado</Label>
                <Select value={empEstadoSel} onValueChange={setEmpEstadoSel}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="sin_demanda">Sin demanda</SelectItem>
                    <SelectItem value="bajo_minimo">Bajo mínimo</SelectItem>
                    <SelectItem value="mixto">Mixto</SelectItem>
                    <SelectItem value="ok">OK</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[240px]">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Búsqueda</Label>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={empSearch} onChange={(e) => setEmpSearch(e.target.value)} placeholder="Código o nombre..." className="pl-8" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-gradient-to-r from-violet-50 to-blue-50">
                  <TableRow>
                    <Th>ABC</Th>
                    <Th>Código</Th>
                    <Th>Producto</Th>
                    <Th className="text-right">Dem/día</Th>
                    <Th className="text-right">Dem/mes</Th>
                    <Th className="text-right">Mínimo total</Th>
                    <Th className="text-right">Máximo total</Th>
                    <Th className="text-right">Stock total</Th>
                    <Th className="text-right">Reorden total</Th>
                    <Th>Estado</Th>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">Cargando...</TableCell></TableRow>
                  )}
                  {!isLoading && empresaFiltrada.length === 0 && (
                    <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">Sin resultados</TableCell></TableRow>
                  )}
                  {empresaFiltrada.map((e, i) => {
                    const bajo = e.minimo > 0 && e.stock < e.minimo;
                    return (
                      <TableRow key={e.codigo_producto} className={i % 2 === 0 ? "bg-background hover:bg-blue-50/40" : "bg-muted/20 hover:bg-blue-50/40"}>
                        <TableCell>{abcBadge(e.clasificacion_abc)}</TableCell>
                        <TableCell className="font-mono text-xs">{e.codigo_producto}</TableCell>
                        <TableCell className="text-xs max-w-[280px] truncate" title={e.nombre_producto ?? ""}>{e.nombre_producto ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{e.demanda.toFixed(2)}</TableCell>
                        <TableCell className="text-right tabular-nums">{(e.demanda * 30).toFixed(0)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-blue-700">{e.minimo.toFixed(0)}</TableCell>
                        <TableCell className="text-right tabular-nums">{e.maximo.toFixed(0)}</TableCell>
                        <TableCell className={`text-right tabular-nums font-medium ${bajo ? "text-red-600" : "text-emerald-700"}`}>{e.stock.toFixed(0)}</TableCell>
                        <TableCell className="text-right tabular-nums">{e.reorden.toFixed(0)}</TableCell>
                        <TableCell>{empEstadoBadge(e)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AjusteManualDialog editing={editing} onClose={() => setEditing(null)} nivMap={nivMap} />
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: number; accent?: "red" | "emerald" | "muted" }) {
  const color = accent === "red" ? "text-red-600" : accent === "emerald" ? "text-emerald-700" : accent === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground font-light">{label}</div>
        <div className={`text-2xl font-light mt-1 ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <TableHead className={`uppercase tracking-wide text-xs font-medium ${className ?? ""}`}>{children}</TableHead>;
}

export function AjusteManualDialog({
  editing,
  onClose,
  nivMap,
}: {
  editing: Row | null;
  onClose: () => void;
  nivMap: Map<string, NivelRow>;
}) {
  const qc = useQueryClient();
  const [minM, setMinM] = useState<string>("");
  const [maxM, setMaxM] = useState<string>("");
  const [reoM, setReoM] = useState<string>("");
  const [notas, setNotas] = useState<string>("");
  const [marcado, setMarcado] = useState<boolean>(false);
  const [fuente, setFuente] = useState<string>("");
  const [leadT, setLeadT] = useState<string>("");

  const guardar = useMutation({
    mutationFn: async (vals: { id: string; codigo_producto?: string; fuente_suministro?: string | null; lead_time_dias?: number | null; minimo_manual: number | null; maximo_manual: number | null; cantidad_reorden_manual: number | null; notas: string; ajustado_manualmente: boolean }) => {
      const { error } = await (supabase as any)
        .from("inv_minmax")
        .update({
          minimo_manual: vals.minimo_manual,
          maximo_manual: vals.maximo_manual,
          cantidad_reorden_manual: vals.cantidad_reorden_manual,
          notas: vals.notas || null,
          ajustado_manualmente: vals.ajustado_manualmente,
        })
        .eq("id", vals.id);
      if (error) throw error;

      // Campos a nivel producto (inv_niveles_inventario) + recálculo de las 4 plazas
      if (vals.codigo_producto) {
        const codigo = vals.codigo_producto;
        const nivUpd: any = {};
        if (vals.fuente_suministro !== undefined) nivUpd.fuente_suministro = vals.fuente_suministro;
        if (vals.lead_time_dias !== undefined) nivUpd.lead_time_dias = vals.lead_time_dias;
        if (Object.keys(nivUpd).length > 0) {
          const { error: e2 } = await (supabase as any)
            .from("inv_niveles_inventario")
            .update(nivUpd)
            .eq("codigo_producto", codigo);
          if (e2) throw e2;
        }

        const n = nivMap.get(codigo);
        const lead = Number(vals.lead_time_dias ?? n?.lead_time_dias ?? 10) || 10;
        const ppt = Math.max(1, Number(n?.piezas_por_tarima ?? 1) || 1);

        const { data: dem } = await (supabase as any)
          .from("inv_demanda_plaza")
          .select("codigo_producto, almacen, demanda_diaria_promedio, periodo_inicio")
          .eq("codigo_producto", codigo)
          .order("periodo_inicio", { ascending: false });
        const ultimaDem = new Map<string, number>();
        for (const d of (dem || [])) {
          if (!ultimaDem.has(d.almacen)) ultimaDem.set(d.almacen, Number(d.demanda_diaria_promedio || 0));
        }

        const { data: mmRows } = await (supabase as any)
          .from("inv_minmax")
          .select("*")
          .eq("codigo_producto", codigo);

        const hoyIso = new Date().toISOString().slice(0, 10);
        for (const r of ((mmRows || []) as Row[])) {
          const ddia = ultimaDem.get(r.almacen) ?? Number(r.demanda_diaria_hub ?? 0);
          const abc = n?.clasificacion_abc ?? r.clasificacion_abc ?? null;
          const cobertura = abc && COBERTURA[abc] ? COBERTURA[abc] : 45;
          const seguridad = abc && SEGURIDAD[abc] ? SEGURIDAD[abc] : 10;
          const minCalc = Math.ceil((ddia * (lead + seguridad)) / ppt) * ppt;
          const maxCalc = Math.ceil((ddia * (lead + cobertura)) / ppt) * ppt;
          const stock = stockOf(n, r.almacen);
          const reordenCalc = Math.max(0, minCalc - stock);
          await (supabase as any).from("inv_minmax").update({
            lead_time_dias: lead,
            dias_cobertura_objetivo: cobertura,
            dias_stock_seguridad: seguridad,
            minimo_calc: minCalc,
            maximo_calc: maxCalc,
            cantidad_reorden_calc: reordenCalc,
            ultima_actualizacion_calc: hoyIso,
          }).eq("id", r.id);
        }
      }
    },
    onSuccess: () => {
      toast.success("Ajuste guardado");
      qc.invalidateQueries({ queryKey: ["inv_minmax"] });
      qc.invalidateQueries({ queryKey: ["inv_niveles_inventario_min"] });
      onClose();
    },
    onError: (e: any) => toast.error("Error: " + (e?.message || "")),
  });

  // Resetear inputs cuando cambia editing
  useEffect(() => {
    setMinM(editing?.minimo_manual != null ? String(editing.minimo_manual) : "");
    setMaxM(editing?.maximo_manual != null ? String(editing.maximo_manual) : "");
    setReoM(editing?.cantidad_reorden_manual != null ? String(editing.cantidad_reorden_manual) : "");
    setNotas(editing?.notas ?? "");
    setMarcado(editing?.ajustado_manualmente ?? false);
    const niv = editing ? nivMap.get(editing.codigo_producto) : undefined;
    setFuente(niv?.fuente_suministro ?? "");
    setLeadT(niv?.lead_time_dias != null ? String(niv.lead_time_dias) : (editing?.lead_time_dias != null ? String(editing.lead_time_dias) : ""));
  }, [editing, nivMap]);

  if (!editing) return null;
  const n = nivMap.get(editing.codigo_producto);

  const toNum = (s: string): number | null => {
    if (s.trim() === "") return null;
    const v = Number(s);
    return Number.isFinite(v) ? v : null;
  };

  const limpiarManual = () => {
    setMinM(""); setMaxM(""); setReoM(""); setMarcado(false);
  };

  const onSave = () => {
    const min = toNum(minM);
    const max = toNum(maxM);
    const reo = toNum(reoM);
    const hayAjuste = min != null || max != null || reo != null;
    guardar.mutate({
      id: editing.id,
      codigo_producto: editing.codigo_producto,
      fuente_suministro: fuente || null,
      lead_time_dias: toNum(leadT),
      minimo_manual: min,
      maximo_manual: max,
      cantidad_reorden_manual: reo,
      notas,
      ajustado_manualmente: marcado || hayAjuste,
    });
  };

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 -m-6 mb-0 p-6 rounded-t-lg">
          <DialogTitle className="uppercase tracking-wide text-sm font-medium">Ajustar mínimos y máximos</DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Info label="Código" value={editing.codigo_producto} mono />
            <Info label="Almacén" value={ALMACEN_LABELS[editing.almacen] ?? editing.almacen} />
            <Info label="Producto" value={n?.nombre_producto ?? "—"} colSpan />
            <Info label="ABC" value={editing.clasificacion_abc ?? "—"} />
            <Info label="Demanda diaria" value={(editing.demanda_diaria_hub ?? 0).toFixed(2)} />
            <Info label="Lead time" value={`${editing.lead_time_dias} días`} />
            <Info label="Stock seguridad" value={`${editing.dias_stock_seguridad} días`} />
            <Info label="Mín calc" value={Number(editing.minimo_calc).toFixed(0)} />
            <Info label="Máx calc" value={Number(editing.maximo_calc).toFixed(0)} />
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Valores manuales (vacío = usar cálculo)</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Mínimo manual</Label>
                <Input type="number" min="0" value={minM} onChange={(e) => setMinM(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Máximo manual</Label>
                <Input type="number" min="0" value={maxM} onChange={(e) => setMaxM(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Reorden manual</Label>
                <Input type="number" min="0" value={reoM} onChange={(e) => setReoM(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notas</Label>
              <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Parámetros del producto (aplican a todas las plazas)</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Fuente de Suministro</Label>
                <Select value={fuente} onValueChange={setFuente}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usa">USA</SelectItem>
                    <SelectItem value="cedis">CEDIS</SelectItem>
                    <SelectItem value="closa">CLOSA</SelectItem>
                    <SelectItem value="europe">EUROPE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Lead Time (días)</Label>
                <Input type="number" min="0" value={leadT} onChange={(e) => setLeadT(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={marcado} onCheckedChange={setMarcado} id="ajuste-manual" />
                <Label htmlFor="ajuste-manual" className="text-xs">Marcar como ajustado manualmente</Label>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={limpiarManual}>
                Limpiar ajuste manual
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter className="bg-muted/30 -m-6 mt-0 p-4 rounded-b-lg">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onSave} disabled={guardar.isPending}>{guardar.isPending ? "Guardando..." : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value, mono, colSpan }: { label: string; value: any; mono?: boolean; colSpan?: boolean }) {
  return (
    <div className={colSpan ? "col-span-2" : ""}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-light">{label}</div>
      <div className={`text-sm ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}