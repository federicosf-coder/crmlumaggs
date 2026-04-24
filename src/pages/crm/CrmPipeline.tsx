import { useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCrmPipelines, useCrmPipelineStages, type PipelineType } from "@/hooks/useCrmPipelines";
import { useCrmDeals, CrmDeal } from "@/hooks/useCrmDeals";
import { CrmKanbanBoard } from "@/components/crm/CrmKanbanBoard";
import { CreateCrmDealDialog } from "@/components/crm/CreateCrmDealDialog";
import { CrmDealDetailSheet } from "@/components/crm/CrmDealDetailSheet";
import { CrmPipelineFilters } from "@/components/crm/CrmPipelineFilters";
import { PageBanner } from "@/components/PageBanner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Kanban, ArrowLeft, Trash2, GripVertical } from "lucide-react";

const DEFAULT_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#6366f1", "#ec4899", "#14b8a6"];

interface NewStage {
  name: string;
  color: string;
}

export default function CrmPipeline() {
  const { brand } = useParams<{ brand: string }>();
  const [params, setParams] = useSearchParams();
  const pipelineType = (params.get("type") as PipelineType) || "primera_compra";
  const typeLabel = pipelineType === "primera_compra" ? "Primera Compra" : "Recompra";
  const marca = brand || "chevron";
  const brandLabel = marca === "chevron" ? "Chevron" : "Phillips 66";
  const navigate = useNavigate();
  const { session } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: pipelines, isLoading: pipelinesLoading } = useCrmPipelines(marca, pipelineType);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");

  const activePipelineId = selectedPipelineId || pipelines?.[0]?.id || "";
  const pipeline = pipelines?.find((p) => p.id === activePipelineId);

  const { data: stages, isLoading: stagesLoading } = useCrmPipelineStages(pipeline?.id);
  const { data: deals, isLoading: dealsLoading } = useCrmDeals(pipeline?.id, marca);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createStageId, setCreateStageId] = useState<string | undefined>();
  const [selectedDeal, setSelectedDeal] = useState<CrmDeal | null>(null);

  // New pipeline dialog
  const [newPipelineOpen, setNewPipelineOpen] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [newStages, setNewStages] = useState<NewStage[]>([
    { name: "Prospecto", color: "#3b82f6" },
    { name: "Contactado", color: "#8b5cf6" },
    { name: "Propuesta", color: "#f59e0b" },
    { name: "Negociación", color: "#10b981" },
    { name: "Ganado", color: "#22c55e" },
    { name: "Perdido", color: "#ef4444" },
  ]);
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

  const addStageRow = () => {
    setNewStages((prev) => [...prev, { name: "", color: DEFAULT_COLORS[prev.length % DEFAULT_COLORS.length] }]);
  };

  const removeStageRow = (idx: number) => {
    setNewStages((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateStageRow = (idx: number, field: keyof NewStage, value: string) => {
    setNewStages((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const handleCreatePipeline = async (name?: string, customStages?: NewStage[]) => {
    if (!session?.user) return;
    const finalName = name || newPipelineName;
    if (!finalName.trim()) return;

    const stagesToCreate = customStages || newStages;
    const validStages = stagesToCreate.filter((s) => s.name.trim());
    if (validStages.length === 0) {
      toast({ title: "Error", description: "Agrega al menos una etapa", variant: "destructive" });
      return;
    }

    setCreating(true);
    // Insert pipeline
    const { data: newPipeline, error: pErr } = await supabase
      .from("crm_pipelines")
      .insert({ nombre: finalName, marca, created_by: session.user.id })
      .select("id")
      .single();

    if (pErr) {
      toast({ title: "Error", description: pErr.message, variant: "destructive" });
      setCreating(false);
      return;
    }

    // Insert stages
    const stageInserts = validStages.map((s, i) => ({
      pipeline_id: newPipeline.id,
      name: s.name,
      color: s.color,
      position: i,
    }));

    const { error: sErr } = await supabase.from("crm_pipeline_stages").insert(stageInserts);
    setCreating(false);

    if (sErr) {
      toast({ title: "Error al crear etapas", description: sErr.message, variant: "destructive" });
    } else {
      toast({ title: "Pipeline creado" });
      qc.invalidateQueries({ queryKey: ["crm_pipelines", marca] });
      setSelectedPipelineId(newPipeline.id);
      setNewPipelineOpen(false);
      setNewPipelineName("");
      setNewStages([
        { name: "Prospecto", color: "#3b82f6" },
        { name: "Contactado", color: "#8b5cf6" },
        { name: "Propuesta", color: "#f59e0b" },
        { name: "Negociación", color: "#10b981" },
        { name: "Ganado", color: "#22c55e" },
        { name: "Perdido", color: "#ef4444" },
      ]);
    }
  };

  const isLoading = pipelinesLoading || stagesLoading || dealsLoading;

  if (!pipelinesLoading && (!pipelines || pipelines.length === 0)) {
    return (
      <div className="space-y-6">
        <PageBanner title={`${typeLabel} — ${brandLabel}`} description="Gestiona tus embudos de ventas.">
          <Button variant="outline" onClick={() => navigate(`/crm/${marca}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver
          </Button>
        </PageBanner>
        <div className="flex flex-col items-center justify-center py-24">
          <Kanban className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Sin Pipeline</h2>
          <p className="text-muted-foreground mb-6">No hay embudo de {typeLabel} para {brandLabel}.</p>
        </div>
      </div>
    );
  }

  function renderNewPipelineDialog() {
    return (
      <Dialog open={newPipelineOpen} onOpenChange={setNewPipelineOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nuevo Pipeline</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre del Pipeline *</Label>
              <Input
                value={newPipelineName}
                onChange={(e) => setNewPipelineName(e.target.value)}
                placeholder="Ej: Prospectos Nuevos"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Etapas</Label>
                <Button type="button" variant="outline" size="sm" onClick={addStageRow}>
                  <Plus className="h-3 w-3 mr-1" /> Etapa
                </Button>
              </div>
              <div className="space-y-2">
                {newStages.map((stage, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <input
                      type="color"
                      value={stage.color}
                      onChange={(e) => updateStageRow(idx, "color", e.target.value)}
                      className="w-8 h-8 rounded border cursor-pointer flex-shrink-0"
                    />
                    <Input
                      value={stage.name}
                      onChange={(e) => updateStageRow(idx, "name", e.target.value)}
                      placeholder={`Etapa ${idx + 1}`}
                      className="flex-1"
                    />
                    {newStages.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeStageRow(idx)} className="flex-shrink-0">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewPipelineOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => handleCreatePipeline()}
              disabled={!newPipelineName.trim() || newStages.filter(s => s.name.trim()).length === 0 || creating}
            >
              {creating ? "Creando..." : "Crear Pipeline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="space-y-6">
      <PageBanner title={`${typeLabel} — ${brandLabel}`} description="Arrastra negocios entre etapas para actualizar su progreso.">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/crm/${marca}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver
          </Button>
          <Button onClick={() => { setCreateStageId(stages?.[0]?.id); setCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo Negocio
          </Button>
        </div>
      </PageBanner>

      {/* Switch primera vs recompra dentro del propio pipeline */}
      <div className="flex flex-wrap gap-1 rounded-full bg-secondary p-1 w-fit">
        <Button size="sm" variant={pipelineType === "primera_compra" ? "default" : "ghost"} className="rounded-full" onClick={() => setParams({ type: "primera_compra" })}>
          Primera Compra
        </Button>
        <Button size="sm" variant={pipelineType === "recompra" ? "default" : "ghost"} className="rounded-full" onClick={() => setParams({ type: "recompra" })}>
          Recompra
        </Button>
      </div>

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

      {renderNewPipelineDialog()}
    </div>
  );
}
