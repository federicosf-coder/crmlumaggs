import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/formatters";

export interface CompanyCobranzaFactura {
  numero: string;
  fechaDocumento: string;
  fechaVencimiento: string;
  tipoPago: string;
  total: number;
  saldo: number;
  /** Días vencida (>=0) en tabla de vencidas, o días para vencer en tabla de por vencer. */
  dias?: number;
}

export interface BucketRow {
  label: string;
  count: number;
  monto: number;
  variant: "destructive" | "warning" | "default";
}

export interface CompanyCreditoCobranzaData {
  companyId: string;
  empresaNombre: string;
  razonSocial?: string | null;
  brandKey?: BrandKey | null;
  brandLabel?: string | null;
  limiteCredito: number;
  creditoUtilizado: number;
  creditoDisponible: number;
  // KPIs (excluye canceladas)
  totalFacturadoImporte: number;
  totalFacturadoCount: number;
  vigenteImporte: number;
  vigenteCount: number;
  vencidoImporte: number;
  vencidoCount: number;
  pagadasCount: number;
  pagadasImporte: number;
  /** Importe histórico total facturado (todas las facturas no canceladas) para esta empresa/marca. */
  pagadasHistFacturadoImporte: number;
  pagadasHistFacturadoCount: number;
  pagadasVencidasCount: number;
  pagadasVigentesCount: number;
  pagadasVencidasPct: number;
  pagadasVigentesPct: number;
  pagadasVencidasImporte: number;
  pagadasVigentesImporte: number;
  buckets: BucketRow[];
  vencidas: CompanyCobranzaFactura[];
  porVencer: CompanyCobranzaFactura[];
  fechaGeneracion: string;
}

export type BrandKey = "lumaggs_chevron" | "galsa_phillips66";
export const BRAND_LABELS: Record<BrandKey, string> = {
  lumaggs_chevron: "Lumaggs (Chevron)",
  galsa_phillips66: "Galsa (Phillips 66)",
};

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

function tipoPagoLabel(value: string | null | undefined): string {
  const v = (value || "").toLowerCase();
  if (!v) return "—";
  if (v === "contado") return "Contado";
  if (v.includes("cescemex")) return "Crédito Cescemex";
  if (v.includes("credito") || v.includes("directo")) return "Crédito Directo";
  return value || "—";
}

export async function buildCompanyCreditoCobranzaData(
  companyId: string,
  brand?: BrandKey | null,
): Promise<CompanyCreditoCobranzaData> {
  const { data: empresa } = await (supabase as any)
    .from("companies")
    .select("id, name, razon_social, limite_credito")
    .eq("id", companyId)
    .maybeSingle();

  let activeQuery = (supabase as any)
    .from("documentos")
    .select("id, numero_factura, fecha_documento, fecha_vencimiento, total, saldo_pendiente_cobranza, estatus_factura, tipo_pago")
    .eq("is_active", true)
    .eq("tipo_documento", "factura")
    .eq("empresa_id", companyId);
  if (brand) activeQuery = activeQuery.eq("empresa_vendedora", brand);
  const { data: docs } = await activeQuery;
  const facturas = (docs || []) as any[];

  const noCanceladas = facturas.filter(f => (f.estatus_factura || "").toLowerCase() !== "cancelada");
  const abiertas = noCanceladas.filter(f => Number(f.saldo_pendiente_cobranza || 0) > 0
    && (f.estatus_factura || "").toLowerCase() !== "pagada");

  // === KPI "Total Facturas Pagadas" — resumen HISTÓRICO ===
  // Considera TODAS las facturas (activas e inactivas) no canceladas de la empresa/marca.
  // Una factura cuenta como "pagada" si tiene al menos una aplicación de pago
  // (pagada total o parcialmente). Se clasifica como "pagada vencida" si tuvo
  // cualquier aplicación posterior a su fecha de vencimiento; en caso contrario
  // se considera "pagada en tiempo".
  let histQuery = (supabase as any)
    .from("documentos")
    .select("id, total, fecha_vencimiento, estatus_factura")
    .eq("tipo_documento", "factura")
    .eq("empresa_id", companyId);
  if (brand) histQuery = histQuery.eq("empresa_vendedora", brand);
  const { data: histDocs } = await histQuery;
  const histNoCanceladas = ((histDocs || []) as any[])
    .filter(f => (f.estatus_factura || "").toLowerCase() !== "cancelada");

  const pagadasHistFacturadoImporte = histNoCanceladas.reduce((s, f) => s + Number(f.total || 0), 0);
  const pagadasHistFacturadoCount = histNoCanceladas.length;

  let pagadasVencidasCount = 0;
  let pagadasVigentesCount = 0;
  let pagadasVencidasImporte = 0;
  let pagadasVigentesImporte = 0;
  let pagadasTotal = 0;
  let pagadasImporte = 0;
  if (histNoCanceladas.length > 0) {
    const ids = histNoCanceladas.map(f => f.id);
    const { data: apps } = await (supabase as any)
      .from("cobranza_aplicaciones")
      .select("documento_id, fecha_aplicacion")
      .eq("tipo_documento", "factura")
      .in("documento_id", ids);
    const appsByDoc = new Map<string, string[]>();
    (apps || []).forEach((a: any) => {
      if (!a.fecha_aplicacion) return;
      const arr = appsByDoc.get(a.documento_id) || [];
      arr.push(a.fecha_aplicacion);
      appsByDoc.set(a.documento_id, arr);
    });
    histNoCanceladas.forEach(f => {
      const fechas = appsByDoc.get(f.id);
      if (!fechas || fechas.length === 0) return;
      pagadasTotal++;
      const importe = Number(f.total || 0);
      pagadasImporte += importe;
      const tieneTarde = f.fecha_vencimiento
        ? fechas.some(d => d > f.fecha_vencimiento)
        : false;
      if (tieneTarde) { pagadasVencidasCount++; pagadasVencidasImporte += importe; }
      else { pagadasVigentesCount++; pagadasVigentesImporte += importe; }
    });
  }
  const pagadasVencidasPct = pagadasTotal ? (pagadasVencidasCount / pagadasTotal) * 100 : 0;
  const pagadasVigentesPct = pagadasTotal ? (pagadasVigentesCount / pagadasTotal) * 100 : 0;

  const isVencida = (f: any) => (f.estatus_factura || "").toLowerCase() === "vencida";
  const vencidasArr = abiertas.filter(isVencida);
  const vigenteArr = abiertas.filter(f => !isVencida(f));

  const sumSaldo = (a: any[]) => a.reduce((s, f) => s + Number(f.saldo_pendiente_cobranza || 0), 0);

  // Buckets sobre las abiertas
  const ordenBuckets: { label: string; variant: BucketRow["variant"]; test: (d: number | null, v: boolean) => boolean }[] = [
    { label: "Vencidas", variant: "destructive", test: (_d, v) => v },
    { label: "Vencen hoy", variant: "warning", test: (d, v) => !v && d === 0 },
    { label: "1-5 días", variant: "default", test: (d, v) => !v && d != null && d >= 1 && d <= 5 },
    { label: "6-10 días", variant: "default", test: (d, v) => !v && d != null && d >= 6 && d <= 10 },
    { label: "11-20 días", variant: "default", test: (d, v) => !v && d != null && d >= 11 && d <= 20 },
    { label: "21-30 días", variant: "default", test: (d, v) => !v && d != null && d >= 21 && d <= 30 },
    { label: "Más de 30 días", variant: "default", test: (d, v) => !v && d != null && d > 30 },
  ];
  const buckets: BucketRow[] = ordenBuckets.map(b => {
    let count = 0, monto = 0;
    abiertas.forEach(f => {
      const v = isVencida(f);
      const d = diasParaVencer(f.fecha_vencimiento ?? null);
      if (b.test(d, v)) { count++; monto += Number(f.saldo_pendiente_cobranza || 0); }
    });
    return { label: b.label, variant: b.variant, count, monto };
  });

  const mapFact = (f: any, diasFn: (d: number | null) => number | undefined): CompanyCobranzaFactura => {
    const d = diasParaVencer(f.fecha_vencimiento ?? null);
    return {
      numero: f.numero_factura || "-",
      fechaDocumento: f.fecha_documento ? formatDate(f.fecha_documento) : "-",
      fechaVencimiento: f.fecha_vencimiento ? formatDate(f.fecha_vencimiento) : "-",
      tipoPago: tipoPagoLabel(f.tipo_pago),
      total: Number(f.total || 0),
      saldo: Number(f.saldo_pendiente_cobranza || 0),
      dias: diasFn(d),
    };
  };

  const vencidas = vencidasArr
    .map(f => mapFact(f, d => d != null ? Math.max(0, -d) : undefined))
    .sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0));

  const porVencer = vigenteArr
    .filter(f => {
      const d = diasParaVencer(f.fecha_vencimiento ?? null);
      return d != null && d >= 0;
    })
    .map(f => mapFact(f, d => d ?? undefined))
    .sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0));

  return {
    companyId,
    empresaNombre: empresa?.name || "Empresa",
    razonSocial: empresa?.razon_social || null,
    brandKey: brand ?? null,
    brandLabel: brand ? BRAND_LABELS[brand] : null,
    limiteCredito: Number(empresa?.limite_credito || 0),
    creditoUtilizado: sumSaldo(abiertas),
    creditoDisponible: Number(empresa?.limite_credito || 0) - sumSaldo(abiertas),
    totalFacturadoImporte: sumSaldo(abiertas),
    totalFacturadoCount: abiertas.length,
    vigenteImporte: sumSaldo(vigenteArr),
    vigenteCount: vigenteArr.length,
    vencidoImporte: sumSaldo(vencidasArr),
    vencidoCount: vencidasArr.length,
    pagadasCount: pagadasTotal,
    pagadasImporte,
    pagadasHistFacturadoImporte,
    pagadasHistFacturadoCount,
    pagadasVencidasCount,
    pagadasVigentesCount,
    pagadasVencidasPct,
    pagadasVigentesPct,
    pagadasVencidasImporte,
    pagadasVigentesImporte,
    buckets,
    vencidas,
    porVencer,
    fechaGeneracion: new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }),
  };
}

export const formatCur = (n: number) => formatCurrency(n);
