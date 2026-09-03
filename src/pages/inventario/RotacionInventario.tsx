import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useCanViewCostos } from "@/hooks/useCanViewCostos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Search, ArrowUpDown, ArrowUp, ArrowDown, Package, AlertTriangle, DollarSign, Star, TrendingDown, RefreshCw, ChevronsUpDown, Clock, AlertOctagon, HelpCircle } from "lucide-react";
import { toast } from "sonner";

type Clasificacion =
  | "estancado"
  | "estancado_urgente"
  | "en_riesgo"
  | "nunca_vendido"
  | "sin_stock"
  | "baja_rotacion"
  | "rotacion_buena"
  | "estrella";

type Velocidad = "rapido" | "medio" | "lento" | "sin_movimiento";

type Row = {
  id: string;
  codigo: string;
  nombre: string;
  marca: string;
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
  estancado: "Estancado (6-12m)",
  estancado_urgente: "Estancado Urgente (12m+)",
  en_riesgo: "En Riesgo (3-6m)",
  nunca_vendido: "Nunca vendido",
  sin_stock: "Sin stock ni movimiento",
  baja_rotacion: "Baja rotación",
  rotacion_buena: "Rotación buena",
  estrella: "⭐ Estrella",
};

const CLAS_ORDER: Clasificacion[] = [
  "estrella",
  "rotacion_buena",
  "baja_rotacion",
  "en_riesgo",
  "estancado",
  "estancado_urgente",
  "nunca_vendido",
  "sin_stock",
];

const CLAS_STYLE: Record<Clasificacion, string> = {
  estancado: "bg-red-100 text-red-700 border-red-200",
  estancado_urgente: "bg-red-700 text-white border-red-800",
  en_riesgo: "bg-orange-100 text-orange-700 border-orange-200",
  nunca_vendido: "bg-sky-100 text-sky-700 border-sky-200",
  sin_stock: "bg-slate-100 text-slate-600 border-slate-200",
  baja_rotacion: "bg-amber-100 text-amber-800 border-amber-200",
  rotacion_buena: "bg-emerald-100 text-emerald-700 border-emerald-200",
  estrella: "bg-violet-100 text-violet-700 border-violet-200",
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
  const [niveles, setNiveles] = useState<any[]>([]);
  const [fechasVenta, setFechasVenta] = useState<any[]>([]);
  const [demanda, setDemanda] = useState<any[]>([]);

  const [marcaSel, setMarcaSel] = useState("ALL");
  const [clasSel, setClasSel] = useState<Clasificacion[]>([...CLAS_ORDER]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("ue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [groupLevels, setGroupLevels] = useState<GroupKey[]>(["none", "none", "none", "none"]);

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
      const [prods, opts, nv, fv, dm] = await Promise.all([
        fetchAll(() => (supabase as any).from("productos").select("id, codigo, nombre_producto, marca_id, categoria_id, linea_id").eq("is_active", true).order("codigo")),
        (supabase as any).from("product_option_values").select("id, value, option_type").in("option_type", ["marca", "categoria", "linea"]),
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
        clasificacion: "nunca_vendido" as Clasificacion,
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
      const tieneHistorico = !!k?.ultima;

      if (r.stock_total <= 0) {
        r.clasificacion = "sin_stock";
        continue;
      }

      if (k?.reciente) {
        const isTop80 = top80.has(r.id);
        if (isTop80 && r.meses_con_venta >= 9) r.clasificacion = "estrella";
        else if (r.meses_con_venta <= 3 || !isTop80) r.clasificacion = "baja_rotacion";
        else r.clasificacion = "rotacion_buena";
        continue;
      }

      if (tieneHistorico) {
        const ult = new Date(`${k!.ultima}T00:00:00`);
        const meses = (hoy.getFullYear() - ult.getFullYear()) * 12 + (hoy.getMonth() - ult.getMonth());
        if (meses < 6) r.clasificacion = "en_riesgo";
        else if (meses < 12) r.clasificacion = "estancado";
        else r.clasificacion = "estancado_urgente";
        continue;
      }

      // Sin registros en kárdex de fechas: si tiene demanda histórica se considera estancado
      r.clasificacion = r.ue > 0 ? "estancado" : "nunca_vendido";
    }
    return base;
  }, [productos, kardexMap, demandaMap, nivelesMap, marcas, categoriaMap, lineaMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (marcaSel !== "ALL" && r.marca !== marcaSel) return false;
      if (!clasSel.includes(r.clasificacion)) return false;
      if (q && !(r.codigo.toLowerCase().includes(q) || r.nombre.toLowerCase().includes(q))) return false;
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
  }, [rows, search, marcaSel, clasSel, sortKey, sortDir]);

  const kpis = useMemo(() => {
    const estancados = filtered.filter((r) => r.clasificacion === "estancado");
    const urgentes = filtered.filter((r) => r.clasificacion === "estancado_urgente");
    return {
      total: filtered.length,
      enRiesgo: filtered.filter((r) => r.clasificacion === "en_riesgo").length,
      estancados: estancados.length,
      urgentes: urgentes.length,
      valorEstancado: [...estancados, ...urgentes].reduce((s, r) => s + r.valor_stock, 0),
      estrella: filtered.filter((r) => r.clasificacion === "estrella").length,
      baja: filtered.filter((r) => r.clasificacion === "baja_rotacion").length,
      nuncaVendido: filtered.filter((r) => r.clasificacion === "nunca_vendido").length,
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

  const clasLabelBtn =
    clasSel.length === CLAS_ORDER.length ? "Clasificación: Todas" :
    clasSel.length === 0 ? "Clasificación: Ninguna" :
    `Clasificación: ${clasSel.length} seleccionadas`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground font-light">Ventas registradas en Kárdex del {desde} al {hasta}.</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={recargar} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualizar
          </Button>
          <Button onClick={exportar} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Descargar Excel ({filtered.length})
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-7 gap-4">
        <Kpi label="Total SKUs" value={kpis.total.toLocaleString("es-MX")} icon={<Package className="h-4 w-4" />} tone="slate" />
        <Kpi label="En Riesgo (3-6m)" value={kpis.enRiesgo.toLocaleString("es-MX")} icon={<Clock className="h-4 w-4" />} tone="orange" />
        <Kpi label="Estancado (6-12m)" value={kpis.estancados.toLocaleString("es-MX")} icon={<AlertTriangle className="h-4 w-4" />} tone="red" />
        <Kpi label="Estancado Urgente (12m+)" value={kpis.urgentes.toLocaleString("es-MX")} icon={<AlertOctagon className="h-4 w-4" />} tone="redDark" />
        <Kpi label="Valor estancado" value={fmtMoney(kpis.valorEstancado)} icon={<DollarSign className="h-4 w-4" />} tone="blue" />
        <Kpi label="Estrella" value={kpis.estrella.toLocaleString("es-MX")} icon={<Star className="h-4 w-4" />} tone="violet" />
        <Kpi label="Baja rotación" value={kpis.baja.toLocaleString("es-MX")} icon={<TrendingDown className="h-4 w-4" />} tone="amber" />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={marcaSel} onValueChange={setMarcaSel}>
              <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Marca: Todas</SelectItem>
                <SelectItem value="Chevron">Chevron</SelectItem>
                <SelectItem value="Phillips 66">Phillips 66</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 w-64 justify-between font-normal">
                  <span className="truncate">{clasLabelBtn}</span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-3 space-y-2">
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" className="h-7 text-xs flex-1" onClick={() => setClasSel([...CLAS_ORDER])}>Todas</Button>
                  <Button size="sm" variant="secondary" className="h-7 text-xs flex-1" onClick={() => setClasSel([])}>Ninguna</Button>
                </div>
                <div className="space-y-2 pt-1">
                  {CLAS_ORDER.map((c) => (
                    <label key={c} className="flex items-center gap-2 text-sm font-light cursor-pointer">
                      <Checkbox
                        checked={clasSel.includes(c)}
                        onCheckedChange={(v) =>
                          setClasSel((prev) => (v ? [...prev, c] : prev.filter((x) => x !== c)))
                        }
                      />
                      {CLAS_LABEL[c]}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <div className="relative flex-1 min-w-[220px]">
              <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por código o nombre…" className="pl-8 h-9" />
            </div>
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <HelpCircle className="h-3 w-3" /> {kpis.nuncaVendido.toLocaleString("es-MX")} nunca vendidos
            </span>
          </div>

          <div className="rounded-md border overflow-auto max-h-[70vh]">
            <Table>
              <TableHeader className="bg-gradient-to-r from-violet-50 to-blue-50 sticky top-0 z-10">
                <TableRow>
                  <SortHead k="codigo" className="sticky left-0 bg-violet-50 z-20">Código</SortHead>
                  <SortHead k="nombre">Producto</SortHead>
                  <SortHead k="marca">Marca</SortHead>
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
                  <TableRow><TableCell colSpan={15} className="text-center text-muted-foreground py-10">Cargando…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={15} className="text-center text-muted-foreground py-10">Sin resultados</TableCell></TableRow>
                ) : filtered.map((r, i) => (
                  <TableRow key={r.id} className={`hover:bg-blue-50/40 ${i % 2 === 1 ? "bg-muted/20" : ""}`}>
                    <TableCell className="font-mono text-xs sticky left-0 bg-inherit z-10">{r.codigo}</TableCell>
                    <TableCell className="text-sm max-w-[220px] truncate" title={r.nombre}>{r.nombre}</TableCell>
                    <TableCell className="text-sm">{r.marca || "—"}</TableCell>
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
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
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
