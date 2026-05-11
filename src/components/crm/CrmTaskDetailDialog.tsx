import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { CrmTask, useUpdateCrmTask, useDeleteCrmTask } from "@/hooks/useCrmTasks";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Trash2, Calendar as CalendarIcon, User, FileText, Link2,
  MessageCircle, Loader2, Check, ChevronLeft, ChevronRight,
} from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay } from "date-fns";
import { es } from "date-fns/locale";
import { WhatsAppActionDialog } from "@/components/whatsapp/WhatsAppActionDialog";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface CrmTaskDetailDialogProps {
  task: CrmTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRIORITY_META: Record<string, { label: string; cls: string; dot: string }> = {
  high: { label: "Alta", cls: "bg-red-100 text-red-700 border-red-300 hover:bg-red-200", dot: "bg-red-500" },
  medium: { label: "Media", cls: "bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200", dot: "bg-yellow-500" },
  low: { label: "Baja", cls: "bg-green-100 text-green-700 border-green-300 hover:bg-green-200", dot: "bg-green-500" },
};

const nextPriority = (p: string) => (p === "high" ? "medium" : p === "medium" ? "low" : "high");

const inputCls = "w-full border border-transparent hover:border-border focus:border-primary focus-visible:ring-0 transition-colors";

export function CrmTaskDetailDialog({ task, open, onOpenChange }: CrmTaskDetailDialogProps) {
  const updateTask = useUpdateCrmTask();
  const deleteTask = useDeleteCrmTask();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // local form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [completed, setCompleted] = useState(false);
  const [dealId, setDealId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [programable, setProgramable] = useState(false);
  const [calMonth, setCalMonth] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (task && open) {
      setTitle(task.title || "");
      setDescription(task.description || "");
      setDueDate(task.due_date ? task.due_date.slice(0, 10) : "");
      setPriority(task.priority || "medium");
      setCompleted(!!task.completed);
      setDealId(task.deal_id || null);
      setCompanyId(task.company_id || null);
      setContactId(task.contact_id || null);
      setUserId(task.user_id || null);
      setProgramable(!!(task as any).programable_entrega);
      setCalMonth(task.due_date ? parseISO(task.due_date) : new Date());
      setCalendarOpen(false);
      initialized.current = true;
      setSaveStatus("idle");
    }
    if (!open) {
      initialized.current = false;
      setCalendarOpen(false);
    }
  }, [task, open]);

  // pickers
  const { data: companies } = useQuery({
    queryKey: ["companies-picker-task"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, name").eq("is_active", true).order("name");
      return data || [];
    },
  });
  const { data: contactsAll } = useQuery({
    queryKey: ["contacts-picker-task"],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, first_name, last_name, company_id").eq("is_active", true).order("first_name");
      return data || [];
    },
  });
  const { data: deals } = useQuery({
    queryKey: ["crm-deals-picker-task"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_deals").select("id, title, company_id, contact_id, created_at").order("created_at", { ascending: false });
      return data || [];
    },
  });
  const { data: users } = useQuery({
    queryKey: ["profiles-picker-task"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, email").eq("is_active", true).order("full_name");
      return data || [];
    },
  });

  const filteredContacts = useMemo(() => {
    if (!contactsAll) return [];
    return companyId ? contactsAll.filter((c: any) => c.company_id === companyId) : contactsAll;
  }, [contactsAll, companyId]);

  // Auto-save with debounce
  const triggerSave = useCallback((updates: Record<string, any>) => {
    if (!task) return;
    setSaveStatus("saving");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateTask.mutate(
        { id: task.id, ...updates },
        {
          onSuccess: () => {
            setSaveStatus("saved");
            setTimeout(() => setSaveStatus("idle"), 1500);
          },
          onError: (e: any) => {
            setSaveStatus("idle");
            toast({ title: "Error al guardar", description: e?.message, variant: "destructive" });
          },
        }
      );
    }, 800);
  }, [task, updateTask, toast]);

  // Cascade selection handlers
  const handleSelectDeal = (val: string) => {
    const id = val === "none" ? null : val;
    setDealId(id);
    const updates: Record<string, any> = { deal_id: id };
    if (id) {
      const d = deals?.find((x: any) => x.id === id);
      if (d?.company_id) {
        setCompanyId(d.company_id);
        updates.company_id = d.company_id;
      }
      if (d?.contact_id) {
        setContactId(d.contact_id);
        updates.contact_id = d.contact_id;
      }
    }
    triggerSave(updates);
  };

  const handleSelectCompany = (val: string) => {
    const id = val === "none" ? null : val;
    setCompanyId(id);
    const updates: Record<string, any> = { company_id: id };
    if (id) {
      const lastDeal = deals?.find((x: any) => x.company_id === id);
      if (lastDeal) {
        setDealId(lastDeal.id);
        updates.deal_id = lastDeal.id;
        if (lastDeal.contact_id) {
          setContactId(lastDeal.contact_id);
          updates.contact_id = lastDeal.contact_id;
        }
      }
      // If current contact doesn't belong to this company, clear it
      const currentContact = contactsAll?.find((c: any) => c.id === contactId);
      if (currentContact && currentContact.company_id !== id) {
        setContactId(null);
        updates.contact_id = null;
      }
    }
    triggerSave(updates);
  };

  const handleSelectContact = (val: string) => {
    const id = val === "none" ? null : val;
    setContactId(id);
    const updates: Record<string, any> = { contact_id: id };
    if (id) {
      const c = contactsAll?.find((x: any) => x.id === id);
      if (c?.company_id && !companyId) {
        setCompanyId(c.company_id);
        updates.company_id = c.company_id;
        const lastDeal = deals?.find((x: any) => x.company_id === c.company_id);
        if (lastDeal) {
          setDealId(lastDeal.id);
          updates.deal_id = lastDeal.id;
        }
      }
    }
    triggerSave(updates);
  };

  const handleTitleChange = (v: string) => { setTitle(v); triggerSave({ title: v }); };
  const handleDescChange = (v: string) => { setDescription(v); triggerSave({ description: v || null }); };
  const handleDueDateChange = (v: string) => {
    setDueDate(v);
    triggerSave({ due_date: v ? v : null });
    if (v) setCalMonth(parseISO(v));
    setCalendarOpen(false);
  };
  const handlePriorityClick = () => {
    const np = nextPriority(priority);
    setPriority(np);
    triggerSave({ priority: np });
  };
  const handleCompletedChange = (v: boolean) => {
    setCompleted(v);
    triggerSave({ completed: v, completed_at: v ? new Date().toISOString() : null });
  };
  const handleUserChange = (v: string) => {
    const id = v === "none" ? null : v;
    setUserId(id);
    triggerSave({ user_id: id });
  };
  const handleProgramableChange = (v: boolean) => {
    setProgramable(v);
    triggerSave({ programable_entrega: v });
  };

  const handleDelete = () => {
    if (!task) return;
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        toast({ title: "Tarea eliminada" });
        onOpenChange(false);
      },
    });
  };

  // Mini calendar
  const monthDays = useMemo(() => {
    const start = startOfMonth(calMonth);
    const end = endOfMonth(calMonth);
    const days = eachDayOfInterval({ start, end });
    const startWeekday = getDay(start); // 0 Sunday
    return { days, startWeekday };
  }, [calMonth]);

  const dueDateObj = dueDate ? parseISO(dueDate) : null;

  // Enriched for WhatsApp
  const { data: enriched } = useQuery({
    queryKey: ["task-enriched", task?.id, contactId, companyId],
    queryFn: async () => {
      const [c, co] = await Promise.all([
        contactId ? supabase.from("contacts").select("first_name,last_name,phone,mobile,whatsapp_phone,company_id").eq("id", contactId).maybeSingle() : Promise.resolve({ data: null } as any),
        companyId ? supabase.from("companies").select("name,phone").eq("id", companyId).maybeSingle() : Promise.resolve({ data: null } as any),
      ]);
      return { contact: c.data, company: co.data };
    },
    enabled: !!task && open,
  });

  if (!task) return null;

  const phone = enriched?.contact?.whatsapp_phone || enriched?.contact?.mobile || enriched?.contact?.phone || enriched?.company?.phone || null;
  const variables = {
    contacto_nombre: enriched?.contact ? `${enriched.contact.first_name} ${enriched.contact.last_name}`.trim() : null,
    empresa_nombre: enriched?.company?.name || null,
    ejecutivo_nombre: profile?.full_name || null,
    folio_cotizacion: deals?.find((d: any) => d.id === dealId)?.title || null,
  };

  const pMeta = PRIORITY_META[priority] || PRIORITY_META.medium;

  const companyOptions = [{ value: "none", label: "Sin empresa" }, ...(companies || []).map((c: any) => ({ value: c.id, label: c.name }))];
  const contactOptions = [{ value: "none", label: "Sin contacto" }, ...filteredContacts.map((c: any) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` }))];
  const dealOptions = [{ value: "none", label: "Sin negocio" }, ...(deals || []).map((d: any) => ({ value: d.id, label: d.title }))];
  const userOptions = [{ value: "none", label: "Sin asignar" }, ...(users || []).map((u: any) => ({ value: u.user_id, label: u.full_name || u.email }))];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl p-0 h-[85vh] flex flex-col overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4 border-b">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={completed}
              onCheckedChange={(v) => handleCompletedChange(!!v)}
              className="h-5 w-5 mt-1.5"
            />
            <div className="flex-1 min-w-0">
              <DialogTitle asChild>
                <input
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className={cn(
                    "w-full bg-transparent border-0 outline-none text-xl font-semibold",
                    "placeholder:text-muted-foreground focus:ring-0",
                    completed && "line-through text-muted-foreground"
                  )}
                  placeholder="Título de la tarea"
                />
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={cn("cursor-pointer text-xs font-medium", pMeta.cls)}
                  onClick={handlePriorityClick}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full mr-1.5", pMeta.dot)} />
                  Prioridad {pMeta.label}
                </Badge>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">Tarea</Badge>
                <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                  {saveStatus === "saving" && (<><Loader2 className="h-3 w-3 animate-spin" /> Guardando...</>)}
                  {saveStatus === "saved" && (<><Check className="h-3 w-3 text-green-600" /> Guardado</>)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-0 overflow-hidden">
          {/* Left column */}
          <div className="md:col-span-2 overflow-y-auto p-5 space-y-5 border-r">
            {/* Description */}
            <section>
              <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
                <FileText className="h-4 w-4" /> Descripción
              </div>
              <Textarea
                value={description}
                onChange={(e) => handleDescChange(e.target.value)}
                placeholder="Agrega una descripción..."
                rows={3}
                className={cn(inputCls, "resize-y min-h-[80px]")}
              />
            </section>

            <Separator />

            {/* Vínculos */}
            <section className="border-l-4 border-blue-400 pl-4">
              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
                <Link2 className="h-4 w-4" /> Vínculos
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Negocio</label>
                  <SearchableSelect
                    value={dealId || "none"}
                    onValueChange={handleSelectDeal}
                    options={dealOptions}
                    placeholder="Seleccionar negocio..."
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Empresa</label>
                  <SearchableSelect
                    value={companyId || "none"}
                    onValueChange={handleSelectCompany}
                    options={companyOptions}
                    placeholder="Seleccionar empresa..."
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Contacto</label>
                  <SearchableSelect
                    value={contactId || "none"}
                    onValueChange={handleSelectContact}
                    options={contactOptions}
                    placeholder="Seleccionar contacto..."
                  />
                </div>
              </div>
            </section>

            <Separator />

            {/* Asignación */}
            <section>
              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
                <User className="h-4 w-4" /> Asignación
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Asignado a</label>
                  <SearchableSelect
                    value={userId || "none"}
                    onValueChange={handleUserChange}
                    options={userOptions}
                    placeholder="Sin asignar"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Fecha vencimiento</label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => handleDueDateChange(e.target.value)}
                    onFocus={() => setCalendarOpen(true)}
                    onClick={() => setCalendarOpen(true)}
                    className={inputCls}
                  />
                </div>
              </div>
              {phone && (
                <div className="mt-3">
                  <Button size="sm" variant="outline" onClick={() => setWhatsappOpen(true)}>
                    <MessageCircle className="h-4 w-4 mr-1.5" /> Enviar WhatsApp
                  </Button>
                </div>
              )}
            </section>
          </div>

          {/* Right column */}
          <div className="md:col-span-1 overflow-y-auto p-5 space-y-5 bg-muted/30">
            {calendarOpen && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CalendarIcon className="h-4 w-4" />
                  {format(calMonth, "MMMM yyyy", { locale: es })}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setCalMonth(subMonths(calMonth, 1))}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setCalMonth(addMonths(calMonth, 1))}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground mb-1">
                {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => <div key={i}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: monthDays.startWeekday }).map((_, i) => <div key={`pad-${i}`} />)}
                {monthDays.days.map((day) => {
                  const isDue = dueDateObj && isSameDay(day, dueDateObj);
                  const isToday = isSameDay(day, new Date());
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => handleDueDateChange(format(day, "yyyy-MM-dd"))}
                      className={cn(
                        "aspect-square rounded-full text-xs flex items-center justify-center transition-colors",
                        "hover:bg-accent",
                        isToday && !isDue && "border border-primary/40",
                        isDue && cn("text-white font-semibold", pMeta.dot)
                      )}
                    >
                      {format(day, "d")}
                    </button>
                  );
                })}
              </div>
            </section>
            )}

            <Separator />

            <section className="space-y-2 text-xs text-muted-foreground">
              <div>
                <span className="font-medium">Creada:</span>{" "}
                {format(parseISO(task.created_at), "d MMM yyyy, h:mm a", { locale: es })}
              </div>
              {completed && (task as any).completed_at && (
                <div>
                  <span className="font-medium">Completada:</span>{" "}
                  {format(parseISO((task as any).completed_at), "d MMM yyyy, h:mm a", { locale: es })}
                </div>
              )}
              <div className="flex items-center justify-between pt-2">
                <span className="text-foreground">Programable entrega</span>
                <Switch checked={programable} onCheckedChange={handleProgramableChange} />
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-3 flex items-center justify-between bg-background shrink-0">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4 mr-1.5" /> Eliminar tarea
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
                <AlertDialogDescription>Se eliminará permanentemente "{title}".</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </div>

        <WhatsAppActionDialog
          open={whatsappOpen}
          onOpenChange={setWhatsappOpen}
          phone={phone}
          variables={variables}
          defaultMessage={task.mensaje_sugerido || undefined}
          context={{ company_id: companyId, contact_id: contactId, deal_id: dealId }}
          onSent={() => updateTask.mutate({ id: task.id, whatsapp_status: "enviado", whatsapp_last_sent_at: new Date().toISOString() })}
        />
      </DialogContent>
    </Dialog>
  );
}
