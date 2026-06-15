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
  pagadasVencidasCount: number;
  pagadasVigentesCount: number;
  pagadasVencidasPct: number;
  pagadasVigentesPct: number;
  buckets: BucketRow[];
  vencidas: CompanyCobranzaFactura[];
  porVencer: CompanyCobranzaFactura[];
  fechaGeneracion: string;
}

function diasParaVencer(fechaVenc: string | null): number | null {
  if (!fechaVenc) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const v = new Date(fechaVenc); v.setHours(0, 0, 0, 0);
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

export async function buildCompanyCreditoCobranzaData(companyId: string): Promise<CompanyCreditoCobranzaData> {
  const { data: empresa } = await (supabase as any)
    .from("companies")
    .select("id, name, razon_social, limite_credito")
    .eq("id", companyId)
    .maybeSingle();

  const { data: docs } = await (supabase as any)
    .from("documentos")
    .select("id, numero_factura, fecha_documento, fecha_vencimiento, total, saldo_pendiente_cobranza, estatus_factura, tipo_pago")
    .eq("is_active", true)
    .eq("tipo_documento", "factura")
    .eq("empresa_id", companyId);
  const facturas = (docs || []) as any[];

  const noCanceladas = facturas.filter(f => (f.estatus_factura || "").toLowerCase() !== "cancelada");
  const abiertas = noCanceladas.filter(f => Number(f.saldo_pendiente_cobranza || 0) > 0
    && (f.estatus_factura || "").toLowerCase() !== "pagada");

  const pagadasArr = noCanceladas.filter(f => (f.estatus_factura || "").toLowerCase() === "pagada");

  // Determinar si cada factura pagada se pagó vencida o vigente, según última aplicación
  let pagadasVencidasCount = 0;
  let pagadasVigentesCount = 0;
  if (pagadasArr.length > 0) {
    const ids = pagadasArr.map(f => f.id);
    const { data: apps } = await (supabase as any)
      .from("cobranza_aplicaciones")
      .select("documento_id, fecha_aplicacion")
      .eq("tipo_documento", "factura")
      .in("documento_id", ids);
    const lastByDoc = new Map<string, string>();
    (apps || []).forEach((a: any) => {
      const cur = lastByDoc.get(a.documento_id);
      if (!cur || (a.fecha_aplicacion && a.fecha_aplicacion > cur)) {
        lastByDoc.set(a.documento_id, a.fecha_aplicacion);
      }
    });
    pagadasArr.forEach(f => {
      const last = lastByDoc.get(f.id);
      if (last && f.fecha_vencimiento && last > f.fecha_vencimiento) pagadasVencidasCount++;
      else pagadasVigentesCount++;
    });
  }
  const pagadasTotal = pagadasArr.length;
  const pagadasVencidasPct = pagadasTotal ? (pagadasVencidasCount / pagadasTotal) * 100 : 0;
  const pagadasVigentesPct = pagadasTotal ? (pagadasVigentesCount / pagadasTotal) * 100 : 0;

  const isVencida = (f: any) => (f.estatus_factura || "").toLowerCase() === "vencida";
  const vencidasArr = abiertas.filter(isVencida);
  const vigenteArr = abiertas.filter(f => !isVencida(f));

  const sumTotal = (a: any[]) => a.reduce((s, f) => s + Number(f.total || 0), 0);
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
    limiteCredito: Number(empresa?.limite_credito || 0),
    creditoUtilizado: sumSaldo(vigenteArr),
    creditoDisponible: Number(empresa?.limite_credito || 0) - sumSaldo(vigenteArr),
    totalFacturadoImporte: sumTotal(noCanceladas),
    totalFacturadoCount: noCanceladas.length,
    vigenteImporte: sumSaldo(vigenteArr),
    vigenteCount: vigenteArr.length,
    vencidoImporte: sumSaldo(vencidasArr),
    vencidoCount: vencidasArr.length,
    pagadasCount: pagadasTotal,
    pagadasImporte: sumTotal(pagadasArr),
    pagadasVencidasCount,
    pagadasVigentesCount,
    pagadasVencidasPct,
    pagadasVigentesPct,
    buckets,
    vencidas,
    porVencer,
    fechaGeneracion: new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }),
  };
}

export const formatCur = (n: number) => formatCurrency(n);
