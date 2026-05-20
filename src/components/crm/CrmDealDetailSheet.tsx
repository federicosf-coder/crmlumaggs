import { CrmDeal, useUpdateCrmDeal, useDeleteCrmDeal } from "@/hooks/useCrmDeals";
import { useCreateCrmActivity } from "@/hooks/useCrmActivities";
import { useCrmTasks } from "@/hooks/useCrmTasks";
import { useAuth } from "@/contexts/AuthContext";
import { CrmPipelineStage } from "@/hooks/useCrmPipelines";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CompanyFormDialog } from "@/components/CompanyFormDialog";
import { ContactFormDialog } from "@/components/ContactFormDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CrmTaskItem } from "@/components/crm/CrmTaskItem";
import { CreateCrmTaskDialog } from "@/components/crm/CreateCrmTaskDialog";
import { DealUnitsProgress } from "@/components/crm/DealUnitsProgress";
import { DealDocumentsTab } from "@/components/crm/DealDocumentsTab";
import { CrmDealStrategicAnalysis } from "@/components/crm/CrmDealStrategicAnalysis";
import { CompanyEvaluacionTab } from "@/components/crm/CompanyEvaluacionTab";
import { DealCompanyUnitsSummary } from "@/components/crm/DealCompanyUnitsSummary";
import { DealCompanyInlineBlocks } from "@/components/crm/DealCompanyInlineBlocks";
import { CompanyProcesoDecisionBlock } from "@/components/crm/CompanyProcesoDecisionBlock";
import { formatCurrency, formatDate, formatMonthYear, lastDayOfMonth } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Phone, Mail, Calendar, FileText, Trash2, Save, Pencil, X, Plus, MessageCircle, ExternalLink, Building2, User, MapPin, Target, TrendingUp, ClipboardList, Briefcase } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCrmActivities } from "@/hooks/useCrmActivities";
import { formatRelativeDate } from "@/lib/formatters";
import { fetchAllRows } from "@/lib/supabasePagination";

// Helper: limpia el nombre del pipeline para evitar duplicar "Chevron", "Phillips 66",
// "Primera Compra", "1ra Compra" o "Recompra" cuando ya vienen incluidos en p.nombre.
function cleanPipelineName(nombre: string): string {
  if (!nombre) return "";
  let out = nombre;
  const patterns = [
    /\bphillips\s*66\b/gi,
    /\bchevron\b/gi,
    /\bprimera\s*compra\b/gi,
    /\b1ra\.?\s*compra\b/gi,
    /\brecompra\b/gi,
  ];
  for (const p of patterns) out = out.replace(p, "");
  return out.replace(/[·\-–|]+/g, " ").replace(/\s+/g, " ").trim() || nombre.trim();
}

interface CrmDealDetailSheetProps {
  deal: CrmDeal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: CrmPipelineStage[];
}

export function CrmDealDetailSheet({ deal, open, onOpenChange, stages }: CrmDealDetailSheetProps) {
  const { session } = useAuth();
  const updateDeal = useUpdateCrmDeal();
  const deleteDeal = useDeleteCrmDeal();
  const createActivity = useCreateCrmActivity();
  const { data: activities } = useCrmActivities({ limit: 10 });
  const { data: tasks } = useCrmTasks({ deal_id: deal?.id });
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editCloseDate, setEditCloseDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStageId, setEditStageId] = useState("");
  const [editContactId, setEditContactId] = useState("");
  const [editCompanyId, setEditCompanyId] = useState("");
  const [editOwnerId, setEditOwnerId] = useState("");
  const [editPipelineId, setEditPipelineId] = useState("");
  const [editPlazaId, setEditPlazaId] = useState("");
  const [activityTitle, setActivityTitle] = useState("");
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);

  const { data: allContacts } = useQuery({
    queryKey: ["contacts-picker-with-company"],
    queryFn: async () => {
      const rows = await fetchAllRows<{ id: string; first_name: string; last_name: string; company_id: string | null }>(
        (from, to) =>
          supabase
            .from("contacts")
            .select("id, first_name, last_name, company_id")
            .eq("is_active", true)
            .order("first_name")
            .range(from, to)
      );
      return rows;
    },
  });
  const { data: allCompanies } = useQuery({
    queryKey: ["companies-picker"],
    queryFn: async () => {
      const rows = await fetchAllRows<{ id: string; name: string }>((from, to) =>
        supabase
          .from("companies")
          .select("id, name")
          .eq("is_active", true)
          .order("name")
          .range(from, to)
      );
      return rows;
    },
  });
  const { data: ejecutivos } = useQuery({
    queryKey: ["ejecutivos-picker"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, is_active")
        .eq("is_active", true)
        .order("full_name");
      return data || [];
    },
    staleTime: 60_000,
  });

  const { data: plazas } = useQuery({
    queryKey: ["plazas-picker"],
    queryFn: async () => {
      const { data } = await supabase.from("plazas").select("id, nombre").eq("is_active", true).order("nombre");
      return data || [];
    },
    staleTime: 5 * 60_000,
  });
  const plazaName = (deal as any)?.plaza_id
    ? plazas?.find((p: any) => p.id === (deal as any).plaza_id)?.nombre || null
    : null;
  const ownerName = deal?.owner_id
    ? ejecutivos?.find((e: any) => e.user_id === deal.owner_id)?.full_name || null
    : null;

  // Color por plaza (estable, basado en hash del nombre)
  const PLAZA_COLORS = [
    "bg-blue-100 text-blue-800 border-blue-200",
    "bg-purple-100 text-purple-800 border-purple-200",
    "bg-emerald-100 text-emerald-800 border-emerald-200",
    "bg-amber-100 text-amber-800 border-amber-200",
    "bg-rose-100 text-rose-800 border-rose-200",
    "bg-cyan-100 text-cyan-800 border-cyan-200",
    "bg-indigo-100 text-indigo-800 border-indigo-200",
    "bg-orange-100 text-orange-800 border-orange-200",
  ];
  const plazaColor = (() => {
    if (!plazaName) return "bg-muted text-muted-foreground border";
    let h = 0;
    for (let i = 0; i < plazaName.length; i++) h = (h * 31 + plazaName.charCodeAt(i)) >>> 0;
    return PLAZA_COLORS[h % PLAZA_COLORS.length];
  })();

  const { data: dealPipeline } = useQuery({
    queryKey: ["crm-pipeline-marca", deal?.pipeline_id],
    enabled: !!deal?.pipeline_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_pipelines")
        .select("marca")
        .eq("id", deal!.pipeline_id)
        .maybeSingle();
      return data;
    },
  });
  const empresaVendedora =
    dealPipeline?.marca === "phillips66" ? "galsa_phillips66" : "lumaggs_chevron";

  // Pipelines disponibles para cambiar — TODOS (primera_compra y recompra)
  const { data: availablePipelines } = useQuery({
    queryKey: ["crm-pipelines-all"],
    enabled: !!deal,
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_pipelines")
        .select("id, nombre, marca, pipeline_type")
        .order("pipeline_type")
        .order("marca")
        .order("nombre");
      return data || [];
    },
  });

  // Etapas del pipeline seleccionado al editar (puede diferir del pipeline actual)
  const { data: editStages } = useQuery({
    queryKey: ["crm-pipeline-stages-edit", editPipelineId],
    enabled: editing && !!editPipelineId,
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_pipeline_stages")
        .select("id, name, color, position")
        .eq("pipeline_id", editPipelineId)
        .order("position");
      return data || [];
    },
  });

  useEffect(() => {
    if (deal && editing) {
      setEditTitle(deal.title);
      setEditValue(String((deal as any).potencial_unidades ?? 0));
      setEditCloseDate(
        deal.close_date ||
          ((deal as any).pipeline_type === "recompra"
            ? lastDayOfMonth((deal as any).mes_negocio) || ""
            : "")
      );
      setEditNotes(deal.notes || "");
      setEditStageId(deal.stage_id);
      setEditContactId(deal.contact_id || "");
      setEditCompanyId(deal.company_id || "");
      setEditOwnerId(deal.owner_id || "");
      setEditPipelineId(deal.pipeline_id || "");
      setEditPlazaId((deal as any).plaza_id || "");
    }
  }, [deal, editing]);

  // Limpiar contacto si no pertenece a la empresa seleccionada en edición
  useEffect(() => {
    if (!editing) return;
    if (!editContactId) return;
    if (!editCompanyId) { setEditContactId(""); return; }
    const c = (allContacts || []).find((x: any) => x.id === editContactId);
    if (c && c.company_id !== editCompanyId) setEditContactId("");
  }, [editing, editCompanyId, allContacts, editContactId]);

  if (!deal) return null;

  const dealActivities = activities?.filter((a) => a.deal_id === deal.id) || [];
  const currentStage = stages.find((s) => s.id === deal.stage_id);
  const isPhillips = dealPipeline?.marca === "phillips66";
  const headerGradient = isPhillips
    ? "bg-gradient-to-r from-red-50 via-orange-50 to-amber-50 border-l-4 border-red-500"
    : "bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-l-4 border-blue-500";
  const stageColor = currentStage?.color || "hsl(var(--primary))";
  const sectionStyle: React.CSSProperties = {
    borderLeftColor: stageColor,
    borderLeftWidth: 4,
  };
  const isRecompra = (deal as any).pipeline_type === "recompra";
  const periodoLabel = isRecompra ? formatMonthYear((deal as any).mes_negocio) : "";
  const cierreDefault =
    (deal as any).close_date || (isRecompra ? lastDayOfMonth((deal as any).mes_negocio) : null);

  const handleQuickActivity = (type: "call" | "email" | "meeting" | "note") => {
    if (!session?.user || !activityTitle.trim()) {
      toast({ title: "Ingresa un título", variant: "destructive" });
      return;
    }
    createActivity.mutate(
      { deal_id: deal.id, user_id: session.user.id, type, title: activityTitle },
      { onSuccess: () => { toast({ title: "Actividad registrada" }); setActivityTitle(""); } }
    );
  };

  const handleSave = () => {
    // Si se cambió el pipeline, la etapa actual puede no pertenecer al nuevo pipeline.
    let nextStageId = editStageId;
    if (editPipelineId && editPipelineId !== deal.pipeline_id) {
      const stillValid = (editStages || []).some((s: any) => s.id === editStageId);
      if (!stillValid) {
        nextStageId = (editStages || [])[0]?.id || "";
      }
    }
    if (!nextStageId) {
      toast({ title: "Selecciona una etapa válida", variant: "destructive" });
      return;
    }
    // Si cambia el pipeline, también puede cambiar el pipeline_type (primera_compra <-> recompra)
    const targetPipeline = (availablePipelines || []).find((p: any) => p.id === (editPipelineId || deal.pipeline_id));
    const updates: any = {
      id: deal.id,
      title: editTitle,
      potencial_unidades: parseFloat(editValue) || 0,
      close_date: editCloseDate || null,
      notes: editNotes || null,
      pipeline_id: editPipelineId || deal.pipeline_id,
      stage_id: nextStageId,
      contact_id: editContactId || null,
      company_id: editCompanyId || null,
      owner_id: editOwnerId || null,
      plaza_id: editPlazaId || null,
    };
    if (targetPipeline?.pipeline_type) {
      updates.pipeline_type = targetPipeline.pipeline_type;
    }
    updateDeal.mutate(updates, {
      onSuccess: () => { toast({ title: "Negocio actualizado" }); setEditing(false); },
    });
  };

  const handleDelete = () => {
    deleteDeal.mutate(deal.id, { onSuccess: () => { toast({ title: "Negocio eliminado" }); onOpenChange(false); } });
  };

  const openInNewTab = (path: string) => window.open(path, "_blank", "noopener,noreferrer");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setEditing(false); onOpenChange(o); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className={`rounded-lg p-4 shadow-sm ${headerGradient}`}>
            <div className="flex items-start justify-between gap-2">
              <DialogTitle className="flex items-center gap-2 text-lg flex-wrap">
                <div className="h-3 w-3 rounded-full ring-2 ring-white" style={{ backgroundColor: stageColor }} />
                <span>{deal.title}</span>
                {(() => {
                  const p = (availablePipelines || []).find((x: any) => x.id === deal.pipeline_id);
                  if (!p) return null;
                  const tipoLabel = p.pipeline_type === "recompra" ? "Recompra" : "Primera Compra";
                  const marcaLabel = p.marca === "phillips66" ? "Phillips 66" : "Chevron";
                  const clean = cleanPipelineName(p.nombre);
                  return (
                    <Badge variant="outline" className="text-xs font-semibold bg-white/80 border-foreground/10 shadow-sm">
                      {marcaLabel} · {tipoLabel}{clean ? ` · ${clean}` : ""}
                    </Badge>
                  );
                })()}
                {(deal.close_date || (isRecompra && cierreDefault)) && (
                  <span className="text-sm font-normal text-muted-foreground">
                    · Cierre: {isRecompra
                      ? cierreDefault ? formatMonthYear(cierreDefault) : (periodoLabel || "—")
                      : deal.close_date ? formatDate(deal.close_date) : "—"}
                  </span>
                )}
              </DialogTitle>
              <Button variant="ghost" size="icon" onClick={() => setEditing(!editing)}>
                {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              {deal.companies && (
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground/80">
                  <Building2 className="h-3.5 w-3.5" /> {deal.companies.name}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 ml-1"
                    title="Ver empresa en nueva ventana"
                    onClick={() => openInNewTab(`/directory?company=${deal.company_id}`)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </span>
              )}
              {plazaName && (
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold border shadow-sm ${plazaColor}`}>
                  <MapPin className="h-3.5 w-3.5" /> {plazaName}
                </span>
              )}
              {currentStage && (
                <Badge
                  className="text-sm font-semibold px-3 py-1 shadow-sm"
                  style={{ backgroundColor: stageColor, color: "white" }}
                >
                  {currentStage.name}
                </Badge>
              )}
              {isRecompra && (
                <Badge variant="outline" className="text-sm font-semibold bg-white/70">Recompra</Badge>
              )}
              {ownerName && (
                <span className="inline-flex items-center gap-1 text-sm text-foreground/70">
                  <User className="h-3.5 w-3.5" /> {ownerName}
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
          {editing ? (
            <div className="space-y-4">
              {/* Fila 1: Título + Pipeline */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground font-light">Título</Label>
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground font-light">Pipeline</Label>
                  <Select value={editPipelineId} onValueChange={setEditPipelineId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar pipeline" /></SelectTrigger>
                    <SelectContent>
                      {(availablePipelines || []).map((p: any) => {
                        const tipoLabel = p.pipeline_type === "recompra" ? "Recompra" : "Primera Compra";
                        const marcaLabel = p.marca === "phillips66" ? "Phillips 66" : "Chevron";
                        const clean = cleanPipelineName(p.nombre);
                        return (
                          <SelectItem key={p.id} value={p.id}>
                            {marcaLabel} · {tipoLabel}{clean ? ` · ${clean}` : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {editPipelineId && editPipelineId !== deal.pipeline_id && (
                <p className="text-xs text-muted-foreground -mt-2">
                  Al cambiar de pipeline, la etapa se reasignará a la primera del pipeline destino si no coincide.
                </p>
              )}

              {/* Fila 2: Empresa + Contacto */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground font-light">Empresa</Label>
                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0">
                      <SearchableSelect
                        value={editCompanyId}
                        onValueChange={setEditCompanyId}
                        options={(allCompanies || []).map((c) => ({ value: c.id, label: c.name }))}
                        placeholder="Buscar empresa..."
                      />
                    </div>
                    <Button type="button" variant="outline" size="icon" title="Nueva empresa" onClick={() => setCompanyDialogOpen(true)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" title="Abrir empresa" disabled={!editCompanyId} onClick={() => editCompanyId && openInNewTab(`/directory?tab=companies&select=${editCompanyId}`)}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground font-light">Contacto</Label>
                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0">
                      <SearchableSelect
                        value={editContactId}
                        onValueChange={setEditContactId}
                        options={(allContacts || [])
                          .filter((c: any) => c.company_id === editCompanyId)
                          .map((c: any) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` }))}
                        placeholder={editCompanyId ? "Buscar contacto..." : "Selecciona primero una empresa"}
                        disabled={!editCompanyId}
                      />
                    </div>
                    <Button type="button" variant="outline" size="icon" title="Nuevo contacto" disabled={!editCompanyId} onClick={() => setContactDialogOpen(true)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" title="Abrir contacto" disabled={!editContactId} onClick={() => editContactId && openInNewTab(`/directory?tab=contacts&select=${editContactId}`)}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Fila 3: Ejecutivo + Plaza */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground font-light">Ejecutivo</Label>
                  <Select value={editOwnerId} onValueChange={setEditOwnerId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar ejecutivo" /></SelectTrigger>
                    <SelectContent>
                      {(ejecutivos || []).map((e: any) => (
                        <SelectItem key={e.user_id} value={e.user_id}>{e.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground font-light">Plaza <span className="text-destructive">*</span></Label>
                  <Select value={editPlazaId} onValueChange={setEditPlazaId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar plaza" /></SelectTrigger>
                    <SelectContent>
                      {(plazas || []).map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Fila 4: Potencial + Etapa + Fecha de Cierre */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground font-light">Potencial Unidades</Label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="Unidades"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground font-light">Etapa</Label>
                  <Select value={editStageId} onValueChange={setEditStageId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(editPipelineId && editPipelineId !== deal.pipeline_id ? (editStages || []) : stages).map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                            {s.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground font-light">Fecha de Cierre</Label>
                  <Input type="date" value={editCloseDate} onChange={(e) => setEditCloseDate(e.target.value)} />
                </div>
              </div>

              {/* Notas */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground font-light">Notas</Label>
                <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} />
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={updateDeal.isPending}><Save className="h-4 w-4 mr-1" /> Guardar</Button>
                <Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <Tabs defaultValue="resumen" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="resumen" className="text-xs">Resumen</TabsTrigger>
                <TabsTrigger value="documentos" className="text-xs">Documentos Venta</TabsTrigger>
                <TabsTrigger value="seguimiento" className="text-xs">Seguimiento</TabsTrigger>
                <TabsTrigger value="evaluacion" className="text-xs">Evaluación Cliente</TabsTrigger>
              </TabsList>

              {/* === Resumen === */}
              <TabsContent value="resumen" className="space-y-4 mt-4 min-h-[580px] overflow-y-auto">
                {/* Bloques empresa editables */}
                {deal.company_id && (
                  <DealCompanyInlineBlocks companyId={deal.company_id} />
                )}

                {/* Resumen unidades por marca */}
                {deal.company_id && (
                  <DealCompanyUnitsSummary
                    companyId={deal.company_id}
                    marca={dealPipeline?.marca === "phillips66" ? "phillips66" : "chevron"}
                  />
                )}

                {deal.contacts && (
                  <div className="rounded-lg shadow-sm bg-gray-50 p-3 text-sm" style={sectionStyle}>
                    <span className="text-muted-foreground inline-flex items-center gap-1"><User className="h-3.5 w-3.5" /> Contacto</span>
                    <p className="font-medium">{deal.contacts.first_name} {deal.contacts.last_name}</p>
                  </div>
                )}
                {deal.notes && (
                  <div className="rounded-lg shadow-sm bg-gray-50 p-3 text-sm" style={sectionStyle}>
                    <span className="text-muted-foreground inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Notas</span>
                    <p className="mt-1 whitespace-pre-wrap">{deal.notes}</p>
                  </div>
                )}

                <div className="rounded-lg shadow-sm bg-gray-50 p-4" style={sectionStyle}>
                  <h4 className="text-sm font-semibold mb-3 inline-flex items-center gap-1.5"><TrendingUp className="h-4 w-4" /> Avance del negocio (en unidades)</h4>
                  <DealUnitsProgress deal={deal} />
                </div>

                <div className="rounded-lg shadow-sm bg-gray-50 p-4" style={sectionStyle}>
                  <CrmDealStrategicAnalysis dealId={deal.id} />
                </div>
              </TabsContent>

              {/* === Documentos Venta === */}
              <TabsContent value="documentos" className="mt-4 min-h-[580px] overflow-y-auto">
                <DealDocumentsTab
                  dealId={deal.id}
                  empresaId={deal.company_id ?? null}
                  contactoId={deal.contact_id ?? null}
                  empresaVendedora={empresaVendedora}
                  negocioCrm={deal.title}
                  ownerId={deal.owner_id ?? deal.created_by ?? null}
                  notas={deal.notes ?? null}
                />
              </TabsContent>

              {/* === Seguimiento === */}
              <TabsContent value="seguimiento" className="space-y-4 mt-4 min-h-[580px] overflow-y-auto">
                <div className="rounded-lg shadow-sm bg-gray-50 p-4" style={sectionStyle}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold inline-flex items-center gap-1.5"><ClipboardList className="h-4 w-4" /> Tareas</h4>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setTaskDialogOpen(true)}>
                      <Plus className="h-3 w-3 mr-1" /> Agregar Tarea
                    </Button>
                  </div>
                  {!tasks?.length ? (
                    <p className="text-sm text-muted-foreground">Sin tareas vinculadas.</p>
                  ) : (
                    <div className="space-y-2">{tasks.map((t) => <CrmTaskItem key={t.id} task={t} />)}</div>
                  )}
                </div>

                <div className="rounded-lg shadow-sm bg-gray-50 p-4" style={sectionStyle}>
                  <h4 className="text-sm font-semibold mb-3 inline-flex items-center gap-1.5"><Target className="h-4 w-4" /> Registrar Actividad</h4>
                  <div className="flex gap-2 mb-2">
                    <Input placeholder="Título de la actividad..." value={activityTitle} onChange={(e) => setActivityTitle(e.target.value)} className="flex-1" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleQuickActivity("call")}><Phone className="h-3 w-3 mr-1" /> Llamada</Button>
                    <Button size="sm" variant="outline" onClick={() => handleQuickActivity("email")}><Mail className="h-3 w-3 mr-1" /> Email</Button>
                    <Button size="sm" variant="outline" onClick={() => handleQuickActivity("meeting")}><Calendar className="h-3 w-3 mr-1" /> Reunión</Button>
                    <Button size="sm" variant="outline" onClick={() => handleQuickActivity("note")}><FileText className="h-3 w-3 mr-1" /> Nota</Button>
                  </div>
                </div>

                <div className="rounded-lg shadow-sm bg-gray-50 p-4" style={sectionStyle}>
                  <h4 className="text-sm font-semibold mb-3 inline-flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Línea de Tiempo</h4>
                  {dealActivities.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin actividades registradas.</p>
                  ) : (
                    <div className="space-y-3">
                      {dealActivities.map((a) => (
                        <div key={a.id} className="flex gap-3 text-sm">
                          <div className="mt-1">
                            {a.type === "call" && <Phone className="h-4 w-4 text-blue-500" />}
                            {a.type === "email" && <Mail className="h-4 w-4 text-purple-500" />}
                            {a.type === "meeting" && <Calendar className="h-4 w-4 text-orange-500" />}
                            {a.type === "note" && <FileText className="h-4 w-4 text-green-500" />}
                            {a.type === "whatsapp" && <MessageCircle className="h-4 w-4 text-emerald-500" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{a.title}</p>
                            {a.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground">{formatRelativeDate(a.created_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* === Evaluación Cliente === */}
              <TabsContent value="evaluacion" className="mt-4 min-h-[580px] overflow-y-auto">
                {deal.company_id ? (
                  <div className="space-y-4">
                    <CompanyProcesoDecisionBlock companyId={deal.company_id} />
                    <CompanyEvaluacionTab companyId={deal.company_id} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Asigna una empresa al negocio para evaluarla.</p>
                )}
              </TabsContent>
            </Tabs>
          )}

          <Separator />

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-1" /> Eliminar Negocio</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar negocio?</AlertDialogTitle>
                <AlertDialogDescription>Se eliminará permanentemente "{deal.title}" y no se puede deshacer.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          </div>

          {/* Right column: recent activities + pending tasks */}
          <aside className="space-y-6 lg:border-l lg:pl-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold">Tareas pendientes</h4>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setTaskDialogOpen(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Nueva
                </Button>
              </div>
              {!tasks?.length ? (
                <p className="text-xs text-muted-foreground">Sin tareas.</p>
              ) : (
                <div className="space-y-2">{tasks.slice(0, 5).map((t) => <CrmTaskItem key={t.id} task={t} />)}</div>
              )}
            </div>
            <Separator />
            <div>
              <h4 className="text-sm font-semibold mb-2">Actividades recientes</h4>
              {dealActivities.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin actividades.</p>
              ) : (
                <div className="space-y-3">
                  {dealActivities.slice(0, 5).map((a) => (
                    <div key={a.id} className="flex gap-2 text-xs">
                      <div className="mt-0.5">
                        {a.type === "call" && <Phone className="h-3.5 w-3.5 text-blue-500" />}
                        {a.type === "email" && <Mail className="h-3.5 w-3.5 text-purple-500" />}
                        {a.type === "meeting" && <Calendar className="h-3.5 w-3.5 text-orange-500" />}
                        {a.type === "note" && <FileText className="h-3.5 w-3.5 text-green-500" />}
                        {a.type === "whatsapp" && <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{a.title}</p>
                        <p className="text-muted-foreground">{formatRelativeDate(a.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </DialogContent>
      <CreateCrmTaskDialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen} defaultDealId={deal.id} />
      <CompanyFormDialog
        open={companyDialogOpen}
        onOpenChange={setCompanyDialogOpen}
        onCreated={(id) => setEditCompanyId(id)}
      />
      <ContactFormDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        defaultCompanyId={editCompanyId || undefined}
        onCreated={async (id) => {
          const { data: nuevo } = await supabase
            .from("contacts")
            .select("id, company_id")
            .eq("id", id)
            .maybeSingle();
          if (nuevo && nuevo.company_id === editCompanyId) {
            setEditContactId(id);
          }
        }}
      />
    </Dialog>
  );
}
