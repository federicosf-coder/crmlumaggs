import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { CobranzaReportInput } from "./generateCobranzaReportPdf";

export type ReportBrand = "lumaggs_chevron" | "galsa_phillips66";

// ===== Helpers (replicados de Cobranza.tsx para evitar acoplamiento) =====
function diasParaVencer(fechaVenc: string | null): number | null {
  if (!fechaVenc) return null;
  // Parsear la fecha como fecha LOCAL (evita el corrimiento de 1 día que provoca
  // `new Date("YYYY-MM-DD")`, que se interpreta como UTC en zonas con offset negativo).
  const [y, m, d] = String(fechaVenc).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const v = new Date(y, m - 1, d); v.setHours(0, 0, 0, 0);
  return Math.round((v.getTime() - hoy.getTime()) / 86400000);
}

function fechaVencimientoEfectiva(f: { fecha_documento?: string | null; fecha_vencimiento?: string | null; tipo_pago?: string | null }): string | null {
  const tp = (f.tipo_pago || "").toLowerCase();
  if (!f.fecha_documento) return f.fecha_vencimiento ?? null;
  if (tp === "contado") return f.fecha_documento;
  if (tp === "credito" || tp === "credito_directo" || tp === "credito_cescemex" || tp.includes("credito") || tp.includes("cescemex")) {
    const d = new Date(f.fecha_documento + "T12:00:00");
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }
  return f.fecha_vencimiento ?? null;
}

function bucketLabel(dias: number | null): string {
  if (dias === null) return "Sin vencimiento";
  if (dias < 0) return "Vencidas";
  if (dias === 0) return "Vencen hoy";
  if (dias <= 5) return "1-5 días";
  if (dias <= 10) return "6-10 días";
  if (dias <= 20) return "11-20 días";
  if (dias <= 30) return "21-30 días";
  return "Más de 30 días";
}

function tipoPagoLabel(value: string | null | undefined): string {
  const v = (value || "").toLowerCase();
  if (!v) return "—";
  if (v === "contado") return "Contado";
  if (v === "credito_cescemex" || v.includes("cescemex")) return "Crédito Cescemex";
  if (v === "credito" || v.includes("directo")) return "Crédito Directo";
  return value || "—";
}

/**
 * Construye el input del reporte de Cobranza haciendo sus propias consultas.
 * Respeta RLS — usa la sesión del usuario actual.
 */
export async function buildCobranzaReportInput(opts: {
  empresaVendedora: ReportBrand;
  plazaId?: string | null;
}): Promise<CobranzaReportInput> {
  const { empresaVendedora, plazaId = null } = opts;

  // Plazas y profiles (para mostrar nombre de plaza / ejecutivo)
  const [plazasRes, profilesRes] = await Promise.all([
    supabase.from("plazas").select("id, nombre").eq("is_active", true).order("nombre"),
    supabase.from("profiles").select("user_id, full_name").eq("is_active", true),
  ]);
  const plazasList = plazasRes.data || [];
  const profilesList = profilesRes.data || [];

  // Documentos (facturas)
  let dq: any = supabase
    .from("documentos")
    .select("id,tipo_documento,numero_factura,fecha_documento,fecha_vencimiento,total,saldo_pendiente_cobranza,estado_cobranza,estatus_factura,tipo_pago,empresa_id,plaza_id,ejecutivo_venta_id, empresa:companies(id,name), plaza:plazas(id,nombre)")
    .eq("is_active", true)
    .eq("tipo_documento", "factura")
    .eq("empresa_vendedora", empresaVendedora as any)
    .gt("total", 0);
  if (plazaId) dq = dq.eq("plaza_id", plazaId);
  const docsRes = await dq;
  const docs = (docsRes.data || []) as any[];
  const facturas = docs.filter((d) => {
    const ef = (d.estatus_factura || "").toString().toLowerCase();
    if (ef === "cancelada" || ef === "pagada") return false;
    if (Number(d.saldo_pendiente_cobranza || 0) <= 0) return false;
    return true;
  });

  // Pagos del mes (para Cobrado del mes y facturas pagadas del mes)
  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
  let pq: any = (supabase as any)
    .from("cobranza_pagos")
    .select("id, monto_total, fecha_pago, estado_pago")
    .gte("fecha_pago", inicioMes.toISOString())
    .neq("estado_pago", "cancelado")
    .eq("empresa_vendedora", empresaVendedora);
  if (plazaId) pq = pq.eq("plaza_id", plazaId);
  const pagosMesRes = await pq;
  const pagosMes = (pagosMesRes.data || []) as any[];
  const cobradoMes = pagosMes.reduce((s, p) => s + Number(p.monto_total || 0), 0);

  let facturasPagadasMes = 0;
  if (pagosMes.length > 0) {
    const ids = pagosMes.map((p) => p.id);
    const { data: aplics } = await supabase
      .from("cobranza_aplicaciones")
      .select("documento_id,tipo_documento,estatus_aplicacion,pago_id")
      .in("pago_id", ids)
      .eq("estatus_aplicacion", "activa")
      .eq("tipo_documento", "factura");
    const set = new Set<string>();
    (aplics || []).forEach((a: any) => { if (a.documento_id) set.add(a.documento_id); });
    facturasPagadasMes = set.size;
  }

  // ===== Clasificadores =====
  const isVencida = (f: any) => (f.estatus_factura || "").toString().toLowerCase() === "vencida";
  const isCreditoCescemex = (f: any) => (f.tipo_pago || "").toLowerCase().includes("cescemex");
  const isCreditoDirecto = (f: any) => !isCreditoCescemex(f);
  const sumSaldo = (arr: any[]) => arr.reduce((s, f) => s + Number(f.saldo_pendiente_cobranza || 0), 0);

  const directo = facturas.filter(isCreditoDirecto);
  const cescemex = facturas.filter(isCreditoCescemex);
  const vencidas = facturas.filter(isVencida);
  const enTiempo = facturas.filter((f) => !isVencida(f));
  const directoVencidas = directo.filter(isVencida);
  const directoEnTiempo = directo.filter((f) => !isVencida(f));
  const cescemexVencidas = cescemex.filter(isVencida);
  const cescemexEnTiempo = cescemex.filter((f) => !isVencida(f));

  const uniq = (arr: any[]) => new Set(arr.map((f) => f.empresa?.id || f.empresa?.name).filter(Boolean));
  const clientesVencidos = uniq(vencidas);
  const clientesVencidosDirecto = uniq(directoVencidas);
  const clientesVencidosCescemex = uniq(cescemexVencidas);
  const clientesEnTiempoDirecto = new Set(Array.from(uniq(directoEnTiempo)).filter((c) => !clientesVencidos.has(c)));
  const clientesEnTiempoCescemex = new Set(Array.from(uniq(cescemexEnTiempo)).filter((c) => !clientesVencidos.has(c)));
  const clientesVencidosTotal = clientesVencidosDirecto.size + clientesVencidosCescemex.size;
  const clientesEnTiempoTotal = clientesEnTiempoDirecto.size + clientesEnTiempoCescemex.size;
  const clientesTotalCount = clientesVencidosTotal + clientesEnTiempoTotal;

  const totalCount = facturas.length;
  const totalSaldo = sumSaldo(facturas);
  const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
  const fmtPct = (n: number, d: number) => `${pct(n, d).toFixed(1)}%`;

  // Buckets
  const buildBuckets = (lista: any[]) => {
    const orden = ["Vencidas", "Vencen hoy", "1-5 días", "6-10 días", "11-20 días", "21-30 días", "Más de 30 días"];
    const acc: Record<string, { count: number; monto: number }> = {};
    orden.forEach((b) => acc[b] = { count: 0, monto: 0 });
    lista.forEach((f) => {
      if (Number(f.saldo_pendiente_cobranza) <= 0) return;
      let lbl: string;
      if (isVencida(f)) lbl = "Vencidas";
      else {
        const dias = diasParaVencer(f.fecha_vencimiento ?? null);
        lbl = bucketLabel(dias);
        if (lbl === "Vencidas") return;
      }
      if (acc[lbl]) { acc[lbl].count++; acc[lbl].monto += Number(f.saldo_pendiente_cobranza); }
    });
    return orden.map((b) => ({ label: b, ...acc[b] }));
  };

  const buckets = buildBuckets(facturas);
  const bucketsDirecto = buildBuckets(directo);
  const bucketsCescemex = buildBuckets(cescemex);

  // Filas
  const formatCur = (n: number) => formatCurrency(n);
  const fmtDate = (d: string | null | undefined) => (d ? formatDate(d) : "-");
  const ejecutivoNombre = (id: string | null | undefined) => {
    if (!id) return "-";
    return (profilesList.find((p: any) => p.user_id === id) as any)?.full_name || "-";
  };
  const plazaNombre =
    plazaId
      ? (plazasList.find((p: any) => p.id === plazaId) as any)?.nombre || "—"
      : "Todas las plazas";

  const facturasVencidas = facturas.filter(isVencida).map((f) => {
    const fv = fechaVencimientoEfectiva(f);
    const dv = diasParaVencer(fv ?? null);
    return {
      numero: f.numero_factura || "-",
      cliente: f.empresa?.name || "Sin cliente",
      ejecutivo: ejecutivoNombre(f.ejecutivo_venta_id),
      plaza: f.plaza?.nombre || "-",
      fechaDocumento: fmtDate(f.fecha_documento),
      fechaVencimiento: fmtDate(fv),
      tipoPago: tipoPagoLabel(f.tipo_pago),
      total: Number(f.total || 0),
      saldo: Number(f.saldo_pendiente_cobranza || 0),
      dias: dv != null ? Math.max(0, -dv) : undefined,
    };
  });

  const facturasPorVencer = facturas
    .filter((f) => {
      if (isVencida(f)) return false;
      if (Number(f.saldo_pendiente_cobranza) <= 0) return false;
      const fv = fechaVencimientoEfectiva(f);
      const d = diasParaVencer(fv ?? null);
      return d != null && d >= 1 && d <= 5;
    })
    .map((f) => {
      const fv = fechaVencimientoEfectiva(f);
      const d = diasParaVencer(fv ?? null);
      return {
        numero: f.numero_factura || "-",
        cliente: f.empresa?.name || "Sin cliente",
        ejecutivo: ejecutivoNombre(f.ejecutivo_venta_id),
        plaza: f.plaza?.nombre || "-",
        fechaDocumento: fmtDate(f.fecha_documento),
        fechaVencimiento: fmtDate(fv),
        tipoPago: tipoPagoLabel(f.tipo_pago),
        total: Number(f.total || 0),
        saldo: Number(f.saldo_pendiente_cobranza || 0),
        dias: d ?? undefined,
      };
    });

  const carteraVencida = vencidas.reduce((s, f) => s + Number(f.saldo_pendiente_cobranza || 0), 0);

  return {
    brand: empresaVendedora === "galsa_phillips66" ? "galsa" : "lumaggs",
    empresaNombre: empresaVendedora === "galsa_phillips66" ? "Galsa" : "Lumaggs",
    fecha: new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    plaza: plazaNombre,
    kpisRow1: [
      {
        title: "Cartera Total",
        value: formatCur(totalSaldo),
        subtitle: `${totalCount} facturas`,
        variant: "success",
        lines: [
          { label: "Vencidas", tone: "destructive", value: `${vencidas.length} (${fmtPct(vencidas.length, totalCount)}) · ${formatCur(sumSaldo(vencidas))}` },
          { label: "En tiempo", value: `${enTiempo.length} (${fmtPct(enTiempo.length, totalCount)}) · ${formatCur(sumSaldo(enTiempo))}` },
        ],
      },
      {
        title: "Crédito Directo",
        value: formatCur(sumSaldo(directo)),
        subtitle: `${directo.length} facturas (${fmtPct(directo.length, totalCount)})`,
        lines: [
          { label: "Vencidas", tone: "destructive", value: `${directoVencidas.length} · ${formatCur(sumSaldo(directoVencidas))}` },
          { label: "En tiempo", value: `${directoEnTiempo.length} · ${formatCur(sumSaldo(directoEnTiempo))}` },
        ],
      },
      {
        title: "Crédito Cescemex",
        value: formatCur(sumSaldo(cescemex)),
        subtitle: `${cescemex.length} facturas (${fmtPct(cescemex.length, totalCount)})`,
        lines: [
          { label: "Vencidas", tone: "destructive", value: `${cescemexVencidas.length} · ${formatCur(sumSaldo(cescemexVencidas))}` },
          { label: "En tiempo", value: `${cescemexEnTiempo.length} · ${formatCur(sumSaldo(cescemexEnTiempo))}` },
        ],
      },
    ],
    kpisRow2: [
      { title: "Cartera Vencida", value: formatCur(carteraVencida), subtitle: `${vencidas.length} facturas`, variant: "destructive", valueBlack: true },
      { title: "Vencido Crédito Directo", value: formatCur(sumSaldo(directoVencidas)), subtitle: `${directoVencidas.length} facturas`, variant: "destructive", valueBlack: true },
      { title: "Vencido Crédito Cescemex", value: formatCur(sumSaldo(cescemexVencidas)), subtitle: `${cescemexVencidas.length} facturas`, variant: "destructive", valueBlack: true },
    ],
    kpisRow3: [
      { title: "Cobrado del mes", value: formatCur(cobradoMes), subtitle: `${facturasPagadasMes} pagadas · ${pagosMes.length} pagos`, variant: "success", valueBlack: true },
      {
        title: "Clientes en cartera vencida",
        value: `${clientesVencidosTotal}`,
        subtitle: `${fmtPct(clientesVencidosTotal, clientesTotalCount)} de ${clientesTotalCount}`,
        variant: "destructive",
        lines: [
          { label: "Crédito Directo", value: `${clientesVencidosDirecto.size}` },
          { label: "Crédito Cescemex", value: `${clientesVencidosCescemex.size}` },
        ],
      },
      {
        title: "Clientes en tiempo",
        value: `${clientesEnTiempoTotal}`,
        subtitle: `${fmtPct(clientesEnTiempoTotal, clientesTotalCount)} de ${clientesTotalCount}`,
        variant: "success",
        lines: [
          { label: "Crédito Directo", value: `${clientesEnTiempoDirecto.size}` },
          { label: "Crédito Cescemex", value: `${clientesEnTiempoCescemex.size}` },
        ],
      },
    ],
    buckets: [
      { title: "Cartera Total", rows: buckets },
      { title: "Crédito Directo", rows: bucketsDirecto },
      { title: "Crédito Cescemex", rows: bucketsCescemex },
    ],
    facturas: facturasVencidas,
    facturasPorVencer,
  };
}