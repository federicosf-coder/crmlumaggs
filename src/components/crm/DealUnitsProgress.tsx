import { cn } from "@/lib/utils";
import { useDealUnitsProgress } from "@/hooks/useDealUnitsProgress";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  deal: any;
}

function fmtUnits(n: number) {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(n);
}

function ProgressRow({
  label,
  value,
  pct,
  base,
  variant = "default",
}: {
  label: string;
  value: number;
  pct: number;
  base?: number;
  variant?: "default" | "potential" | "historic";
}) {
  // Cap visual width at 100%, but show real % in label.
  const visualWidth = Math.min(100, Math.max(0, pct));
  const exceeds = pct > 100;

  const fillClass =
    variant === "potential"
      ? "bg-primary"
      : variant === "historic"
        ? "bg-muted-foreground/60"
        : exceeds
          ? "bg-primary"
          : "bg-primary/70";

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="font-mono">
          {fmtUnits(value)} u
          {base !== undefined && (
            <span className={cn("ml-2", exceeds && "text-primary font-semibold")}>
              {fmtUnits(pct)}%
            </span>
          )}
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", fillClass)} style={{ width: `${visualWidth}%` }} />
      </div>
    </div>
  );
}

export function DealUnitsProgress({ deal }: Props) {
  const { data, isLoading } = useDealUnitsProgress(deal);

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }
  if (!data) {
    return (
      <p className="text-xs text-muted-foreground">
        Vincula una empresa para ver avance en unidades.
      </p>
    );
  }

  const { potencial, historico, cotizado, pedido, facturado, pctCotizado, pctPedido, pctFacturado, isRecompra } = data;

  return (
    <div className="space-y-3">
      {isRecompra && historico !== null && (
        <ProgressRow label="Histórico (prom. mensual)" value={historico} pct={100} variant="historic" />
      )}
      <ProgressRow label="Potencial" value={potencial} pct={100} variant="potential" />
      <ProgressRow label="Cotizado" value={cotizado} pct={pctCotizado} base={potencial} />
      <ProgressRow label="Pedido" value={pedido} pct={pctPedido} base={potencial} />
      <ProgressRow label="Facturado (real)" value={facturado} pct={pctFacturado} base={potencial} />
      {potencial === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Define un potencial (volumen mensual estimado) para ver porcentajes.
        </p>
      )}
    </div>
  );
}
