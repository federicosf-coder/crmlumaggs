import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";

interface Props { companyId: string }

function fmtUnits(n: number) {
  return new Intl.NumberFormat("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
}

export function CompanyMetricsPanel({ companyId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["company-metrics-panel", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: docs } = await supabase
        .from("documentos")
        .select("fecha_documento,unidades_equivalentes_total,subtotal,total,saldo_pendiente_cobranza,estado_cobranza,fecha_vencimiento,estatus_factura")
        .eq("empresa_id", companyId)
        .eq("tipo_documento", "factura")
        .eq("is_active", true)
        .limit(5000);

      const rows = (docs || []).filter((d: any) => String(d.estatus_factura ?? "") !== "cancelada");

      let totalU = 0;
      let totalS = 0;
      const byMonth = new Map<string, { u: number; s: number }>();
      for (const r of rows) {
        const u = Number(r.unidades_equivalentes_total) || 0;
        const s = r.subtotal != null ? Number(r.subtotal) : Math.round((Number(r.total) || 0) / 1.16 * 100) / 100;
        totalU += u;
        totalS += s;
        if (r.fecha_documento) {
          const k = String(r.fecha_documento).slice(0, 7);
          const cur = byMonth.get(k) || { u: 0, s: 0 };
          cur.u += u; cur.s += s;
          byMonth.set(k, cur);
        }
      }
      const months = byMonth.size || 1;
      const promU = byMonth.size ? Array.from(byMonth.values()).reduce((a, b) => a + b.u, 0) / months : 0;
      const promS = byMonth.size ? Array.from(byMonth.values()).reduce((a, b) => a + b.s, 0) / months : 0;

      const today = new Date().toISOString().slice(0, 10);
      const saldoVencido = rows
        .filter((r: any) => String(r.estado_cobranza ?? "") === "vencida" && r.fecha_vencimiento && r.fecha_vencimiento < today)
        .reduce((a: number, r: any) => a + (Number(r.saldo_pendiente_cobranza) || 0), 0);

      return { totalU, promU, totalS, promS, saldoVencido };
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0,1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }
  if (!data) return null;

  const showVencido = (data.saldoVencido || 0) > 0;

  return (
    <div className={`grid grid-cols-2 ${showVencido ? "md:grid-cols-5" : "md:grid-cols-4"} gap-3`}>
      <Stat label="Total Unidades" value={fmtUnits(data.totalU)} color="text-blue-600" />
      <Stat label="Promedio Mensual Unid." value={fmtUnits(data.promU)} color="text-blue-600" />
      <Stat label="Total Facturado (s/IVA)" value={formatCurrency(data.totalS)} color="text-emerald-600" />
      <Stat label="Promedio Mensual (s/IVA)" value={formatCurrency(data.promS)} color="text-emerald-600" />
      {showVencido && (
        <Stat label="Saldo Vencido" value={formatCurrency(data.saldoVencido)} color="text-red-600" />
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-base font-bold ${color}`}>{value}</div>
    </div>
  );
}