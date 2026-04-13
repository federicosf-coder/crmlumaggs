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
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDealId?: string;
  defaultContactId?: string;
}

export function CreateCrmActivityTaskDialog({ open, onOpenChange, defaultDealId, defaultContactId }: Props) {
  const { session } = useAuth();
  const createActivity = useCreateCrmActivity();
  const createTask = useCreateCrmTask();
  const { toast } = useToast();

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

  const [type, setType] = useState<CrmActivityType>("call");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dealId, setDealId] = useState(defaultDealId || "");
  const [contactId, setContactId] = useState(defaultContactId || "");

  const isTask = type === "task";

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
          due_date: dueDate || null,
          priority,
          deal_id: dealId && dealId !== "none" ? dealId : null,
          contact_id: contactId && contactId !== "none" ? contactId : null,
        },
        {
          onSuccess: () => {
            toast({ title: "Actividad / Tarea creada" });
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
          deal_id: dealId && dealId !== "none" ? dealId : null,
          contact_id: contactId && contactId !== "none" ? contactId : null,
        },
        {
          onSuccess: () => {
            toast({ title: "Actividad / Tarea registrada" });
            resetAndClose();
          },
        }
      );
    }
  };

  const resetAndClose = () => {
    onOpenChange(false);
    setType("call");
    setDescription("");
    setDueDate("");
    setPriority("medium");
    setDealId(defaultDealId || "");
    setContactId(defaultContactId || "");
  };

  const isPending = createActivity.isPending || createTask.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Nueva Actividad / Tarea</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
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
            </div>
          )}

          {!defaultDealId && (
            <div className="space-y-2">
              <Label>Vincular a Negocio</Label>
              <Select value={dealId} onValueChange={setDealId}>
                <SelectTrigger><SelectValue placeholder="Ninguno" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguno</SelectItem>
                  {deals?.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
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
