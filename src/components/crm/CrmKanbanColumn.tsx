import { useState } from "react";
import { CrmDeal } from "@/hooks/useCrmDeals";
import { CrmPipelineStage } from "@/hooks/useCrmPipelines";
import { CrmDealCard } from "./CrmDealCard";
import { Kanban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CrmKanbanColumnProps {
  stage: CrmPipelineStage;
  deals: CrmDeal[];
  onDrop: (dealId: string, stageId: string) => void;
  onDealClick: (deal: CrmDeal) => void;
  onAddDeal: (stageId: string) => void;
}

export function CrmKanbanColumn({ stage, deals, onDrop, onDealClick, onAddDeal }: CrmKanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const totalUnidades = deals.reduce(
    (sum, d: any) => sum + (Number(d.potencial_unidades) || Number(d.volumen_mensual_estimado) || 0),
    0
  );

  return (
    <div className="min-w-[156px] w-[156px] flex-shrink-0">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: stage.color }} />
        <h3 className="text-sm font-semibold">{stage.name}</h3>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {deals.length}
        </span>
      </div>
      {totalUnidades > 0 && (
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(totalUnidades)} u
        </p>
      )}
      <div
        className={`space-y-2 rounded-xl p-3 min-h-[400px] transition-colors ${isDragOver ? "bg-primary/10 ring-2 ring-primary/30" : "bg-muted/50"}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const dealId = e.dataTransfer.getData("dealId");
          if (dealId) onDrop(dealId, stage.id);
        }}
      >
        {deals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Kanban className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground/60">Sin negocios</p>
          </div>
        ) : (
          deals.map((deal) => (
            <CrmDealCard key={deal.id} deal={deal} stageColor={stage.color} onClick={() => onDealClick(deal)} />
          ))
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 text-muted-foreground hover:text-foreground"
          onClick={() => onAddDeal(stage.id)}
        >
          <Plus className="h-4 w-4 mr-1" /> Agregar negocio
        </Button>
      </div>
    </div>
  );
}
