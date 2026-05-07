import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useDealUnitsProgress } from "@/hooks/useDealUnitsProgress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X } from "lucide-react";
import { useUpdateCrmDeal } from "@/hooks/useCrmDeals";
import { useToast } from "@/hooks/use-toast";

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
  const updateDeal = useUpdateCrmDeal();
  const { toast } = useToast();
  const [editingPotencial, setEditingPotencial] = useState(false);
  const [potencialInput, setPotencialInput] = useState("");

  useEffect(() => {
    if (deal) setPotencialInput(String(deal.potencial_unidades ?? deal.volumen_mensual_estimado ?? ""));
  }, [deal?.id, deal?.potencial_unidades, deal?.volumen_mensual_estimado]);

  const savePotencial = async () => {
    const num = potencialInput === "" ? null : Number(potencialInput);
    if (num !== null && (Number.isNaN(num) || num < 0)) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    try {
      await updateDeal.mutateAsync({ id: deal.id, potencial_unidades: num });
      setEditingPotencial(false);
      toast({ title: "Potencial actualizado" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

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
      <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
        <span className="text-base font-semibold uppercase tracking-wide text-muted-foreground">
          Potencial manual (u)
        </span>
        {editingPotencial ? (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              step="0.1"
              value={potencialInput}
              onChange={(e) => setPotencialInput(e.target.value)}
              className="h-8 w-28 text-right font-mono text-base"
              autoFocus
            />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={savePotencial} disabled={updateDeal.isPending}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingPotencial(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingPotencial(true)}
            className="flex items-center gap-1.5 text-base font-mono font-semibold hover:text-primary"
          >
            {deal.potencial_unidades != null ? fmtUnits(Number(deal.potencial_unidades)) : "—"}
            <Pencil className="h-3 w-3 opacity-60" />
          </button>
        )}
      </div>

      {isRecompra && historico !== null && (
        <ProgressRow label="Histórico (prom. mensual)" value={historico} pct={100} variant="historic" />
      )}
      <ProgressRow label="Cotizado" value={cotizado} pct={pctCotizado} base={potencial} />
      <ProgressRow label="Pedido" value={pedido} pct={pctPedido} base={potencial} />
      <ProgressRow label="Facturado (real)" value={facturado} pct={pctFacturado} base={potencial} />
      {potencial === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Define un potencial manual arriba para ver los porcentajes.
        </p>
      )}
    </div>
  );
}
