import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCrmPipelines, useCrmPipelineStages, type PipelineType } from "@/hooks/useCrmPipelines";
import { useCrmDeals, CrmDeal } from "@/hooks/useCrmDeals";
import { CrmKanbanBoard } from "@/components/crm/CrmKanbanBoard";
import { CreateCrmDealDialog } from "@/components/crm/CreateCrmDealDialog";
import { CrmDealDetailSheet } from "@/components/crm/CrmDealDetailSheet";
import { CrmPipelineFilters, type ExecutivoOption, type PlazaOption, type SortOption } from "@/components/crm/CrmPipelineFilters";
import { PageBanner } from "@/components/PageBanner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase as _supabaseTyped } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _supabaseTyped;
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Kanban, Trash2, GripVertical, List as ListIcon, Pencil } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { CrmDealsListView } from "@/components/crm/CrmDealsListView";
import { BulkEditDealsDialog } from "@/components/crm/BulkEditDealsDialog";

const DEFAULT_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#6366f1", "#ec4899", "#14b8a6"];

interface NewStage {
  name: string;
  color: string;
}

interface CrmPipelineProps {
  brandProp?: string;
  pipelineTypeProp?: PipelineType;
  embedded?: boolean;
}

export default function CrmPipeline({ brandProp, pipelineTypeProp, embedded }: CrmPipelineProps = {}) {
  const routeParams = useParams<{ brand: string }>();
  const [params, setParams] = useSearchParams();
  const brand = brandProp ?? routeParams.brand;
  const [innerType, setInnerType] = useState<PipelineType>(pipelineTypeProp ?? ((params.get("type") as PipelineType) || "primera_compra"));
  const pipelineType: PipelineType = pipelineTypeProp ?? innerType;
  const typeLabel = pipelineType === "primera_compra" ? "Primera Compra" : "Recompra";
  const marca = brand || "chevron";
  const brandLabel = marca === "chevron" ? "Chevron" : "Phillips 66";
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: pipelines, isLoading: pipelinesLoading } = useCrmPipelines(marca, pipelineType);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");

  const activePipelineId = selectedPipelineId || pipelines?.[0]?.id || "";
  const pipeline = pipelines?.find((p) => p.id === activePipelineId);

  const { data: stages, isLoading: stagesLoading } = useCrmPipelineStages(pipeline?.id);
  const { data: deals, isLoading: dealsLoading } = useCrmDeals(pipeline?.id, marca);

  const [search, setSearch] = useState("");
  const [filterEjecutivo, setFilterEjecutivo] = useState<string>("all");
  const [filterPlaza, setFilterPlaza] = useState<string>("all");
  const [sort, setSort] = useState<SortOption>("default");
  const [filterMes, setFilterMes] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createStageId, setCreateStageId] = useState<string | undefined>();
  const [selectedDeal, setSelectedDeal] = useState<CrmDeal | null>(null);

  // View mode (kanban | list) persisted in localStorage
  const [viewMode, setViewMode] = useState<"kanban" | "list">(() => {
    if (typeof window === "undefined") return "kanban";
    return (localStorage.getItem("crm_view_mode") as "kanban" | "list") || "kanban";
  });
  useEffect(() => {
    try { localStorage.setItem("crm_view_mode", viewMode); } catch {}
  }, [viewMode]);

  // Bulk selection (list mode)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  // Clear selection when filters / pipeline change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activePipelineId, search, filterEjecutivo, filterPlaza, filterMes, sort, pipelineType, marca]);

  // Abrir negocio automáticamente si viene ?deal=<id> en la URL
  useEffect(() => {
    const dealId = params.get("deal");
    if (!dealId || !deals?.length) return;
    if (selectedDeal?.id === dealId) return;
    const found = deals.find((d) => d.id === dealId);
    if (found) setSelectedDeal(found);
  }, [params, deals, selectedDeal?.id]);

  // Cargar ejecutivos (profiles) y plazas para los filtros
  const [ejecutivos, setEjecutivos] = useState<ExecutivoOption[]>([]);
  const [plazas, setPlazas] = useState<PlazaOption[]>([]);
  useEffect(() => {
    supabase.from("profiles").select("user_id, full_name, is_active").eq("is_active", true).order("full_name", { ascending: true })
      .then(({ data }) => {
        setEjecutivos(((data ?? []) as any[])
          .filter((p) => p.full_name)
          .map((p) => ({ user_id: p.user_id, full_name: p.full_name }))
          .sort((a, b) => a.full_name.localeCompare(b.full_name, "es", { sensitivity: "base" })));
      });
    supabase.from("plazas").select("id, nombre").eq("is_active", true).order("nombre", { ascending: true })
      .then(({ data }) => {
        setPlazas(((data ?? []) as any[])
          .map((p) => ({ id: p.id, nombre: p.nombre }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })));
      });
  }, []);

  // Plaza por default = plaza del usuario (solo en montaje inicial / cambio de marca)
  useEffect(() => {
    if (profile?.plaza_id) {
      setFilterPlaza(profile.plaza_id);
    } else {
      setFilterPlaza("all");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.plaza_id, marca]);

  // Reset filtros al cambiar tipo de pipeline
  useEffect(() => {
    setFilterEjecutivo("all");
    setFilterMes("all");
    setSort("default");
  }, [pipelineType, marca]);

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

  const mesesDisponibles = useMemo(() => {
    if (pipelineType !== "recompra" || !deals) return [];
    const set = new Set<string>();
    for (const d of deals as any[]) {
      if (d.mes_negocio && /^\d{4}-\d{2}$/.test(d.mes_negocio)) set.add(d.mes_negocio);
    }
    return Array.from(set).sort().reverse();
  }, [deals, pipelineType]);

  const filteredDeals = useMemo(() => {
    if (!deals) return [];
    let out = deals as any[];
    if (search) {
      const s = search.toLowerCase();
      out = out.filter(
        (d) =>
          d.title.toLowerCase().includes(s) ||
          d.companies?.name?.toLowerCase().includes(s) ||
          d.contacts?.first_name?.toLowerCase().includes(s) ||
          d.contacts?.last_name?.toLowerCase().includes(s)
      );
    }
    if (filterEjecutivo === "none") {
      out = out.filter((d) => !d.owner_id);
    } else if (filterEjecutivo !== "all") {
      out = out.filter((d) => d.owner_id === filterEjecutivo);
    }
    if (filterPlaza === "none") {
      out = out.filter((d) => !(d.plaza_id || d.companies?.plaza_id));
    } else if (filterPlaza !== "all") {
      out = out.filter((d) => (d.plaza_id || d.companies?.plaza_id) === filterPlaza);
    }
    if (pipelineType === "recompra") {
      if (filterMes !== "all") {
        out = out.filter((d) => d.mes_negocio === filterMes);
      }
      // Ordenar por mes DESC por default
      out = [...out].sort((a, b) => (b.mes_negocio ?? "").localeCompare(a.mes_negocio ?? ""));
    }
    if (sort !== "default") {
      const cmpStr = (a?: string | null, b?: string | null) => (a ?? "").localeCompare(b ?? "", "es", { sensitivity: "base" });
      const cmpNum = (a?: number | null, b?: number | null) => (Number(a ?? 0)) - (Number(b ?? 0));
      const companyName = (d: any) => d.companies?.name ?? "";
      const contactName = (d: any) => `${d.contacts?.first_name ?? ""} ${d.contacts?.last_name ?? ""}`.trim();
      out = [...out].sort((a, b) => {
        switch (sort) {
          case "company_asc": return cmpStr(companyName(a), companyName(b));
          case "company_desc": return cmpStr(companyName(b), companyName(a));
          case "contact_asc": return cmpStr(contactName(a), contactName(b));
          case "contact_desc": return cmpStr(contactName(b), contactName(a));
          case "potencial_desc": return cmpNum(b.potencial_unidades, a.potencial_unidades);
          case "potencial_asc": return cmpNum(a.potencial_unidades, b.potencial_unidades);
          case "value_desc": return cmpNum(b.value, a.value);
          case "value_asc": return cmpNum(a.value, b.value);
          default: return 0;
        }
      });
    }
    return out as CrmDeal[];
  }, [deals, search, pipelineType, filterEjecutivo, filterPlaza, filterMes, sort]);

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
        {!embedded && (
          <div className="flex items-center gap-2">
            <BackButton fallback="/crm" />
          </div>
        )}
        <PageBanner title={`${typeLabel} — ${brandLabel}`} description="Gestiona tus embudos de ventas." />
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
      <div className="flex items-center gap-2 flex-wrap">
        {!embedded && <BackButton fallback="/crm" />}
        <Button onClick={() => { setCreateStageId(stages?.[0]?.id); setCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo Negocio
        </Button>
      </div>
      {!embedded && <PageBanner title={`${typeLabel} — ${brandLabel}`} description="Arrastra negocios entre etapas para actualizar su progreso." />}

      {/* Switch primera vs recompra dentro del propio pipeline */}
      <div className="flex flex-wrap gap-1 rounded-full bg-secondary p-1 w-fit">
        <Button size="sm" variant={pipelineType === "primera_compra" ? "default" : "ghost"} className="rounded-full" onClick={() => embedded ? setInnerType("primera_compra") : setParams({ type: "primera_compra" })}>
          Primera Compra
        </Button>
        <Button size="sm" variant={pipelineType === "recompra" ? "default" : "ghost"} className="rounded-full" onClick={() => embedded ? setInnerType("recompra") : setParams({ type: "recompra" })}>
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
        <div>
          <CrmPipelineFilters
            search={search}
            onSearchChange={setSearch}
            ejecutivos={ejecutivos}
            ejecutivoId={filterEjecutivo}
            onEjecutivoChange={setFilterEjecutivo}
            plazas={plazas}
            plazaId={filterPlaza}
            onPlazaChange={setFilterPlaza}
            showRecompraFilters={pipelineType === "recompra"}
            meses={mesesDisponibles}
            mes={filterMes}
            onMesChange={setFilterMes}
            sort={sort}
            onSortChange={setSort}
          />
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <div className="flex rounded-md border p-0.5">
            <Button size="sm" variant={viewMode === "kanban" ? "default" : "ghost"} className="h-8" onClick={() => setViewMode("kanban")}>
              <Kanban className="h-4 w-4 mr-1" /> Kanban
            </Button>
            <Button size="sm" variant={viewMode === "list" ? "default" : "ghost"} className="h-8" onClick={() => setViewMode("list")}>
              <ListIcon className="h-4 w-4 mr-1" /> Lista
            </Button>
          </div>
          {viewMode === "list" && (
            <Button size="sm" variant="outline" disabled={selectedIds.size === 0} onClick={() => setBulkOpen(true)}>
              <Pencil className="h-4 w-4 mr-1" /> Edición masiva ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[500px] w-[336px] flex-shrink-0" />
          ))}
        </div>
      ) : stages && stages.length > 0 ? (
        viewMode === "kanban" ? (
        <CrmKanbanBoard
          stages={stages}
          deals={filteredDeals}
          onDealClick={setSelectedDeal}
          onAddDeal={(stageId) => { setCreateStageId(stageId); setCreateOpen(true); }}
          brand={marca}
          pipelineType={pipelineType}
        />
        ) : (
          <CrmDealsListView
            stages={stages}
            deals={filteredDeals}
            ejecutivos={ejecutivos}
            selectedIds={selectedIds}
            onToggleSelect={(id) => {
              setSelectedIds((prev) => {
                const n = new Set(prev);
                n.has(id) ? n.delete(id) : n.add(id);
                return n;
              });
            }}
            onToggleSelectMany={(ids, checked) => {
              setSelectedIds((prev) => {
                const n = new Set(prev);
                if (checked) ids.forEach((i) => n.add(i));
                else ids.forEach((i) => n.delete(i));
                return n;
              });
            }}
            onOpenDeal={setSelectedDeal}
          />
        )
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
        onOpenChange={(o) => {
          if (!o) {
            setSelectedDeal(null);
            if (params.get("deal")) {
              const next = new URLSearchParams(params);
              next.delete("deal");
              setParams(next, { replace: true });
            }
          }
        }}
        stages={stages || []}
      />

      <BulkEditDealsDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        selectedDeals={(deals || []).filter((d) => selectedIds.has(d.id))}
        marca={marca}
        onSuccess={() => setSelectedIds(new Set())}
      />
    </div>
  );
}
