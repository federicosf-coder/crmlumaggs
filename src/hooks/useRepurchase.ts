import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EstatusRecompra = "al_dia" | "proximo" | "vencido" | "en_riesgo" | "dormido" | "sin_historial";

export interface RepurchaseCompany {
  id: string;
  name: string;
  fecha_ultima_compra: string | null;
  frecuencia_dias: number | null;
  ticket_promedio: number | null;
  proxima_recompra: string | null;
  estatus: EstatusRecompra;
  total_facturas: number;
}

export function useRepurchaseDashboard(marca: "chevron" | "phillips66") {
  return useQuery({
    queryKey: ["repurchase_dashboard", marca],
    queryFn: async () => {
      const suffix = marca === "chevron" ? "chevron" : "phillips66";
      const { data, error } = await supabase
        .from("companies")
        .select(
          `id, name,
           fecha_ultima_compra_${suffix},
           frecuencia_compra_${suffix}_dias,
           ticket_promedio_${suffix},
           proxima_recompra_${suffix},
           estatus_recompra_${suffix},
           total_facturas_${suffix}`
        )
        .neq(`estatus_recompra_${suffix}`, "sin_historial")
        .order(`proxima_recompra_${suffix}`, { ascending: true, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      return ((data ?? []) as any[]).map<RepurchaseCompany>((r) => ({
        id: r.id,
        name: r.name,
        fecha_ultima_compra: r[`fecha_ultima_compra_${suffix}`],
        frecuencia_dias: r[`frecuencia_compra_${suffix}_dias`],
        ticket_promedio: r[`ticket_promedio_${suffix}`],
        proxima_recompra: r[`proxima_recompra_${suffix}`],
        estatus: r[`estatus_recompra_${suffix}`],
        total_facturas: r[`total_facturas_${suffix}`] ?? 0,
      }));
    },
  });
}