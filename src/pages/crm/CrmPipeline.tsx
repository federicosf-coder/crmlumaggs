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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Kanban, ArrowLeft } from "lucide-react";

export default function CrmPipeline() {
  const { brand } = useParams<{ brand: string }>();
  const marca = brand || "chevron";
  const brandLabel = marca === "chevron" ? "Chevron" : "Phillips 66";
  const navigate = useNavigate();
  const { session } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: pipelines, isLoading: pipelinesLoading } = useCrmPipelines(marca);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");

  // Auto-select first pipeline
  const activePipelineId = selectedPipelineId || pipelines?.[0]?.id || "";
  const pipeline = pipelines?.find((p) => p.id === activePipelineId);

  const { data: stages, isLoading: stagesLoading } = useCrmPipelineStages(pipeline?.id);
  const { data: deals, isLoading: dealsLoading } = useCrmDeals(pipeline?.id);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createStageId, setCreateStageId] = useState<string | undefined>();
  const [selectedDeal, setSelectedDeal] = useState<CrmDeal | null>(null);

  // New pipeline dialog
  const [newPipelineOpen, setNewPipelineOpen] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [creating, setCreating] = useState(false);

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

  const handleCreatePipeline = async (name?: string) => {
    if (!session?.user) return;
    setCreating(true);
    const { data, error } = await supabase.rpc("seed_crm_pipeline", {
      p_marca: marca,
      p_user_id: session.user.id,
      p_nombre: name || null,
    });
    setCreating(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Pipeline creado" });
      qc.invalidateQueries({ queryKey: ["crm_pipelines", marca] });
      if (data) setSelectedPipelineId(data as string);
      setNewPipelineOpen(false);
      setNewPipelineName("");
    }
  };

  const isLoading = pipelinesLoading || stagesLoading || dealsLoading;

  if (!pipelinesLoading && (!pipelines || pipelines.length === 0)) {
    return (
      <div className="space-y-6">
        <PageBanner title={`Pipeline — ${brandLabel}`} description="Gestiona tus embudos de ventas.">
          <Button variant="outline" onClick={() => navigate("/crm")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver
          </Button>
        </PageBanner>
        <div className="flex flex-col items-center justify-center py-24">
          <Kanban className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Sin Pipelines</h2>
          <p className="text-muted-foreground mb-6">Crea tus pipelines para comenzar a rastrear negocios.</p>
          <div className="flex gap-3">
            <Button onClick={() => handleCreatePipeline("Prospectos Nuevos")} disabled={creating}>
              <Plus className="h-4 w-4 mr-2" /> Prospectos Nuevos
            </Button>
            <Button variant="outline" onClick={() => handleCreatePipeline("Clientes con Compra")} disabled={creating}>
              <Plus className="h-4 w-4 mr-2" /> Clientes con Compra
            </Button>
          </div>
        </div>
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

      {/* Pipeline selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={activePipelineId} onValueChange={setSelectedPipelineId}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder="Seleccionar Pipeline" />
          </SelectTrigger>
          <SelectContent>
            {pipelines?.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setNewPipelineOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo Pipeline
        </Button>
        <div className="sm:ml-auto">
          <CrmPipelineFilters search={search} onSearchChange={setSearch} />
        </div>
      </div>

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

      {/* New Pipeline Dialog */}
      <Dialog open={newPipelineOpen} onOpenChange={setNewPipelineOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nuevo Pipeline</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre del Pipeline *</Label>
              <Input
                value={newPipelineName}
                onChange={(e) => setNewPipelineName(e.target.value)}
                placeholder="Ej: Prospectos Nuevos, Clientes con Compra..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewPipelineOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => handleCreatePipeline(newPipelineName)}
                disabled={!newPipelineName.trim() || creating}
              >
                {creating ? "Creando..." : "Crear Pipeline"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
