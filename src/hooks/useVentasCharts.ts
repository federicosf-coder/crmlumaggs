import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EmpresaVendedora } from "@/hooks/useSeguimientoVentas";

export interface PlazaUnidades {
  plaza: string;
  unidades: number;
}

export interface EjecutivoPlazaUnidades {
  plaza: string;
  ejecutivos: { nombre: string; unidades: number }[];
}

export interface VentasChartsData {
  total: number;
  porPlaza: PlazaUnidades[];
  porPlazaEjecutivo: EjecutivoPlazaUnidades[];
}

export function useVentasCharts(empresa: EmpresaVendedora) {
  return useQuery({
    queryKey: ["ventas_charts", empresa],
    queryFn: async (): Promise<VentasChartsData> => {
      const { data, error } = await supabase
        .from("documentos")
        .select("plaza_id, ejecutivo_venta_id, unidades_equivalentes_total, estatus_factura, tipo_documento, empresa_vendedora")
        .eq("empresa_vendedora", empresa)
        .eq("tipo_documento", "factura")
        .neq("estatus_factura", "cancelada")
        .limit(20000);
      if (error) throw error;

      const rows = (data || []) as Array<{
        plaza_id: string | null;
        ejecutivo_venta_id: string | null;
        unidades_equivalentes_total: number | null;
      }>;

      const plazaIds = Array.from(new Set(rows.map(r => r.plaza_id).filter(Boolean))) as string[];
      const userIds = Array.from(new Set(rows.map(r => r.ejecutivo_venta_id).filter(Boolean))) as string[];

      const [plazasRes, profsRes] = await Promise.all([
        plazaIds.length
          ? supabase.from("plazas").select("id, nombre").in("id", plazaIds)
          : Promise.resolve({ data: [], error: null } as any),
        userIds.length
          ? supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);
      const plazaMap = new Map<string, string>((plazasRes.data || []).map((p: any) => [p.id, p.nombre]));
      const profMap = new Map<string, string>((profsRes.data || []).map((p: any) => [p.user_id, p.full_name || "—"]));

      const porPlazaMap = new Map<string, number>();
      const porPlazaEjeMap = new Map<string, Map<string, number>>();
      let total = 0;

      for (const r of rows) {
        const u = Number(r.unidades_equivalentes_total || 0);
        if (!u) continue;
        total += u;
        const plaza = (r.plaza_id && plazaMap.get(r.plaza_id)) || "Sin plaza";
        porPlazaMap.set(plaza, (porPlazaMap.get(plaza) || 0) + u);
        const ejec = (r.ejecutivo_venta_id && profMap.get(r.ejecutivo_venta_id)) || "Sin ejecutivo";
        if (!porPlazaEjeMap.has(plaza)) porPlazaEjeMap.set(plaza, new Map());
        const em = porPlazaEjeMap.get(plaza)!;
        em.set(ejec, (em.get(ejec) || 0) + u);
      }

      const porPlaza = Array.from(porPlazaMap.entries())
        .map(([plaza, unidades]) => ({ plaza, unidades: Math.round(unidades) }))
        .sort((a, b) => b.unidades - a.unidades);

      const porPlazaEjecutivo = Array.from(porPlazaEjeMap.entries())
        .map(([plaza, m]) => ({
          plaza,
          ejecutivos: Array.from(m.entries())
            .map(([nombre, unidades]) => ({ nombre, unidades: Math.round(unidades) }))
            .sort((a, b) => b.unidades - a.unidades),
        }))
        .sort((a, b) => {
          const sa = a.ejecutivos.reduce((s, e) => s + e.unidades, 0);
          const sb = b.ejecutivos.reduce((s, e) => s + e.unidades, 0);
          return sb - sa;
        });

      return { total: Math.round(total), porPlaza, porPlazaEjecutivo };
    },
    staleTime: 5 * 60_000,
  });
}