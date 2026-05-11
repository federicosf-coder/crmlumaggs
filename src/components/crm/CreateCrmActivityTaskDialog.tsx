import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateCrmTask } from "@/hooks/useCrmTasks";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, X, Phone, Mail, CalendarCheck, Car, MessageCircle, Banknote, RefreshCw, FileText,
} from "lucide-react";
import { format, addHours, startOfHour } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type TaskTypeKey =
  | "call" | "email" | "meeting" | "field_visit"
  | "whatsapp" | "cobranza" | "follow_up" | "note";

const TASK_TYPES: { key: TaskTypeKey; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "call",        label: "Llamada",     Icon: Phone },
  { key: "email",       label: "Email",       Icon: Mail },
  { key: "meeting",     label: "Reunión",     Icon: CalendarCheck },
  { key: "field_visit", label: "Visita",      Icon: Car },
  { key: "whatsapp",    label: "WhatsApp",    Icon: MessageCircle },
  { key: "cobranza",    label: "Cobranza",    Icon: Banknote },
  { key: "follow_up",   label: "Seguimiento", Icon: RefreshCw },
  { key: "note",        label: "Nota",        Icon: FileText },
];

const TASK_TYPE_LABEL: Record<TaskTypeKey, string> = TASK_TYPES.reduce((acc, t) => {
  acc[t.key] = t.label;
  return acc;
}, {} as Record<TaskTypeKey, string>);

/** Próxima hora redonda (si son las 14:23 → 15:00). */
function nextRoundHourLocal(): string {
  const next = addHours(startOfHour(new Date()), 1);
  return format(next, "yyyy-MM-dd'T'HH:mm");
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDealId?: string;
  defaultContactId?: string;
  defaultBrand?: string;
  defaultDate?: string;
}

export function CreateCrmActivityTaskDialog({ open, onOpenChange, defaultDealId, defaultContactId, defaultBrand, defaultDate }: Props) {
  const { session } = useAuth();
  const createTask = useCreateCrmTask();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: companies } = useQuery({
    queryKey: ["companies-picker"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, name").eq("is_active", true).order("name");
      return data || [];
    },
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
      const { data } = await supabase.from("crm_deals").select("id, title, crm_pipelines(marca)").order("title");
      return data || [];
    },
  });

  const { data: users } = useQuery({
    queryKey: ["profiles-picker"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, email").eq("is_active", true).order("full_name");
      return data || [];
    },
  });

  const defaultDateValue = defaultDate || nextRoundHourLocal();

  const [taskType, setTaskType] = useState<TaskTypeKey>("call");
  const [activityDate, setActivityDate] = useState(defaultDateValue);
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [recurrence, setRecurrence] = useState<"none" | "daily" | "weekly" | "monthly">("none");
  const [taskStatus, setTaskStatus] = useState<"planned" | "done" | "cancelled">("planned");
  const [companyId, setCompanyId] = useState("");
  const [brand, setBrand] = useState(defaultBrand || "");
  const [dealId, setDealId] = useState(defaultDealId || "");
  const [contactId, setContactId] = useState(defaultContactId || "");
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);

  const filteredDeals = brand
    ? deals?.filter((d: any) => d.crm_pipelines?.marca === brand) || []
    : deals || [];

  const availableCollaborators = users?.filter(
    (u) => u.user_id !== session?.user?.id && !collaboratorIds.includes(u.user_id)
  ) || [];

  const handleAddCollaborator = (userId: string) => {
    if (userId && userId !== "none" && !collaboratorIds.includes(userId)) {
      setCollaboratorIds([...collaboratorIds, userId]);
    }
  };

  const handleRemoveCollaborator = (userId: string) => {
    setCollaboratorIds(collaboratorIds.filter((id) => id !== userId));
  };

  const saveCollaborators = async (entityType: "activity" | "task", entityId: string) => {
    if (collaboratorIds.length === 0) return;
    const table = entityType === "activity" ? "crm_activity_collaborators" : "crm_task_collaborators";
    const fkField = entityType === "activity" ? "activity_id" : "task_id";
    const rows = collaboratorIds.map((uid) => ({ [fkField]: entityId, user_id: uid }));
    try {
      const { error } = await supabase.from(table).insert(rows as any);
      if (error) throw error;
    } catch (err: any) {
      // No bloquear el éxito del registro principal
      toast({
        title: "Advertencia",
        description: `No se pudieron guardar los colaboradores: ${err?.message || "error desconocido"}`,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;
    if (createTask.isPending) return;

    const typeLabel = TASK_TYPE_LABEL[taskType];
    const normalizedDealId = dealId && dealId !== "none" ? dealId : null;
    const normalizedContactId = contactId && contactId !== "none" ? contactId : null;
    let normalizedCompanyId = companyId && companyId !== "none" ? companyId : null;

    // Auto-resolver company_id desde deal o contact si el usuario no la seleccionó
    if (!normalizedCompanyId && normalizedDealId) {
      const { data: dealRow } = await supabase
        .from("crm_deals").select("company_id").eq("id", normalizedDealId).maybeSingle();
      if (dealRow?.company_id) normalizedCompanyId = dealRow.company_id;
    }
    if (!normalizedCompanyId && normalizedContactId) {
      const { data: contactRow } = await supabase
        .from("contacts").select("company_id").eq("id", normalizedContactId).maybeSingle();
      if (contactRow?.company_id) normalizedCompanyId = contactRow.company_id;
    }

    const invalidateAll = () => {
      queryClient.invalidateQueries({ queryKey: ["crm_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["crm_activities"] });
      queryClient.invalidateQueries({ queryKey: ["seller-portal"] });
    };

    const verifyCompany = (data: any) => {
      if (normalizedCompanyId && !data?.company_id) {
        toast({
          title: "Aviso",
          description: "El registro se creó pero no quedó vinculado a la empresa seleccionada.",
          variant: "destructive",
        });
      }
    };

    createTask.mutate(
      {
        user_id: session.user.id,
        title: typeLabel,
        description: description || null,
        due_date: activityDate || null,
        priority,
        company_id: normalizedCompanyId,
        deal_id: normalizedDealId,
        contact_id: normalizedContactId,
        // Nuevas columnas
        task_type: taskType,
        recurrence,
        task_status: taskStatus,
        completed: taskStatus === "done",
      } as any,
      {
        onSuccess: async (data) => {
          verifyCompany(data);
          invalidateAll();
          toast({ title: "Tarea creada" });
          resetAndClose();
          saveCollaborators("task", data.id);
        },
        onError: (err: any) => {
          toast({
            title: "Error al crear tarea",
            description: err?.message || "No se pudo guardar la tarea.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const resetAndClose = () => {
    onOpenChange(false);
    setTaskType("call");
    setActivityDate(defaultDate || nextRoundHourLocal());
    setDescription("");
    setDueDate("");
    setPriority("medium");
    setRecurrence("none");
    setTaskStatus("planned");
    setCompanyId("");
    setBrand(defaultBrand || "");
    setDealId(defaultDealId || "");
    setContactId(defaultContactId || "");
    setCollaboratorIds([]);
  };

  const isPending = createTask.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); else onOpenChange(true); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Nueva Actividad / Tarea</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 px-6 pb-6 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4 pr-2">
            <div className="space-y-2">
              <Label>Fecha *</Label>
              <Input type="datetime-local" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Tipo *</Label>
              <div className="grid grid-cols-4 gap-2">
                {TASK_TYPES.map(({ key, label, Icon }) => {
                  const selected = taskType === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTaskType(key)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 p-3 transition-all",
                        "hover:border-primary/50 hover:bg-accent/50",
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground"
                      )}
                      aria-pressed={selected}
                    >
                      <Icon className="h-6 w-6" />
                      <span className={cn("text-xs font-medium", selected && "text-primary")}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Recurrencia</Label>
              <Select value={recurrence} onValueChange={(v) => setRecurrence(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguna</SelectItem>
                  <SelectItem value="daily">Diaria</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Estatus</Label>
              <Select value={taskStatus} onValueChange={(v) => setTaskStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planificada</SelectItem>
                  <SelectItem value="done">Realizada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Detalles de la actividad..." maxLength={2000} />
            </div>

            {/* Collaborators - right after description */}
            <div className="space-y-2">
              <Label>Colaboradores</Label>
              <SearchableSelect
                value="none"
                onValueChange={handleAddCollaborator}
                options={[
                  { value: "none", label: "Agregar colaborador..." },
                  ...availableCollaborators.map((u) => ({
                    value: u.user_id,
                    label: u.full_name || u.email || "Sin nombre",
                  })),
                ]}
                placeholder="Buscar usuario..."
              />
              {collaboratorIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {collaboratorIds.map((uid) => {
                    const user = users?.find((u) => u.user_id === uid);
                    return (
                      <Badge key={uid} variant="secondary" className="gap-1">
                        {user?.full_name || user?.email || uid.slice(0, 8)}
                        <button type="button" onClick={() => handleRemoveCollaborator(uid)}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baja</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Empresa / Cliente</Label>
              <SearchableSelect
                value={companyId || "none"}
                onValueChange={(v) => setCompanyId(v === "none" ? "" : v)}
                options={[
                  { value: "none", label: "Ninguna" },
                  ...(companies?.map((c) => ({ value: c.id, label: c.name })) || []),
                ]}
                placeholder="Buscar empresa..."
              />
            </div>
            {!defaultDealId && (
              <div className="space-y-2">
                <Label>Vincular a Negocio</Label>
                <SearchableSelect
                  value={dealId || "none"}
                  onValueChange={(v) => setDealId(v === "none" ? "" : v)}
                  options={[
                    { value: "none", label: "Ninguno" },
                    ...(filteredDeals?.map((d: any) => ({ value: d.id, label: d.title })) || []),
                  ]}
                  placeholder="Buscar negocio..."
                />
              </div>
            )}
            {!defaultContactId && (
              <div className="space-y-2">
                <Label>Vincular a Contacto</Label>
                <SearchableSelect
                  value={contactId || "none"}
                  onValueChange={(v) => setContactId(v === "none" ? "" : v)}
                  options={[
                    { value: "none", label: "Ninguno" },
                    ...(contacts?.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` })) || []),
                  ]}
                  placeholder="Buscar contacto..."
                />
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
              <Button type="button" variant="outline" onClick={resetAndClose}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar"}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
