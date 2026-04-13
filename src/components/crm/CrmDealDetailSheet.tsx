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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CrmTaskItem } from "@/components/crm/CrmTaskItem";
import { CreateCrmTaskDialog } from "@/components/crm/CreateCrmTaskDialog";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Phone, Mail, Calendar, FileText, Trash2, Save, Pencil, X, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCrmActivities } from "@/hooks/useCrmActivities";
import { formatRelativeDate } from "@/lib/formatters";

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
  const [editProbability, setEditProbability] = useState("");
  const [editCloseDate, setEditCloseDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStageId, setEditStageId] = useState("");
  const [editContactId, setEditContactId] = useState("");
  const [editCompanyId, setEditCompanyId] = useState("");
  const [activityTitle, setActivityTitle] = useState("");
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);

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
      const { data } = await supabase.from("companies").select("id, name").eq("is_active", true).order("name");
      return data || [];
    },
  });

  useEffect(() => {
    if (deal && editing) {
      setEditTitle(deal.title);
      setEditValue(String(deal.value || 0));
      setEditProbability(String(deal.probability || 50));
      setEditCloseDate(deal.close_date || "");
      setEditNotes(deal.notes || "");
      setEditStageId(deal.stage_id);
      setEditContactId(deal.contact_id || "");
      setEditCompanyId(deal.company_id || "");
    }
  }, [deal, editing]);

  if (!deal) return null;

  const dealActivities = activities?.filter((a) => a.deal_id === deal.id) || [];
  const currentStage = stages.find((s) => s.id === deal.stage_id);

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
    updateDeal.mutate(
      {
        id: deal.id, title: editTitle, value: parseFloat(editValue) || 0,
        probability: parseInt(editProbability) || 50, close_date: editCloseDate || null,
        notes: editNotes || null, stage_id: editStageId,
        contact_id: editContactId || null, company_id: editCompanyId || null,
      },
      { onSuccess: () => { toast({ title: "Negocio actualizado" }); setEditing(false); } }
    );
  };

  const handleDelete = () => {
    deleteDeal.mutate(deal.id, { onSuccess: () => { toast({ title: "Negocio eliminado" }); onOpenChange(false); } });
  };

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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Valor</Label><Input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} /></div>
                <div className="space-y-2"><Label>Probabilidad (%)</Label><Input type="number" min="0" max="100" value={editProbability} onChange={(e) => setEditProbability(e.target.value)} /></div>
              </div>
              <div className="space-y-2">
                <Label>Etapa</Label>
                <Select value={editStageId} onValueChange={setEditStageId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{stages.map((s) => <SelectItem key={s.id} value={s.id}><div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />{s.name}</div></SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Contacto</Label>
                <Select value={editContactId} onValueChange={setEditContactId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>{allContacts?.map((c) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Select value={editCompanyId} onValueChange={setEditCompanyId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>{allCompanies?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Fecha de Cierre</Label><Input type="date" value={editCloseDate} onChange={(e) => setEditCloseDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>Notas</Label><Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} /></div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={updateDeal.isPending}><Save className="h-4 w-4 mr-1" /> Guardar</Button>
                <Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Valor</span><p className="font-semibold text-lg">{formatCurrency(Number(deal.value))}</p></div>
                <div><span className="text-muted-foreground">Probabilidad</span><p className="font-semibold">{deal.probability}%</p></div>
                <div><span className="text-muted-foreground">Etapa</span><Badge style={{ backgroundColor: currentStage?.color, color: "white" }}>{currentStage?.name}</Badge></div>
                <div><span className="text-muted-foreground">Fecha de Cierre</span><p>{deal.close_date ? formatDate(deal.close_date) : "No definida"}</p></div>
              </div>
              {deal.companies && <div className="text-sm"><span className="text-muted-foreground">Empresa</span><p className="font-medium">{deal.companies.name}</p></div>}
              {deal.contacts && <div className="text-sm"><span className="text-muted-foreground">Contacto</span><p className="font-medium">{deal.contacts.first_name} {deal.contacts.last_name}</p></div>}
              {deal.notes && <div className="text-sm"><span className="text-muted-foreground">Notas</span><p className="mt-1 whitespace-pre-wrap">{deal.notes}</p></div>}
            </>
          )}

          <Separator />

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
                    </div>
                    <div>
                      <p className="font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{formatRelativeDate(a.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
    </Sheet>
  );
}
