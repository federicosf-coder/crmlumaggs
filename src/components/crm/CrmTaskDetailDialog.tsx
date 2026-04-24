import { useState, useEffect } from "react";
import { CrmTask, useUpdateCrmTask, useDeleteCrmTask } from "@/hooks/useCrmTasks";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Pencil, X, Save, Trash2, Calendar, Clock, LinkIcon, MessageCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { WhatsAppActionDialog } from "@/components/whatsapp/WhatsAppActionDialog";
import { useAuth } from "@/contexts/AuthContext";

interface CrmTaskDetailDialogProps {
  task: CrmTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const priorityColors: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  low: "bg-muted text-muted-foreground border-border",
};

export function CrmTaskDetailDialog({ task, open, onOpenChange }: CrmTaskDetailDialogProps) {
  const updateTask = useUpdateCrmTask();
  const deleteTask = useDeleteCrmTask();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [whatsappOpen, setWhatsappOpen] = useState(false);

  // Enriched contact + company for WhatsApp variables
  const { data: enriched } = useQuery({
    queryKey: ["task-enriched", task?.id],
    queryFn: async () => {
      if (!task) return null;
      const [c, co] = await Promise.all([
        task.contact_id ? supabase.from("contacts").select("first_name,last_name,phone,mobile,whatsapp_phone,company_id").eq("id", task.contact_id).maybeSingle() : Promise.resolve({ data: null } as any),
        task.company_id ? supabase.from("companies").select("name,phone").eq("id", task.company_id).maybeSingle() : Promise.resolve({ data: null } as any),
      ]);
      return { contact: c.data, company: co.data };
    },
    enabled: !!task && open,
  });

  const { data: contacts } = useQuery({
    queryKey: ["contacts-picker"],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, first_name, last_name").eq("is_active", true).order("first_name");
      return data || [];
    },
  });

  const { data: deals } = useQuery({
    queryKey: ["crm-deals-picker"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_deals").select("id, title").order("title");
      return data || [];
    },
  });

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editPriority, setEditPriority] = useState("medium");
  const [editDealId, setEditDealId] = useState("");
  const [editContactId, setEditContactId] = useState("");

  useEffect(() => {
    if (task && editing) {
      setEditTitle(task.title);
      setEditDescription(task.description || "");
      setEditDueDate(task.due_date ? task.due_date.slice(0, 16) : "");
      setEditPriority(task.priority);
      setEditDealId(task.deal_id || "none");
      setEditContactId(task.contact_id || "none");
    }
  }, [task, editing]);

  if (!task) return null;

  const phone =
    enriched?.contact?.whatsapp_phone ||
    enriched?.contact?.mobile ||
    enriched?.contact?.phone ||
    enriched?.company?.phone ||
    null;
  const variables = {
    contacto_nombre: enriched?.contact ? `${enriched.contact.first_name} ${enriched.contact.last_name}`.trim() : null,
    empresa_nombre: enriched?.company?.name || null,
    ejecutivo_nombre: profile?.full_name || null,
    folio_cotizacion: task.crm_deals?.title || null,
  };

  const handleSave = () => {
    updateTask.mutate(
      {
        id: task.id,
        title: editTitle,
        description: editDescription || null,
        due_date: editDueDate || null,
        priority: editPriority,
        deal_id: editDealId && editDealId !== "none" ? editDealId : null,
        contact_id: editContactId && editContactId !== "none" ? editContactId : null,
      },
      {
        onSuccess: () => {
          toast({ title: "Tarea actualizada" });
          setEditing(false);
          onOpenChange(false);
        },
      }
    );
  };

  const handleDelete = () => {
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        toast({ title: "Tarea eliminada" });
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setEditing(false); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md p-0 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b px-6 py-3 shrink-0">
          <DialogTitle className="text-lg font-semibold truncate">{task.title}</DialogTitle>
          <Button variant="ghost" size="icon" onClick={() => setEditing(!editing)}>
            {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          </Button>
        </div>

        <div className="px-6 pb-6 pt-4 space-y-4 overflow-y-auto flex-1">
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-2"><Label>Título</Label><Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Descripción</Label><Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Fecha</Label><Input type="datetime-local" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>Prioridad</Label>
                  <Select value={editPriority} onValueChange={setEditPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baja</SelectItem>
                      <SelectItem value="medium">Media</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Vincular a negocio</Label>
                <Select value={editDealId} onValueChange={setEditDealId}>
                  <SelectTrigger><SelectValue placeholder="Ninguno" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguno</SelectItem>
                    {deals?.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vincular a contacto</Label>
                <Select value={editContactId} onValueChange={setEditContactId}>
                  <SelectTrigger><SelectValue placeholder="Ninguno" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguno</SelectItem>
                    {contacts?.map((c) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={updateTask.isPending}><Save className="h-4 w-4 mr-1" /> Guardar</Button>
                <Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant={task.completed ? "secondary" : "default"}>
                  {task.completed ? "Completada" : "Pendiente"}
                </Badge>
                <Badge variant="outline" className={priorityColors[task.priority] || ""}>
                  {task.priority === "high" ? "Alta" : task.priority === "medium" ? "Media" : "Baja"}
                </Badge>
              </div>

              {task.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>}

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Vence:</span>
                  <span>{task.due_date ? format(parseISO(task.due_date), "d MMM yyyy 'a las' h:mm a", { locale: es }) : "—"}</span>
                </div>
                {task.crm_deals && (
                  <div className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Negocio:</span>
                    <span>{task.crm_deals.title}</span>
                  </div>
                )}
                {task.contacts && (
                  <div className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Contacto:</span>
                    <span>{task.contacts.first_name} {task.contacts.last_name}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setWhatsappOpen(true)}>
                  <MessageCircle className="h-4 w-4 mr-1" /> Enviar WhatsApp
                </Button>
              </div>

              <Separator />

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-1" /> Eliminar</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
                    <AlertDialogDescription>Se eliminará permanentemente "{task.title}".</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        <WhatsAppActionDialog
          open={whatsappOpen}
          onOpenChange={setWhatsappOpen}
          phone={phone}
          variables={variables}
          defaultMessage={task.mensaje_sugerido || undefined}
          context={{ company_id: task.company_id, contact_id: task.contact_id, deal_id: task.deal_id }}
          onSent={() => updateTask.mutate({ id: task.id, whatsapp_status: "enviado", whatsapp_last_sent_at: new Date().toISOString() })}
        />
      </DialogContent>
    </Dialog>
  );
}
