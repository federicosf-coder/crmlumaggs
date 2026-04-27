import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Avance del negocio medido en UNIDADES EQUIVALENTES (no en dinero).
 *
 * Para PRIMERA COMPRA:
 *  - potencial = crm_deals.volumen_mensual_estimado (manual)
 *  - cotizado/pedido/facturado = suma de unidades_equivalentes_total de
 *    documentos vinculados a la empresa de la oportunidad.
 *
 * Para RECOMPRA:
 *  - histórico = promedio mensual de unidades facturadas a la empresa
 *  - potencial = volumen_mensual_estimado si existe, si no = histórico
 */
export interface DealUnitsProgress {
  potencial: number;
  historico: number | null;
  cotizado: number;
  pedido: number;
  facturado: number;
  pctCotizado: number;
  pctPedido: number;
  pctFacturado: number;
  isRecompra: boolean;
}

const CANCELLED_COTIZACION = ["rechazada", "vencida"];
const CANCELLED_PEDIDO = ["cancelado"];
const CANCELLED_FACTURA = ["cancelada"];

export function useDealUnitsProgress(deal: any | null) {
  return useQuery<DealUnitsProgress | null>({
    queryKey: [
      "deal-units-progress",
      deal?.id,
      deal?.company_id,
      deal?.pipeline_type,
      deal?.mes_negocio,
      deal?.pipeline_id,
      deal?.potencial_unidades,
      deal?.volumen_mensual_estimado,
    ],
    enabled: !!deal && !!deal.company_id,
    queryFn: async () => {
      if (!deal || !deal.company_id) return null;
      const isRecompra = deal.pipeline_type === "recompra";

      // Determinar marca/empresa_vendedora del pipeline (para Recompra filtrar por marca)
      let empresaVendedora: string | null = null;
      if (isRecompra && deal.pipeline_id) {
        const { data: pipe } = await supabase
          .from("crm_pipelines")
          .select("marca")
          .eq("id", deal.pipeline_id)
          .maybeSingle();
        empresaVendedora =
          pipe?.marca === "phillips66" ? "galsa_phillips66" : "lumaggs_chevron";
      }

      let q = supabase
        .from("documentos")
        .select(
          "id, tipo_documento, estatus_cotizacion, estatus_pedido, estatus_factura, unidades_equivalentes_total, fecha_documento, is_active, empresa_vendedora"
        )
        .eq("empresa_id", deal.company_id)
        .eq("is_active", true);
      if (isRecompra && empresaVendedora) {
        q = q.eq("empresa_vendedora", empresaVendedora as any);
      }
      const { data: docs } = await q;

      let cotizado = 0;
      let pedido = 0;
      let facturado = 0;
      const facturasParaHistorico: { fecha: string; unidades: number }[] = [];

      // En Recompra sólo contamos documentos del mes del negocio para los
      // indicadores de Cotizado/Pedido/Facturado (real). El histórico promedio
      // mensual sí usa todas las facturas (para tener referencia de comportamiento).
      const mes: string | null = isRecompra ? (deal.mes_negocio ?? null) : null;
      const inMonth = (fecha?: string | null) => {
        if (!mes || !fecha) return false;
        return fecha.slice(0, 7) === mes;
      };

      (docs || []).forEach((d: any) => {
        const u = Number(d.unidades_equivalentes_total) || 0;
        const includeForPeriod = isRecompra ? inMonth(d.fecha_documento) : true;
        if (d.tipo_documento === "cotizacion") {
          if (includeForPeriod && !CANCELLED_COTIZACION.includes(d.estatus_cotizacion || "")) cotizado += u;
        } else if (d.tipo_documento === "pedido") {
          if (includeForPeriod && !CANCELLED_PEDIDO.includes(d.estatus_pedido || "")) pedido += u;
        } else if (d.tipo_documento === "factura") {
          if (!CANCELLED_FACTURA.includes(d.estatus_factura || "")) {
            if (includeForPeriod) facturado += u;
            if (d.fecha_documento) facturasParaHistorico.push({ fecha: d.fecha_documento, unidades: u });
          }
        }
      });

      // Histórico: promedio mensual de unidades facturadas
      let historico: number | null = null;
      if (isRecompra && facturasParaHistorico.length > 0) {
        const fechas = facturasParaHistorico.map((f) => new Date(f.fecha).getTime());
        const minF = Math.min(...fechas);
        const maxF = Math.max(...fechas);
        const meses = Math.max(1, Math.round((maxF - minF) / (1000 * 60 * 60 * 24 * 30)) + 1);
        const totalU = facturasParaHistorico.reduce((s, f) => s + f.unidades, 0);
        historico = totalU / meses;
      }

      // Prioridad: potencial_unidades (nuevo manual editable) > volumen_mensual_estimado (legacy) > histórico (recompra)
      const potencialManual =
        Number(deal.potencial_unidades) ||
        Number(deal.volumen_mensual_estimado) ||
        0;
      const potencial = potencialManual > 0 ? potencialManual : (historico ?? 0);

      const safeBase = potencial > 0 ? potencial : 1;
      return {
        potencial,
        historico,
        cotizado,
        pedido,
        facturado,
        pctCotizado: (cotizado / safeBase) * 100,
        pctPedido: (pedido / safeBase) * 100,
        pctFacturado: (facturado / safeBase) * 100,
        isRecompra,
      };
    },
  });
}
