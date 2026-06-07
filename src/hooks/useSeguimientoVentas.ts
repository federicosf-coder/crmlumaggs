import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EmpresaVendedora = "lumaggs_chevron" | "galsa_phillips66";

export interface SeguimientoEstatus {
  id: string;
  ambito: "con_venta" | "sin_venta";
  familia: "riesgo" | "ritmo" | "avance" | "gestion";
  nombre: string;
  color: string;
  es_urgente: boolean;
  orden: number;
  activo: boolean;
  unidad: string;
  umbral_min: number | null;
  umbral_max: number | null;
}

export interface SeguimientoVentasRow {
  id: string;
  company_id: string;
  empresa_vendedora: EmpresaVendedora;
  tiene_venta: boolean;
  potencial: number;
  promedio_historico_mensual: number;
  acum_mes: number;
  acum_mes_anterior: number;
  acum_anio: number;
  fecha_ultima_compra: string | null;
  dias_ultima_compra: number | null;
  ciclo_dias: number | null;
  ritmo_pct: number | null;
  cotizaciones_total: number;
  ultima_cotizacion_fecha: string | null;
  dias_ultima_cotizacion: number | null;
  actividades_activas: number;
  actividades_total: number;
  ultima_actividad_fecha: string | null;
  dias_ultima_actividad: number | null;
  proxima_tarea_fecha: string | null;
  estatus_riesgo_id: string | null;
  estatus_ritmo_id: string | null;
  estatus_gestion_id: string | null;
  estatus_manual: boolean;
  estatus_manual_id: string | null;
  owner_id: string | null;
  ultima_actualizacion: string;
  companies?: { id: string; name: string } | null;
  perdido?: boolean | null;
  motivo_perdida_id?: string | null;
  fecha_perdida?: string | null;
  nota_perdida?: string | null;
}

export function useSeguimientoEstatusCatalogo() {
  return useQuery({
    queryKey: ["seguimiento_estatus_catalogo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seguimiento_estatus_catalogo")
        .select("*")
        .eq("activo", true)
        .order("ambito")
        .order("familia")
        .order("orden");
      if (error) throw error;
      return (data || []) as SeguimientoEstatus[];
    },
    staleTime: 5 * 60_000,
  });
}

export function useSeguimientoVentas(params: {
  empresaVendedora: EmpresaVendedora;
  tieneVenta: boolean;
  perdidos?: boolean;
}) {
  return useQuery({
    queryKey: ["seguimiento_ventas", params.empresaVendedora, params.tieneVenta, params.perdidos ? "perdidos" : "all"],
    queryFn: async () => {
      let q = supabase
        .from("seguimiento_ventas")
        .select("*, companies:company_id(id, name, created_at)")
        .eq("empresa_vendedora", params.empresaVendedora);
      if (params.perdidos) {
        q = q.eq("perdido", true);
      } else {
        q = q.eq("tiene_venta", params.tieneVenta);
      }
      const { data, error } = await q.limit(5000);
      if (error) throw error;
      return (data || []) as unknown as SeguimientoVentasRow[];
    },
  });
}

export function useUpdateSeguimientoEstatusManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; estatus_manual_id: string | null }) => {
      const { error } = await supabase
        .from("seguimiento_ventas")
        .update({
          estatus_manual: input.estatus_manual_id !== null,
          estatus_manual_id: input.estatus_manual_id,
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seguimiento_ventas"] });
    },
  });
}