import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown } from "lucide-react";
import { ESTATUS_PEDIDO_LABEL } from "@/hooks/usePedidosInventario";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";

type Row = Record<string, any>;

const ESTADOS: { key: string; desc: string; color: string }[] = [
  { key: "Agotado", desc: "Sin existencia y con venta regular.", color: "#dc2626" },
  { key: "Faltará antes de reponer", desc: "La existencia no alcanza para el tiempo de entrega.", color: "#ef4444" },
  { key: "Faltará: pedido llega tarde", desc: "Hay pedido en camino, pero llega después de que se acabe la existencia.", color: "#f97316" },
  { key: "Ordenar ahora", desc: "Alcanza para el tiempo de entrega pero llegaría con menos de 7 días.", color: "#f59e0b" },
  { key: "Bajo pedido (esporádico)", desc: "Se vende 3 meses o menos al año: pedir solo contra venta confirmada.", color: "#9ca3af" },
  { key: "Corporativo sin programar", desc: "Solo tuvo salidas corporativas y no hay entregas programadas: captura el calendario en Entregas Corporativas.", color: "#8b5cf6" },
  { key: "OK", desc: "Cobertura dentro de la política.", color: "#16a34a" },
  { key: "Arriba de política (45-90 d)", desc: "Entre 45 y 90 días de cobertura.", color: "#3b82f6" },
  { key: "Sobre-inventario (>90 d)", desc: "Más de 90 días de cobertura.", color: "#1e3a8a" },
  { key: "Atorado", desc: "Más de 120 días sin venta, o venta muy esporádica con más de 180 días de cobertura.", color: "#374151" },
  { key: "Sin movimiento 12m", desc: "Con existencia y sin ventas en 12 meses.", color: "#6b7280" },
];
const URGENTES = ["Agotado", "Faltará antes de reponer", "Faltará: pedido llega tarde", "Ordenar ahora"];

const MOTIVOS = [
  { v: "descontinuado", l: "Descontinuado" },
  { v: "merma", l: "Merma" },
  { v: "ya_no_se_necesita", l: "Ya no se necesita" },
  { v: "solo_bajo_pedido", l: "Solo bajo pedido" },
  { v: "otro", l: "Otro" },
];

const n = (v: any) => Number(v) || 0;
const fmtMoneyC = (v: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", notation: "compact", maximumFractionDigits: 1 }).format(v);
const fmtMoney = (v: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(v);
const fmtNum = (v: number, d = 0) => new Intl.NumberFormat("es-MX", { maximumFractionDigits: d }).format(v);

// ============ SortableTable genérico ============
export interface SortCol<T> {
  key: string;
  label: string;
  value?: (r: T) => any;
  render?: (r: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  sortable?: boolean;
}

function SortableTable<T extends Row>({ rows, columns, defaultSort, defaultDir = "desc", rowKey }: {
  rows: T[]; columns: SortCol<T>[]; defaultSort?: string; defaultDir?: "asc" | "desc"; rowKey: (r: T) => string;
}) {
  const [sort, setSort] = useState<string | undefined>(defaultSort);
  const [dir, setDir] = useState<"asc" | "desc">(defaultDir);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find(c => c.key === sort);
    const get = col?.value || ((r: T) => r[sort]);
    return [...rows].sort((a, b) => {
      const va = get(a), vb = get(b);
      let c: number;
      if (typeof va === "number" || typeof vb === "number") c = n(va) - n(vb);
      else c = String(va ?? "").localeCompare(String(vb ?? ""), "es");
      return dir === "asc" ? c : -c;
    });
  }, [rows, sort, dir, columns]);

  const toggle = (k: string) => {
    if (sort === k) setDir(dir === "asc" ? "desc" : "asc");
    else { setSort(k); setDir("desc"); }
  };

  return (
    <div className="max-h-[28rem] overflow-auto rounded-md border">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur">
          <TableRow>
            {columns.map(c => (
              <TableHead
                key={c.key}
                className={`whitespace-nowrap text-xs ${c.align === "right" ? "text-right" : ""} ${c.sortable !== false ? "cursor-pointer select-none" : ""}`}
                onClick={() => c.sortable !== false && toggle(c.key)}
              >
                {c.label}{" "}
                {c.sortable !== false && <span className="text-muted-foreground">{sort === c.key ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((r, i) => (
            <TableRow key={rowKey(r)} className={i % 2 ? "bg-muted/30" : ""}>
              {columns.map(c => (
                <TableCell key={c.key} className={`text-xs py-1.5 ${c.align === "right" ? "text-right tabular-nums" : ""}`}>
                  {c.render ? c.render(r) : (r[c.key] ?? "")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ============ Página ============
export default function Control45() {
  const [params, setParams] = useSearchParams();
  const empresa = params.get("marca") === "galsa" ? "galsa" : "lumaggs";
  const [tab, setTab] = useState("resumen");
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(URGENTES.map(k => [k, true])));
  const [search, setSearch] = useState("");
  const { user, hasAnyRole } = useAuth();
  const qc = useQueryClient();
  const canArchive = hasAnyRole(["admin", "manager", "warehouse"] as any);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["inv_reorden_45d", empresa],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("inv_reorden_45d", { p_empresa: empresa });
      if (error) throw error;
      return (data || []) as Row[];
    },
  });
  const { data: salidas = [] } = useQuery({
    queryKey: ["inv_salidas_mensuales", empresa],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("inv_salidas_mensuales", { p_empresa: empresa });
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  const activos = useMemo(() => rows.filter(r => r.estado !== "Archivado"), [rows]);
  const first = rows[0];

  const kpi = useMemo(() => {
    let valor = 0, den = 0, exceso = 0, pedir = 0, pedirN = 0, smV = 0, smN = 0, transito = 0;
    for (const r of activos) {
      valor += n(r.valor);
      den += (n(r.venta_diaria) + n(r.corp_45d) / 45) * n(r.costo_unitario);
      exceso += n(r.exceso_valor);
      pedir += n(r.pedir_valor);
      if (n(r.pedir_uds) > 0) pedirN++;
      if (r.estado === "Sin movimiento 12m") { smV += n(r.valor); smN++; }
      transito += n(r.transito_valor);
    }
    return { valor, cobertura: den > 0 ? valor / den : null, exceso, excesoPct: valor > 0 ? (exceso / valor) * 100 : 0, pedir, pedirN, smV, smN, transito };
  }, [activos]);

  const porEstado = useMemo(() => ESTADOS.map(e => {
    const rs = activos.filter(r => r.estado === e.key);
    return { ...e, rows: rs, valor: rs.reduce((s, r) => s + n(r.valor), 0), pedir: rs.reduce((s, r) => s + n(r.pedir_valor), 0), exceso: rs.reduce((s, r) => s + n(r.exceso_valor), 0) };
  }), [activos]);

  const mensual = useMemo(() => {
    const m = new Map<string, any>();
    for (const s of salidas) {
      const k = String(s.mes).slice(0, 7);
      const cur = m.get(k) || { mes: k, Facturación: 0, Refacturaciones: 0, "Entregas corporativas (histórico)": 0 };
      const v = n(s.valor_costo_actual);
      if (s.tipo === "venta" || s.tipo === "devolucion") cur["Facturación"] += v;
      else if (s.tipo === "refacturacion") cur["Refacturaciones"] += v;
      else if (s.tipo === "corporativo") cur["Entregas corporativas (histórico)"] += v;
      m.set(k, cur);
    }
    return [...m.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  }, [salidas]);

  const q = search.trim().toLowerCase();
  const filtrar = (rs: Row[]) => !q ? rs : rs.filter(r => String(r.codigo_producto).toLowerCase().includes(q) || String(r.nombre_producto ?? "").toLowerCase().includes(q));

  const archivar = async (r: Row, motivo: string) => {
    const now = new Date().toISOString();
    const { error } = await (supabase as any).from("inv_producto_config").upsert({
      empresa_vendedora: empresa, codigo_producto: r.codigo_producto, archivado: true, motivo_archivo: motivo,
      archivado_por: user?.id, archivado_at: now, updated_at: now,
    }, { onConflict: "empresa_vendedora,codigo_producto" });
    if (error) { toast.error(error.message); return; }
    toast.success("Archivado");
    qc.invalidateQueries({ queryKey: ["inv_reorden_45d", empresa] });
  };

  const archivados = useMemo(() => rows.filter(r => r.estado === "Archivado"), [rows]);
  const { data: reqs = [] } = useQuery({
    queryKey: ["control45_req", empresa],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("inv_solicitudes_extraordinarias").select("*")
        .or(`empresa_vendedora.eq.${empresa},empresa_vendedora.is.null`).order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Row[];
    },
  });
  const reqAbiertasCount = reqs.filter(r => r.estatus === "pendiente" || r.estatus === "aprobada").length;

  const columns: SortCol<Row>[] = [
    { key: "codigo_producto", label: "Código" },
    { key: "nombre_producto", label: "Producto", render: r => <span className="block max-w-[16rem] truncate" title={r.nombre_producto}>{r.nombre_producto}</span> },
    { key: "origen", label: "Origen", render: r => r.origen ? (
      <Tooltip><TooltipTrigger asChild><span><Badge variant="outline">{r.origen === "IMP" ? "Importado" : r.origen === "NAL" ? "Nacional" : r.origen}</Badge></span></TooltipTrigger>
        <TooltipContent>Tiempo de entrega: {r.lead_dias ?? "—"} días</TooltipContent></Tooltip>) : "—" },
    { key: "existencia", label: "Exist.", align: "right", value: r => n(r.existencia), render: r => fmtNum(n(r.existencia)) },
    { key: "en_transito", label: "Tránsito", align: "right", value: r => n(r.en_transito), render: r => fmtNum(n(r.en_transito)) },
    { key: "proxima_llegada", label: "Llega", value: r => r.proxima_llegada ?? "", render: r => r.proxima_llegada ?? "—" },
    { key: "venta_diaria", label: "Venta/día", align: "right", value: r => n(r.venta_diaria), render: r => fmtNum(n(r.venta_diaria), 2) },
    { key: "corp_45d", label: "Corp. 45d", align: "right", value: r => n(r.corp_45d), render: r => fmtNum(n(r.corp_45d)) },
    { key: "requisiciones", label: "Req.", align: "right", value: r => n(r.requisiciones), render: r => fmtNum(n(r.requisiciones)) },
    { key: "cobertura_dias", label: "Cobertura (d)", align: "right", value: r => r.cobertura_dias == null ? -1 : n(r.cobertura_dias), render: r => r.cobertura_dias == null ? "—" : fmtNum(n(r.cobertura_dias)) },
    { key: "cobertura_con_transito_dias", label: "Cob. c/tránsito (d)", align: "right", value: r => r.cobertura_con_transito_dias == null ? -1 : n(r.cobertura_con_transito_dias), render: r => r.cobertura_con_transito_dias == null ? "—" : fmtNum(n(r.cobertura_con_transito_dias)) },
    { key: "dias_sin_venta", label: "Días s/venta", align: "right", value: r => r.dias_sin_venta == null ? -1 : n(r.dias_sin_venta), render: r => r.dias_sin_venta ?? "—" },
    { key: "valor", label: "Valor", align: "right", value: r => n(r.valor), render: r => fmtMoney(n(r.valor)) },
    { key: "pedir_uds", label: "Pedir (uds)", align: "right", value: r => n(r.pedir_uds), render: r => fmtNum(n(r.pedir_uds)) },
    { key: "pedir_valor", label: "Pedir ($)", align: "right", value: r => n(r.pedir_valor), render: r => fmtMoney(n(r.pedir_valor)) },
    { key: "exceso_valor", label: "Exceso c/tránsito ($)", align: "right", value: r => n(r.exceso_valor), render: r => fmtMoney(n(r.exceso_valor)) },
    ...(canArchive ? [{ key: "accion", label: "Acción", sortable: false, render: (r: Row) => (
      <Select value="" onValueChange={v => archivar(r, v)}>
        <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="Archivar…" /></SelectTrigger>
        <SelectContent>{MOTIVOS.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
      </Select>) } as SortCol<Row>] : []),
  ];

  const abrirEstado = (k: string) => { setTab("estado"); setOpen(o => ({ ...o, [k]: true })); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Control de inventario 45 días</h1>
          <p className="text-xs text-muted-foreground font-light mt-1">
            Kárdex al {first?.fecha_corte_kardex ?? "—"} · Inventario al {first?.fecha_inventario ?? "—"}
          </p>
        </div>
        <ToggleGroup type="single" value={empresa} onValueChange={v => v && setParams(p => { p.set("marca", v); return p; })}>
          <ToggleGroupItem value="lumaggs">Lumaggs</ToggleGroupItem>
          <ToggleGroupItem value="galsa">Galsa</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="estado">Por estado</TabsTrigger>
          <TabsTrigger value="corp">Entregas corporativas</TabsTrigger>
          <TabsTrigger value="req" className="gap-1.5">Requisiciones
            {reqAbiertasCount > 0 && <Badge variant="secondary" className="h-5 px-1.5">{reqAbiertasCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="arch" className="gap-1.5">Archivados
            {archivados.length > 0 && <Badge variant="secondary" className="h-5 px-1.5">{archivados.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-4">
          {isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : (<>
            <p className="text-sm font-light">
              Tienes {fmtMoneyC(kpi.valor)} en inventario a costo, con cobertura global de {kpi.cobertura == null ? "—" : fmtNum(kpi.cobertura)} días.
              Hay {fmtMoneyC(kpi.exceso)} ({fmtNum(kpi.excesoPct, 1)}%) por encima de 45 días, {fmtMoneyC(kpi.pedir)} por ordenar en {kpi.pedirN} productos
              y {fmtMoneyC(kpi.smV)} en {kpi.smN} productos sin movimiento en 12 meses.
            </p>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
              <Kpi title="Inventario a costo" value={fmtMoneyC(kpi.valor)} />
              <Kpi title="Cobertura global" value={kpi.cobertura == null ? "—" : `${fmtNum(kpi.cobertura)} días`} danger={kpi.cobertura != null && kpi.cobertura > 45} />
              <Kpi title="Exceso sobre 45 días" value={fmtMoneyC(kpi.exceso)} sub={`${fmtNum(kpi.excesoPct, 1)}% del inventario`} />
              <Kpi title="Por ordenar" value={fmtMoneyC(kpi.pedir)} sub={`${kpi.pedirN} productos`} />
              <Kpi title="Sin movimiento 12 meses" value={fmtMoneyC(kpi.smV)} sub={`${kpi.smN} productos`} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Inventario por estado</CardTitle></CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer>
                    <BarChart data={porEstado} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={fmtMoneyC} fontSize={11} />
                      <YAxis type="category" dataKey="key" width={170} fontSize={11} />
                      <RTooltip formatter={(v: any) => fmtMoney(n(v))} />
                      <Bar dataKey="valor" name="Inventario" cursor="pointer" onClick={(d: any) => abrirEstado(d.key)}>
                        {porEstado.map(e => <Cell key={e.key} fill={e.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Salidas mensuales</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer>
                      <BarChart data={mensual}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="mes" fontSize={11} />
                        <YAxis tickFormatter={fmtMoneyC} fontSize={11} />
                        <RTooltip formatter={(v: any) => fmtMoney(n(v))} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Facturación" stackId="a" fill="#3b82f6" />
                        <Bar dataKey="Refacturaciones" stackId="a" fill="#f59e0b" />
                        <Bar dataKey="Entregas corporativas (histórico)" stackId="a" fill="#8b5cf6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-muted-foreground font-light mt-2">
                    Valorizado a costo actual. Las entregas corporativas futuras se toman de Entregas Corporativas programadas, no de este histórico.
                  </p>
                </CardContent>
              </Card>
            </div>
          </>)}
        </TabsContent>

        <TabsContent value="estado" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Buscar código o nombre…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs h-9" />
            <Button variant="outline" size="sm" onClick={() => setOpen(Object.fromEntries(ESTADOS.map(e => [e.key, true])))}>Abrir todos</Button>
            <Button variant="outline" size="sm" onClick={() => setOpen({})}>Cerrar todos</Button>
          </div>
          {porEstado.filter(e => e.rows.length > 0).map(e => {
            const rs = filtrar(e.rows);
            if (q && rs.length === 0) return null;
            const isOpen = q ? true : !!open[e.key];
            return (
              <Collapsible key={e.key} open={isOpen} onOpenChange={v => setOpen(o => ({ ...o, [e.key]: v }))}>
                <Card className="overflow-hidden" style={{ borderLeft: `4px solid ${e.color}` }}>
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40">
                      <div className="flex items-center gap-2 min-w-0">
                        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        <div className="min-w-0">
                          <div className="font-medium text-sm">{e.key}</div>
                          <div className="text-xs text-muted-foreground font-light">{e.desc}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs tabular-nums">
                        <span>{rs.length} productos</span>
                        <span>Inventario {fmtMoney(e.valor)}</span>
                        {e.pedir > 0 && <span className="text-destructive">Por ordenar {fmtMoney(e.pedir)}</span>}
                        {e.exceso > 0 && <span className="text-primary">Exceso {fmtMoney(e.exceso)}</span>}
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 pb-4">
                    <SortableTable
                      rows={rs}
                      columns={columns}
                      defaultSort={URGENTES.includes(e.key) ? "pedir_valor" : "exceso_valor"}
                      rowKey={r => r.codigo_producto}
                    />
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </TabsContent>

        <TabsContent value="corp"><CorpTab rows={rows} /></TabsContent>
        <TabsContent value="req"><ReqTab rows={rows} empresa={empresa} reqs={reqs} canManage={canArchive} userId={user?.id} /></TabsContent>
        <TabsContent value="arch"><ArchTab rows={archivados} empresa={empresa} canManage={canArchive} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ title, value, sub, danger }: { title: string; value: string; sub?: string; danger?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{title}</div>
        <div className={`text-xl font-semibold mt-1 ${danger ? "text-destructive" : ""}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground font-light">{sub}</div>}
      </CardContent>
    </Card>
  );
}

// ============ Helpers compartidos ============
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hoyStr = () => ymd(new Date());
const masDias = (dias: number) => { const h = new Date(); return ymd(new Date(h.getFullYear(), h.getMonth(), h.getDate() + dias)); };
const motivoLabel = (v?: string | null) => MOTIVOS.find(m => m.v === v)?.l ?? (v || "—");

// ============ Tab Entregas corporativas ============
function CorpTab({ rows }: { rows: Row[] }) {
  const navigate = useNavigate();
  const [cliente, setCliente] = useState("__all");
  const { data: entregas = [] } = useQuery({
    queryKey: ["control45_entregas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("entregas_corporativas")
        .select("id, cliente, fecha_programada, estatus, numero_pedido, lugar_entrega_texto, entregas_corporativas_lineas(codigo_producto, nombre_producto, cantidad)")
        .eq("estatus", "programada");
      if (error) throw error;
      return (data || []) as Row[];
    },
  });
  const byCode = useMemo(() => new Map(rows.map(r => [String(r.codigo_producto), r])), [rows]);
  const lineas = useMemo(() => {
    const out: Row[] = [];
    entregas.forEach(e => (e.entregas_corporativas_lineas || []).forEach((l: Row, i: number) => {
      if (!byCode.has(String(l.codigo_producto))) return;
      out.push({ _k: `${e.id}-${i}`, fecha: e.fecha_programada, cliente: e.cliente, pedido: e.numero_pedido,
        codigo_producto: l.codigo_producto, nombre_producto: l.nombre_producto || byCode.get(String(l.codigo_producto))?.nombre_producto, cantidad: n(l.cantidad) });
    }));
    return out;
  }, [entregas, byCode]);
  const hoy = hoyStr(), lim = masDias(45);
  const proximas = lineas.filter(l => l.fecha && l.fecha >= hoy && l.fecha <= lim);
  const vencidas = lineas.filter(l => l.fecha && l.fecha < hoy);
  const clientes = [...new Set(lineas.map(l => l.cliente).filter(Boolean))].sort();
  const clientesVenc = [...new Set(vencidas.map(l => l.cliente).filter(Boolean))].sort();
  const vencFiltradas = cliente === "__all" ? vencidas : vencidas.filter(l => l.cliente === cliente);

  const agrupado = useMemo(() => {
    const m = new Map<string, Row>();
    proximas.forEach(l => {
      const c = String(l.codigo_producto);
      const cur = m.get(c) || { codigo_producto: c, nombre_producto: l.nombre_producto, cantidad: 0, entregas: 0, primera: l.fecha,
        existencia: n(byCode.get(c)?.existencia), cobertura_dias: byCode.get(c)?.cobertura_dias };
      cur.cantidad += l.cantidad; cur.entregas += 1; if (l.fecha < cur.primera) cur.primera = l.fecha;
      m.set(c, cur);
    });
    return [...m.values()];
  }, [proximas, byCode]);

  const detalleCols: SortCol<Row>[] = [
    { key: "fecha", label: "Fecha" }, { key: "cliente", label: "Cliente" }, { key: "pedido", label: "Pedido" },
    { key: "codigo_producto", label: "Código" }, { key: "nombre_producto", label: "Producto" },
    { key: "cantidad", label: "Cantidad", align: "right", value: r => n(r.cantidad), render: r => fmtNum(n(r.cantidad)) },
  ];
  const grupoCols: SortCol<Row>[] = [
    { key: "codigo_producto", label: "Código" }, { key: "nombre_producto", label: "Producto" },
    { key: "cantidad", label: "Cantidad total", align: "right", value: r => n(r.cantidad), render: r => fmtNum(n(r.cantidad)) },
    { key: "entregas", label: "Entregas", align: "right", value: r => n(r.entregas) },
    { key: "primera", label: "Primera fecha" },
    { key: "existencia", label: "Existencia", align: "right", value: r => n(r.existencia), render: r => fmtNum(n(r.existencia)) },
    { key: "cobertura_dias", label: "Cobertura (d)", align: "right", value: r => r.cobertura_dias == null ? -1 : n(r.cobertura_dias), render: r => r.cobertura_dias == null ? "—" : fmtNum(n(r.cobertura_dias)) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-3">
        <Kpi title="Próximos 45 días" value={fmtNum(proximas.length)} sub="líneas" />
        <Kpi title="Vencidas sin cerrar" value={fmtNum(vencidas.length)} sub="líneas" danger={vencidas.length > 0} />
        <Kpi title="Clientes" value={fmtNum(clientes.length)} />
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Consideradas en el cálculo (próximos 45 días)</CardTitle>
          <p className="text-xs text-muted-foreground font-light">Estas cantidades se suman a la demanda del producto antes de calcular qué ordenar.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {proximas.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">No hay entregas programadas en los próximos 45 días. Captúralas o sube el calendario en Entregas Corporativas.</p>
              <Button size="sm" variant="outline" onClick={() => navigate("/entregas-corporativas")}>Ir a Entregas Corporativas</Button>
            </div>
          ) : (<>
            <SortableTable rows={agrupado} columns={grupoCols} defaultSort="cantidad" rowKey={r => r.codigo_producto} />
            <SortableTable rows={proximas} columns={detalleCols} defaultSort="fecha" defaultDir="asc" rowKey={r => r._k} />
          </>)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Vencidas sin cerrar</CardTitle>
          <p className="text-xs text-muted-foreground font-light">Siguen como Programada con fecha pasada. No cuentan en el cálculo: márcalas como entregadas o canceladas en Entregas Corporativas.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Select value={cliente} onValueChange={setCliente}>
              <SelectTrigger className="h-9 w-64"><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos los clientes</SelectItem>
                {clientesVenc.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => navigate("/entregas-corporativas")}>Ir a Entregas Corporativas</Button>
          </div>
          <SortableTable key={cliente} rows={vencFiltradas} columns={detalleCols} defaultSort="fecha" defaultDir="desc" rowKey={r => r._k} />
        </CardContent>
      </Card>
    </div>
  );
}

// ============ Tab Requisiciones ============
const REQ_COLOR: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800 border-amber-200",
  en_espera: "bg-amber-100 text-amber-800 border-amber-200",
  aprobada: "bg-blue-100 text-blue-800 border-blue-200",
  pedida: "bg-violet-100 text-violet-800 border-violet-200",
  recibida: "bg-green-100 text-green-800 border-green-200",
  rechazada: "bg-muted text-muted-foreground",
  cancelada: "bg-muted text-muted-foreground",
};
const ABIERTAS = ["pendiente", "en_espera", "aprobada", "pedida"];

function ReqTab({ rows, empresa, reqs, canManage, userId }: { rows: Row[]; empresa: string; reqs: Row[]; canManage: boolean; userId?: string }) {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState("abiertas");
  const [prodOpen, setProdOpen] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [cliente, setCliente] = useState("");
  const [fecha, setFecha] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [pedirDlg, setPedirDlg] = useState<Row | null>(null);
  const [ref, setRef] = useState("");

  const ids = useMemo(() => [...new Set(reqs.map(r => r.solicitado_por).filter(Boolean))], [reqs]);
  const { data: perfiles = [] } = useQuery({
    queryKey: ["control45_req_perfiles", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("profiles").select("user_id, full_name").in("user_id", ids);
      if (error) throw error;
      return (data || []) as Row[];
    },
  });
  const nombre = (id?: string) => perfiles.find(p => p.user_id === id)?.full_name || "—";
  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["control45_req", empresa] });
    qc.invalidateQueries({ queryKey: ["inv_reorden_45d", empresa] });
  };
  const prodSel = codigo ? rows.find(r => r.codigo_producto === codigo) : null;

  const guardar = async () => {
    const cant = Number(cantidad);
    const desc = prodSel ? prodSel.nombre_producto : texto.trim();
    if (!desc) return toast.error("Indica el producto");
    if (!(cant > 0)) return toast.error("La cantidad debe ser mayor a 0");
    if (!motivo.trim()) return toast.error("El motivo es obligatorio");
    setSaving(true);
    const { error } = await (supabase as any).from("inv_solicitudes_extraordinarias").insert({
      codigo_producto: codigo || null, producto_descripcion: desc, cantidad: cant, tipo: "unica",
      motivo: motivo.trim(), cliente: cliente.trim() || null, fecha_requerida: fecha || null,
      empresa_vendedora: empresa, estatus: "pendiente", solicitado_por: userId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Requisición registrada");
    setCodigo(null); setTexto(""); setCantidad(""); setCliente(""); setFecha(""); setMotivo("");
    refrescar();
  };

  const actualizar = async (id: string, patch: Row, msg: string) => {
    const { error } = await (supabase as any).from("inv_solicitudes_extraordinarias").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(msg);
    refrescar();
  };

  const lista = filtro === "abiertas" ? reqs.filter(r => ABIERTAS.includes(r.estatus)) : reqs;
  const cols: SortCol<Row>[] = [
    { key: "created_at", label: "Fecha", render: r => String(r.created_at ?? "").slice(0, 10) },
    { key: "solicito", label: "Solicitó", value: r => nombre(r.solicitado_por), render: r => nombre(r.solicitado_por) },
    { key: "cliente", label: "Cliente", render: r => r.cliente || "—" },
    { key: "codigo_producto", label: "Código", render: r => r.codigo_producto || "—" },
    { key: "producto_descripcion", label: "Producto", render: r => <span className="block max-w-[14rem] truncate" title={r.producto_descripcion}>{r.producto_descripcion}</span> },
    { key: "cantidad", label: "Cantidad", align: "right", value: r => n(r.cantidad), render: r => fmtNum(n(r.cantidad)) },
    { key: "fecha_requerida", label: "Para", render: r => r.fecha_requerida || "—" },
    { key: "motivo", label: "Motivo", render: r => <span className="block max-w-[14rem] truncate" title={r.motivo}>{r.motivo}</span> },
    { key: "estatus", label: "Estatus", render: r => <Badge variant="outline" className={REQ_COLOR[r.estatus] || ""}>{r.estatus}</Badge> },
    { key: "acciones", label: "Acciones", sortable: false, render: r => {
      const now = new Date().toISOString();
      return (
        <div className="flex gap-1 whitespace-nowrap">
          {canManage && (r.estatus === "pendiente" || r.estatus === "en_espera") && (<>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => actualizar(r.id, { estatus: "aprobada", revisado_por: userId, revisado_at: now }, "Aprobada")}>Aprobar</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => actualizar(r.id, { estatus: "rechazada", activo: false, revisado_por: userId, revisado_at: now }, "Rechazada")}>Rechazar</Button>
          </>)}
          {canManage && r.estatus === "aprobada" && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setRef(""); setPedirDlg(r); }}>Marcar como pedido</Button>
          )}
          {canManage && r.estatus === "pedida" && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => actualizar(r.id, { estatus: "recibida", recibido_at: now, activo: false }, "Marcada como recibida")}>Marcar recibido</Button>
          )}
          {r.solicitado_por === userId && r.estatus === "pendiente" && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => actualizar(r.id, { estatus: "cancelada", activo: false }, "Cancelada")}>Cancelar</Button>
          )}
        </div>
      );
    } },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm font-light">Un vendedor pide un producto para un cliente. Las aprobadas se suman a lo que hay que ordenar; al marcarlas como pedidas dejan de sumarse.</p>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Nueva requisición</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs uppercase tracking-wide">Producto</Label>
            <Popover open={prodOpen} onOpenChange={setProdOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal h-9">
                  <span className="truncate">{prodSel ? `${prodSel.codigo_producto} · ${prodSel.nombre_producto}` : texto || "Buscar producto o escribir…"}</span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                <Command>
                  <CommandInput placeholder="Código o nombre…" value={texto} onValueChange={v => { setTexto(v); setCodigo(null); }} />
                  <CommandList>
                    <CommandEmpty>Sin coincidencias: se guardará como texto libre.</CommandEmpty>
                    <CommandGroup>
                      {rows.slice(0, 2000).map(r => (
                        <CommandItem key={r.codigo_producto} value={`${r.codigo_producto} · ${r.nombre_producto}`}
                          onSelect={() => { setCodigo(r.codigo_producto); setTexto(""); setProdOpen(false); }}>
                          {r.codigo_producto} · {r.nombre_producto}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide">Cantidad</Label>
            <Input type="number" min={0} value={cantidad} onChange={e => setCantidad(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide">Cliente</Label>
            <Input value={cliente} onChange={e => setCliente(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide">Se necesita para</Label>
            <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide">Motivo</Label>
            <Input value={motivo} onChange={e => setMotivo(e.target.value)} className="h-9" />
          </div>
          <div className="md:col-span-3 flex justify-end">
            <Button onClick={guardar} disabled={saving}>{saving ? "Guardando…" : "Registrar requisición"}</Button>
          </div>
        </CardContent>
      </Card>
      <ToggleGroup type="single" value={filtro} onValueChange={v => v && setFiltro(v)} className="justify-start">
        <ToggleGroupItem value="abiertas">Abiertas</ToggleGroupItem>
        <ToggleGroupItem value="todas">Todas</ToggleGroupItem>
      </ToggleGroup>
      <SortableTable rows={lista} columns={cols} defaultSort="created_at" rowKey={r => r.id} />

      <Dialog open={!!pedirDlg} onOpenChange={o => !o && setPedirDlg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marcar como pedido</DialogTitle></DialogHeader>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide">Referencia / PO (opcional)</Label>
            <Input value={ref} onChange={e => setRef(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPedirDlg(null)}>Cancelar</Button>
            <Button onClick={async () => {
              const r = pedirDlg!; setPedirDlg(null);
              await actualizar(r.id, { estatus: "pedida", pedido_at: new Date().toISOString(), pedido_por: userId, pedido_referencia: ref.trim() || null }, "Marcada como pedida");
            }}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ Tab Archivados ============
function ArchTab({ rows, empresa, canManage }: { rows: Row[]; empresa: string; canManage: boolean }) {
  const qc = useQueryClient();
  const restaurar = async (codigo: string) => {
    const { error } = await (supabase as any).from("inv_producto_config")
      .update({ archivado: false, motivo_archivo: null, updated_at: new Date().toISOString() })
      .eq("empresa_vendedora", empresa).eq("codigo_producto", codigo);
    if (error) return toast.error(error.message);
    toast.success("Restaurado");
    qc.invalidateQueries({ queryKey: ["inv_reorden_45d", empresa] });
  };
  const cols: SortCol<Row>[] = [
    { key: "codigo_producto", label: "Código" },
    { key: "nombre_producto", label: "Producto" },
    { key: "existencia", label: "Existencia", align: "right", value: r => n(r.existencia), render: r => fmtNum(n(r.existencia)) },
    { key: "valor", label: "Valor", align: "right", value: r => n(r.valor), render: r => fmtMoney(n(r.valor)) },
    { key: "motivo_archivo", label: "Motivo", value: r => motivoLabel(r.motivo_archivo), render: r => motivoLabel(r.motivo_archivo) },
    ...(canManage ? [{ key: "accion", label: "Acción", sortable: false, render: (r: Row) => (
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => restaurar(r.codigo_producto)}>Restaurar</Button>
    ) } as SortCol<Row>] : []),
  ];
  return (
    <div className="space-y-3">
      <p className="text-sm font-light">No aparecen en los estados, no se sugieren para pedido y no cuentan en los indicadores.</p>
      <SortableTable rows={rows} columns={cols} defaultSort="valor" rowKey={r => r.codigo_producto} />
    </div>
  );
}
