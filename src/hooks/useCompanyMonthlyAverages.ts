import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Devuelve un Map<company_id, promedio_mensual_unidades_facturadas>
 * para una marca específica (chevron / phillips66). Calcula el promedio
 * dividiendo el total de unidades facturadas históricas entre el número
 * de meses transcurridos desde la primera factura de esa empresa+marca.
 */
export function useCompanyMonthlyAverages(companyIds: string[], brand: string | undefined) {
  const [map, setMap] = useState<Map<string, number>>(new Map());
  const empresaVendedora = brand === "phillips66" ? "galsa_phillips66" : "lumaggs_chevron";

  // Estabilizar key
  const idsKey = useMemo(
    () => Array.from(new Set(companyIds.filter(Boolean))).sort().join(","),
    [companyIds],
  );

  useEffect(() => {
    let cancelled = false;
    const ids = idsKey ? idsKey.split(",") : [];
    if (ids.length === 0) {
      setMap(new Map());
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("documentos")
        .select("empresa_id,fecha_documento,unidades_equivalentes_total,estatus_factura")
        .eq("tipo_documento", "factura")
        .eq("empresa_vendedora", empresaVendedora as any)
        .eq("is_active", true)
        .in("empresa_id", ids)
        .limit(5000);
      if (error || cancelled) return;

      const grouped = new Map<string, { total: number; first: Date; last: Date }>();
      for (const row of data ?? []) {
        if (!row.empresa_id || !row.fecha_documento) continue;
        if ((row.estatus_factura ?? "") === "cancelada") continue;
        const units = Number(row.unidades_equivalentes_total ?? 0);
        const d = new Date(row.fecha_documento as string);
        const cur = grouped.get(row.empresa_id);
        if (!cur) grouped.set(row.empresa_id, { total: units, first: d, last: d });
        else {
          cur.total += units;
          if (d < cur.first) cur.first = d;
          if (d > cur.last) cur.last = d;
        }
      }
      const result = new Map<string, number>();
      for (const [cid, agg] of grouped) {
        const months = Math.max(
          1,
          (agg.last.getFullYear() - agg.first.getFullYear()) * 12 +
            (agg.last.getMonth() - agg.first.getMonth()) +
            1,
        );
        result.set(cid, agg.total / months);
      }
      if (!cancelled) setMap(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [idsKey, empresaVendedora]);

  return map;
}
