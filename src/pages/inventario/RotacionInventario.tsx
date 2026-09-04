import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useCanViewCostos } from "@/hooks/useCanViewCostos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Download, Search, ArrowUpDown, ArrowUp, ArrowDown, Package, AlertTriangle, Star, RefreshCw, Clock, AlertOctagon, HelpCircle, FileText, CheckCircle2, PanelLeftClose, PanelLeftOpen, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { generateRotacionInventarioPdf } from "@/lib/generateRotacionInventarioPdf";

type Clasificacion =
  | "estrella"
  | "normal"
  | "en_riesgo"
  | "estancado"
  | "sin_movimiento";

type Velocidad = "rapido" | "medio" | "lento" | "sin_movimiento";

type Row = {
  id: string;
  codigo: string;
  nombre: string;
  marca: string;
  presentacion: string;
  categoria: string;
  linea: string;
  velocidad: Velocidad;
  s1001: number; s1002: number; s1003: number; s1004: number; stock_total: number;
  costo_prom: number | null;
  valor_stock: number;
  ue: number;
  pct: number;
  meses_con_venta: number;
  ultima_venta: string | null;
  clasificacion: Clasificacion;
};

const VELOCIDAD_LABEL: Record<Velocidad, string> = {
  rapido: "Rápido (1-2m)",
  medio: "Medio (3-6m)",
  lento: "Lento (6-12m+)",
  sin_movimiento: "Sin movimiento",
};

type GroupKey = "marca" | "categoria" | "linea" | "velocidad" | "none";

const GROUP_OPTIONS: { value: GroupKey; label: string }[] = [
  { value: "none", label: "Ninguno" },
  { value: "marca", label: "Marca" },
  { value: "categoria", label: "Categoría" },
  { value: "linea", label: "Línea" },
  { value: "velocidad", label: "Velocidad de rotación" },
];

type GroupNode = {
  label: string;
  level: number;
  count: number;
  valor: number;
  children: GroupNode[];
  rows: Row[];
};

function groupValue(r: Row, k: GroupKey): string {
  if (k === "marca") return r.marca || "Sin marca";
  if (k === "categoria") return r.categoria;
  if (k === "linea") return r.linea;
  if (k === "velocidad") return VELOCIDAD_LABEL[r.velocidad];
  return "";
}

function groupRows(rows: Row[], keys: GroupKey[], level = 0): GroupNode[] {
  if (!keys.length) return [];
  const [k, ...rest] = keys;
  const map = new Map<string, Row[]>();
  for (const r of rows) {
    const v = groupValue(r, k);
    const arr = map.get(v) || [];
    arr.push(r);
    map.set(v, arr);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "es"))
    .map(([label, items]) => ({
      label,
      level,
      count: items.length,
      valor: items.reduce((s, r) => s + r.valor_stock, 0),
      children: rest.length ? groupRows(items, rest, level + 1) : [],
      rows: rest.length ? [] : items,
    }));
}


type SortKey = keyof Row;

const fmtMoney = (n: number | null | undefined) =>
  n == null || isNaN(Number(n)) ? "—" : `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtNum = (n: number | null | undefined, dec = 0) =>
  n == null || isNaN(Number(n)) ? "—" : Number(n).toLocaleString("es-MX", { minimumFractionDigits: dec, maximumFractionDigits: dec });

const CLAS_LABEL: Record<Clasificacion, string> = {
  estrella: "⭐ Estrella",
  normal: "Normal (<3m)",
  en_riesgo: "En Riesgo (3-6m)",
  estancado: "Estancado (6-12m)",
  sin_movimiento: "Sin Movimiento (12m+ o nunca vendido)",
};

const CLAS_ORDER: Clasificacion[] = [
  "estrella",
  "normal",
  "en_riesgo",
  "estancado",
  "sin_movimiento",
];

const CLAS_STYLE: Record<Clasificacion, string> = {
  estrella: "bg-violet-100 text-violet-700 border-violet-200",
  normal: "bg-emerald-100 text-emerald-700 border-emerald-200",
  en_riesgo: "bg-orange-100 text-orange-700 border-orange-200",
  estancado: "bg-red-100 text-red-700 border-red-200",
  sin_movimiento: "bg-slate-100 text-slate-600 border-slate-200",
};

function clasificacionBadge(c: Clasificacion) {
  return <Badge variant="outline" className={`text-[10px] font-medium whitespace-nowrap ${CLAS_STYLE[c]}`}>{CLAS_LABEL[c]}</Badge>;
}

async function fetchAll(build: () => any) {
  const out: any[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await build().range(from, from + size - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < size) break;
  }
  return out;
}

function pad(n: number) { return String(n).padStart(2, "0"); }

export default function RotacionInventario() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rotación de Inventario</h1>
        <p className="text-sm text-muted-foreground font-light">Clasificación de productos por rotación de ventas registradas en el Kárdex.</p>
      </div>
      <RotacionInventarioTabContent />
    </div>
  );
}

export function RotacionInventarioTabContent() {
  const canViewCostos = useCanViewCostos();
  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState<any[]>([]);
  const [marcas, setMarcas] = useState<Map<string, string>>(new Map());
  const [categoriaMap, setCategoriaMap] = useState<Map<string, string>>(new Map());
  const [lineaMap, setLineaMap] = useState<Map<string, string>>(new Map());
  const [presentaciones, setPresentaciones] = useState<Map<string, string>>(new Map());
  const [niveles, setNiveles] = useState<any[]>([]);
  const [fechasVenta, setFechasVenta] = useState<any[]>([]);
  const [demanda, setDemanda] = useState<any[]>([]);

  const [marcaSel, setMarcaSel] = useState("ALL");
  const [clasSel, setClasSel] = useState<Clasificacion[]>([...CLAS_ORDER]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("ue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [groupLevels, setGroupLevels] = useState<GroupKey[]>(["none", "none", "none", "none"]);
  const [filtrosVisibles, setFiltrosVisibles] = useState(true);
  const [soloConExistencia, setSoloConExistencia] = useState(false);

  const { desde, hasta, hace3Meses } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const tres = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    return {
      desde: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`,
      hasta: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      hace3Meses: `${tres.getFullYear()}-${pad(tres.getMonth() + 1)}-${pad(tres.getDate())}`,
    };
  }, []);

  const recargar = async () => {
    setLoading(true);
    try {
      const [prods, opts, pres, nv, fv, dm] = await Promise.all([
        fetchAll(() => (supabase as any).from("productos").select("id, codigo, nombre_producto, marca_id, categoria_id, linea_id, presentacion_id").eq("is_active", true).order("codigo")),
        (supabase as any).from("product_option_values").select("id, value, option_type").in("option_type", ["marca", "categoria", "linea"]),
        fetchAll(() => (supabase as any).from("presentaciones").select("id, nombre")),
        fetchAll(() => (supabase as any).from("inv_niveles_inventario").select("codigo_producto, stock_almacen_1001, stock_almacen_1002, stock_almacen_1003, stock_almacen_1004, stock_total, costo_promedio")),
        fetchAll(() => (supabase as any).from("inv_kardex_fechas_venta").select("codigo_producto, almacen, fecha, cantidad")),
        fetchAll(() => (supabase as any).from("inv_demanda_plaza").select("codigo_producto, almacen, periodo_fin, demanda_mensual_promedio, ultima_venta")),
      ]);
      setProductos(prods);
      const allOpts = ((opts.data || []) as any[]);
      const mapOf = (t: string) => new Map(allOpts.filter((o) => o.option_type === t).map((o) => [o.id, o.value] as [string, string]));
      setMarcas(mapOf("marca"));
      setCategoriaMap(mapOf("categoria"));
      setLineaMap(mapOf("linea"));
      setPresentaciones(new Map((pres || []).map((p: any) => [p.id, p.nombre] as [string, string])));
      setNiveles(nv);
      setFechasVenta(fv);
      setDemanda(dm);
    } catch (e: any) {
      toast.error("Error cargando rotación: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { recargar(); }, []);

  const nivelesMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const n of niveles) if (!m.has(n.codigo_producto)) m.set(n.codigo_producto, n);
    return m;
  }, [niveles]);

  // Por código: última venta real, meses con venta y si hay venta en los últimos 3 meses
  const kardexMap = useMemo(() => {
    const m = new Map<string, { ultima: string | null; meses: Set<string>; reciente: boolean }>();
    for (const f of fechasVenta) {
      const cod = f.codigo_producto;
      if (!cod) continue;
      const fecha: string | null = f.fecha ?? null;
      const cur = m.get(cod) ?? { ultima: null, meses: new Set<string>(), reciente: false };
      if (fecha) {
        if (!cur.ultima || fecha > cur.ultima) cur.ultima = fecha;
        cur.meses.add(fecha.slice(0, 7));
        if (fecha >= hace3Meses) cur.reciente = true;
      }
      m.set(cod, cur);
    }
    return m;
  }, [fechasVenta, hace3Meses]);

  // Por código: suma de (demanda_mensual_promedio * 12) tomando por almacén la fila con periodo_fin más reciente
  const demandaMap = useMemo(() => {
    const latest = new Map<string, any>();
    for (const d of demanda) {
      const k = `${d.codigo_producto}|${d.almacen}`;
      const prev = latest.get(k);
      if (!prev || String(d.periodo_fin || "") > String(prev.periodo_fin || "")) latest.set(k, d);
    }
    const m = new Map<string, number>();
    for (const d of latest.values()) {
      const ue = Number(d.demanda_mensual_promedio || 0) * 12;
      m.set(d.codigo_producto, (m.get(d.codigo_producto) || 0) + ue);
    }
    return m;
  }, [demanda]);

  const rows = useMemo<Row[]>(() => {
    const base = productos.map((p) => {
      const k = kardexMap.get(p.codigo);
      const n = nivelesMap.get(p.codigo);
      const costo = n?.costo_promedio != null ? Number(n.costo_promedio) : null;
      const stock_total = Number(n?.stock_total || 0);
      const ue = Number(demandaMap.get(p.codigo) || 0);
      const demandaMensual = ue / 12;
      let velocidad: Velocidad;
      if (demandaMensual <= 0) velocidad = "sin_movimiento";
      else {
        const coberturaMeses = stock_total / demandaMensual;
        velocidad = coberturaMeses <= 2 ? "rapido" : coberturaMeses <= 6 ? "medio" : "lento";
      }
      return {
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre_producto || "",
        marca: marcas.get(p.marca_id) || "",
        presentacion: presentaciones.get(p.presentacion_id) || "—",
        categoria: categoriaMap.get(p.categoria_id) || "Sin categoría",
        linea: lineaMap.get(p.linea_id) || "Sin línea",
        velocidad,
        s1001: Number(n?.stock_almacen_1001 || 0),
        s1002: Number(n?.stock_almacen_1002 || 0),
        s1003: Number(n?.stock_almacen_1003 || 0),
        s1004: Number(n?.stock_almacen_1004 || 0),
        stock_total,
        costo_prom: costo,
        valor_stock: (costo || 0) * stock_total,
        ue,
        pct: 0,
        meses_con_venta: k?.meses.size || 0,
        ultima_venta: k?.ultima ?? null,
        clasificacion: "sin_movimiento" as Clasificacion,
      };
    });

    const conVenta = base.filter((r) => r.ue > 0).sort((a, b) => b.ue - a.ue);
    const total = conVenta.reduce((s, r) => s + r.ue, 0);
    let acc = 0;
    let reached = false;
    const top80 = new Set<string>();
    for (const r of conVenta) {
      acc += r.ue;
      if (!reached) top80.add(r.id);
      if (total > 0 && (acc / total) * 100 >= 80) reached = true;
    }

    const hoy = new Date();
    for (const r of base) {
      r.pct = total > 0 ? (r.ue / total) * 100 : 0;
      const k = kardexMap.get(r.codigo);

      if (!k?.ultima) {
        r.clasificacion = "sin_movimiento";
        continue;
      }

      const ult = new Date(`${k.ultima}T00:00:00`);
      const meses = (hoy.getFullYear() - ult.getFullYear()) * 12 + (hoy.getMonth() - ult.getMonth());
      if (meses < 3) r.clasificacion = top80.has(r.id) ? "estrella" : "normal";
      else if (meses < 6) r.clasificacion = "en_riesgo";
      else if (meses < 12) r.clasificacion = "estancado";
      else r.clasificacion = "sin_movimiento";
    }
    return base;
  }, [productos, kardexMap, demandaMap, nivelesMap, marcas, categoriaMap, lineaMap, presentaciones]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (marcaSel !== "ALL" && r.marca !== marcaSel) return false;
      if (!clasSel.includes(r.clasificacion)) return false;
      if (q && !(r.codigo.toLowerCase().includes(q) || r.nombre.toLowerCase().includes(q))) return false;
      if (soloConExistencia && !(r.stock_total > 0)) return false;
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
  }, [rows, search, marcaSel, clasSel, sortKey, sortDir, soloConExistencia]);

  const kpis = useMemo(() => {
    return {
      total: filtered.length,
      estrella: filtered.filter((r) => r.clasificacion === "estrella").length,
      normal: filtered.filter((r) => r.clasificacion === "normal").length,
      enRiesgo: filtered.filter((r) => r.clasificacion === "en_riesgo").length,
      estancados: filtered.filter((r) => r.clasificacion === "estancado").length,
      sinMovimiento: filtered.filter((r) => r.clasificacion === "sin_movimiento").length,
    };
  }, [filtered]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
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
    const data = filtered.map((r) => ({
      "Código": r.codigo,
      "Producto": r.nombre,
      "Marca": r.marca,
      "Presentación": r.presentacion,
      "Stock MXL": r.s1001,
      "Stock TIJ": r.s1002,
      "Stock MOR": r.s1003,
      "Stock ENS": r.s1004,
      "Stock Total": r.stock_total,
      ...(canViewCostos ? { "Costo Promedio": r.costo_prom ?? "" } : {}),
      "Valor Stock": Number(r.valor_stock.toFixed(2)),
      "UE anualizadas": Number(r.ue.toFixed(2)),
      "% participación": Number(r.pct.toFixed(2)),
      "Meses con venta": `${r.meses_con_venta}/12`,
      "Última venta": r.ultima_venta || "",
      "Clasificación": CLAS_LABEL[r.clasificacion],
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rotacion");
    XLSX.writeFile(wb, `rotacion_inventario_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const activeGroupKeys = useMemo(() => groupLevels.filter((g) => g !== "none") as GroupKey[], [groupLevels]);
  const grouped = useMemo(() => (activeGroupKeys.length ? groupRows(filtered, activeGroupKeys) : []), [filtered, activeGroupKeys]);

  function toPdfRow(r: Row) {
    return {
      codigo: r.codigo,
      nombre: r.nombre,
      marca: r.marca,
      presentacion: r.presentacion,
      stock_total: r.stock_total,
      valor_stock: r.valor_stock,
      clasificacionLabel: CLAS_LABEL[r.clasificacion],
    };
  }
  function toPdfGroup(g: GroupNode): any {
    return {
      label: g.label,
      level: g.level,
      count: g.count,
      valor: g.valor,
      children: g.children.map(toPdfGroup),
      rows: g.rows.map(toPdfRow),
    };
  }
  function exportarPdf() {
    generateRotacionInventarioPdf(grouped.map(toPdfGroup), filtered.map(toPdfRow), {
      titulo: "Rotación de Inventario",
      subtitulo: `Ventas registradas en Kárdex del ${desde} al ${hasta}`,
    });
  }

  const colCount = canViewCostos ? 16 : 15;

  function renderGroups(nodes: GroupNode[]): React.ReactNode[] {
    const out: React.ReactNode[] = [];
    for (const g of nodes) {
      out.push(
        <TableRow key={`g-${g.level}-${g.label}-${out.length}`} className="bg-violet-50/70 hover:bg-violet-50">
          <TableCell colSpan={colCount} className="py-2">
            <div style={{ paddingLeft: g.level * 20 }} className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide">{g.label}</span>
              <span className="text-[11px] text-muted-foreground">{g.count} SKUs</span>
              <span className="text-[11px] text-muted-foreground">{fmtMoney(g.valor)}</span>
            </div>
          </TableCell>
        </TableRow>
      );
      if (g.children.length) out.push(...renderGroups(g.children));
      g.rows.forEach((r, i) => out.push(renderRow(r, i)));
    }
    return out;
  }

  function renderRow(r: Row, i: number) {
    return (
      <TableRow key={r.id} className={`hover:bg-blue-50/40 ${i % 2 === 1 ? "bg-muted/20" : ""}`}>
        <TableCell className="font-mono text-xs sticky left-0 bg-background z-10 w-[120px]">
          <Tooltip>
            <TooltipTrigger asChild><span className="block max-w-[120px] truncate cursor-default">{r.codigo}</span></TooltipTrigger>
            <TooltipContent>{r.codigo}</TooltipContent>
          </Tooltip>
        </TableCell>
        <TableCell className="text-sm sticky left-[120px] bg-background z-10 border-r">
          <Tooltip>
            <TooltipTrigger asChild><span className="block max-w-[280px] truncate cursor-default">{r.nombre}</span></TooltipTrigger>
            <TooltipContent className="max-w-xs">{r.nombre}</TooltipContent>
          </Tooltip>
        </TableCell>
        <TableCell className="text-sm">{r.marca || "—"}</TableCell>
        <TableCell className="text-sm">{r.presentacion}</TableCell>
        <TableCell className="text-right text-sm border-l">{fmtNum(r.s1001)}</TableCell>
        <TableCell className="text-right text-sm">{fmtNum(r.s1002)}</TableCell>
        <TableCell className="text-right text-sm">{fmtNum(r.s1003)}</TableCell>
        <TableCell className="text-right text-sm">{fmtNum(r.s1004)}</TableCell>
        <TableCell className="text-right text-sm font-bold">{fmtNum(r.stock_total)}</TableCell>
        {canViewCostos && <TableCell className="text-right text-sm border-l">{fmtMoney(r.costo_prom)}</TableCell>}
        <TableCell className="text-right text-sm">{fmtMoney(r.valor_stock)}</TableCell>
        <TableCell className="text-right text-sm font-semibold border-l">{fmtNum(r.ue, 2)}</TableCell>
        <TableCell className="text-right text-sm">{r.pct.toFixed(1)}%</TableCell>
        <TableCell className="text-right text-sm">{r.meses_con_venta}/12</TableCell>
        <TableCell className="text-sm">{r.ultima_venta || "—"}</TableCell>
        <TableCell>{clasificacionBadge(r.clasificacion)}</TableCell>
      </TableRow>
    );
  }


  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground font-light">Ventas registradas en Kárdex del {desde} al {hasta}.</p>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setFiltrosVisibles((v) => !v)}
          className="gap-2"
        >
          {filtrosVisibles ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          <span className="hidden sm:inline">{filtrosVisibles ? "Ocultar filtros" : "Mostrar filtros"}</span>
        </Button>

        <div className="flex flex-col md:flex-row gap-4 items-start">
          {/* Filtros */}
          {filtrosVisibles && (
            <aside className="w-full md:w-64 md:shrink-0 md:sticky md:top-4 md:self-start flex flex-col gap-3">
            <Select value={marcaSel} onValueChange={setMarcaSel}>
              <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Marca: Todas</SelectItem>
                <SelectItem value="Chevron">Chevron</SelectItem>
                <SelectItem value="Phillips 66">Phillips 66</SelectItem>
              </SelectContent>
            </Select>

            <div className="rounded-md border p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Clasificación</div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" className="h-7 text-xs flex-1" onClick={() => setClasSel([...CLAS_ORDER])}>Todas</Button>
                <Button size="sm" variant="secondary" className="h-7 text-xs flex-1" onClick={() => setClasSel([])}>Ninguna</Button>
              </div>
              <div className="space-y-2 pt-1">
                {CLAS_ORDER.map((c) => (
                  <label key={c} className="flex items-start gap-2 text-xs font-light cursor-pointer">
                    <Checkbox
                      className="mt-0.5"
                      checked={clasSel.includes(c)}
                      onCheckedChange={(v) =>
                        setClasSel((prev) => (v ? [...prev, c] : prev.filter((x) => x !== c)))
                      }
                    />
                    <span>{CLAS_LABEL[c]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por código o nombre…" className="pl-8 h-9" />
            </div>
            <label className="flex items-center gap-2 text-xs font-light cursor-pointer">
              <Checkbox
                className="mt-0.5"
                checked={soloConExistencia}
                onCheckedChange={(v) => setSoloConExistencia(Boolean(v))}
              />
              <span>Solo con existencia actual</span>
            </label>
            <span className="text-xs text-muted-foreground inline-flex items-start gap-1">
              <HelpCircle className="h-3 w-3 mt-0.5 shrink-0" /> {kpis.sinMovimiento.toLocaleString("es-MX")} {CLAS_LABEL.sin_movimiento}
            </span>

            <Button variant="outline" onClick={recargar} disabled={loading} className="w-full">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualizar
            </Button>
            <Button onClick={exportar} disabled={filtered.length === 0} className="w-full">
              <Download className="h-4 w-4 mr-2" /> Excel ({filtered.length})
            </Button>
            <Button variant="outline" onClick={exportarPdf} disabled={filtered.length === 0} className="w-full">
              <FileText className="h-4 w-4 mr-2" /> Descargar PDF
            </Button>
          </aside>
          )}

          {/* Contenido */}
          <div className="flex-1 min-w-0 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <Kpi label="Total SKUs" value={kpis.total.toLocaleString("es-MX")} icon={<Package className="h-4 w-4" />} tone="slate" />
              <Kpi label="Estrella" value={kpis.estrella.toLocaleString("es-MX")} icon={<Star className="h-4 w-4" />} tone="violet" />
              <Kpi label="Normal (<3m)" value={kpis.normal.toLocaleString("es-MX")} icon={<CheckCircle2 className="h-4 w-4" />} tone="sky" />
              <Kpi label="En Riesgo (3-6m)" value={kpis.enRiesgo.toLocaleString("es-MX")} icon={<Clock className="h-4 w-4" />} tone="orange" />
              <Kpi label="Estancado (6-12m)" value={kpis.estancados.toLocaleString("es-MX")} icon={<AlertTriangle className="h-4 w-4" />} tone="red" />
              <Kpi label="Sin Movimiento (12m+)" value={kpis.sinMovimiento.toLocaleString("es-MX")} icon={<AlertOctagon className="h-4 w-4" />} tone="slate" />
            </div>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Agrupar por</span>
                  {groupLevels.map((gl, idx) => (
                    <Select
                      key={idx}
                      value={gl}
                      onValueChange={(v) => setGroupLevels((prev) => prev.map((p, i) => (i === idx ? (v as GroupKey) : p)))}
                    >
                      <SelectTrigger className="h-9 w-44"><SelectValue placeholder={`Nivel ${idx + 1}`} /></SelectTrigger>
                      <SelectContent>
                        {GROUP_OPTIONS.filter((o) => o.value === "none" || o.value === gl || !groupLevels.includes(o.value)).map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.value === "none" ? `Nivel ${idx + 1}: Ninguno` : o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!groupLevels.some((g) => g !== "none")}
                    onClick={() => setGroupLevels(["none", "none", "none", "none"])}
                    className="gap-1.5"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reiniciar agrupación
                  </Button>
                </div>

                <div className="rounded-md border overflow-auto overflow-x-auto max-h-[70vh]">
                  <Table>
                    <TableHeader className="bg-gradient-to-r from-violet-50 to-blue-50 sticky top-0 z-10">
                      <TableRow>
                        <SortHead k="codigo" className="sticky left-0 bg-violet-50 z-20 w-[120px]">Código</SortHead>
                        <SortHead k="nombre" className="sticky left-[120px] bg-violet-50 z-20 border-r">Producto</SortHead>
                        <SortHead k="marca">Marca</SortHead>
                        <SortHead k="presentacion">Presentación</SortHead>
                        <SortHead k="s1001" className="text-right border-l">MXL</SortHead>
                        <SortHead k="s1002" className="text-right">TIJ</SortHead>
                        <SortHead k="s1003" className="text-right">MOR</SortHead>
                        <SortHead k="s1004" className="text-right">ENS</SortHead>
                        <SortHead k="stock_total" className="text-right">Stock Total</SortHead>
                        {canViewCostos && <SortHead k="costo_prom" className="text-right border-l">Costo Prom.</SortHead>}
                        <SortHead k="valor_stock" className="text-right">Valor Stock</SortHead>
                        <SortHead k="ue" className="text-right border-l">UE (12m)</SortHead>
                        <SortHead k="pct" className="text-right">% part.</SortHead>
                        <SortHead k="meses_con_venta" className="text-right">Meses c/venta</SortHead>
                        <SortHead k="ultima_venta">Última venta</SortHead>
                        <SortHead k="clasificacion">Clasificación</SortHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow><TableCell colSpan={colCount} className="text-center text-muted-foreground py-10">Cargando…</TableCell></TableRow>
                      ) : filtered.length === 0 ? (
                        <TableRow><TableCell colSpan={colCount} className="text-center text-muted-foreground py-10">Sin resultados</TableCell></TableRow>
                      ) : activeGroupKeys.length ? (
                        renderGroups(grouped)
                      ) : filtered.map((r, i) => renderRow(r, i))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function Kpi({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: "slate" | "blue" | "amber" | "red" | "redDark" | "violet" | "orange" | "sky" }) {
  const tones: Record<string, string> = {
    slate: "from-slate-50 to-slate-100 text-slate-700 border-slate-200",
    blue: "from-blue-50 to-blue-100 text-blue-700 border-blue-200",
    amber: "from-amber-50 to-amber-100 text-amber-800 border-amber-200",
    red: "from-red-50 to-red-100 text-red-700 border-red-200",
    redDark: "from-red-100 to-red-200 text-red-900 border-red-300",
    violet: "from-violet-50 to-violet-100 text-violet-700 border-violet-200",
    orange: "from-orange-50 to-orange-100 text-orange-700 border-orange-200",
    sky: "from-sky-50 to-sky-100 text-sky-700 border-sky-200",
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
