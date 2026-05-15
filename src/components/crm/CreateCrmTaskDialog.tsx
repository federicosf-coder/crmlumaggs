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
import { ACTION_TASK_TYPES, PARENT_CATEGORIES, ParentCategoryKey, TaskTypeKey } from "@/lib/taskTypes";
import { cn } from "@/lib/utils";

interface CreateCrmTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDealId?: string;
  defaultContactId?: string;
  defaultCompanyId?: string;
  /** Si se define, la nueva tarea se crea como sub-tarea (paso) de esta tarea padre. */
  parentTaskId?: string | null;
  /** Categoría padre (Seguimiento / Cobranza) cuando se crea como cabecera. */
  defaultParentCategory?: ParentCategoryKey | null;
  /** Tipo de acción concreta sugerido (call, email, etc.). */
  defaultTaskType?: TaskTypeKey | null;
  /** Título sugerido. */
  defaultTitle?: string;
}

export function CreateCrmTaskDialog({
  open, onOpenChange, defaultDealId, defaultContactId, defaultCompanyId,
  parentTaskId = null, defaultParentCategory = null, defaultTaskType = null, defaultTitle = "",
}: CreateCrmTaskDialogProps) {
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

  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dealId, setDealId] = useState(defaultDealId || "");
  const [contactId, setContactId] = useState(defaultContactId || "");
  const [companyId, setCompanyId] = useState(defaultCompanyId || "");
  const [parentCategory, setParentCategory] = useState<ParentCategoryKey | null>(defaultParentCategory);
  const [taskType, setTaskType] = useState<TaskTypeKey | null>(defaultTaskType);

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setParentCategory(defaultParentCategory);
      setTaskType(defaultTaskType);
    }
  }, [open, defaultTitle, defaultParentCategory, defaultTaskType]);

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
        task_type: taskType || null,
        parent_task_id: parentTaskId || null,
        parent_category: parentTaskId ? null : parentCategory, // sub-tareas no llevan categoría
      },
      {
        onSuccess: () => {
          toast({ title: "Tarea creada" });
          onOpenChange(false);
          setTitle(""); setDescription(""); setDueDate(""); setPriority("medium");
          setDealId(defaultDealId || ""); setContactId(defaultContactId || ""); setCompanyId(defaultCompanyId || "");
          setParentCategory(defaultParentCategory); setTaskType(defaultTaskType);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>{parentTaskId ? "Agregar paso a la secuencia" : "Crear Actividad / Tarea"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 pb-6 overflow-y-auto flex-1">
          {!parentTaskId && (
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <div className="grid grid-cols-3 gap-1.5">
                <button type="button" onClick={() => setParentCategory(null)}
                  className={cn("rounded-md border p-2 text-xs font-medium transition-colors",
                    parentCategory === null
                      ? "bg-slate-700 text-white border-slate-700"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100")}>
                  Ninguna
                </button>
                {PARENT_CATEGORIES.map(({ key, label, Icon, soft, active }) => {
                  const sel = parentCategory === key;
                  return (
                    <button key={key} type="button" onClick={() => setParentCategory(key)}
                      className={cn("rounded-md border p-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5",
                        sel ? active : soft)}>
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Tipo de actividad</Label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {ACTION_TASK_TYPES.map(({ key, label, Icon, soft, active }) => {
                const sel = taskType === key;
                return (
                  <button key={key} type="button" onClick={() => setTaskType(sel ? null : key)} title={label}
                    className={cn("flex flex-col items-center justify-center gap-0.5 rounded-md border p-1.5 transition-all",
                      sel ? active : soft)}>
                    <Icon className="h-4 w-4" />
                    <span className="text-[10px] font-medium leading-tight">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
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
