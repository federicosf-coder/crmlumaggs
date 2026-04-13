import { CrmDeal, useUpdateCrmDeal } from "@/hooks/useCrmDeals";
import { CrmPipelineStage } from "@/hooks/useCrmPipelines";
import { CrmKanbanColumn } from "./CrmKanbanColumn";
import { useToast } from "@/hooks/use-toast";

interface CrmKanbanBoardProps {
  stages: CrmPipelineStage[];
  deals: CrmDeal[];
  onDealClick: (deal: CrmDeal) => void;
  onAddDeal: (stageId: string) => void;
}

export function CrmKanbanBoard({ stages, deals, onDealClick, onAddDeal }: CrmKanbanBoardProps) {
  const updateDeal = useUpdateCrmDeal();
  const { toast } = useToast();

  const handleDrop = (dealId: string, stageId: string) => {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage_id === stageId) return;
    const targetStage = stages.find((s) => s.id === stageId);
    updateDeal.mutate(
      { id: dealId, stage_id: stageId },
      {
        onSuccess: () => toast({ title: "Negocio movido", description: `Movido a ${targetStage?.name || "nueva etapa"}` }),
        onError: () => toast({ title: "Error", description: "No se pudo mover el negocio", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map((stage) => (
        <CrmKanbanColumn
          key={stage.id}
          stage={stage}
          deals={deals.filter((d) => d.stage_id === stage.id)}
          onDrop={handleDrop}
          onDealClick={onDealClick}
          onAddDeal={onAddDeal}
        />
      ))}
    </div>
  );
}
