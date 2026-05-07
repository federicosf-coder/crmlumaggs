import { useState, useEffect } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface CreateCrmTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDealId?: string;
  defaultContactId?: string;
  defaultCompanyId?: string;
}

export function CreateCrmTaskDialog({ open, onOpenChange, defaultDealId, defaultContactId, defaultCompanyId }: CreateCrmTaskDialogProps) {
  const { session } = useAuth();
  const createTask = useCreateCrmTask();
  const { toast } = useToast();

  const { data: contacts } = useQuery({
    queryKey: ["contacts-picker"],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, first_name, last_name").eq("is_active", true).order("first_name");
      return data || [];
    },
  });

  const { data: companies } = useQuery({
    queryKey: ["companies-picker"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, name").eq("is_active", true).order("name");
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

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dealId, setDealId] = useState(defaultDealId || "");
  const [contactId, setContactId] = useState(defaultContactId || "");
  const [companyId, setCompanyId] = useState(defaultCompanyId || "");

  // Cuando se abre con un defaultDealId, resolver empresa y contacto principal
  useEffect(() => {
    if (!open || !defaultDealId) return;
    (async () => {
      const { data: deal } = await supabase
        .from("crm_deals")
        .select("company_id, contact_id")
        .eq("id", defaultDealId)
        .maybeSingle();
      if (!deal) return;
      const cId = (deal as any).company_id || "";
      if (cId) {
        setCompanyId((prev) => prev || cId);
        const { data: comp } = await supabase
          .from("companies")
          .select("primary_contact_id")
          .eq("id", cId)
          .maybeSingle();
        const primary = (comp as any)?.primary_contact_id || (deal as any).contact_id || "";
        if (primary) setContactId((prev) => prev || primary);
      } else if ((deal as any).contact_id) {
        setContactId((prev) => prev || (deal as any).contact_id);
      }
    })();
  }, [open, defaultDealId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;
    createTask.mutate(
      {
        user_id: session.user.id,
        title,
        description: description || null,
        due_date: dueDate || null,
        priority,
        deal_id: dealId && dealId !== "none" ? dealId : null,
        contact_id: contactId && contactId !== "none" ? contactId : null,
        company_id: companyId && companyId !== "none" ? companyId : null,
      },
      {
        onSuccess: () => {
          toast({ title: "Tarea creada" });
          onOpenChange(false);
          setTitle(""); setDescription(""); setDueDate(""); setPriority("medium");
          setDealId(defaultDealId || ""); setContactId(defaultContactId || ""); setCompanyId(defaultCompanyId || "");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0"><DialogTitle>Crear Actividad / Tarea</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 pb-6 overflow-y-auto flex-1">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Dar seguimiento al cliente" required maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={2000} />
          </div>
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
          <div className="space-y-2">
            <Label>Vincular a Empresa</Label>
            <SearchableSelect
              value={companyId || "none"}
              onValueChange={(v) => setCompanyId(v === "none" ? "" : v)}
              options={[
                { value: "none", label: "Ninguna" },
                ...((companies || []).map((c: any) => ({ value: c.id, label: c.name }))),
              ]}
              placeholder="Buscar empresa..."
            />
          </div>
          <div className="space-y-2">
            <Label>Vincular a Contacto</Label>
            <SearchableSelect
              value={contactId || "none"}
              onValueChange={(v) => setContactId(v === "none" ? "" : v)}
              options={[
                { value: "none", label: "Ninguno" },
                ...((contacts || []).map((c: any) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` }))),
              ]}
              placeholder="Buscar contacto..."
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={createTask.isPending}>
              {createTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear Actividad / Tarea"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
