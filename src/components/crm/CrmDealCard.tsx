import { CrmDeal } from "@/hooks/useCrmDeals";
import { formatDate } from "@/lib/formatters";
import { Calendar, GripVertical, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface CrmDealCardProps {
  deal: CrmDeal;
  stageColor: string;
  onClick: () => void;
  /** Promedio mensual histórico de unidades facturadas (por marca). null si no hay historial. */
  monthlyAvg?: number | null;
  /** Mostrar líneas de Potencial Manual + Histórico Promedio Mensual (Recompra). */
  showHistorico?: boolean;
}

function fmtUnits(n: number) {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(n);
}

function ProgressBar({ label, value, base, color }: { label: string; value: number; base: number; color: string }) {
  const pct = base > 0 ? Math.min(100, (value / base) * 100) : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[10px] leading-none">
        <span className="text-muted-foreground uppercase tracking-wide">{label}</span>
        <span className="font-mono">{fmtUnits(value)}u</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function CrmDealCard({ deal, stageColor, onClick, monthlyAvg, showHistorico }: CrmDealCardProps) {
  const d = deal as any;
  const potencialManual = Number(d.potencial_unidades ?? 0);
  const potencial = potencialManual > 0
    ? potencialManual
    : Number(d.volumen_mensual_estimado ?? 0);
  const cotizado = Number(d.cotizado_unidades ?? 0);
  const pedido = Number(d.pedido_unidades ?? 0);
  const facturado = Number(d.facturado_unidades ?? 0);
  const showProgress = potencial > 0 || cotizado > 0 || pedido > 0 || facturado > 0;
  const base = Math.max(potencial, cotizado, pedido, facturado, 1);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("dealId", deal.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onClick}
      className="group relative cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 min-h-[44px]"
    >
      <div className="absolute left-0 top-0 h-full w-1 rounded-l-lg" style={{ backgroundColor: stageColor }} />
      <div className="ml-2 space-y-2">
        <div className="flex items-start justify-between">
          <h4 className="text-sm font-semibold leading-tight">{deal.title}</h4>
          <GripVertical className="h-4 w-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        {deal.companies && (
          <p className="text-xs text-muted-foreground">{deal.companies.name}</p>
        )}
        {showProgress && (
          <div className="space-y-1.5 pt-1">
            {potencial > 0 && (
              <ProgressBar label="Potencial" value={potencial} base={base} color="bg-primary/40" />
            )}
            <ProgressBar label="Cotizado" value={cotizado} base={base} color="bg-violet-500" />
            <ProgressBar label="Pedido" value={pedido} base={base} color="bg-cyan-500" />
            <ProgressBar label="Facturado" value={facturado} base={base} color="bg-emerald-500" />
          </div>
        )}
        {showHistorico && (
          <div className="space-y-0.5 pt-1 border-t pt-2">
            {potencialManual > 0 && (
              <div className="flex items-center justify-between text-[10px] leading-none">
                <span className="text-muted-foreground uppercase tracking-wide">Potencial Manual</span>
                <span className="font-mono font-medium text-foreground">{fmtUnits(potencialManual)}u</span>
              </div>
            )}
            <div className="flex items-center justify-between text-[10px] leading-none">
              <span className="text-muted-foreground uppercase tracking-wide">Histórico Prom. Mensual</span>
              <span className="font-mono font-medium text-foreground">
                {monthlyAvg != null && monthlyAvg > 0 ? `${fmtUnits(monthlyAvg)}u` : "—"}
              </span>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {!showProgress && potencial > 0 && (
            <span className="flex items-center gap-1 font-medium text-foreground">
              <Package className="h-3 w-3" />
              {fmtUnits(potencial)} u
            </span>
          )}
          {deal.close_date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(deal.close_date)}
            </span>
          )}
        </div>
        {deal.contacts && (
          <p className="text-xs text-muted-foreground">
            {deal.contacts.first_name} {deal.contacts.last_name}
          </p>
        )}
      </div>
    </div>
  );
}
