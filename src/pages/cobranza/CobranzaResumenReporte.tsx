import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageBanner } from "@/components/PageBanner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { companyLabel } from "@/lib/companyLabel";
import { Wallet, Download } from "lucide-react";

type PeriodoKey = "hoy" | "ayer" | "semana" | "mes" | "periodo";
type AgrupacionKey = "plaza" | "tipo_pago" | "cliente";
type EmpresaFiltro = "todas" | "lumaggs_chevron" | "galsa_phillips66";

const PERIODOS: { key: PeriodoKey; label: string }[] = [
  { key: "hoy", label: "Hoy" },
  { key: "ayer", label: "Ayer" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mes" },
  { key: "periodo", label: "Periodo" },
];

const AGRUPACIONES: { key: AgrupacionKey; label: string }[] = [
  { key: "plaza", label: "Por plaza" },
  { key: "tipo_pago", label: "Por tipo de pago" },
  { key: "cliente", label: "Por cliente" },
];

const EMPRESAS_FILTRO: { key: EmpresaFiltro; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "lumaggs_chevron", label: "Lumaggs · Chevron" },
  { key: "galsa_phillips66", label: "Galsa · Phillips 66" },
];

const TIPO_PAGO_LABEL: Record<string, string> = {
  contado: "Contado",
  credito: "Crédito Directo",
  credito_directo: "Crédito Directo",
  credito_cescemex: "Cescemex",
  sin_tipo: "Sin tipo",
};

const TIPO_PAGO_CLASS: Record<string, string> = {
  contado: "bg-blue-100 text-blue-700 border-blue-200",
  credito: "bg-violet-100 text-violet-700 border-violet-200",
  credito_directo: "bg-violet-100 text-violet-700 border-violet-200",
  credito_cescemex: "bg-emerald-100 text-emerald-700 border-emerald-200",
  sin_tipo: "bg-amber-100 text-amber-700 border-amber-200",
};

const TIPOS_ORDEN = ["contado", "credito", "credito_cescemex", "sin_tipo"];

const METODO_LABEL: Record<string, string> = {
  transferencia: "Transferencia",
  cheque: "Cheque",
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  deposito: "Depósito",
};

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const tipoKey = (t: string | null) => (t && TIPO_PAGO_LABEL[t] ? t : "sin_tipo");

interface Fila {
  id: string;
  fecha: string;
  tipo: string;
  plazaId: string | null;
  plaza: string;
  cliente: string;
  metodo: string;
  referencia: string;
  facturas: string[];
  importe: number;
}

export default function CobranzaResumenReporte() {
  const { profile, hasAnyRole } = useAuth();
  const [periodo, setPeriodo] = useState<PeriodoKey>("hoy");
  const hoyStr = ymd(new Date());
  const [customDesde, setCustomDesde] = useState(hoyStr);
  const [customHasta, setCustomHasta] = useState(hoyStr);
  const [agrupacion, setAgrupacion] = useState<AgrupacionKey>("plaza");
  const [empresaFiltro, setEmpresaFiltro] = useState<EmpresaFiltro>("todas");
  const [plazaSel, setPlazaSel] = useState<string>("todas");

  // Alcance total: master y crédito/cobranza ven todas las plazas.
  const verTodo = hasAnyRole(["master", "accounting", "manager"]);

  const { desde, hasta } = useMemo(() => {
    const hoy = new Date();
    if (periodo === "hoy") return { desde: ymd(hoy), hasta: ymd(hoy) };
    if (periodo === "ayer") {
      const a = new Date(hoy);
      a.setDate(a.getDate() - 1);
      return { desde: ymd(a), hasta: ymd(a) };
    }
    if (periodo === "semana") {
      const d = new Date(hoy);
      const dow = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - dow);
      return { desde: ymd(d), hasta: ymd(hoy) };
    }
    if (periodo === "mes") {
      const d = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      return { desde: ymd(d), hasta: ymd(hoy) };
    }
    return { desde: customDesde, hasta: customHasta };
  }, [periodo, customDesde, customHasta]);

  const { data: plazas = [] } = useQuery({
    queryKey: ["plazas-active-reporte-cobranza"],
    queryFn: async () => {
      const { data } = await supabase.from("plazas").select("id, nombre").eq("is_active", true).order("nombre");
      return (data ?? []) as { id: string; nombre: string }[];
    },
  });

  // Plazas que el usuario puede ver (null = todas)
  const { data: plazasPermitidas = null } = useQuery({
    queryKey: ["plazas-permitidas-cobranza", profile?.user_id, verTodo],
    enabled: !!profile,
    queryFn: async () => {
      if (verTodo) return null;
      const ids = new Set<string>();
      if (profile?.user_id) {
        const { data } = await (supabase as any)
          .from("plaza_responsables")
          .select("plaza_id")
          .eq("user_id", profile.user_id);
        (data ?? []).forEach((r: any) => r.plaza_id && ids.add(r.plaza_id));
      }
      if (profile?.plaza_id) ids.add(profile.plaza_id);
      // Sin plaza asignada: no se le oculta nada (evita dejarlo sin datos).
      return ids.size ? Array.from(ids) : null;
    },
  });

  const plazasVisibles = useMemo(
    () => (plazasPermitidas ? plazas.filter((p) => plazasPermitidas.includes(p.id)) : plazas),
    [plazas, plazasPermitidas]
  );

  const plazaNombre = useMemo(() => {
    const m: Record<string, string> = {};
    plazas.forEach((p) => (m[p.id] = p.nombre));
    return m;
  }, [plazas]);

  const { data: filas = [], isLoading } = useQuery({
    queryKey: ["cobranza-resumen", desde, hasta, plazasPermitidas, plazaSel, empresaFiltro],
    queryFn: async () => {
      let q = supabase
        .from("cobranza_pagos")
        .select(
          "id, fecha_pago, monto_total, tipo_pago, metodo_pago, referencia_pago, plaza_id, empresa_vendedora, empresa_id, companies:empresa_id(name, razon_social)"
        )
        .gte("fecha_pago", desde)
        .lte("fecha_pago", hasta)
        .order("fecha_pago", { ascending: false });

      if (plazaSel !== "todas") q = q.eq("plaza_id", plazaSel);
      else if (plazasPermitidas) q = q.in("plaza_id", plazasPermitidas);
      if (empresaFiltro !== "todas") q = q.eq("empresa_vendedora", empresaFiltro as any);

      const { data, error } = await q;
      if (error) throw error;
      const pagos = (data ?? []) as any[];
      if (!pagos.length) return [] as Fila[];

      const ids = pagos.map((p) => p.id);
      const { data: aplics } = await supabase
        .from("cobranza_aplicaciones")
        .select("pago_id, documento_id, tipo_documento, monto_aplicado, estatus_aplicacion")
        .in("pago_id", ids)
        .eq("estatus_aplicacion", "activa");

      const docIds = Array.from(new Set((aplics ?? []).map((a: any) => a.documento_id).filter(Boolean)));
      const folioPorDoc: Record<string, string> = {};
      if (docIds.length) {
        const { data: docs } = await supabase
          .from("documentos")
          .select("id, numero_factura, numero_pedido")
          .in("id", docIds);
        (docs ?? []).forEach((d: any) => {
          folioPorDoc[d.id] = d.numero_factura || d.numero_pedido || "—";
        });
      }

      const facturasPorPago: Record<string, string[]> = {};
      (aplics ?? []).forEach((a: any) => {
        const folio = folioPorDoc[a.documento_id];
        if (!folio) return;
        (facturasPorPago[a.pago_id] ||= []).push(folio);
      });

      return pagos.map<Fila>((p) => ({
        id: p.id,
        fecha: p.fecha_pago,
        tipo: tipoKey(p.tipo_pago),
        plazaId: p.plaza_id ?? null,
        plaza: p.plaza_id ? plazaNombre[p.plaza_id] || "Sin plaza" : "Sin plaza",
        cliente: companyLabel(p.companies) || "Sin cliente",
        metodo: METODO_LABEL[p.metodo_pago] || p.metodo_pago || "—",
        referencia: p.referencia_pago || "",
        facturas: Array.from(new Set(facturasPorPago[p.id] ?? [])),
        importe: Number(p.monto_total || 0),
      }));
    },
  });

  const totalGeneral = filas.reduce((a, f) => a + f.importe, 0);

  const totalesPorTipo = useMemo(() => {
    const m: Record<string, number> = {};
    filas.forEach((f) => (m[f.tipo] = (m[f.tipo] || 0) + f.importe));
    return m;
  }, [filas]);

  const grupos = useMemo(() => {
    const m = new Map<string, Fila[]>();
    filas.forEach((f) => {
      const k = agrupacion === "plaza" ? f.plaza : agrupacion === "tipo_pago" ? TIPO_PAGO_LABEL[f.tipo] : f.cliente;
      const arr = m.get(k) ?? [];
      arr.push(f);
      m.set(k, arr);
    });
    return Array.from(m.entries())
      .map(([nombre, items]) => ({
        nombre,
        items,
        total: items.reduce((a, i) => a + i.importe, 0),
        porTipo: items.reduce<Record<string, number>>((acc, i) => {
          acc[i.tipo] = (acc[i.tipo] || 0) + i.importe;
          return acc;
        }, {}),
      }))
      .sort((a, b) => b.total - a.total);
  }, [filas, agrupacion]);

  const exportar = () => {
    const rows: any[] = [];
    grupos.forEach((g) => {
      g.items.forEach((f) => {
        rows.push({
          Grupo: g.nombre,
          Fecha: f.fecha,
          Plaza: f.plaza,
          "Tipo de pago": TIPO_PAGO_LABEL[f.tipo],
          Cliente: f.cliente,
          "Método de pago": f.metodo,
          Referencia: f.referencia,
          "Facturas aplicadas": f.facturas.join(", "),
          "Importe pagado": f.importe,
        });
      });
      rows.push({ Grupo: `TOTAL ${g.nombre}`, "Importe pagado": g.total });
    });
    rows.push({ Grupo: "TOTAL GENERAL", "Importe pagado": totalGeneral });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cobranza");
    XLSX.writeFile(wb, `cobranza_${desde}_${hasta}.xlsx`);
  };

  const mostrarChipsTipo = agrupacion !== "tipo_pago" && agrupacion !== "cliente";

  return (
    <div className="space-y-5">
      <PageBanner
        title="Reporte de Cobranza"
        description="Resumen de pagos recibidos por periodo, plaza, tipo de pago y cliente"
        avatar={
          <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <Wallet className="h-5 w-5" />
          </div>
        }
      >
        <Button
          size="sm"
          variant="outline"
          onClick={exportar}
          disabled={!filas.length}
          className="border-violet-200 bg-gradient-to-r from-violet-50 to-blue-50 text-violet-700 hover:from-violet-100 hover:to-blue-100 hover:text-violet-800 text-[10px] font-semibold uppercase tracking-widest"
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Exportar Excel
        </Button>
      </PageBanner>

      {/* Filtros */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Periodo</Label>
            <div className="flex flex-wrap gap-2">
              {PERIODOS.map((p) => (
                <Button
                  key={p.key}
                  size="sm"
                  variant={periodo === p.key ? "default" : "outline"}
                  onClick={() => setPeriodo(p.key)}
                  className="rounded-full"
                >
                  {p.label}
                </Button>
              ))}
            </div>
            {periodo === "periodo" && (
              <div className="flex flex-wrap gap-3 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs">Desde</Label>
                  <Input type="date" value={customDesde} onChange={(e) => setCustomDesde(e.target.value)} className="w-[170px]" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hasta</Label>
                  <Input type="date" value={customHasta} onChange={(e) => setCustomHasta(e.target.value)} className="w-[170px]" />
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Agrupar</Label>
              <div className="flex flex-wrap gap-2">
                {AGRUPACIONES.map((a) => (
                  <Button
                    key={a.key}
                    size="sm"
                    variant={agrupacion === a.key ? "default" : "outline"}
                    onClick={() => setAgrupacion(a.key)}
                    className="rounded-full text-xs"
                  >
                    {a.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Empresa</Label>
              <div className="flex flex-wrap gap-2">
                {EMPRESAS_FILTRO.map((e) => (
                  <Button
                    key={e.key}
                    size="sm"
                    variant={empresaFiltro === e.key ? "default" : "outline"}
                    onClick={() => setEmpresaFiltro(e.key)}
                    className="rounded-full text-xs"
                  >
                    {e.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Plaza</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={plazaSel === "todas" ? "default" : "outline"}
                  onClick={() => setPlazaSel("todas")}
                  className="rounded-full text-xs"
                >
                  {plazasPermitidas ? "Mis plazas" : "Todas"}
                </Button>
                {plazasVisibles.map((p) => (
                  <Button
                    key={p.id}
                    size="sm"
                    variant={plazaSel === p.id ? "default" : "outline"}
                    onClick={() => setPlazaSel(p.id)}
                    className="rounded-full text-xs"
                  >
                    {p.nombre}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground font-light">
            Del {formatDate(desde)} al {formatDate(hasta)}
            {plazasPermitidas ? " · Solo las plazas a tu cargo" : ""}
          </p>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50/70 to-transparent dark:from-emerald-950/20">
          <CardContent className="p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Total cobrado</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCurrency(totalGeneral)}</p>
            <p className="text-[11px] text-muted-foreground font-light">{filas.length} pagos</p>
          </CardContent>
        </Card>
        {TIPOS_ORDEN.map((t) => (
          <Card key={t} className="border-border/60">
            <CardContent className="p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {TIPO_PAGO_LABEL[t]}
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums">{formatCurrency(totalesPorTipo[t] || 0)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Grupos */}
      {isLoading && <p className="text-sm text-muted-foreground py-6 text-center">Cargando…</p>}
      {!isLoading && grupos.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">Sin pagos registrados en el periodo.</p>
      )}

      {grupos.map((g) => (
        <Card key={g.nombre} className="overflow-hidden border-border/60 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-violet-50/70 to-blue-50/70 px-4 py-3 border-b border-border/40">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold tracking-tight">{g.nombre}</span>
              <span className="text-[11px] text-muted-foreground font-light">{g.items.length} pagos</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {mostrarChipsTipo &&
                TIPOS_ORDEN.filter((t) => g.porTipo[t]).map((t) => (
                  <Badge key={t} variant="outline" className={`text-[10px] font-semibold ${TIPO_PAGO_CLASS[t]}`}>
                    {TIPO_PAGO_LABEL[t]}: {formatCurrency(g.porTipo[t])}
                  </Badge>
                ))}
              <span className="text-sm font-semibold tabular-nums">{formatCurrency(g.total)}</span>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo de pago</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Método de pago</TableHead>
                <TableHead>Facturas aplicadas</TableHead>
                <TableHead className="text-right">Importe pagado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {g.items.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(f.fecha)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] font-semibold ${TIPO_PAGO_CLASS[f.tipo]}`}>
                      {TIPO_PAGO_LABEL[f.tipo]}
                    </Badge>
                  </TableCell>
                  <TableCell>{f.cliente}</TableCell>
                  <TableCell>
                    {f.metodo}
                    {f.referencia && (
                      <span className="block text-xs text-muted-foreground">Ref. {f.referencia}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {f.facturas.length ? (
                      <span className="flex flex-wrap gap-1">
                        {f.facturas.map((n) => (
                          <Badge key={n} variant="secondary" className="text-[10px] font-mono">
                            {n}
                          </Badge>
                        ))}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Anticipo sin aplicar</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(f.importe)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ))}
    </div>
  );
}
