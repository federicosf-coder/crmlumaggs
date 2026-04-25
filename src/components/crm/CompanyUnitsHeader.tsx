import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props { companyId: string }

function fmtUnits(n: number) {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(n);
}

/**
 * Tarjeta de métricas en UNIDADES EQUIVALENTES para la empresa:
 *  - Total facturado histórico
 *  - Promedio mensual
 *  - Tendencia (últimos 3 meses vs 3 anteriores)
 */
export function CompanyUnitsHeader({ companyId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["company-units-metrics", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: docs } = await supabase
        .from("documentos")
        .select("tipo_documento, estatus_factura, unidades_equivalentes_total, fecha_documento, is_active")
        .eq("empresa_id", companyId)
        .eq("tipo_documento", "factura")
        .eq("is_active", true);

      const facturas = (docs || []).filter((d: any) => d.estatus_factura !== "cancelada");
      const total = facturas.reduce((s: number, d: any) => s + (Number(d.unidades_equivalentes_total) || 0), 0);

      let promedio = 0;
      if (facturas.length > 0) {
        const fechas = facturas.map((f: any) => new Date(f.fecha_documento).getTime());
        const meses = Math.max(1, Math.round((Math.max(...fechas) - Math.min(...fechas)) / (1000 * 60 * 60 * 24 * 30)) + 1);
        promedio = total / meses;
      }

      const now = Date.now();
      const ms90 = 90 * 24 * 60 * 60 * 1000;
      const recientes = facturas.filter((f: any) => now - new Date(f.fecha_documento).getTime() < ms90);
      const previos = facturas.filter((f: any) => {
        const d = now - new Date(f.fecha_documento).getTime();
        return d >= ms90 && d < 2 * ms90;
      });
      const sumR = recientes.reduce((s: number, d: any) => s + (Number(d.unidades_equivalentes_total) || 0), 0);
      const sumP = previos.reduce((s: number, d: any) => s + (Number(d.unidades_equivalentes_total) || 0), 0);
      const tendencia = sumP > 0 ? ((sumR - sumP) / sumP) * 100 : sumR > 0 ? 100 : 0;

      return { total, promedio, tendencia, count: facturas.length };
    },
  });

  if (isLoading) return <Skeleton className="h-20 w-full" />;
  if (!data || data.count === 0) {
    return (
      <Card className="bg-muted/40">
        <CardContent className="py-3 text-xs text-muted-foreground text-center">
          Sin facturas registradas para mostrar métricas en unidades.
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = data.tendencia > 5 ? TrendingUp : data.tendencia < -5 ? TrendingDown : Minus;
  const trendColor = data.tendencia > 5 ? "text-primary" : data.tendencia < -5 ? "text-destructive" : "text-muted-foreground";

  return (
    <Card>
      <CardContent className="grid grid-cols-3 gap-3 py-3">
        <Stat label="Total (u)" value={fmtUnits(data.total)} icon={<Package className="h-4 w-4 text-primary" />} />
        <Stat label="Prom. mensual" value={fmtUnits(data.promedio)} />
        <Stat
          label="Tendencia 90d"
          value={`${data.tendencia > 0 ? "+" : ""}${fmtUnits(data.tendencia)}%`}
          icon={<TrendIcon className={`h-4 w-4 ${trendColor}`} />}
          valueClass={trendColor}
        />
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, icon, valueClass = "" }: { label: string; value: string; icon?: React.ReactNode; valueClass?: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}{label}
      </div>
      <div className={`mt-0.5 font-mono text-sm font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}
