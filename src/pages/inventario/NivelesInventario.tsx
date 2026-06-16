import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Upload, ArrowUp, ArrowDown, BarChart3 } from "lucide-react";
import { useNivelesInventario, statusColor, abcColor } from "@/hooks/useInventario";

const STATUS_LABELS: Record<string, string> = {
  pedir: "PEDIR", ok: "OK", sobrestock: "SOBRESTOCK", muerto: "MUERTO", inactivo: "INACTIVO",
};

type SortKey = "codigo_producto" | "nombre_producto" | "stock_total" | "dias_cobertura" | "consumo_hub_mensual" | "clasificacion_abc" | "estatus_inventario";

export default function NivelesInventario() {
  const { data: niveles = [], isLoading } = useNivelesInventario();
  const [empresa, setEmpresa] = useState("todos");
  const [estatus, setEstatus] = useState("todos");
  const [abc, setAbc] = useState("todos");
  const [presentacion, setPresentacion] = useState("todos");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("codigo_producto");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const kpis = useMemo(() => {
    const c = (s: string) => niveles.filter((n: any) => n.estatus_inventario === s).length;
    return { pedir: c("pedir"), ok: c("ok"), sobrestock: c("sobrestock"), muerto: c("muerto") };
  }, [niveles]);

  const filtered = useMemo(() => {
    let r = niveles.filter((n: any) => {
      if (empresa !== "todos" && n.empresa_vendedora !== empresa) return false;
      if (estatus !== "todos" && n.estatus_inventario !== estatus) return false;
      if (abc !== "todos" && n.clasificacion_abc !== abc) return false;
      if (presentacion !== "todos" && n.presentacion !== presentacion) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!String(n.codigo_producto || "").toLowerCase().includes(s) &&
            !String(n.nombre_producto || "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
    r = [...r].sort((a: any, b: any) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return r;
  }, [niveles, empresa, estatus, abc, presentacion, search, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  const SortHead = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead className={`uppercase tracking-wide text-xs font-medium cursor-pointer select-none ${className || ""}`} onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">{children}{sortKey === k && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</span>
    </TableHead>
  );

  const empresaChip = (e?: string | null) => e === "lumaggs"
    ? <Badge className="bg-blue-100 text-blue-800 border-blue-200">Chevron</Badge>
    : e === "galsa" ? <Badge className="bg-red-100 text-red-800 border-red-200">Phillips 66</Badge>
    : <span className="text-muted-foreground text-xs">—</span>;

  const diasColor = (n: any) => {
    const d = n?.dias_cobertura ?? 0;
    if (n?.estatus_inventario === "pedir") return "text-red-700 font-semibold";
    if (n?.estatus_inventario === "sobrestock") return "text-orange-700 font-semibold";
    if (n?.estatus_inventario === "ok") return "text-green-700";
    return "text-muted-foreground";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-tight">Niveles de Inventario</h1>
          <p className="text-sm text-muted-foreground">Stock en tiempo real con semáforo de status</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/inventario/kardex"><Upload className="h-4 w-4 mr-2" />Cargar Kárdex</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="SKUs a Pedir" value={kpis.pedir} bg="bg-red-50" text="text-red-700" />
        <KpiCard label="SKUs OK" value={kpis.ok} bg="bg-green-50" text="text-green-700" />
        <KpiCard label="SKUs Sobrestock" value={kpis.sobrestock} bg="bg-orange-50" text="text-orange-700" />
        <KpiCard label="SKUs Muertos" value={kpis.muerto} bg="bg-yellow-50" text="text-yellow-700" />
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input placeholder="Buscar por código o nombre" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={empresa} onValueChange={setEmpresa}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas las empresas</SelectItem>
              <SelectItem value="lumaggs">Lumaggs — Chevron</SelectItem>
              <SelectItem value="galsa">Galsa — Phillips 66</SelectItem>
            </SelectContent>
          </Select>
          <Select value={estatus} onValueChange={setEstatus}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los status</SelectItem>
              <SelectItem value="pedir">Pedir</SelectItem>
              <SelectItem value="ok">OK</SelectItem>
              <SelectItem value="sobrestock">Sobrestock</SelectItem>
              <SelectItem value="muerto">Muerto</SelectItem>
              <SelectItem value="inactivo">Inactivo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={abc} onValueChange={setAbc}>
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">ABC: Todos</SelectItem>
              <SelectItem value="A">A</SelectItem>
              <SelectItem value="B">B</SelectItem>
              <SelectItem value="C">C</SelectItem>
            </SelectContent>
          </Select>
          <Select value={presentacion} onValueChange={setPresentacion}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Toda presentación</SelectItem>
              <SelectItem value="tambor">Tambor</SelectItem>
              <SelectItem value="cubeta">Cubeta</SelectItem>
              <SelectItem value="caja_12u">Caja 12u</SelectItem>
              <SelectItem value="caja_6u">Caja 6u</SelectItem>
              <SelectItem value="caja_3u">Caja 3u</SelectItem>
              <SelectItem value="granel">Granel</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">Cargando niveles...</div>
          ) : niveles.length === 0 ? (
            <div className="p-12 text-center space-y-4">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/40" />
              <p className="text-muted-foreground">Sube tu primer kárdex para ver los niveles de inventario</p>
              <Button asChild><Link to="/inventario/kardex"><Upload className="h-4 w-4 mr-2" />Ir a Carga de Kárdex</Link></Button>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-gradient-to-r from-violet-50 to-blue-50">
                <TableRow>
                  <SortHead k="clasificacion_abc">ABC</SortHead>
                  <SortHead k="codigo_producto">Código</SortHead>
                  <SortHead k="nombre_producto">Producto</SortHead>
                  <TableHead className="uppercase tracking-wide text-xs font-medium">Unidad</TableHead>
                  <TableHead className="uppercase tracking-wide text-xs font-medium">Empresa</TableHead>
                  <SortHead k="estatus_inventario">Status</SortHead>
                  <TableHead className="uppercase tracking-wide text-xs font-medium text-right">TJ</TableHead>
                  <TableHead className="uppercase tracking-wide text-xs font-medium text-right">MXL</TableHead>
                  <TableHead className="uppercase tracking-wide text-xs font-medium text-right">MOR</TableHead>
                  <TableHead className="uppercase tracking-wide text-xs font-medium text-right">ENS</TableHead>
                  <SortHead k="stock_total" className="text-right">Total</SortHead>
                  <SortHead k="dias_cobertura" className="text-right">Días Cob.</SortHead>
                  <SortHead k="consumo_hub_mensual" className="text-right">Consumo/mes</SortHead>
                  <TableHead className="uppercase tracking-wide text-xs font-medium">Fuente</TableHead>
                  <TableHead className="uppercase tracking-wide text-xs font-medium text-right">Lead (sem)</TableHead>
                  <TableHead className="uppercase tracking-wide text-xs font-medium text-right">Pzs/Tarima</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((n: any, i: number) => (
                  <TableRow key={n.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                    <TableCell><Badge variant="outline" className={abcColor(n.clasificacion_abc)}>{n.clasificacion_abc || "—"}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{n.codigo_producto}</TableCell>
                    <TableCell className="max-w-[280px] truncate">{n.nombre_producto || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{n.unidad || "—"}</TableCell>
                    <TableCell>{empresaChip(n.empresa_vendedora)}</TableCell>
                    <TableCell><Badge variant="outline" className={statusColor(n.estatus_inventario)}>{STATUS_LABELS[n.estatus_inventario] || "—"}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{n.stock_almacen_1002 ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums">{n.stock_almacen_1001 ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums">{n.stock_almacen_1003 ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums">{n.stock_almacen_1004 ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{n.stock_total ?? 0}</TableCell>
                    <TableCell className={`text-right tabular-nums ${diasColor(n)}`}>{n.dias_cobertura != null ? Math.round(n.dias_cobertura) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{n.consumo_hub_mensual != null ? Math.round(n.consumo_hub_mensual) : "—"}</TableCell>
                    <TableCell className="text-xs uppercase">{n.fuente_suministro || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{n.lead_time_dias != null ? Math.round(n.lead_time_dias / 7) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{n.piezas_por_tarima ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={16} className="text-center py-8 text-muted-foreground">Sin resultados con los filtros aplicados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, bg, text }: { label: string; value: number; bg: string; text: string }) {
  return (
    <Card className={`${bg} border-0`}>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-3xl font-light mt-1 ${text}`}>{value}</div>
      </CardContent>
    </Card>
  );
}