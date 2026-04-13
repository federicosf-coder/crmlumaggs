import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCrmPipelines, useCrmPipelineStages } from "@/hooks/useCrmPipelines";
import { useCrmDeals, CrmDeal } from "@/hooks/useCrmDeals";
import { CrmKanbanBoard } from "@/components/crm/CrmKanbanBoard";
import { CreateCrmDealDialog } from "@/components/crm/CreateCrmDealDialog";
import { CrmDealDetailSheet } from "@/components/crm/CrmDealDetailSheet";
import { CrmPipelineFilters } from "@/components/crm/CrmPipelineFilters";
import { PageBanner } from "@/components/PageBanner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Kanban, ArrowLeft } from "lucide-react";

export default function CrmPipeline() {
  const { brand } = useParams<{ brand: string }>();
  const marca = brand || "chevron";
  const brandLabel = marca === "chevron" ? "Chevron" : "Phillips 66";
  const navigate = useNavigate();
  const { session } = useAuth();
  const { toast } = useToast();

  const { data: pipelines, isLoading: pipelinesLoading } = useCrmPipelines(marca);
  const pipeline = pipelines?.[0];
  const { data: stages, isLoading: stagesLoading } = useCrmPipelineStages(pipeline?.id);
  const { data: deals, isLoading: dealsLoading } = useCrmDeals(pipeline?.id);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createStageId, setCreateStageId] = useState<string | undefined>();
  const [selectedDeal, setSelectedDeal] = useState<CrmDeal | null>(null);

  const filteredDeals = useMemo(() => {
    if (!deals) return [];
    if (!search) return deals;
    const s = search.toLowerCase();
    return deals.filter(
      (d) =>
        d.title.toLowerCase().includes(s) ||
        d.companies?.name?.toLowerCase().includes(s) ||
        d.contacts?.first_name?.toLowerCase().includes(s) ||
        d.contacts?.last_name?.toLowerCase().includes(s)
    );
  }, [deals, search]);

  const handleCreatePipeline = async () => {
    if (!session?.user) return;
    const { error } = await supabase.rpc("seed_crm_pipeline", { p_marca: marca, p_user_id: session.user.id });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Pipeline creado" });
      window.location.reload();
    }
  };

  const isLoading = pipelinesLoading || stagesLoading || dealsLoading;

  if (!pipelinesLoading && !pipeline) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Kanban className="h-16 w-16 text-muted-foreground/40 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Sin Pipeline</h2>
        <p className="text-muted-foreground mb-6">Crea tu primer pipeline para comenzar.</p>
        <Button onClick={handleCreatePipeline} size="lg">
          <Plus className="h-5 w-5 mr-2" /> Crear Pipeline
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageBanner title={`Pipeline — ${brandLabel}`} description="Arrastra negocios entre etapas para actualizar su progreso.">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/crm")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver
          </Button>
          <Button onClick={() => { setCreateStageId(stages?.[0]?.id); setCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo Negocio
          </Button>
        </div>
      </PageBanner>

      <CrmPipelineFilters search={search} onSearchChange={setSearch} />

      {isLoading ? (
        <div className="flex gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[500px] w-[280px] flex-shrink-0" />
          ))}
        </div>
      ) : stages && stages.length > 0 ? (
        <CrmKanbanBoard
          stages={stages}
          deals={filteredDeals}
          onDealClick={setSelectedDeal}
          onAddDeal={(stageId) => { setCreateStageId(stageId); setCreateOpen(true); }}
        />
      ) : null}

      {pipeline && stages && (
        <CreateCrmDealDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          pipelineId={pipeline.id}
          stages={stages}
          defaultStageId={createStageId}
        />
      )}

      <CrmDealDetailSheet
        deal={selectedDeal}
        open={!!selectedDeal}
        onOpenChange={(o) => !o && setSelectedDeal(null)}
        stages={stages || []}
      />
    </div>
  );
}
