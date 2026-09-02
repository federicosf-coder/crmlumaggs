import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useCanViewCostos } from "@/hooks/useCanViewCostos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Search, ArrowUpDown, ArrowUp, ArrowDown, Package, AlertTriangle, DollarSign, Calendar, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Row = {
  codigo: string;
  nombre: string;
  empresa: string | null;
  abc: string | null;
  s1001: number; s1002: number; s1003: number; s1004: number; stock_total: number;
  v1001: number; v1002: number; v1003: number; v1004: number;
  dem_dia: number;
  dias_inv: number | null;
  costo_prom: number | null;
  ultimo_costo: number | null;
  minimo: number | null;
  maximo: number | null;
  alerta: "bajo" | "rango" | "normal" | "sobre";
};

type SortKey = keyof Row;

const fmtMoney = (n: number | null | undefined) =>
  n == null || isNaN(Number(n)) ? "—" : `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtNum = (n: number | null | undefined, dec = 0) =>
  n == null || isNaN(Number(n)) ? "—" : Number(n).toLocaleString("es-MX", { minimumFractionDigits: dec, maximumFractionDigits: dec });

function empresaBadge(e: string | null) {
  if (!e) return <span className="text-muted-foreground text-xs">—</span>;
  const isLum = /lumaggs/i.test(e);
  const isGal = /galsa/i.test(e);
  const cls = isLum ? "bg-blue-100 text-blue-700 border-blue-200"
    : isGal ? "bg-red-100 text-red-700 border-red-200"
    : "bg-slate-100 text-slate-700 border-slate-200";
  return <Badge variant="outline" className={`text-[10px] font-medium ${cls}`}>{isLum ? "Lumaggs" : isGal ? "Galsa" : e}</Badge>;
}

function abcBadge(c: string | null) {
  if (!c) return <span className="text-muted-foreground text-xs">—</span>;
  const map: Record<string, string> = {
    A: "bg-red-100 text-red-700 border-red-200",
    B: "bg-amber-100 text-amber-700 border-amber-200",
    C: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return <Badge variant="outline" className={`text-[10px] font-bold ${map[c] || "bg-muted"}`}>{c}</Badge>;
}

function alertaCell(a: Row["alerta"]) {
  const map = {
    bajo: { icon: "🔴", label: "Bajo mínimo" },
    rango: { icon: "🟡", label: "En rango" },
    normal: { icon: "✅", label: "Normal" },
    sobre: { icon: "🔵", label: "Sobrestock" },
  } as const;
  const v = map[a];
  return <span className="text-xs whitespace-nowrap">{v.icon} {v.label}</span>;
}

function diasInvCell(d: number | null) {
  if (d == null) return <span className="text-muted-foreground text-xs">—</span>;
  const cls = d < 30 ? "text-red-600" : d < 60 ? "text-amber-600" : "text-emerald-600";
  return <span className={`text-sm font-semibold ${cls}`}>{d.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>;
}

function calcAlerta(stock: number, min: number | null, max: number | null): Row["alerta"] {
  if (min != null && stock < min) return "bajo";
  if (max != null && stock > max) return "sobre";
  if (min != null && max != null && stock >= min && stock <= max) return "rango";
  return "normal";
}

type PeriodoOpt = "todo" | "hoy" | "ayer" | "semana" | "mes" | "rango";

export default function ReporteKardex() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reporte de Inventario y Kárdex</h1>
        <p className="text-sm text-muted-foreground font-light">Resumen de existencias, demanda y costos por SKU.</p>
      </div>
      <ReporteKardexTabContent />
    </div>
  );
}

export function ReporteKardexTabContent() {
  const canViewCostos = useCanViewCostos();
  const [loading, setLoading] = useState(true);
  const [niveles, setNiveles] = useState<any[]>([]);
  const [demanda, setDemanda] = useState<any[]>([]);
  const [minmax, setMinmax] = useState<any[]>([]);
  const [costos, setCostos] = useState<any[]>([]);

  const [empresaSel, setEmpresaSel] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [abcSel, setAbcSel] = useState("ALL");
  const [alertaSel, setAlertaSel] = useState("ALL");
  const [periodo, setPeriodo] = useState<PeriodoOpt>("todo");
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("codigo");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const recargar = async () => {
    setLoading(true);
    try {
      const [nv, dp, mm, cp] = await Promise.all([
        (supabase as any).from("inv_niveles_inventario").select("*"),
        (supabase as any).from("inv_demanda_plaza").select("codigo_producto, almacen, unidades_vendidas, demanda_diaria_promedio, periodo_inicio, periodo_fin"),
        (supabase as any).from("inv_minmax").select("codigo_producto, almacen, minimo_calc, maximo_calc"),
        (supabase as any).from("inv_costos_producto").select("codigo_producto, costo_galper, created_at").order("created_at", { ascending: false }),
      ]);
      setNiveles(nv.data || []);
      setDemanda(dp.data || []);
      setMinmax(mm.data || []);
      setCostos(cp.data || []);
    } catch (e: any) {
      toast.error("Error cargando reporte: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { recargar(); }, []);

  const empresasDisponibles = useMemo(() => {
    const s = new Set<string>();
    niveles.forEach(n => { if (n.empresa_vendedora) s.add(n.empresa_vendedora); });
    return Array.from(s).sort();
  }, [niveles]);

  // Más reciente por (codigo, almacen) en demanda
  const demandaMap = useMemo(() => {
    const map = new Map<string, any>(); // key: codigo|almacen
    for (const d of demanda) {
      const k = `${d.codigo_producto}|${d.almacen}`;
      const cur = map.get(k);
      if (!cur || new Date(d.periodo_fin) > new Date(cur.periodo_fin)) map.set(k, d);
    }
    return map;
  }, [demanda]);

  // Período global (max periodo_inicio/fin sobre todos los registros más recientes)
  const periodoGlobal = useMemo(() => {
    let ini: string | null = null;
    let fin: string | null = null;
    for (const d of demandaMap.values()) {
      if (!ini || (d.periodo_inicio && d.periodo_inicio < ini)) ini = d.periodo_inicio;
      if (!fin || (d.periodo_fin && d.periodo_fin > fin)) fin = d.periodo_fin;
    }
    return { ini, fin };
  }, [demandaMap]);

  // Min/max por (codigo, almacen) → tomamos el global (sumamos mínimos/máximos por SKU)
  const minmaxMap = useMemo(() => {
    const map = new Map<string, { min: number; max: number }>();
    for (const m of minmax) {
      const cur = map.get(m.codigo_producto) || { min: 0, max: 0 };
      cur.min += Number(m.minimo_calc || 0);
      cur.max += Number(m.maximo_calc || 0);
      map.set(m.codigo_producto, cur);
    }
    return map;
  }, [minmax]);

  // Último costo galper por código
  const costoMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of costos) {
      if (!map.has(c.codigo_producto) && c.costo_galper != null) map.set(c.codigo_producto, Number(c.costo_galper));
    }
    return map;
  }, [costos]);

  // Filtro de período: aplica a los registros más recientes de demanda
  // Si SKU no tiene demanda en período → ventas/dem = 0 y se incluye igual (salvo período específico = solo SKUs con periodo válido)
  const periodoFiltro = useMemo(() => {
    const now = new Date(); now.setHours(0,0,0,0);
    const today = now.toISOString().slice(0, 10);
    const yest = new Date(now); yest.setDate(yest.getDate() - 1);
    const week = new Date(now); week.setDate(week.getDate() - 7);
    const month = new Date(now); month.setDate(month.getDate() - 30);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    switch (periodo) {
      case "hoy": return { from: today, to: today };
      case "ayer": return { from: fmt(yest), to: fmt(yest) };
      case "semana": return { from: fmt(week), to: today };
      case "mes": return { from: fmt(month), to: today };
      case "rango": return { from: desde || null, to: hasta || null };
      default: return null;
    }
  }, [periodo, desde, hasta]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const n of niveles) {
      const cod = n.codigo_producto;
      const getDem = (alm: string) => {
        const d = demandaMap.get(`${cod}|${alm}`);
        if (!d) return null;
        if (periodoFiltro) {
          const pf = d.periodo_fin;
          const pi = d.periodo_inicio;
          if (periodoFiltro.from && pf < periodoFiltro.from) return null;
          if (periodoFiltro.to && pi && pi > periodoFiltro.to) return null;
          if (periodoFiltro.to && !pi && pf > periodoFiltro.to) return null;
        }
        return d;
      };
      const d1 = getDem("1001"); const d2 = getDem("1002");
      const d3 = getDem("1003"); const d4 = getDem("1004");
      const v1 = Number(d1?.unidades_vendidas || 0);
      const v2 = Number(d2?.unidades_vendidas || 0);
      const v3 = Number(d3?.unidades_vendidas || 0);
      const v4 = Number(d4?.unidades_vendidas || 0);
      const dem = Number(d1?.demanda_diaria_promedio || 0) + Number(d2?.demanda_diaria_promedio || 0)
        + Number(d3?.demanda_diaria_promedio || 0) + Number(d4?.demanda_diaria_promedio || 0);
      const stock = Number(n.stock_total || 0);
      const mm = minmaxMap.get(cod);
      out.push({
        codigo: cod,
        nombre: n.nombre_producto || "",
        empresa: n.empresa_vendedora || null,
        abc: n.clasificacion_abc || null,
        s1001: Number(n.stock_almacen_1001 || 0),
        s1002: Number(n.stock_almacen_1002 || 0),
        s1003: Number(n.stock_almacen_1003 || 0),
        s1004: Number(n.stock_almacen_1004 || 0),
        stock_total: stock,
        v1001: v1, v1002: v2, v1003: v3, v1004: v4,
        dem_dia: dem,
        dias_inv: dem > 0 ? stock / dem : null,
        costo_prom: n.costo_promedio != null ? Number(n.costo_promedio) : null,
        ultimo_costo: costoMap.get(cod) ?? null,
        minimo: mm?.min ?? null,
        maximo: mm?.max ?? null,
        alerta: calcAlerta(stock, mm?.min ?? null, mm?.max ?? null),
      });
    }
    return out;
  }, [niveles, demandaMap, minmaxMap, costoMap, periodoFiltro]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = rows.filter(r => {
      if (empresaSel !== "ALL" && r.empresa !== empresaSel) return false;
      if (q && !(r.codigo.toLowerCase().includes(q) || r.nombre.toLowerCase().includes(q))) return false;
      if (abcSel !== "ALL" && (r.abc || "") !== abcSel) return false;
      if (alertaSel !== "ALL" && r.alerta !== alertaSel) return false;
      return true;
    });
    out = [...out].sort((a, b) => {
      const av = a[sortKey] as any; const bv = b[sortKey] as any;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      const cmp = String(av).localeCompare(String(bv), "es", { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [rows, search, empresaSel, abcSel, alertaSel, sortKey, sortDir]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const conAlerta = filtered.filter(r => r.alerta === "bajo").length;
    const valor = filtered.reduce((s, r) => s + (r.costo_prom || 0) * (r.stock_total || 0), 0);
    const dias = filtered.filter(r => r.dias_inv != null).map(r => r.dias_inv as number);
    const promDias = dias.length ? dias.reduce((a, b) => a + b, 0) / dias.length : 0;
    return { total, conAlerta, valor, promDias };
  }, [filtered]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  }

  function SortHead({ k, children, className = "" }: { k: SortKey; children: React.ReactNode; className?: string }) {
    const active = sortKey === k;
    const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <TableHead className={`cursor-pointer select-none uppercase text-[10px] tracking-wide ${className}`} onClick={() => toggleSort(k)}>
        <span className="inline-flex items-center gap-1">{children}<Icon className="h-3 w-3 opacity-60" /></span>
      </TableHead>
    );
  }

  function exportar() {
    const alertaLabel: Record<Row["alerta"], string> = { bajo: "Bajo mínimo", rango: "En rango", normal: "Normal", sobre: "Sobrestock" };
    const data = filtered.map(r => ({
      "Código": r.codigo,
      "Nombre": r.nombre,
      "Empresa": r.empresa || "",
      "ABC": r.abc || "",
      "Stock MXL": r.s1001,
      "Stock TIJ": r.s1002,
      "Stock MOR": r.s1003,
      "Stock ENS": r.s1004,
      "Stock Total": r.stock_total,
      "Vtas MXL": r.v1001,
      "Vtas TIJ": r.v1002,
      "Vtas MOR": r.v1003,
      "Vtas ENS": r.v1004,
      "Dem/día": Number(r.dem_dia.toFixed(2)),
      "Días Inventario": r.dias_inv != null ? Number(r.dias_inv.toFixed(1)) : "",
      ...(canViewCostos ? { "Costo Promedio": r.costo_prom ?? "" } : {}),
      "Último Costo": r.ultimo_costo ?? "",
      "Alerta": alertaLabel[r.alerta],
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kardex");
    const empresaTag = empresaSel === "ALL" ? "todas" : empresaSel.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    XLSX.writeFile(wb, `reporte_kardex_${empresaTag}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-muted-foreground font-light flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Período del kárdex: {periodoGlobal.ini || "—"} → {periodoGlobal.fin || "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={recargar} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button onClick={exportar} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Descargar Excel ({filtered.length})
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Total SKUs" value={kpis.total.toLocaleString("es-MX")} icon={<Package className="h-4 w-4" />} tone="slate" />
        <Kpi label="SKUs con alerta" value={kpis.conAlerta.toLocaleString("es-MX")} icon={<AlertTriangle className="h-4 w-4" />} tone="red" />
        <Kpi label="Valor total inventario" value={fmtMoney(kpis.valor)} icon={<DollarSign className="h-4 w-4" />} tone="blue" />
        <Kpi label="Días promedio inv." value={kpis.promDias.toFixed(1)} icon={<Calendar className="h-4 w-4" />} tone="amber" />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={empresaSel} onValueChange={setEmpresaSel}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Empresa: Todas</SelectItem>
                {empresasDisponibles.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[220px]">
              <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por código o nombre…" className="pl-8 h-9" />
            </div>
            <Select value={abcSel} onValueChange={setAbcSel}>
              <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ABC: Todas</SelectItem>
                <SelectItem value="A">A</SelectItem>
                <SelectItem value="B">B</SelectItem>
                <SelectItem value="C">C</SelectItem>
              </SelectContent>
            </Select>
            <Select value={alertaSel} onValueChange={setAlertaSel}>
              <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Alerta: Todas</SelectItem>
                <SelectItem value="bajo">🔴 Bajo mínimo</SelectItem>
                <SelectItem value="rango">🟡 En rango</SelectItem>
                <SelectItem value="normal">✅ Normal</SelectItem>
                <SelectItem value="sobre">🔵 Sobrestock</SelectItem>
              </SelectContent>
            </Select>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoOpt)}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">Período: Todo</SelectItem>
                <SelectItem value="hoy">Hoy</SelectItem>
                <SelectItem value="ayer">Ayer</SelectItem>
                <SelectItem value="semana">Esta semana</SelectItem>
                <SelectItem value="mes">Este mes</SelectItem>
                <SelectItem value="rango">Período…</SelectItem>
              </SelectContent>
            </Select>
            {periodo === "rango" && (
              <>
                <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="h-9 w-40" />
                <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="h-9 w-40" />
              </>
            )}
          </div>

          <div className="rounded-md border overflow-auto max-h-[70vh]">
            <Table>
              <TableHeader className="bg-gradient-to-r from-violet-50 to-blue-50 sticky top-0 z-10">
                <TableRow>
                  <SortHead k="codigo" className="sticky left-0 bg-violet-50 z-20">Código</SortHead>
                  <SortHead k="nombre">Nombre</SortHead>
                  <SortHead k="empresa">Empresa</SortHead>
                  <SortHead k="abc">ABC</SortHead>
                  <SortHead k="s1001" className="text-right border-l">MXL</SortHead>
                  <SortHead k="s1002" className="text-right">TIJ</SortHead>
                  <SortHead k="s1003" className="text-right">MOR</SortHead>
                  <SortHead k="s1004" className="text-right">ENS</SortHead>
                  <SortHead k="stock_total" className="text-right">Total</SortHead>
                  <SortHead k="alerta">Alerta</SortHead>
                  <SortHead k="v1001" className="text-right border-l">Vtas MXL</SortHead>
                  <SortHead k="v1002" className="text-right">Vtas TIJ</SortHead>
                  <SortHead k="v1003" className="text-right">Vtas MOR</SortHead>
                  <SortHead k="v1004" className="text-right">Vtas ENS</SortHead>
                  <SortHead k="dem_dia" className="text-right">Dem/día</SortHead>
                  <SortHead k="dias_inv" className="text-right">Días inv.</SortHead>
                  {canViewCostos && <SortHead k="costo_prom" className="text-right border-l">Costo prom. (Kardex)</SortHead>}
                  <SortHead k="ultimo_costo" className="text-right">Precio Galper</SortHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={18} className="text-center text-muted-foreground py-10">Cargando…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={18} className="text-center text-muted-foreground py-10">Sin resultados</TableCell></TableRow>
                ) : filtered.map((r, i) => (
                  <TableRow key={`${r.codigo}-${i}`} className={`hover:bg-blue-50/40 ${i % 2 === 1 ? "bg-muted/20" : ""}`}>
                    <TableCell className="font-mono text-xs sticky left-0 bg-inherit z-10">{r.codigo}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate" title={r.nombre}>{r.nombre}</TableCell>
                    <TableCell>{empresaBadge(r.empresa)}</TableCell>
                    <TableCell>{abcBadge(r.abc)}</TableCell>
                    <TableCell className="text-right text-sm border-l">{fmtNum(r.s1001)}</TableCell>
                    <TableCell className="text-right text-sm">{fmtNum(r.s1002)}</TableCell>
                    <TableCell className="text-right text-sm">{fmtNum(r.s1003)}</TableCell>
                    <TableCell className="text-right text-sm">{fmtNum(r.s1004)}</TableCell>
                    <TableCell className="text-right text-sm font-bold">{fmtNum(r.stock_total)}</TableCell>
                    <TableCell>{alertaCell(r.alerta)}</TableCell>
                    <TableCell className="text-right text-sm border-l">{fmtNum(r.v1001)}</TableCell>
                    <TableCell className="text-right text-sm">{fmtNum(r.v1002)}</TableCell>
                    <TableCell className="text-right text-sm">{fmtNum(r.v1003)}</TableCell>
                    <TableCell className="text-right text-sm">{fmtNum(r.v1004)}</TableCell>
                    <TableCell className="text-right text-sm">{fmtNum(r.dem_dia, 2)}</TableCell>
                    <TableCell className="text-right">{diasInvCell(r.dias_inv)}</TableCell>
                    {canViewCostos && <TableCell className="text-right text-sm border-l">{fmtMoney(r.costo_prom)}</TableCell>}
                    <TableCell className="text-right text-sm">{fmtMoney(r.ultimo_costo)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: "slate" | "blue" | "amber" | "red" }) {
  const tones: Record<string, string> = {
    slate: "from-slate-50 to-slate-100 text-slate-700 border-slate-200",
    blue: "from-blue-50 to-blue-100 text-blue-700 border-blue-200",
    amber: "from-amber-50 to-amber-100 text-amber-800 border-amber-200",
    red: "from-red-50 to-red-100 text-red-700 border-red-200",
  };
  return (
    <Card className={`bg-gradient-to-br ${tones[tone]} border`}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-medium uppercase tracking-wide">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}