import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  companyId: string;
  marca: "chevron" | "phillips66" | null | undefined;
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(n || 0);
}

export function DealCompanyUnitsSummary({ companyId, marca }: Props) {
  const empresaVendedora = marca === "phillips66" ? "galsa_phillips66" : "lumaggs_chevron";
  const label = marca === "phillips66" ? "Galsa Phillips 66" : "Lumaggs Chevron";
  const badgeCls = marca === "phillips66"
    ? "bg-red-600 hover:bg-red-600 text-white"
    : "bg-blue-600 hover:bg-blue-600 text-white";

  const { data, isLoading } = useQuery({
    queryKey: ["deal-company-units-summary", companyId, empresaVendedora],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: docs } = await supabase
        .from("documentos")
        .select("fecha_documento, unidades_equivalentes_total, estatus_factura, empresa_vendedora")
        .eq("empresa_id", companyId)
        .eq("tipo_documento", "factura")
        .eq("is_active", true)
        .eq("empresa_vendedora", empresaVendedora);
      const rows = (docs || []).filter((d: any) => String(d.estatus_factura ?? "") !== "cancelada");

      const now = new Date();
      const yyyyMM = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const mesActual = yyyyMM(now);
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const mesAnterior = yyyyMM(prev);

      let actual = 0, anterior = 0, total = 0;
      for (const r of rows) {
        const u = Number(r.unidades_equivalentes_total) || 0;
        total += u;
        const k = String(r.fecha_documento || "").slice(0, 7);
        if (k === mesActual) actual += u;
        if (k === mesAnterior) anterior += u;
      }
      return { actual, anterior, total };
    },
  });

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!data) return null;

  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Badge className={badgeCls}>{label}</Badge>
          <div className="flex gap-6 flex-wrap">
            <Stat label="Mes actual" value={fmt(data.actual)} />
            <Stat label="Mes anterior" value={fmt(data.anterior)} />
            <Stat label="Total histórico" value={fmt(data.total)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono font-bold text-sm">{value} u</div>
    </div>
  );
}