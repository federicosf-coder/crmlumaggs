import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const PIEZAS_POR_TARIMA: Record<string, number> = {
  tambor: 4, cubeta: 45, caja_12u: 84, caja_6u: 75, caja_3u: 60,
};
export const LEAD_TIME_DIAS: Record<string, number> = { USA: 32, CEDIS: 14 };
export const MIN_TARIMAS_PEDIDO = 24;

export function presentacionPiezas(p?: string | null): number {
  if (!p) return 0;
  return PIEZAS_POR_TARIMA[p] || 0;
}

export function calcSugerencia(n: any): { necesidad: number; tarimas: number } {
  const consumoMes = Number(n.consumo_hub_mensual || 0);
  const leadDias = Number(n.lead_time_dias || LEAD_TIME_DIAS[n.fuente_suministro?.toUpperCase?.()] || 30);
  const stock = Number(n.stock_total || 0);
  const necesidad = Math.max(0, Math.ceil((consumoMes / 30) * (leadDias + 30) - stock));
  const pzs = Number(n.piezas_por_tarima || presentacionPiezas(n.presentacion) || 1);
  const tarimas = pzs > 0 ? Math.ceil(necesidad / pzs) : 0;
  return { necesidad, tarimas };
}

export function usePedidos() {
  return useQuery({
    queryKey: ["inv_pedidos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("inv_pedidos")
        .select("*").order("fecha_pedido", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function usePedido(id: string | null) {
  return useQuery({
    queryKey: ["inv_pedido", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: pedido, error: pe } = await (supabase as any).from("inv_pedidos").select("*").eq("id", id).single();
      if (pe) throw pe;
      const { data: lineas } = await (supabase as any).from("inv_pedido_lineas").select("*").eq("pedido_id", id).order("created_at");
      const { data: archivos } = await (supabase as any).from("inv_pedido_archivos").select("*").eq("pedido_id", id).order("created_at", { ascending: false });
      return { pedido, lineas: lineas || [], archivos: archivos || [] };
    },
  });
}

export function useRecepciones() {
  return useQuery({
    queryKey: ["inv_recepciones"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("inv_recepciones")
        .select("*, inv_pedidos(numero_po_interno, empresa_vendedora, almacen_destino)")
        .order("fecha_recepcion", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useReclamos() {
  return useQuery({
    queryKey: ["inv_reclamos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("inv_reclamos")
        .select("*, inv_pedidos(numero_po_interno, empresa_vendedora)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useUpdatePedidoEstatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, estatus }: { id: string; estatus: string }) => {
      const { error } = await (supabase as any).from("inv_pedidos").update({ estatus }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["inv_pedidos"] });
      qc.invalidateQueries({ queryKey: ["inv_pedido", v.id] });
    },
  });
}

export const ESTATUS_PEDIDO_LABEL: Record<string, string> = {
  borrador: "Borrador", enviado: "Enviado", confirmado_proveedor: "Confirmado",
  en_transito: "En tránsito", recibido_parcial: "Recibido parcial",
  cerrado: "Cerrado", cancelado: "Cancelado",
  elaborado: "Elaborado", recibido: "Recibido",
};

export function estatusPedidoColor(e?: string | null) {
  switch (e) {
    case "borrador": return "bg-gray-100 text-gray-700";
    case "enviado": return "bg-blue-100 text-blue-800";
    case "confirmado_proveedor": return "bg-cyan-100 text-cyan-800";
    case "en_transito": return "bg-amber-100 text-amber-800";
    case "recibido_parcial": return "bg-orange-100 text-orange-800";
    case "cerrado": return "bg-green-100 text-green-800";
    case "cancelado": return "bg-red-100 text-red-800";
    case "elaborado": return "bg-indigo-100 text-indigo-800";
    case "recibido": return "bg-green-100 text-green-800";
    default: return "bg-gray-100 text-gray-700";
  }
}

export function nextEstatus(current: string): string | null {
  const flow: Record<string, string> = {
    borrador: "enviado",
    enviado: "confirmado_proveedor",
    confirmado_proveedor: "en_transito",
    en_transito: "recibido_parcial",
    recibido_parcial: "cerrado",
    elaborado: "recibido",
  };
  return flow[current] || null;
}

export function nextEstatusLabel(current: string): string | null {
  const labels: Record<string, string> = {
    borrador: "Marcar como Enviado",
    enviado: "Confirmar por proveedor",
    confirmado_proveedor: "Marcar en tránsito",
    en_transito: "Registrar recepción",
    recibido_parcial: "Cerrar pedido",
    elaborado: "Marcar como Recibido",
  };
  return labels[current] || null;
}