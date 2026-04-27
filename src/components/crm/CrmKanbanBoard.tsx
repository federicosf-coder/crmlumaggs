import { CrmDeal, useUpdateCrmDeal } from "@/hooks/useCrmDeals";
import { CrmPipelineStage } from "@/hooks/useCrmPipelines";
import { CrmKanbanColumn } from "./CrmKanbanColumn";
import { useToast } from "@/hooks/use-toast";
import { useCompanyMonthlyAverages } from "@/hooks/useCompanyMonthlyAverages";
import { useMemo } from "react";

interface CrmKanbanBoardProps {
  stages: CrmPipelineStage[];
  deals: CrmDeal[];
  onDealClick: (deal: CrmDeal) => void;
  onAddDeal: (stageId: string) => void;
  brand?: string;
  pipelineType?: string;
}

export function CrmKanbanBoard({ stages, deals, onDealClick, onAddDeal, brand, pipelineType }: CrmKanbanBoardProps) {
  const updateDeal = useUpdateCrmDeal();
  const { toast } = useToast();
  const companyIds = useMemo(
    () => deals.map((d) => (d as any).company_id).filter(Boolean) as string[],
    [deals],
  );
  const monthlyAvg = useCompanyMonthlyAverages(companyIds, brand);
  const showHistorico = pipelineType === "recompra";

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
          monthlyAvg={monthlyAvg}
          showHistorico={showHistorico}
        />
      ))}
    </div>
  );
}
