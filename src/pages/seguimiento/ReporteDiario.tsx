import { useEffect, useMemo, useState } from "react";
import { format, startOfMonth, startOfWeek, subDays } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { CalendarIcon, FileSpreadsheet, FileText, FileDown, Copy } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageBanner } from "@/components/PageBanner";
import { BackButton } from "@/components/BackButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const EMPRESA_LABELS: Record<string, string> = {
  lumaggs_chevron: "Lumaggs (Chevron)",
  galsa_phillips66: "Galsa (Phillips 66)",
};

interface EjecutivoOption {
  user_id: string;
  full_name: string | null;
}

interface DocRow {
  id: string;
  tipo: string;
  folio: string;
  empresaVendedora: string;
  cliente: string;
  empresaId: string | null;
  total: number;
  unidades: number;
  ejecutivoId: string | null;
}

interface CobranzaRow {
  id: string;
  cliente: string;
  empresaVendedora: string;
  metodoPago: string;
  importe: number;
  facturas: string[];
  creadoPor: string | null;
}

interface ActividadRow {
  id: string;
  userId: string | null;
  cliente: string;
  empresaId: string | null;
  tipo: string;
  descripcion: string;
  promedioHistorico: number | null;
}

interface ReporteData {
  cotizaciones: DocRow[];
  facturas: DocRow[];
  cobranza: CobranzaRow[];
  actividades: ActividadRow[];
}

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });
const num = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 2 });

export default function ReporteDiario() {
  const { user, hasAnyRole } = useAuth();
  const esGerencia = hasAnyRole(["admin", "manager"]);

  type PeriodoKey = "ayer" | "hoy" | "semana" | "mes" | "periodo";
  const [periodo, setPeriodo] = useState<PeriodoKey>("hoy");
  const [rango, setRango] = useState<DateRange | undefined>({ from: new Date(), to: new Date() });
  const [seleccion, setSeleccion] = useState<string[] | null>(null);
  const [params, setParams] = useState<{ fechaInicio: string; fechaFin: string; ids: string[] } | null>(null);
  const [textoOpen, setTextoOpen] = useState(false);
  const [textoValor, setTextoValor] = useState("");

  const ymd = (d: Date) => format(d, "yyyy-MM-dd");
  const { fechaInicio, fechaFin } = useMemo(() => {
    const hoy = new Date();
    if (periodo === "ayer") {
      const a = subDays(hoy, 1);
      return { fechaInicio: ymd(a), fechaFin: ymd(a) };
    }
    if (periodo === "hoy") return { fechaInicio: ymd(hoy), fechaFin: ymd(hoy) };
    if (periodo === "semana")
      return { fechaInicio: ymd(startOfWeek(hoy, { weekStartsOn: 1 })), fechaFin: ymd(hoy) };
    if (periodo === "mes") return { fechaInicio: ymd(startOfMonth(hoy)), fechaFin: ymd(hoy) };
    const from = rango?.from ?? hoy;
    const to = rango?.to ?? from;
    return { fechaInicio: ymd(from), fechaFin: ymd(to) };
  }, [periodo, rango]);

  const { data: ejecutivos = [] } = useQuery({
    queryKey: ["reporte-diario-ejecutivos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return (data || []) as EjecutivoOption[];
    },
  });

  const selectedIds = useMemo(() => {
    if (seleccion) return seleccion;
    if (esGerencia) return ejecutivos.map((e) => e.user_id);
    return user?.id ? [user.id] : [];
  }, [seleccion, esGerencia, ejecutivos, user?.id]);

  const toggle = (id: string) => {
    if (!esGerencia && id !== user?.id) return;
    setSeleccion((prev) => {
      const base = prev ?? selectedIds;
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    });
  };

  const seleccionarTodos = () => {
    if (!esGerencia) return;
    setSeleccion(ejecutivos.map((e) => e.user_id));
  };
  const deseleccionarTodos = () => {
    if (!esGerencia) return;
    setSeleccion([]);
  };

  const nombreDe = (id: string | null) =>
    (id && ejecutivos.find((e) => e.user_id === id)?.full_name) || "Sin nombre";

  const { data: reporte, isFetching } = useQuery({
    queryKey: ["reporte-diario-consolidado", params?.fechaInicio, params?.fechaFin, params?.ids],
    enabled: !!params && (params?.ids.length || 0) > 0,
    queryFn: async (): Promise<ReporteData> => {
      const desde = params!.fechaInicio;
      const hasta = params!.fechaFin;
      const ids = params!.ids;
      const startIso = new Date(`${desde}T00:00:00`).toISOString();
      const endIso = new Date(`${hasta}T23:59:59.999`).toISOString();

      const [docsRes, pagosRes, actsRes] = await Promise.all([
        supabase
          .from("documentos")
          .select(
            "id, tipo_documento, numero_factura, numero_cotizacion, empresa_vendedora, total, estatus_factura, empresa_id, ejecutivo_venta_id, companies:empresa_id(name)"
          )
          .in("tipo_documento", ["factura", "cotizacion"])
          .or("numero_factura.is.null,numero_factura.not.ilike.RFC*")
          .eq("is_active", true)
          .gte("fecha_documento", desde)
          .lte("fecha_documento", hasta)
          .in("ejecutivo_venta_id", ids),
        supabase
          .from("cobranza_pagos")
          .select("id, empresa_id, empresa_vendedora, monto_total, metodo_pago, creado_por, companies:empresa_id(name)")
          .gte("fecha_pago", desde)
          .lte("fecha_pago", hasta)
          .in("creado_por", ids),
        supabase
          .from("crm_activities")
          .select("id, user_id, company_id, title, description, type, activity_date, companies:company_id(name)")
          .gte("activity_date", startIso)
          .lte("activity_date", endIso)
          .in("user_id", ids)
          .order("activity_date"),
      ]);

      for (const r of [docsRes, pagosRes, actsRes]) if (r.error) throw r.error;

      const docsRaw = ((docsRes.data || []) as any[]).filter(
        (d) => d.estatus_factura !== "cancelada"
      );
      const docIds = docsRaw.map((d) => d.id);

      // Unidades equivalentes calculadas línea por línea
      const unidadesMap = new Map<string, number>();
      if (docIds.length > 0) {
        const { data: lineas, error: linErr } = await supabase
          .from("documento_productos")
          .select(
            "documento_id, cantidad, documentos!inner(id), productos!inner(presentacion_id, presentaciones!inner(unidades_equivalentes))"
          )
          .in("documento_id", docIds);
        if (linErr) throw linErr;
        for (const l of (lineas || []) as any[]) {
          const ue = Number(l.productos?.presentaciones?.unidades_equivalentes) || 1;
          const uds = (Number(l.cantidad) || 0) * ue;
          unidadesMap.set(l.documento_id, (unidadesMap.get(l.documento_id) || 0) + uds);
        }
      }

      const mapDoc = (d: any): DocRow => ({
        id: d.id,
        tipo: d.tipo_documento,
        folio: (d.tipo_documento === "factura" ? d.numero_factura : d.numero_cotizacion) || "—",
        empresaVendedora: d.empresa_vendedora || "sin_empresa",
        cliente: d.companies?.name || "Sin empresa",
        total: Number(d.total) || 0,
        unidades: unidadesMap.get(d.id) || 0,
        ejecutivoId: d.ejecutivo_venta_id || null,
      });

      const cotizaciones = docsRaw.filter((d) => d.tipo_documento === "cotizacion").map(mapDoc);
      const facturas = docsRaw.filter((d) => d.tipo_documento === "factura").map(mapDoc);

      const pagos = (pagosRes.data || []) as any[];
      const pagoIds = pagos.map((p) => p.id);
      const aplicMap = new Map<string, string[]>();
      if (pagoIds.length > 0) {
        const { data: aplic, error: aplicErr } = await supabase
          .from("cobranza_aplicaciones")
          .select("pago_id, documento_id, documentos:documento_id(numero_factura)")
          .in("pago_id", pagoIds);
        if (aplicErr) throw aplicErr;
        for (const a of (aplic || []) as any[]) {
          const folio = a.documentos?.numero_factura;
          if (!folio) continue;
          const arr = aplicMap.get(a.pago_id) || [];
          arr.push(folio);
          aplicMap.set(a.pago_id, arr);
        }
      }

      const cobranza: CobranzaRow[] = pagos.map((p) => ({
        id: p.id,
        cliente: p.companies?.name || "Sin empresa",
        empresaVendedora: p.empresa_vendedora || "sin_empresa",
        metodoPago: p.metodo_pago || "—",
        importe: Number(p.monto_total) || 0,
        facturas: aplicMap.get(p.id) || [],
      }));

      const actividades: ActividadRow[] = ((actsRes.data || []) as any[]).map((a) => ({
        id: a.id,
        userId: a.user_id || null,
        cliente: a.companies?.name || "Sin empresa",
        tipo: a.type || "—",
        descripcion: (a.description || "").trim() || a.title || "",
      }));

      return { cotizaciones, facturas, cobranza, actividades };
    },
  });

  // Acumulado del mes (día 1 del mes hasta la fecha seleccionada), por marca
  const { data: acumMes } = useQuery({
    queryKey: ["reporte-diario-acum-mes", params?.fecha, params?.ids],
    enabled: !!params && (params?.ids.length || 0) > 0,
    queryFn: async () => {
      const day = params!.fecha;
      const ids = params!.ids;
      const mesStart = `${day.slice(0, 8)}01`;

      const { data: docsMes, error: docsErr } = await supabase
        .from("documentos")
        .select("id, empresa_vendedora, total")
        .eq("tipo_documento", "factura")
        .eq("is_active", true)
        .neq("estatus_factura", "cancelada")
        .or("numero_factura.is.null,numero_factura.not.ilike.RFC*")
        .gte("fecha_documento", mesStart)
        .lte("fecha_documento", day)
        .in("ejecutivo_venta_id", ids);
      if (docsErr) throw docsErr;

      const rows = (docsMes || []) as any[];
      const docIds = rows.map((d) => d.id);

      const unidadesMap = new Map<string, number>();
      if (docIds.length > 0) {
        const { data: lineas, error: linErr } = await supabase
          .from("documento_productos")
          .select(
            "documento_id, cantidad, documentos!inner(id), productos!inner(presentacion_id, presentaciones!inner(unidades_equivalentes))"
          )
          .in("documento_id", docIds);
        if (linErr) throw linErr;
        for (const l of (lineas || []) as any[]) {
          const ue = Number(l.productos?.presentaciones?.unidades_equivalentes) || 1;
          const uds = (Number(l.cantidad) || 0) * ue;
          unidadesMap.set(l.documento_id, (unidadesMap.get(l.documento_id) || 0) + uds);
        }
      }

      const agg = {
        udsLumaggs: 0,
        udsGalsa: 0,
        impLumaggs: 0,
        impGalsa: 0,
      };
      for (const d of rows) {
        const uds = unidadesMap.get(d.id) || 0;
        const imp = Number(d.total) || 0;
        if (d.empresa_vendedora === "lumaggs_chevron") {
          agg.udsLumaggs += uds;
          agg.impLumaggs += imp;
        } else if (d.empresa_vendedora === "galsa_phillips66") {
          agg.udsGalsa += uds;
          agg.impGalsa += imp;
        }
      }
      return agg;
    },
  });

  const hayDatos = !!reporte;

  const kpis = useMemo(() => {
    const f = reporte?.facturas || [];
    const c = reporte?.cobranza || [];
    const sum = (arr: DocRow[], k: string) =>
      arr.filter((x) => x.empresaVendedora === k).reduce((s, x) => s + x.unidades, 0);
    const sumC = (k: string) =>
      c.filter((x) => x.empresaVendedora === k).reduce((s, x) => s + x.importe, 0);
    return {
      udsLumaggs: sum(f, "lumaggs_chevron"),
      udsGalsa: sum(f, "galsa_phillips66"),
      cobLumaggs: sumC("lumaggs_chevron"),
      cobGalsa: sumC("galsa_phillips66"),
    };
  }, [reporte]);

  const totalUdsCotizadas = useMemo(
    () => (reporte?.cotizaciones || []).reduce((s, x) => s + x.unidades, 0),
    [reporte]
  );

  const facturasPorMarca = (key: string) => (reporte?.facturas || []).filter((f) => f.empresaVendedora === key);

  const generar = () => {
    if (selectedIds.length === 0) {
      toast.error("Selecciona al menos un ejecutivo");
      return;
    }
    setParams({ fecha: format(fecha, "yyyy-MM-dd"), ids: selectedIds });
  };

  const descargarExcel = () => {
    if (!reporte) {
      toast.error("Primero genera el reporte");
      return;
    }
    const day = params!.fecha;
    const aoa: (string | number)[][] = [];
    aoa.push([`Reporte diario consolidado`]);
    aoa.push([`Fecha: ${day}`]);
    aoa.push([]);
    aoa.push(["Indicadores"]);
    aoa.push(["Unidades vendidas — Lumaggs", kpis.udsLumaggs]);
    aoa.push(["Unidades vendidas — Galsa", kpis.udsGalsa]);
    aoa.push(["Total cobrado — Lumaggs", kpis.cobLumaggs]);
    aoa.push(["Total cobrado — Galsa", kpis.cobGalsa]);
    aoa.push([`Acumulado en el mes (al ${day})`]);
    aoa.push(["Unidades del mes — Lumaggs", acumMes?.udsLumaggs ?? 0]);
    aoa.push(["Unidades del mes — Galsa", acumMes?.udsGalsa ?? 0]);
    aoa.push(["Importe del mes — Lumaggs", acumMes?.impLumaggs ?? 0]);
    aoa.push(["Importe del mes — Galsa", acumMes?.impGalsa ?? 0]);
    aoa.push([]);

    aoa.push(["Actividades del día"]);
    aoa.push(["Realizó", "Cliente", "Tipo", "Descripción"]);
    if (reporte.actividades.length === 0) aoa.push(["Sin actividades", "", "", ""]);
    reporte.actividades.forEach((a) =>
      aoa.push([nombreDe(a.userId), a.cliente, a.tipo, a.descripcion])
    );
    aoa.push([]);

    aoa.push(["Cotizaciones realizadas"]);
    aoa.push(["Empresa", "Cliente", "Folio", "Unidades", "Importe"]);
    if (reporte.cotizaciones.length === 0) aoa.push(["Sin cotizaciones", "", "", 0, 0]);
    reporte.cotizaciones.forEach((c) =>
      aoa.push([
        EMPRESA_LABELS[c.empresaVendedora] || c.empresaVendedora,
        c.cliente,
        c.folio,
        c.unidades,
        c.total,
      ])
    );
    aoa.push(["Total unidades cotizadas", "", "", totalUdsCotizadas, ""]);
    aoa.push([]);

    aoa.push(["Facturas elaboradas"]);
    for (const key of ["lumaggs_chevron", "galsa_phillips66"]) {
      const rows = facturasPorMarca(key);
      aoa.push([EMPRESA_LABELS[key]]);
      aoa.push(["Cliente", "Folio", "Unidades", "Importe"]);
      if (rows.length === 0) aoa.push(["Sin facturas", "", 0, 0]);
      rows.forEach((f) => aoa.push([f.cliente, f.folio, f.unidades, f.total]));
      aoa.push(["Total unidades", "", rows.reduce((s, f) => s + f.unidades, 0), ""]);
      aoa.push([]);
    }

    aoa.push(["Desglose de cobranza"]);
    aoa.push(["Empresa", "Forma de pago", "Importe", "Facturas relacionadas"]);
    if (reporte.cobranza.length === 0) aoa.push(["Sin cobranza", "", 0, ""]);
    reporte.cobranza.forEach((c) =>
      aoa.push([c.cliente, c.metodoPago, c.importe, c.facturas.length ? c.facturas.join(", ") : "Sin aplicar"])
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Reporte diario");
    XLSX.writeFile(wb, `reporte_diario_${day}.xlsx`);
  };

  const descargarPDF = () => {
    if (!reporte) {
      toast.error("Primero genera el reporte");
      return;
    }
    const day = params!.fecha;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`Reporte diario — ${format(fecha, "PPP", { locale: es })}`, 14, 16);
    doc.setFontSize(10);
    doc.text(
      [
        `Unidades vendidas — Lumaggs: ${num(kpis.udsLumaggs)}`,
        `Unidades vendidas — Galsa: ${num(kpis.udsGalsa)}`,
        `Total cobrado — Lumaggs: ${money(kpis.cobLumaggs)}`,
        `Total cobrado — Galsa: ${money(kpis.cobGalsa)}`,
      ],
      14,
      24
    );
    doc.text(
      [
        `Acumulado del mes (al ${day}):`,
        `Unidades del mes — Lumaggs: ${num(acumMes?.udsLumaggs ?? 0)}`,
        `Unidades del mes — Galsa: ${num(acumMes?.udsGalsa ?? 0)}`,
        `Importe del mes — Lumaggs: ${money(acumMes?.impLumaggs ?? 0)}`,
        `Importe del mes — Galsa: ${money(acumMes?.impGalsa ?? 0)}`,
      ],
      14,
      42
    );

    let y = 66;
    const sec = (titulo: string, head: string[], body: (string | number)[][]) => {
      doc.setFontSize(11);
      doc.text(titulo, 14, y);
      autoTable(doc, {
        startY: y + 3,
        head: [head],
        body: body.length ? body : [head.map((_, i) => (i === 0 ? "Sin registros" : ""))],
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [71, 85, 105] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
      if (y > doc.internal.pageSize.getHeight() - 30) {
        doc.addPage();
        y = 16;
      }
    };

    sec(
      "Actividades del día",
      ["Realizó", "Cliente", "Tipo", "Descripción"],
      reporte.actividades.map((a) => [nombreDe(a.userId), a.cliente, a.tipo, a.descripcion])
    );

    sec(
      `Cotizaciones realizadas (total unidades: ${num(totalUdsCotizadas)})`,
      ["Empresa", "Cliente", "Folio", "Unidades", "Importe"],
      reporte.cotizaciones.map((c) => [
        EMPRESA_LABELS[c.empresaVendedora] || c.empresaVendedora,
        c.cliente,
        c.folio,
        num(c.unidades),
        money(c.total),
      ])
    );

    for (const key of ["lumaggs_chevron", "galsa_phillips66"]) {
      const rows = facturasPorMarca(key);
      sec(
        `Facturas elaboradas — ${EMPRESA_LABELS[key]} (total unidades: ${num(
          rows.reduce((s, f) => s + f.unidades, 0)
        )})`,
        ["Cliente", "Folio", "Unidades", "Importe"],
        rows.map((f) => [f.cliente, f.folio, num(f.unidades), money(f.total)])
      );
    }

    sec(
      "Desglose de cobranza",
      ["Empresa", "Forma de pago", "Importe", "Facturas relacionadas"],
      reporte.cobranza.map((c) => [
        c.cliente,
        c.metodoPago,
        money(c.importe),
        c.facturas.length ? c.facturas.join(", ") : "Sin aplicar",
      ])
    );

    doc.save(`reporte_diario_${day}.pdf`);
  };

  return (
    <div className="space-y-6">
      <BackButton />
      <PageBanner
        title="Reporte Diario"
        description="Resumen consolidado de ventas, cobranza y actividades del día"
        avatar={
          <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <FileText className="h-5 w-5" />
          </div>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-wide">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(fecha, "PPP", { locale: es })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fecha}
                  onSelect={(d) => d && setFecha(d)}
                  initialFocus
                  locale={es}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Button onClick={generar} disabled={isFetching}>
              {isFetching ? "Generando…" : "Generar reporte"}
            </Button>
            <Button variant="outline" onClick={descargarExcel} disabled={!hayDatos}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Descargar Excel
            </Button>
            <Button variant="outline" onClick={descargarPDF} disabled={!hayDatos}>
              <FileDown className="mr-2 h-4 w-4" />
              Descargar PDF
            </Button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ejecutivos
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={seleccionarTodos} disabled={!esGerencia}>
                  Seleccionar todos
                </Button>
                <Button size="sm" variant="ghost" onClick={deseleccionarTodos} disabled={!esGerencia}>
                  Deseleccionar todos
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {ejecutivos.map((e) => {
                const disabled = !esGerencia && e.user_id !== user?.id;
                return (
                  <label
                    key={e.user_id}
                    className={cn(
                      "flex items-center gap-2 text-sm rounded-md border px-2 py-1.5",
                      disabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Checkbox
                      checked={selectedIds.includes(e.user_id)}
                      disabled={disabled}
                      onCheckedChange={() => toggle(e.user_id)}
                    />
                    <span className="truncate">{e.full_name || "Sin nombre"}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {reporte && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Unidades vendidas — Lumaggs" value={num(kpis.udsLumaggs)} />
            <KpiCard label="Unidades vendidas — Galsa" value={num(kpis.udsGalsa)} />
            <KpiCard label="Total cobrado — Lumaggs" value={money(kpis.cobLumaggs)} />
            <KpiCard label="Total cobrado — Galsa" value={money(kpis.cobGalsa)} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Unidades del mes — Lumaggs" value={num(acumMes?.udsLumaggs ?? 0)} />
            <KpiCard label="Unidades del mes — Galsa" value={num(acumMes?.udsGalsa ?? 0)} />
            <KpiCard label="Importe del mes — Lumaggs" value={money(acumMes?.impLumaggs ?? 0)} />
            <KpiCard label="Importe del mes — Galsa" value={money(acumMes?.impGalsa ?? 0)} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase tracking-wide">Actividades del día</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Realizó</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descripción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reporte.actividades.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground text-sm">
                        Sin actividades registradas
                      </TableCell>
                    </TableRow>
                  ) : (
                    reporte.actividades.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap">{nombreDe(a.userId)}</TableCell>
                        <TableCell className="font-medium">{a.cliente}</TableCell>
                        <TableCell>{a.tipo}</TableCell>
                        <TableCell className="whitespace-pre-wrap">{a.descripcion}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase tracking-wide">Cotizaciones realizadas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Folio</TableHead>
                    <TableHead className="text-right">Unidades</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reporte.cotizaciones.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground text-sm">
                        Sin cotizaciones
                      </TableCell>
                    </TableRow>
                  ) : (
                    reporte.cotizaciones.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{EMPRESA_LABELS[c.empresaVendedora] || c.empresaVendedora}</TableCell>
                        <TableCell className="font-medium">{c.cliente}</TableCell>
                        <TableCell>{c.folio}</TableCell>
                        <TableCell className="text-right">{num(c.unidades)}</TableCell>
                        <TableCell className="text-right">{money(c.total)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <div className="border-t bg-muted/40 px-4 py-2 text-sm font-semibold">
                Total unidades cotizadas: {num(totalUdsCotizadas)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase tracking-wide">Facturas elaboradas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-0 pb-4">
              {(["lumaggs_chevron", "galsa_phillips66"] as const).map((key) => {
                const rows = facturasPorMarca(key);
                const totalUds = rows.reduce((s, f) => s + f.unidades, 0);
                return (
                  <div key={key}>
                    <p className="px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {EMPRESA_LABELS[key]}
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Folio</TableHead>
                          <TableHead className="text-right">Unidades</TableHead>
                          <TableHead className="text-right">Importe</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground text-sm">
                              Sin facturas
                            </TableCell>
                          </TableRow>
                        ) : (
                          <>
                            {rows.map((f) => (
                              <TableRow key={f.id}>
                                <TableCell className="font-medium">{f.cliente}</TableCell>
                                <TableCell>{f.folio}</TableCell>
                                <TableCell className="text-right">{num(f.unidades)}</TableCell>
                                <TableCell className="text-right">{money(f.total)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/40 font-semibold">
                              <TableCell colSpan={2}>Total unidades</TableCell>
                              <TableCell className="text-right">{num(totalUds)}</TableCell>
                              <TableCell className="text-right">
                                {money(rows.reduce((s, f) => s + f.total, 0))}
                              </TableCell>
                            </TableRow>
                          </>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase tracking-wide">Desglose de cobranza</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Forma de pago</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                    <TableHead>Facturas relacionadas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reporte.cobranza.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground text-sm">
                        Sin cobranza registrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    reporte.cobranza.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.cliente}</TableCell>
                        <TableCell>{c.metodoPago}</TableCell>
                        <TableCell className="text-right">{money(c.importe)}</TableCell>
                        <TableCell>{c.facturas.length ? c.facturas.join(", ") : "Sin aplicar"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-muted-foreground text-xs uppercase tracking-wide truncate">{label}</p>
        <p className="text-2xl font-semibold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
