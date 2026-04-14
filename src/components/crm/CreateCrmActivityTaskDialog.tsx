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
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

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

  const isTask = type === "task";

  // Filter deals by selected brand
  const filteredDeals = brand
    ? deals?.filter((d: any) => d.crm_pipelines?.marca === brand) || []
    : deals || [];

  const handleSubmit = (e: React.FormEvent) => {
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
          onSuccess: () => {
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
          onSuccess: () => {
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
  };

  const isPending = createActivity.isPending || createTask.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Nueva Actividad / Tarea</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date at the top */}
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
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue placeholder="Ninguna" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ninguna</SelectItem>
                {companies?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {!defaultDealId && (
            <div className="space-y-2">
              <Label>Vincular a Negocio</Label>
              <Select value={dealId} onValueChange={setDealId}>
                <SelectTrigger><SelectValue placeholder="Ninguno" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguno</SelectItem>
                  {filteredDeals?.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {!defaultContactId && (
            <div className="space-y-2">
              <Label>Vincular a Contacto</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger><SelectValue placeholder="Ninguno" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguno</SelectItem>
                  {contacts?.map((c) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
