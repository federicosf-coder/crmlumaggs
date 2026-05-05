import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";

interface Props { companyId: string }

function fmtUnits(n: number) {
  return new Intl.NumberFormat("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
}

type BrandStats = { totalU: number; promU: number; totalS: number; promS: number };

function computeStats(rows: any[]): BrandStats {
  let totalU = 0, totalS = 0;
  const byMonth = new Map<string, { u: number; s: number }>();
  for (const r of rows) {
    const u = Number(r.unidades_equivalentes_total) || 0;
    const s = r.subtotal != null ? Number(r.subtotal) : Math.round((Number(r.total) || 0) / 1.16 * 100) / 100;
    totalU += u; totalS += s;
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
  return { totalU, promU, totalS, promS };
}

export function CompanyMetricsPanel({ companyId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["company-metrics-panel", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: docs } = await supabase
        .from("documentos")
        .select("fecha_documento,unidades_equivalentes_total,subtotal,total,saldo_pendiente_cobranza,estado_cobranza,fecha_vencimiento,estatus_factura,empresa_vendedora")
        .eq("empresa_id", companyId)
        .eq("tipo_documento", "factura")
        .eq("is_active", true)
        .limit(5000);

      const rows = (docs || []).filter((d: any) => String(d.estatus_factura ?? "") !== "cancelada");
      const chevronRows = rows.filter((r: any) => {
        const v = String(r.empresa_vendedora ?? "").toLowerCase();
        return v === "lumaggs" || v === "lumaggs_chevron" || v === "chevron";
      });
      const galsaRows = rows.filter((r: any) => {
        const v = String(r.empresa_vendedora ?? "").toLowerCase();
        return v === "galsa" || v === "galsa_phillips66" || v === "phillips66";
      });

      const chevron = computeStats(chevronRows);
      const galsa = computeStats(galsaRows);

      const today = new Date().toISOString().slice(0, 10);
      const saldoVencido = rows
        .filter((r: any) => String(r.estado_cobranza ?? "") === "vencida" && r.fecha_vencimiento && r.fecha_vencimiento < today)
        .reduce((a: number, r: any) => a + (Number(r.saldo_pendiente_cobranza) || 0), 0);

      return { chevron, galsa, saldoVencido };
    },
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data) return null;

  const { chevron, galsa, saldoVencido } = data;
  const total: BrandStats = {
    totalU: chevron.totalU + galsa.totalU,
    promU: chevron.promU + galsa.promU,
    totalS: chevron.totalS + galsa.totalS,
    promS: chevron.promS + galsa.promS,
  };

  const isEmpty = (s: BrandStats) => !s.totalU && !s.totalS;
  const cellU = (s: BrandStats, k: "totalU" | "promU", cls: string) =>
    isEmpty(s) ? <span className="text-muted-foreground">—</span> : <span className={cls}>{fmtUnits(s[k])}</span>;
  const cellS = (s: BrandStats, k: "totalS" | "promS", cls: string) =>
    isEmpty(s) ? <span className="text-muted-foreground">—</span> : <span className={cls}>{formatCurrency(s[k])}</span>;

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Marca</th>
              <th className="px-3 py-2 text-right font-medium">Uds Total</th>
              <th className="px-3 py-2 text-right font-medium">Uds Mensual</th>
              <th className="px-3 py-2 text-right font-medium">Importe Total</th>
              <th className="px-3 py-2 text-right font-medium">Importe Mensual</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="px-3 py-2">
                <Badge className="bg-blue-600 hover:bg-blue-600 text-white">Chevron</Badge>
              </td>
              <td className="px-3 py-2 text-right font-mono font-bold">{cellU(chevron, "totalU", "text-blue-600")}</td>
              <td className="px-3 py-2 text-right font-mono font-bold">{cellU(chevron, "promU", "text-blue-600")}</td>
              <td className="px-3 py-2 text-right font-mono font-bold">{cellS(chevron, "totalS", "text-blue-600")}</td>
              <td className="px-3 py-2 text-right font-mono font-bold">{cellS(chevron, "promS", "text-blue-600")}</td>
            </tr>
            <tr className="border-t">
              <td className="px-3 py-2">
                <Badge className="bg-red-600 hover:bg-red-600 text-white">Phillips 66</Badge>
              </td>
              <td className="px-3 py-2 text-right font-mono font-bold">{cellU(galsa, "totalU", "text-emerald-600")}</td>
              <td className="px-3 py-2 text-right font-mono font-bold">{cellU(galsa, "promU", "text-emerald-600")}</td>
              <td className="px-3 py-2 text-right font-mono font-bold">{cellS(galsa, "totalS", "text-emerald-600")}</td>
              <td className="px-3 py-2 text-right font-mono font-bold">{cellS(galsa, "promS", "text-emerald-600")}</td>
            </tr>
            <tr className="border-t bg-muted/50">
              <td className="px-3 py-2 font-bold">Total</td>
              <td className="px-3 py-2 text-right font-mono font-bold text-foreground/80">{fmtUnits(total.totalU)}</td>
              <td className="px-3 py-2 text-right font-mono font-bold text-foreground/80">{fmtUnits(total.promU)}</td>
              <td className="px-3 py-2 text-right font-mono font-bold text-foreground/80">{formatCurrency(total.totalS)}</td>
              <td className="px-3 py-2 text-right font-mono font-bold text-foreground/80">{formatCurrency(total.promS)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {saldoVencido > 0 && (
        <div className="w-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          ⚠ Saldo vencido: {formatCurrency(saldoVencido)}
        </div>
      )}
    </div>
  );
}
