import { useMemo, useState } from "react";
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

type Row = {
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

type NivelRow = {
  codigo_producto: string;
  nombre_producto: string | null;
  clasificacion_abc: string | null;
  lead_time_dias: number | null;
  piezas_por_tarima: number | null;
  stock_almacen_1001: number | null;
  stock_almacen_1002: number | null;
  stock_almacen_1003: number | null;
  stock_almacen_1004: number | null;
};

const stockOf = (n: NivelRow | undefined, alm: string) =>
  Number((n as any)?.[`stock_almacen_${alm}`] ?? 0);

export default function MinMaxInventario() {
  const qc = useQueryClient();
  const [almacenSel, setAlmacenSel] = useState<string>("todos");
  const [abcSel, setAbcSel] = useState<string>("todos");
  const [ajusteSel, setAjusteSel] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [recalculating, setRecalculating] = useState(false);

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
        .select("codigo_producto, nombre_producto, clasificacion_abc, lead_time_dias, piezas_por_tarima, stock_almacen_1001, stock_almacen_1002, stock_almacen_1003, stock_almacen_1004");
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
      if (s) {
        const n = nivMap.get(r.codigo_producto);
        const text = `${r.codigo_producto} ${n?.nombre_producto ?? ""}`.toLowerCase();
        if (!text.includes(s)) return false;
      }
      return true;
    });
  }, [rows, almacenSel, abcSel, ajusteSel, search, nivMap]);

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

  const guardar = useMutation({
    mutationFn: async (vals: { id: string; minimo_manual: number | null; maximo_manual: number | null; cantidad_reorden_manual: number | null; notas: string; ajustado_manualmente: boolean }) => {
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
    },
    onSuccess: () => {
      toast.success("Ajuste guardado");
      qc.invalidateQueries({ queryKey: ["inv_minmax"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error("Error: " + (e?.message || "")),
  });

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
        const lead = Number(n?.lead_time_dias ?? r.lead_time_dias ?? 32) || 32;
        const ppt = Math.max(1, Number(n?.piezas_por_tarima ?? 1) || 1);
        const minCalc = Math.ceil((ddia * (lead + seguridad)) / ppt) * ppt;
        const maxCalc = Math.ceil((ddia * (lead + cobertura)) / ppt) * ppt;
        const stock = stockOf(n, r.almacen);
        const reordenCalc = Math.max(0, maxCalc - stock);
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

  const estadoBadge = (r: Row) => {
    if (!(r.demanda_diaria_hub && r.demanda_diaria_hub > 0)) {
      return <Badge variant="outline" className="text-muted-foreground">SIN DEMANDA</Badge>;
    }
    const stock = stockOf(nivMap.get(r.codigo_producto), r.almacen);
    if (r.minimo_efectivo > 0 && stock < r.minimo_efectivo) {
      return <Badge variant="destructive">BAJO MÍNIMO</Badge>;
    }
    if (r.ajustado_manualmente) return <Badge className="bg-emerald-600 hover:bg-emerald-600">MANUAL</Badge>;
    return <Badge className="bg-blue-600 hover:bg-blue-600">OK</Badge>;
  };

  const abcBadge = (abc: string | null) => {
    if (!abc) return <span className="text-muted-foreground">—</span>;
    const cls = abc === "A" ? "bg-red-100 text-red-700" : abc === "B" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700";
    return <Badge variant="outline" className={cls}>{abc}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-light tracking-tight">Mínimos y Máximos</h1>
          <p className="text-sm text-muted-foreground">Revisión y ajuste de niveles de reorden por SKU y almacén.</p>
        </div>
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

      <AjusteDialog editing={editing} setEditing={setEditing} guardar={guardar} nivMap={nivMap} />
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

function AjusteDialog({
  editing,
  setEditing,
  guardar,
  nivMap,
}: {
  editing: Row | null;
  setEditing: (r: Row | null) => void;
  guardar: ReturnType<typeof useMutation<any, any, any>>;
  nivMap: Map<string, NivelRow>;
}) {
  const [minM, setMinM] = useState<string>("");
  const [maxM, setMaxM] = useState<string>("");
  const [reoM, setReoM] = useState<string>("");
  const [notas, setNotas] = useState<string>("");
  const [marcado, setMarcado] = useState<boolean>(false);

  // Resetear inputs cuando cambia editing
  useMemo(() => {
    setMinM(editing?.minimo_manual != null ? String(editing.minimo_manual) : "");
    setMaxM(editing?.maximo_manual != null ? String(editing.maximo_manual) : "");
    setReoM(editing?.cantidad_reorden_manual != null ? String(editing.cantidad_reorden_manual) : "");
    setNotas(editing?.notas ?? "");
    setMarcado(editing?.ajustado_manualmente ?? false);
    return null;
  }, [editing]);

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
      minimo_manual: min,
      maximo_manual: max,
      cantidad_reorden_manual: reo,
      notas,
      ajustado_manualmente: marcado || hayAjuste,
    });
  };

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
      <DialogContent className="max-w-2xl">
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
          <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
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