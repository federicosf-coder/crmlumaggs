import { CrmDeal, useUpdateCrmDeal, useDeleteCrmDeal } from "@/hooks/useCrmDeals";
import { useCreateCrmActivity } from "@/hooks/useCrmActivities";
import { useCrmTasks } from "@/hooks/useCrmTasks";
import { useAuth } from "@/contexts/AuthContext";
import { CrmPipelineStage } from "@/hooks/useCrmPipelines";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { formatCurrency, formatDate, formatMonthYear, lastDayOfMonth } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Phone, Mail, Calendar, FileText, Trash2, Save, Pencil, X, Plus, MessageCircle, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCrmActivities } from "@/hooks/useCrmActivities";
import { formatRelativeDate } from "@/lib/formatters";
import { fetchAllRows } from "@/lib/supabasePagination";

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
    queryKey: ["contacts-picker"],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, first_name, last_name").eq("is_active", true).order("first_name");
      return data || [];
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

  // Pipelines disponibles para cambiar (mismo pipeline_type del negocio)
  const { data: availablePipelines } = useQuery({
    queryKey: ["crm-pipelines-all", (deal as any)?.pipeline_type],
    enabled: !!deal,
    queryFn: async () => {
      let q = supabase.from("crm_pipelines").select("id, nombre, marca, pipeline_type").order("marca").order("nombre");
      if ((deal as any)?.pipeline_type) q = q.eq("pipeline_type", (deal as any).pipeline_type);
      const { data } = await q;
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
      setEditValue(String(deal.value || 0));
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

  if (!deal) return null;

  const dealActivities = activities?.filter((a) => a.deal_id === deal.id) || [];
  const currentStage = stages.find((s) => s.id === deal.stage_id);
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
    updateDeal.mutate(
      {
        id: deal.id, title: editTitle, value: parseFloat(editValue) || 0,
        close_date: editCloseDate || null,
        notes: editNotes || null,
        pipeline_id: editPipelineId || deal.pipeline_id,
        stage_id: nextStageId,
        contact_id: editContactId || null, company_id: editCompanyId || null,
        owner_id: editOwnerId || null,
        plaza_id: editPlazaId || null,
      },
      { onSuccess: () => { toast({ title: "Negocio actualizado" }); setEditing(false); } }
    );
  };

  const handleDelete = () => {
    deleteDeal.mutate(deal.id, { onSuccess: () => { toast({ title: "Negocio eliminado" }); onOpenChange(false); } });
  };

  const openInNewTab = (path: string) => window.open(path, "_blank", "noopener,noreferrer");

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) setEditing(false); onOpenChange(o); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: currentStage?.color }} />
              {deal.title}
            </SheetTitle>
            <Button variant="ghost" size="icon" onClick={() => setEditing(!editing)}>
              {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-2"><Label>Título</Label><Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} /></div>
              <div className="space-y-2"><Label>Valor</Label><Input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Plaza <span className="text-destructive">*</span></Label>
                <Select value={editPlazaId} onValueChange={setEditPlazaId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar plaza" /></SelectTrigger>
                  <SelectContent>
                    {(plazas || []).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ejecutivo</Label>
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
                <Label>Etapa</Label>
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
                <Label>Pipeline</Label>
                <Select value={editPipelineId} onValueChange={setEditPipelineId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar pipeline" /></SelectTrigger>
                  <SelectContent>
                    {(availablePipelines || []).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.marca === "phillips66" ? "Phillips 66" : "Chevron"} · {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editPipelineId && editPipelineId !== deal.pipeline_id && (
                  <p className="text-xs text-muted-foreground">
                    Al cambiar de pipeline, la etapa se reasignará a la primera del pipeline destino si no coincide.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Empresa</Label>
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
                <Label>Contacto</Label>
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0">
                    <SearchableSelect
                      value={editContactId}
                      onValueChange={setEditContactId}
                      options={(allContacts || []).map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` }))}
                      placeholder="Buscar contacto..."
                    />
                  </div>
                  <Button type="button" variant="outline" size="icon" title="Nuevo contacto" onClick={() => setContactDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="outline" size="icon" title="Abrir contacto" disabled={!editContactId} onClick={() => editContactId && openInNewTab(`/directory?tab=contacts&select=${editContactId}`)}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2"><Label>Fecha de Cierre</Label><Input type="date" value={editCloseDate} onChange={(e) => setEditCloseDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>Notas</Label><Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} /></div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={updateDeal.isPending}><Save className="h-4 w-4 mr-1" /> Guardar</Button>
                <Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <Tabs defaultValue="resumen" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="resumen" className="text-xs">Resumen</TabsTrigger>
                <TabsTrigger value="documentos" className="text-xs">Documentos Venta</TabsTrigger>
                <TabsTrigger value="seguimiento" className="text-xs">Seguimiento</TabsTrigger>
              </TabsList>

              {/* === Resumen === */}
              <TabsContent value="resumen" className="space-y-6 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Potencial (u)</span><p className="font-semibold text-lg">{new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(Number((deal as any).potencial_unidades) || Number((deal as any).volumen_mensual_estimado) || 0)}</p></div>
                  <div><span className="text-muted-foreground">Etapa</span><Badge style={{ backgroundColor: currentStage?.color, color: "white" }}>{currentStage?.name}</Badge></div>
                  {isRecompra && (
                    <div>
                      <span className="text-muted-foreground">Periodo</span>
                      <p className="font-semibold">{periodoLabel || "—"}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Fecha de Cierre</span>
                    <p>
                      {isRecompra
                        ? cierreDefault
                          ? formatMonthYear(cierreDefault)
                          : periodoLabel || "No definida"
                        : deal.close_date
                          ? formatDate(deal.close_date)
                          : "No definida"}
                    </p>
                  </div>
                </div>
                {deal.companies && <div className="text-sm"><span className="text-muted-foreground">Empresa</span><p className="font-medium">{deal.companies.name}</p></div>}
                {deal.contacts && <div className="text-sm"><span className="text-muted-foreground">Contacto</span><p className="font-medium">{deal.contacts.first_name} {deal.contacts.last_name}</p></div>}
                {ownerName && <div className="text-sm"><span className="text-muted-foreground">Ejecutivo</span><p className="font-medium">{ownerName}</p></div>}
                {deal.notes && <div className="text-sm"><span className="text-muted-foreground">Notas</span><p className="mt-1 whitespace-pre-wrap">{deal.notes}</p></div>}

                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-3">Avance del negocio (en unidades)</h4>
                  <DealUnitsProgress deal={deal} />
                </div>
              </TabsContent>

              {/* === Documentos Venta === */}
              <TabsContent value="documentos" className="mt-4">
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
              <TabsContent value="seguimiento" className="space-y-6 mt-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold">Tareas</h4>
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

                <Separator />

                <div>
                  <h4 className="text-sm font-semibold mb-3">Registrar Actividad</h4>
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

                <Separator />

                <div>
                  <h4 className="text-sm font-semibold mb-3">Línea de Tiempo</h4>
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
      </SheetContent>
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
        onCreated={(id) => setEditContactId(id)}
      />
    </Sheet>
  );
}
