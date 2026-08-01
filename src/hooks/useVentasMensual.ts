import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EmpresaVendedora } from "@/hooks/useSeguimientoVentas";

export interface MesUnidades {
  mes: string; // label "Ene 2026"
  unidades: number;
}

export interface MesOption {
  value: string; // YYYY-MM
  label: string; // "Ene 2026"
}

export interface VentasMensualData {
  mesesDisponibles: MesOption[];
  porMesTotal: MesUnidades[];
  porMesPorPlaza: Record<string, MesUnidades[]>;
  plazasDisponibles: string[];
  porMesPlazaMap: Record<string, Record<string, number>>; // YYYY-MM -> plaza -> unidades
}

const MESES_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function mesLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES_ES[(m || 1) - 1]} ${y}`;
}

function buildUltimos12(): MesOption[] {
  const now = new Date();
  const out: MesOption[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value: ym, label: mesLabel(ym) });
  }
  return out;
}

export function useVentasMensual(empresa: EmpresaVendedora) {
  return useQuery({
    queryKey: ["ventas_mensual", empresa],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<VentasMensualData> => {
      const meses = buildUltimos12();
      const desde = `${meses[0].value}-01`;

      const { data, error } = await supabase
        .from("documentos")
        .select("fecha_documento, plaza_id, unidades_equivalentes_total")
        .eq("empresa_vendedora", empresa)
        .eq("tipo_documento", "factura")
        .neq("estatus_factura", "cancelada")
        .gte("fecha_documento", desde)
        .limit(20000);
      if (error) throw error;

      const rows = (data || []) as Array<{
        fecha_documento: string | null;
        plaza_id: string | null;
        unidades_equivalentes_total: number | null;
      }>;

      const plazaIds = Array.from(new Set(rows.map(r => r.plaza_id).filter(Boolean))) as string[];
      const plazasRes = plazaIds.length
        ? await supabase.from("plazas").select("id, nombre").in("id", plazaIds)
        : ({ data: [] } as any);
      const plazaMap = new Map<string, string>((plazasRes.data || []).map((p: any) => [p.id, p.nombre]));

      const porMesPlazaMap: Record<string, Record<string, number>> = {};
      const totalPorMes: Record<string, number> = {};
      const plazasSet = new Set<string>();
      for (const m of meses) {
        porMesPlazaMap[m.value] = {};
        totalPorMes[m.value] = 0;
      }

      for (const r of rows) {
        const u = Number(r.unidades_equivalentes_total || 0);
        if (!u || !r.fecha_documento) continue;
        const ym = String(r.fecha_documento).slice(0, 7);
        if (!(ym in totalPorMes)) continue;
        const plaza = (r.plaza_id && plazaMap.get(r.plaza_id)) || "Sin plaza";
        plazasSet.add(plaza);
        totalPorMes[ym] += u;
        porMesPlazaMap[ym][plaza] = (porMesPlazaMap[ym][plaza] || 0) + u;
      }

      const porMesTotal: MesUnidades[] = meses.map(m => ({
        mes: m.label,
        unidades: Math.round(totalPorMes[m.value] || 0),
      }));

      const plazasDisponibles = Array.from(plazasSet).sort((a, b) => a.localeCompare(b, "es"));
      const porMesPorPlaza: Record<string, MesUnidades[]> = {};
      for (const p of plazasDisponibles) {
        porMesPorPlaza[p] = meses.map(m => ({
          mes: m.label,
          unidades: Math.round(porMesPlazaMap[m.value][p] || 0),
        }));
      }

      return { mesesDisponibles: meses, porMesTotal, porMesPorPlaza, plazasDisponibles, porMesPlazaMap };
    },
  });
}

export function reporteMes(data: VentasMensualData | undefined, mes: string) {
  if (!data) return { total: 0, porPlaza: [] as { plaza: string; unidades: number }[] };
  const m = data.porMesPlazaMap[mes] || {};
  const porPlaza = Object.entries(m)
    .map(([plaza, unidades]) => ({ plaza, unidades: Math.round(unidades) }))
    .sort((a, b) => b.unidades - a.unidades);
  const total = Math.round(porPlaza.reduce((s, p) => s + p.unidades, 0));
  return { total, porPlaza };
}
