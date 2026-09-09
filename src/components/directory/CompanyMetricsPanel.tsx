import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { History } from "lucide-react";
import { useState } from "react";

interface Props { companyId: string }

function fmtUnits(n: number) {
  return new Intl.NumberFormat("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
}

const MESES_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatMes(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES_ES[(m || 1) - 1]} ${y}`;
}

type MonthStat = { mes: string; u: number; s: number };
type BrandStats = { totalU: number; promU: number; totalS: number; promS: number; monthly: MonthStat[] };

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

  const monthly = Array.from(byMonth.entries())
    .map(([mes, v]) => ({ mes, u: v.u, s: v.s }))
    .sort((a, b) => b.mes.localeCompare(a.mes))
    .slice(0, 12);

  return { totalU, promU, totalS, promS, monthly };
}

export function CompanyMetricsPanel({ companyId }: Props) {
  const [open, setOpen] = useState(false);
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

      // Misma fuente de verdad que el módulo Cobranza: estatus_factura === 'vencida' y saldo > 0
      const saldoVencido = rows
        .filter((r: any) =>
          String(r.estatus_factura ?? "").toLowerCase() === "vencida" &&
          Number(r.saldo_pendiente_cobranza) > 0
        )
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
    monthly: [],
  };

  const isEmpty = (s: BrandStats) => !s.totalU && !s.totalS;
  const cellU = (s: BrandStats, k: "totalU" | "promU", cls: string) =>
    isEmpty(s) ? <span className="text-muted-foreground">—</span> : <span className={cls}>{fmtUnits(s[k])}</span>;
  const cellS = (s: BrandStats, k: "totalS" | "promS", cls: string) =>
    isEmpty(s) ? <span className="text-muted-foreground">—</span> : <span className={cls}>{formatCurrency(s[k])}</span>;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <History className="mr-1.5 h-4 w-4" />
          Ver histórico mensual
        </Button>
      </div>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4 border-b shrink-0">
            <DialogTitle className="text-lg font-semibold tracking-tight">Histórico Mensual de Unidades</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 px-5 py-5 overflow-y-auto flex-1">
            <MonthlyHistoryTable
              title={<Badge className="bg-blue-600 hover:bg-blue-600 text-white">Chevron</Badge>}
              monthly={chevron.monthly}
            />
            <MonthlyHistoryTable
              title={<Badge className="bg-red-600 hover:bg-red-600 text-white">Phillips 66</Badge>}
              monthly={galsa.monthly}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MonthlyHistoryTable({ title, monthly }: { title: React.ReactNode; monthly: MonthStat[] }) {
  if (monthly.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">{title}</div>
        <p className="text-sm text-muted-foreground">Sin historial disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">{title}</div>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Mes</th>
              <th className="px-3 py-2 text-right font-medium">Unidades</th>
              <th className="px-3 py-2 text-right font-medium">Variación %</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((m, i) => {
              const prev = monthly[i + 1];
              const variacion = prev && prev.u !== 0
                ? ((m.u - prev.u) / prev.u) * 100
                : null;
              return (
                <tr key={m.mes} className="border-t">
                  <td className="px-3 py-2">{formatMes(m.mes)}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold">{fmtUnits(m.u)}</td>
                  <td className="px-3 py-2 text-right">
                    {variacion === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className={`font-mono font-semibold ${variacion >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {variacion >= 0 ? "↑" : "↓"}
                        {variacion >= 0 ? "+" : ""}
                        {fmtUnits(variacion)}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
