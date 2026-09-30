import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageBanner } from "@/components/PageBanner";
import { BackButton } from "@/components/BackButton";
import { cn } from "@/lib/utils";
import { useGruposEmpresas } from "@/hooks/useGruposEmpresas";
import { GrupoComercialBadge } from "@/components/GrupoComercialBadge";
import { ContpaqiConciliacionDialog } from "@/components/reports/ContpaqiConciliacionDialog";
import { ExternalLink, ShieldCheck, ChevronDown, ChevronRight, Trophy } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from "recharts";

const MARCAS = [
  { v: "lumaggs_chevron", l: "Chevron" },
  { v: "galsa_phillips66", l: "Phillips 66" },
];

const PILL: Record<string, { active: string; idle: string }> = {
  lumaggs_chevron: { active: "bg-blue-600 text-white border-blue-600", idle: "bg-transparent text-blue-700 hover:bg-blue-50" },
  galsa_phillips66: { active: "bg-orange-500 text-white border-orange-500", idle: "bg-transparent text-orange-600 hover:bg-orange-50" },
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const ZONA_COSTA = ["tijuana", "ensenada", "san quintin"];

const ESTATUS_LABEL: Record<string, string> = {
  pendiente: "Vigente",
  vigente: "Vigente",
  pagada: "Pagada",
  vencida: "Vencida",
  refacturado_remision: "Refacturado o Remisión",
};

const COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#14b8a6", "#f97316", "#ec4899", "#22c55e", "#3b82f6", "#a855f7",
  "#eab308", "#06b6d4", "#84cc16", "#f43f5e",
];

interface LineaRow {
  cantidad: number | null;
  precio_unitario: number | null;
  subtotal: number | null;
  unidades_equivalentes: number | null;
  productos: { codigo: string | null; nombre_producto: string | null } | null;
}

interface FacturaRow {
  id: string;
  numero_factura: string | null;
  estatus_factura: string | null;
  fecha_documento: string | null;
  unidades_equivalentes_total: number | null;
  subtotal: number | null;
  total: number | null;
  plaza_id: string | null;
  empresa_id: string | null;
  ejecutivo_venta_id: string | null;
  companies: { name: string | null; razon_social: string | null } | null;
  documento_productos: LineaRow[] | null;
}

interface Grupo {
  key: string;
  nombre: string;
  facturas: FacturaRow[];
  unidades: number;
  importe: number;
  conIva: number;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

const sinAcentos = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const fmt = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 2 });
const mxn = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const mxn2 = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });

export default function DesgloseFacturasEjecutivoReport() {
  const now = new Date();
  const [marca, setMarca] = useState("lumaggs_chevron");
  const [periodo, setPeriodo] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}`);
  const [plazaSel, setPlazaSel] = useState<string[]>([]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [metrica, setMetrica] = useState<"unidades" | "importe">("unidades");
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
  const { grupoNombre } = useGruposEmpresas();
  const pill = PILL[marca];

  const [anio, mesNum] = periodo.split("-").map(Number);
  const mes = mesNum - 1;
  const desde = `${anio}-${pad(mes + 1)}-01`;
  const hasta = mes === 11 ? `${anio + 1}-01-01` : `${anio}-${pad(mes + 2)}-01`;
  const periodoLabel = `${MESES[mes]} ${anio}`;

  const periodos = useMemo(() => {
    const out: { v: string; l: string }[] = [];
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    for (let i = 0; i < 30; i++) {
      out.push({ v: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, l: `${MESES[d.getMonth()]} ${d.getFullYear()}` });
      d.setMonth(d.getMonth() - 1);
    }
    return out;
  }, []);

  const { data: plazas = [] } = useQuery({
    queryKey: ["plazas-desglose"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plazas").select("id, nombre").order("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: ejecutivos = [] } = useQuery({
    queryKey: ["profiles-ejecutivos-desglose"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, full_name, email");
      if (error) throw error;
      return data ?? [];
    },
  });

  const nombreEjecutivo = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of ejecutivos) {
      if (p.user_id) m.set(p.user_id, (p.full_name || p.email || "").trim() || "Sin nombre");
    }
    return m;
  }, [ejecutivos]);

  const plazasFiltro = useMemo(() => {
    if (plazaSel.length === 0) return null;
    const costa = plazas.filter((p) => ZONA_COSTA.includes(sinAcentos(p.nombre ?? ""))).map((p) => p.id);
    return Array.from(new Set(plazaSel.flatMap((id) => (id === "costa" ? costa : [id]))));
  }, [plazaSel, plazas]);

  const { data: facturas = [], isLoading } = useQuery({
    queryKey: ["desglose-facturas-ejecutivo", marca, desde, hasta, plazasFiltro?.join(",") ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("documentos")
        .select(
          "id, numero_factura, estatus_factura, fecha_documento, unidades_equivalentes_total, subtotal, total, plaza_id, empresa_id, ejecutivo_venta_id, companies(name, razon_social), documento_productos(cantidad, precio_unitario, subtotal, unidades_equivalentes, productos(codigo, nombre_producto))"
        )
        .eq("empresa_vendedora", marca as never)
        .eq("tipo_documento", "factura")
        .neq("estatus_factura", "cancelada")
        .or("numero_factura.is.null,numero_factura.not.ilike.RFC*")
        .gte("fecha_documento", desde)
        .lt("fecha_documento", hasta);
      if (plazasFiltro) q = q.in("plaza_id", plazasFiltro.length ? plazasFiltro : ["00000000-0000-0000-0000-000000000000"]);
      const { data, error } = await q.order("fecha_documento", { ascending: false }).limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as FacturaRow[];
    },
  });

  const grupos: Grupo[] = useMemo(() => {
    const map = new Map<string, Grupo>();
    for (const f of facturas) {
      const key = f.ejecutivo_venta_id ?? "__sin__";
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          nombre: f.ejecutivo_venta_id
            ? nombreEjecutivo.get(f.ejecutivo_venta_id) ?? "Ejecutivo no identificado"
            : "Sin ejecutivo asignado",
          facturas: [], unidades: 0, importe: 0, conIva: 0,
        };
        map.set(key, g);
      }
      g.facturas.push(f);
      g.unidades += Number(f.unidades_equivalentes_total ?? 0);
      g.importe += Number(f.subtotal ?? 0);
      g.conIva += Number(f.total ?? 0);
    }
    return Array.from(map.values()).sort((a, b) => b.unidades - a.unidades || b.importe - a.importe);
  }, [facturas, nombreEjecutivo]);

  const totalUnidades = grupos.reduce((a, g) => a + g.unidades, 0);
  const totalImporte = grupos.reduce((a, g) => a + g.importe, 0);
  const totalConIva = grupos.reduce((a, g) => a + g.conIva, 0);
  const lider = grupos[0];

  const chartData = useMemo(
    () =>
      grupos.map((g, i) => ({
        name: g.nombre,
        corto: g.nombre.length > 18 ? `${g.nombre.slice(0, 17)}…` : g.nombre,
        valor: metrica === "unidades" ? g.unidades : g.importe,
        color: COLORS[i % COLORS.length],
      })),
    [grupos, metrica]
  );

  const fechaTxt = (v: string | null) => {
    if (!v) return "—";
    const d = v.includes("T") ? v.slice(0, 10) : v;
    const [y, m, dd] = d.split("-");
    return dd && m && y ? `${dd}/${m}/${y}` : v;
  };

  const toggle = (k: string) => setAbiertos((s) => ({ ...s, [k]: !s[k] }));

  return (
    <>
      <div className="container mx-auto px-4 pt-4">
        <BackButton fallback="/reports" label="Volver a Reportes" />
      </div>
      <PageBanner
        title="Reporte de Unidades e Importes Vendidas — Agrupado por Ejecutivo"
        description="Participación por responsable de venta en unidades equivalentes e importes, con gráficas y detalle por factura."
      />
      <div className="container mx-auto p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border overflow-hidden">
            {MARCAS.map((m) => (
              <button
                key={m.v}
                type="button"
                onClick={() => setMarca(m.v)}
                aria-pressed={marca === m.v}
                className={cn("px-4 py-1.5 text-xs font-semibold transition-all", marca === m.v ? PILL[m.v].active : PILL[m.v].idle)}
              >
                {m.l}
              </button>
            ))}
          </div>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="h-8 w-44 rounded-full text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {periodos.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => setAuditOpen(true)}
            className="ml-auto h-8 bg-gradient-to-br from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700 text-white shadow-md text-[10px] font-semibold uppercase tracking-widest"
          >
            <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />Auditar con ContPAQi
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Plaza:</span>
          <button
            type="button"
            onClick={() => setPlazaSel([])}
            aria-pressed={plazaSel.length === 0}
            className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition-all", plazaSel.length === 0 ? pill.active : pill.idle)}
          >
            Todas
          </button>
          {[{ id: "costa", nombre: "Zona Costa" }, ...plazas.map((p) => ({ id: p.id, nombre: p.nombre ?? "" }))].map((p) => {
            const active = plazaSel.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlazaSel((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))}
                aria-pressed={active}
                className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition-all", active ? pill.active : pill.idle)}
              >
                {p.nombre}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Unidades equivalentes — {periodoLabel}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-light tracking-tight tabular-nums">{fmt(totalUnidades)}</div>
              <p className="text-xs text-muted-foreground mt-1 font-light">
                {facturas.length} factura{facturas.length === 1 ? "" : "s"} · {grupos.length} ejecutivo{grupos.length === 1 ? "" : "s"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Importe facturado (sin IVA)
              </CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-light tracking-tight tabular-nums">{mxn(totalImporte)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Total con IVA
              </CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-light tracking-tight tabular-nums">{mxn(totalConIva)}</div></CardContent>
          </Card>
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
            <CardHeader className="pb-1">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5" />Ejecutivo líder
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-base font-medium tracking-tight truncate">{lider?.nombre ?? "—"}</div>
              <p className="text-xs text-amber-700 mt-1 font-light tabular-nums">
                {lider ? `${fmt(lider.unidades)} UE · ${totalUnidades ? ((lider.unidades / totalUnidades) * 100).toFixed(1) : 0}% del total` : "Sin datos"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Gráficas por:</span>
          {([["unidades", "Unidades equivalentes"], ["importe", "Importe sin IVA"]] as const).map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => setMetrica(v)}
              aria-pressed={metrica === v}
              className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition-all", metrica === v ? pill.active : pill.idle)}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Participación por ejecutivo
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[340px]">
              {chartData.length === 0 ? (
                <div className="h-full grid place-items-center text-sm text-muted-foreground">Sin datos</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} dataKey="valor" nameKey="corto" cx="50%" cy="45%" outerRadius={95} innerRadius={45} paddingAngle={2}>
                      {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number, _n, p) => [metrica === "unidades" ? `${fmt(v)} UE` : mxn2(v), (p?.payload as { name?: string })?.name ?? ""]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Ranking de ejecutivos
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[340px]">
              {chartData.length === 0 ? (
                <div className="h-full grid place-items-center text-sm text-muted-foreground">Sin datos</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => (metrica === "unidades" ? fmt(Number(v)) : mxn(Number(v)))} />
                    <YAxis type="category" dataKey="corto" width={130} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => (metrica === "unidades" ? `${fmt(v)} UE` : mxn2(v))} />
                    <Bar dataKey="valor" radius={[0, 6, 6, 0]}>
                      {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      <LabelList
                        dataKey="valor"
                        position="right"
                        style={{ fontSize: 10 }}
                        formatter={(v: number) => (metrica === "unidades" ? fmt(v) : mxn(v))}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">Cargando...</CardContent></Card>
        ) : grupos.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">Sin facturas en este periodo</CardContent></Card>
        ) : (
          grupos.map((g, gi) => {
            const abierto = abiertos[g.key] ?? false;
            const pct = totalUnidades ? (g.unidades / totalUnidades) * 100 : 0;
            return (
              <Card key={g.key} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggle(g.key)}
                  className="w-full flex flex-wrap items-center gap-3 px-4 py-3 bg-gradient-to-r from-violet-50/60 to-blue-50/60 border-b border-border/40 text-left hover:from-violet-100/60 hover:to-blue-100/60 transition-colors"
                >
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ background: COLORS[gi % COLORS.length] }} />
                  {abierto ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <span className="font-medium tracking-tight">{g.nombre}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {g.facturas.length} factura{g.facturas.length === 1 ? "" : "s"}
                  </span>
                  <span className="ml-auto flex flex-wrap items-center gap-4 tabular-nums">
                    <span className="text-right">
                      <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Unidades</span>
                      <span className="text-lg font-light">{fmt(g.unidades)}</span>
                      <span className="ml-1 text-[11px] text-muted-foreground">({pct.toFixed(1)}%)</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Importe s/IVA</span>
                      <span className="text-lg font-light">{mxn(g.importe)}</span>
                    </span>
                    <span className="text-right hidden sm:block">
                      <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Con IVA</span>
                      <span className="text-lg font-light">{mxn(g.conIva)}</span>
                    </span>
                  </span>
                </button>
                {abierto && (
                  <CardContent className="p-0 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Factura</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Estatus</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Código</TableHead>
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-right">Cant.</TableHead>
                          <TableHead className="text-right">Unidades</TableHead>
                          <TableHead className="text-right">Precio</TableHead>
                          <TableHead className="text-right">Importe</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {g.facturas.map((f) => {
                          const lineas = f.documento_productos ?? [];
                          const suma = lineas.reduce((a, l) => a + Number(l.unidades_equivalentes ?? 0), 0);
                          const sumaImporte = lineas.reduce((a, l) => a + Number(l.subtotal ?? 0), 0);
                          const totalUE = Number(f.unidades_equivalentes_total ?? 0);
                          const docSubtotal = Number(f.subtotal ?? 0);
                          const desfase = Math.abs(suma - totalUE) > 0.01;
                          const desfaseImporte = Math.abs(sumaImporte - docSubtotal) > 0.5;
                          const span = Math.max(lineas.length, 1) + 1;
                          const cliente = (
                            <div className="flex flex-col gap-1">
                              <span>{f.companies?.name || f.companies?.razon_social || "—"}</span>
                              {f.companies?.name && f.companies?.razon_social && (
                                <span className="text-[11px] text-muted-foreground">{f.companies.razon_social}</span>
                              )}
                              <GrupoComercialBadge nombre={grupoNombre(f.empresa_id)} className="w-fit" />
                            </div>
                          );
                          const numeroCell = (
                            <a
                              href={`/documents/${f.id}/edit`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                            >
                              {f.numero_factura || "—"}<ExternalLink className="h-3 w-3" />
                            </a>
                          );
                          return (
                            <Fragment key={f.id}>
                              {lineas.length === 0 ? (
                                <TableRow>
                                  <TableCell rowSpan={span} className="align-top">{numeroCell}</TableCell>
                                  <TableCell rowSpan={span} className="align-top">{cliente}</TableCell>
                                  <TableCell rowSpan={span} className="align-top">{ESTATUS_LABEL[f.estatus_factura ?? ""] ?? f.estatus_factura ?? "—"}</TableCell>
                                  <TableCell rowSpan={span} className="align-top tabular-nums text-xs">{fechaTxt(f.fecha_documento)}</TableCell>
                                  <TableCell colSpan={6} className="text-destructive font-medium">Sin productos capturados</TableCell>
                                </TableRow>
                              ) : (
                                lineas.map((l, i) => (
                                  <TableRow key={`${f.id}-${i}`}>
                                    {i === 0 && (
                                      <>
                                        <TableCell rowSpan={span} className="align-top">{numeroCell}</TableCell>
                                        <TableCell rowSpan={span} className="align-top">{cliente}</TableCell>
                                        <TableCell rowSpan={span} className="align-top">{ESTATUS_LABEL[f.estatus_factura ?? ""] ?? f.estatus_factura ?? "—"}</TableCell>
                                        <TableCell rowSpan={span} className="align-top tabular-nums text-xs">{fechaTxt(f.fecha_documento)}</TableCell>
                                      </>
                                    )}
                                    <TableCell className="font-mono text-xs">{l.productos?.codigo || "—"}</TableCell>
                                    <TableCell className="text-sm">{l.productos?.nombre_producto || "—"}</TableCell>
                                    <TableCell className="text-right tabular-nums">{fmt(Number(l.cantidad ?? 0))}</TableCell>
                                    <TableCell className="text-right tabular-nums">{fmt(Number(l.unidades_equivalentes ?? 0))}</TableCell>
                                    <TableCell className="text-right tabular-nums">{mxn2(Number(l.precio_unitario ?? 0))}</TableCell>
                                    <TableCell className="text-right tabular-nums">{mxn2(Number(l.subtotal ?? 0))}</TableCell>
                                  </TableRow>
                                ))
                              )}
                              <TableRow className="bg-muted/40">
                                <TableCell colSpan={4} className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                  Acumulado de la factura
                                </TableCell>
                                <TableCell colSpan={3} />
                                <TableCell className={cn("text-right font-semibold tabular-nums", desfase && "text-destructive")}>
                                  {fmt(suma)}
                                  {desfase && <span className="ml-2 text-xs font-normal">(doc: {fmt(totalUE)})</span>}
                                </TableCell>
                                <TableCell colSpan={2} className={cn("text-right font-semibold tabular-nums", desfaseImporte && "text-destructive")}>
                                  {mxn2(sumaImporte)}
                                  {desfaseImporte && <span className="ml-2 text-xs font-normal">(doc: {mxn2(docSubtotal)})</span>}
                                </TableCell>
                              </TableRow>
                            </Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>

      <ContpaqiConciliacionDialog
        open={auditOpen}
        onOpenChange={setAuditOpen}
        marca={marca}
        desde={desde}
        hasta={hasta}
        periodoLabel={periodoLabel}
      />
    </>
  );
}
