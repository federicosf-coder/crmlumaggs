import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateCrmActivity, CrmActivityType, ACTIVITY_TYPE_CONFIG } from "@/hooks/useCrmActivities";
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
import { Loader2, X } from "lucide-react";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const createActivity = useCreateCrmActivity();
  const createTask = useCreateCrmTask();
  const { toast } = useToast();

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

  const nowLocal = format(new Date(), "yyyy-MM-dd'T'HH:mm");

  const [type, setType] = useState<CrmActivityType>("call");
  const [activityDate, setActivityDate] = useState(defaultDate || nowLocal);
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [companyId, setCompanyId] = useState("");
  const [brand, setBrand] = useState(defaultBrand || "");
  const [dealId, setDealId] = useState(defaultDealId || "");
  const [contactId, setContactId] = useState(defaultContactId || "");
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);

  const isTask = type === "task";

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
    await supabase.from(table).insert(rows as any);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;

    const typeLabel = ACTIVITY_TYPE_CONFIG[type].label;

    if (isTask) {
      createTask.mutate(
        {
          user_id: session.user.id,
          title: typeLabel,
          description: description || null,
          due_date: activityDate || null,
          priority,
          company_id: companyId && companyId !== "none" ? companyId : null,
          deal_id: dealId && dealId !== "none" ? dealId : null,
          contact_id: contactId && contactId !== "none" ? contactId : null,
        },
        {
          onSuccess: async (data) => {
            await saveCollaborators("task", data.id);
            toast({ title: "Tarea creada" });
            resetAndClose();
          },
        }
      );
    } else {
      createActivity.mutate(
        {
          user_id: session.user.id,
          type,
          title: typeLabel,
          description: description || null,
          activity_date: activityDate ? new Date(activityDate).toISOString() : new Date().toISOString(),
          company_id: companyId && companyId !== "none" ? companyId : null,
          deal_id: dealId && dealId !== "none" ? dealId : null,
          contact_id: contactId && contactId !== "none" ? contactId : null,
        },
        {
          onSuccess: async (data) => {
            await saveCollaborators("activity", data.id);
            toast({ title: "Actividad registrada" });
            resetAndClose();
          },
        }
      );
    }
  };

  const resetAndClose = () => {
    onOpenChange(false);
    setType("call");
    setActivityDate(defaultDate || format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setDescription("");
    setDueDate("");
    setPriority("medium");
    setCompanyId("");
    setBrand(defaultBrand || "");
    setDealId(defaultDealId || "");
    setContactId(defaultContactId || "");
    setCollaboratorIds([]);
  };

  const isPending = createActivity.isPending || createTask.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col p-0">
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
              <Select value={type} onValueChange={(v) => setType(v as CrmActivityType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ACTIVITY_TYPE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.emoji} {config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Detalles de la actividad..." maxLength={2000} />
            </div>

            {isTask && (
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
            )}

            <div className="space-y-2">
              <Label>CRM (opcional)</Label>
              <Select value={brand || "none"} onValueChange={(v) => { setBrand(v === "none" ? "" : v); setDealId(""); }}>
                <SelectTrigger><SelectValue placeholder="Sin CRM" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin CRM</SelectItem>
                  <SelectItem value="chevron">Chevron</SelectItem>
                  <SelectItem value="phillips66">Phillips 66</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Vincular a Empresa</Label>
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

            {/* Collaborators */}
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

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
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
