import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Search, AlertTriangle, PackageX, Package, FileSpreadsheet, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";

type Row = {
  codigo: string;
  nombre: string;
  presentacion: string;
  marca: string;
  clasificacion_abc: string | null;
  stock_total: number | null;
  costo_actual: number | null;
  precio_uf1: number | null;
  costo_galper: number | null;
  costo_especial: number | null;
  costo_lista: number | null;
  costo_efectivo: number | null;
  fuente: string | null;
  empresa: string | null;
  en_catalogo: boolean;
  en_galper: boolean;
};

type SortKey = keyof Row;

const fmtMoney = (n: number | null | undefined) =>
  n == null || isNaN(Number(n)) ? "—" : `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtNum = (n: number | null | undefined) =>
  n == null || isNaN(Number(n)) ? "—" : Number(n).toLocaleString("es-MX");

function fuenteBadge(f: string | null | undefined) {
  if (!f) return <span className="text-muted-foreground">—</span>;
  const map: Record<string, string> = {
    GALPER: "bg-blue-100 text-blue-700 border-blue-200",
    ESPECIAL: "bg-purple-100 text-purple-700 border-purple-200",
    MAX: "bg-indigo-100 text-indigo-700 border-indigo-200",
    LISTA: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return <Badge variant="outline" className={`text-[10px] font-medium ${map[f] || "bg-muted"}`}>{f}</Badge>;
}

function abcBadge(c: string | null | undefined) {
  if (!c) return <span className="text-muted-foreground text-xs">—</span>;
  const map: Record<string, string> = {
    A: "bg-emerald-100 text-emerald-700 border-emerald-200",
    B: "bg-amber-100 text-amber-700 border-amber-200",
    C: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return <Badge variant="outline" className={`text-[10px] font-bold ${map[c] || "bg-muted"}`}>{c}</Badge>;
}

function exportarExcel(data: Row[], nombre: string) {
  const rows = data.map(d => ({
    "Código": d.codigo,
    "Nombre": d.nombre,
    "Presentación": d.presentacion,
    "Marca": d.marca,
    "ABC": d.clasificacion_abc || "",
    "Stock Total": d.stock_total ?? "",
    "Costo Actual": d.costo_actual ?? "",
    "Precio UF1": d.precio_uf1 ?? "",
    "Costo Galper": d.costo_galper ?? "",
    "Precio Especial": d.costo_especial ?? "",
    "Lista General": d.costo_lista ?? "",
    "Costo Efectivo": d.costo_efectivo ?? "",
    "Fuente": d.fuente || "",
    "En Catálogo": d.en_catalogo ? "Sí" : "No",
    "En Galper": d.en_galper ? "Sí" : "No",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 14 }, { wch: 45 }, { wch: 15 }, { wch: 18 }, { wch: 6 }, { wch: 12 },
    { wch: 13 }, { wch: 12 }, { wch: 13 }, { wch: 15 }, { wch: 14 }, { wch: 15 },
    { wch: 10 }, { wch: 12 }, { wch: 10 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Reporte");
  XLSX.writeFile(wb, `${nombre}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export default function ReporteCostos() {
  const [loading, setLoading] = useState(true);
  const [allRows, setAllRows] = useState<Row[]>([]);

  useEffect(() => { (async () => {
    setLoading(true);
    try {
      const [{ data: productos }, costosRes, nivelesRes] = await Promise.all([
        supabase.from("productos")
          .select("id, codigo, nombre_producto, costo_actual, precio_base_uf1, presentaciones(nombre), marca:product_option_values!productos_marca_id_fkey(value)")
          .eq("is_active", true).order("codigo"),
        (supabase as any).from("inv_costos_producto")
          .select("codigo_producto, empresa, costo_galper, costo_especial, costo_lista, costo_efectivo, costo_efectivo_fuente, created_at")
          .order("created_at", { ascending: false }),
        (supabase as any).from("inv_niveles_inventario")
          .select("codigo_producto, stock_total, clasificacion_abc"),
      ]);

      const costos: any[] = costosRes.data || [];
      const niveles: any[] = nivelesRes.data || [];

      // Más reciente por SKU
      const costosMap = new Map<string, any>();
      for (const c of costos) {
        if (!costosMap.has(c.codigo_producto)) costosMap.set(c.codigo_producto, c);
      }
      const nivelesMap = new Map<string, any>();
      for (const n of niveles) nivelesMap.set(n.codigo_producto, n);

      const rows: Row[] = [];
      const catalogoCodigos = new Set<string>();

      for (const p of (productos as any[]) || []) {
        const cod = p.codigo;
        catalogoCodigos.add(cod);
        const c = costosMap.get(cod);
        const n = nivelesMap.get(cod);
        rows.push({
          codigo: cod,
          nombre: p.nombre_producto || "",
          presentacion: p.presentaciones?.nombre || "",
          marca: p.marca?.value || "",
          clasificacion_abc: n?.clasificacion_abc || null,
          stock_total: n?.stock_total ?? null,
          costo_actual: p.costo_actual ?? null,
          precio_uf1: p.precio_base_uf1 ?? null,
          costo_galper: c?.costo_galper ?? null,
          costo_especial: c?.costo_especial ?? null,
          costo_lista: c?.costo_lista ?? null,
          costo_efectivo: c?.costo_efectivo ?? null,
          fuente: c?.costo_efectivo_fuente ?? null,
          empresa: c?.empresa ?? null,
          en_catalogo: true,
          en_galper: c?.costo_galper != null,
        });
      }

      // Códigos en Galper sin catálogo
      for (const [cod, c] of costosMap.entries()) {
        if (catalogoCodigos.has(cod)) continue;
        if (c.costo_galper == null) continue;
        const n = nivelesMap.get(cod);
        rows.push({
          codigo: cod,
          nombre: "(sin catálogo)",
          presentacion: "",
          marca: "",
          clasificacion_abc: n?.clasificacion_abc || null,
          stock_total: n?.stock_total ?? null,
          costo_actual: null,
          precio_uf1: null,
          costo_galper: c.costo_galper ?? null,
          costo_especial: c.costo_especial ?? null,
          costo_lista: c.costo_lista ?? null,
          costo_efectivo: c.costo_efectivo ?? null,
          fuente: c.costo_efectivo_fuente ?? null,
          empresa: c.empresa ?? null,
          en_catalogo: false,
          en_galper: true,
        });
      }

      setAllRows(rows);
    } catch (e: any) {
      toast.error("Error cargando reporte: " + e.message);
    } finally { setLoading(false); }
  })(); }, []);

  const kpis = useMemo(() => {
    const enCatalogo = allRows.filter(r => r.en_catalogo);
    return {
      total: enCatalogo.length,
      conGalper: enCatalogo.filter(r => r.en_galper).length,
      sinGalper: enCatalogo.filter(r => !r.en_galper).length,
      galperSinCat: allRows.filter(r => !r.en_catalogo && r.en_galper).length,
    };
  }, [allRows]);

  const enCatalogoSinGalper = useMemo(() => allRows.filter(r => r.en_catalogo && !r.en_galper), [allRows]);
  const galperSinCatalogo = useMemo(() => allRows.filter(r => !r.en_catalogo && r.en_galper), [allRows]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reporte de Costos</h1>
          <p className="text-sm text-muted-foreground font-light">Vista consolidada de costos y cobertura del catálogo Galper.</p>
        </div>
        <Button onClick={() => exportarExcel(allRows, "reporte_costos_completo")} disabled={loading || allRows.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Descargar todo en Excel
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="Total en catálogo" value={kpis.total} icon={<Package className="h-4 w-4" />} tone="slate" />
        <KpiCard label="Con precio Galper" value={kpis.conGalper} icon={<FileSpreadsheet className="h-4 w-4" />} tone="blue" />
        <KpiCard label="En catálogo sin Galper" value={kpis.sinGalper} icon={<AlertTriangle className="h-4 w-4" />} tone="amber" />
        <KpiCard label="En Galper sin catálogo" value={kpis.galperSinCat} icon={<PackageX className="h-4 w-4" />} tone="red" />
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Lista completa</TabsTrigger>
          <TabsTrigger value="sin-galper">
            En catálogo sin Galper
            <Badge variant="outline" className="ml-2 bg-amber-100 text-amber-700 border-amber-200">{kpis.sinGalper}</Badge>
          </TabsTrigger>
          <TabsTrigger value="sin-cat">
            En Galper sin catálogo
            <Badge variant="outline" className="ml-2 bg-red-100 text-red-700 border-red-200">{kpis.galperSinCat}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <DataTable rows={allRows} loading={loading} showCobertura exportName="reporte_costos" />
        </TabsContent>
        <TabsContent value="sin-galper" className="mt-4">
          <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-900 px-4 py-2 text-xs mb-3">
            Estos productos están activos pero no tienen precio en la última lista Galper. Revisa si deben desactivarse o si Contabilidad debe actualizar la lista.
          </div>
          <DataTable rows={enCatalogoSinGalper} loading={loading} showCobertura={false} exportName="catalogo_sin_galper" />
        </TabsContent>
        <TabsContent value="sin-cat" className="mt-4">
          <div className="rounded-md bg-red-50 border border-red-200 text-red-900 px-4 py-2 text-xs mb-3">
            Estos códigos existen en la lista Galper pero no están en el catálogo. Decide si agregarlos o ignorarlos.
          </div>
          <DataTable rows={galperSinCatalogo} loading={loading} showCobertura={false} exportName="galper_sin_catalogo" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: "slate" | "blue" | "amber" | "red" }) {
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
        <div className="text-2xl font-bold">{value.toLocaleString("es-MX")}</div>
      </CardContent>
    </Card>
  );
}

function DataTable({ rows, loading, showCobertura, exportName }: { rows: Row[]; loading: boolean; showCobertura: boolean; exportName: string }) {
  const [search, setSearch] = useState("");
  const [abc, setAbc] = useState("ALL");
  const [marca, setMarca] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("codigo");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const marcas = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => { if (r.marca) s.add(r.marca); });
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = rows.filter(r => {
      if (q && !(r.codigo.toLowerCase().includes(q) || r.nombre.toLowerCase().includes(q))) return false;
      if (abc !== "ALL" && (r.clasificacion_abc || "") !== abc) return false;
      if (marca !== "ALL" && r.marca !== marca) return false;
      return true;
    });
    out = [...out].sort((a, b) => {
      const av = a[sortKey] as any;
      const bv = b[sortKey] as any;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      const cmp = String(av).localeCompare(String(bv), "es", { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [rows, search, abc, marca, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  }

  function SortHead({ k, children, className = "" }: { k: SortKey; children: React.ReactNode; className?: string }) {
    const active = sortKey === k;
    const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <TableHead className={`cursor-pointer select-none ${className}`} onClick={() => toggleSort(k)}>
        <span className="inline-flex items-center gap-1">{children}<Icon className="h-3 w-3 opacity-60" /></span>
      </TableHead>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por código o nombre…" className="pl-8 h-9" />
          </div>
          <Select value={abc} onValueChange={setAbc}>
            <SelectTrigger className="h-9 w-32"><SelectValue placeholder="ABC" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ABC: Todas</SelectItem>
              <SelectItem value="A">A</SelectItem>
              <SelectItem value="B">B</SelectItem>
              <SelectItem value="C">C</SelectItem>
            </SelectContent>
          </Select>
          <Select value={marca} onValueChange={setMarca}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Marca" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Marca: Todas</SelectItem>
              {marcas.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => exportarExcel(filtered, exportName)} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Excel ({filtered.length})
          </Button>
        </div>

        <div className="rounded-md border overflow-auto max-h-[65vh]">
          <Table>
            <TableHeader className="bg-gradient-to-r from-violet-50 to-blue-50 sticky top-0 z-10">
              <TableRow>
                <SortHead k="codigo">Código</SortHead>
                <SortHead k="nombre">Nombre</SortHead>
                <TableHead>Presentación</TableHead>
                <SortHead k="clasificacion_abc">ABC</SortHead>
                <SortHead k="stock_total" className="text-right">Stock</SortHead>
                <SortHead k="costo_actual" className="text-right">Costo actual</SortHead>
                <SortHead k="costo_galper" className="text-right text-blue-700">Costo Galper</SortHead>
                <SortHead k="costo_especial" className="text-right text-purple-700">Precio Especial</SortHead>
                <SortHead k="costo_lista" className="text-right text-slate-600">Lista General</SortHead>
                <SortHead k="costo_efectivo" className="text-right">Costo efectivo</SortHead>
                <TableHead>Fuente</TableHead>
                {showCobertura && <TableHead>En catálogo</TableHead>}
                {showCobertura && <TableHead>En Galper</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={showCobertura ? 13 : 11} className="text-center text-muted-foreground py-10">Cargando…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={showCobertura ? 13 : 11} className="text-center text-muted-foreground py-10">Sin resultados</TableCell></TableRow>
              ) : filtered.map((r, i) => (
                <TableRow key={`${r.codigo}-${i}`} className="hover:bg-blue-50/40">
                  <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                  <TableCell className="text-sm">{r.nombre}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.presentacion}</TableCell>
                  <TableCell>{abcBadge(r.clasificacion_abc)}</TableCell>
                  <TableCell className="text-right text-sm">{fmtNum(r.stock_total)}</TableCell>
                  <TableCell className="text-right text-sm">{fmtMoney(r.costo_actual)}</TableCell>
                  <TableCell className="text-right text-sm text-blue-700">{fmtMoney(r.costo_galper)}</TableCell>
                  <TableCell className="text-right text-sm text-purple-700">{fmtMoney(r.costo_especial)}</TableCell>
                  <TableCell className="text-right text-sm text-slate-600">{fmtMoney(r.costo_lista)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">{fmtMoney(r.costo_efectivo)}</TableCell>
                  <TableCell>{fuenteBadge(r.fuente)}</TableCell>
                  {showCobertura && (
                    <TableCell>
                      <Badge variant="outline" className={r.en_catalogo ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-red-100 text-red-700 border-red-200"}>
                        {r.en_catalogo ? "Sí" : "No"}
                      </Badge>
                    </TableCell>
                  )}
                  {showCobertura && (
                    <TableCell>
                      <Badge variant="outline" className={r.en_galper ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-amber-100 text-amber-800 border-amber-200"}>
                        {r.en_galper ? "Sí" : "No"}
                      </Badge>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}