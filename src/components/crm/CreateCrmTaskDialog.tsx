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
import { DictationButton } from "@/components/ui/dictation-button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ACTION_TASK_TYPES, PARENT_CATEGORIES, ParentCategoryKey, TaskTypeKey } from "@/lib/taskTypes";
import { cn } from "@/lib/utils";
import { MessageCircle, Send } from "lucide-react";
import { normalizePhoneForWhatsApp, openWhatsApp, logWhatsAppActivity } from "@/lib/whatsapp";
import { WhatsAppActionDialog } from "@/components/whatsapp/WhatsAppActionDialog";

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
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dealId, setDealId] = useState(defaultDealId || "");
  const [contactId, setContactId] = useState(defaultContactId || "");
  const [companyId, setCompanyId] = useState(defaultCompanyId || "");
  const [parentCategory, setParentCategory] = useState<ParentCategoryKey | null>(defaultParentCategory);
  const [taskType, setTaskType] = useState<TaskTypeKey | null>(defaultTaskType);
  const [whatsappOpen, setWhatsappOpen] = useState(false);

  const isWhatsApp = taskType === "whatsapp";

  // Resolver teléfono y nombres para envío local / API
  const { data: waContext } = useQuery({
    queryKey: ["wa-create-task-ctx", contactId, companyId],
    queryFn: async () => {
      const [c, co] = await Promise.all([
        contactId
          ? supabase.from("contacts").select("first_name,last_name,phone,mobile,whatsapp_phone").eq("id", contactId).maybeSingle()
          : Promise.resolve({ data: null } as any),
        companyId
          ? supabase.from("companies").select("name,phone").eq("id", companyId).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      return { contact: (c as any).data, company: (co as any).data };
    },
    enabled: open && isWhatsApp && (!!contactId || !!companyId),
  });

  const waPhone = waContext?.contact?.whatsapp_phone || waContext?.contact?.mobile || waContext?.contact?.phone || waContext?.company?.phone || null;
  const waNormalized = normalizePhoneForWhatsApp(waPhone);
  const waContactName = waContext?.contact ? `${waContext.contact.first_name || ""} ${waContext.contact.last_name || ""}`.trim() : "";
  const waCompanyName = waContext?.company?.name || "";

  // Re-inicializa el formulario sólo cuando el diálogo PASA a abierto (no en cada render
  // donde cambien props o el padre, para no borrar lo que el usuario está escribiendo).
  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle);
    setParentCategory(defaultParentCategory);
    setTaskType(defaultTaskType);
    setDealId(defaultDealId || "");
    setContactId(defaultContactId || "");
    setCompanyId(defaultCompanyId || "");
    setDueTime("");
    setWhatsappOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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

  const buildWhatsAppTitle = () =>
    `WhatsApp${waContactName ? ` · ${waContactName}` : waCompanyName ? ` · ${waCompanyName}` : ""}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;
    const finalTitle = isWhatsApp ? (title || buildWhatsAppTitle()) : title;
    createTask.mutate(
      {
        user_id: session.user.id,
        title: finalTitle,
        description: description || null,
        due_date: dueDate ? (dueTime ? `${dueDate}T${dueTime}:00` : dueDate) : null,
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
          setTitle(""); setDescription(""); setDueDate(""); setDueTime(""); setPriority("medium");
          setDealId(defaultDealId || ""); setContactId(defaultContactId || ""); setCompanyId(defaultCompanyId || "");
          setParentCategory(defaultParentCategory); setTaskType(defaultTaskType);
        },
      }
    );
  };

  // Enviar por wa.me y registrar la tarea como completada
  const handleSendLocal = async () => {
    if (!session?.user) return;
    if (!waNormalized) {
      toast({ title: "Sin teléfono válido", description: "Captura un teléfono en la ficha del contacto.", variant: "destructive" });
      return;
    }
    if (!description.trim()) {
      toast({ title: "Mensaje vacío", description: "Escribe el mensaje a enviar.", variant: "destructive" });
      return;
    }
    openWhatsApp(waNormalized, description);
    try {
      await logWhatsAppActivity({
        user_id: session.user.id,
        message: description,
        company_id: companyId || null,
        contact_id: contactId || null,
        deal_id: dealId || null,
        result: "enviado",
        title: buildWhatsAppTitle(),
        destinatario_phone: waNormalized,
        message_type: "texto",
        channel: "wa_me",
      });
    } catch (err) {
      console.warn("[wa] log failed", err);
    }
    toast({ title: "WhatsApp abierto", description: "Recuerda enviar el mensaje en la app." });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header con gradiente como el modal de detalle */}
        <div className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4 border-b shrink-0">
          <DialogTitle className="text-lg font-semibold tracking-tight">
            {parentTaskId ? "Agregar paso a la secuencia" : "Crear Actividad / Tarea"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5 font-light">
            Completa los datos para registrar la nueva actividad.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5 overflow-y-auto flex-1">
          {!parentTaskId && (
            <section className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Categoría</div>
              <div className="grid grid-cols-3 gap-2">
                {PARENT_CATEGORIES.map(({ key, label, Icon, soft, active }) => {
                  const sel = parentCategory === key;
                  return (
                    <button key={key} type="button" onClick={() => setParentCategory(key)}
                      className={cn("flex items-center justify-center gap-1.5 rounded-md border p-2 text-sm font-medium transition-all",
                        sel ? active : soft)}>
                      <Icon className="h-4 w-4" /> {label}
                    </button>
                  );
                })}
                <button type="button" onClick={() => setParentCategory(null)}
                  className={cn("rounded-md border p-2 text-sm font-medium transition-all",
                    parentCategory === null
                      ? "bg-slate-700 text-white border-slate-700"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100")}>
                  Otra
                </button>
              </div>
            </section>
          )}
          <section className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Tipo de actividad</div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {ACTION_TASK_TYPES.map(({ key, label, Icon, soft, active }) => {
                const sel = taskType === key;
                return (
                  <button key={key} type="button" onClick={() => setTaskType(sel ? null : key)} title={label}
                    className={cn("flex flex-col items-center justify-center gap-0.5 rounded-md border p-2 transition-all",
                      sel ? active : soft)}>
                    <Icon className="h-4 w-4" />
                    <span className="text-[10px] font-medium leading-tight">{label}</span>
                  </button>
                );
              })}
            </div>
          </section>
          {!isWhatsApp && (
          <section className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Título *</div>
            <div className="flex gap-2">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Dar seguimiento al cliente"
                required={!isWhatsApp}
                maxLength={200}
                className="flex-1 text-base font-light"
              />
              <DictationButton currentText={title} onTranscript={setTitle} />
            </div>
          </section>
          )}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {isWhatsApp ? "Mensaje de WhatsApp" : "Descripción"}
              </div>
              <DictationButton
                currentText={description}
                onTranscript={setDescription}
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                title="Dictar descripción"
              />
            </div>
            {isWhatsApp ? (
              <div className="rounded-lg border bg-[#e7f6d5] dark:bg-emerald-900/20 p-2">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  maxLength={4000}
                  placeholder="Escribe el mensaje que enviarás por WhatsApp..."
                  className="font-light bg-white/70 dark:bg-background/40 border-0 focus-visible:ring-1"
                />
                <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-muted-foreground font-light">
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    Para: {waContactName || waCompanyName || "—"}
                    {waNormalized ? ` · +${waNormalized}` : " · sin teléfono"}
                  </span>
                  <span>{description.length}/4000</span>
                </div>
              </div>
            ) : (
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={2000}
                className="font-light"
              />
            )}
          </section>
          <section className="grid grid-cols-12 gap-3">
            <div className="space-y-2 col-span-8">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Fecha</div>
              <div className="flex gap-2 min-w-0">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "flex-1 min-w-0 justify-start text-left font-light h-9 px-3",
                        !dueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-60" />
                      <span className="truncate">
                        {dueDate
                          ? format(parseISO(dueDate.slice(0, 10)), "EEE d MMM yyyy", { locale: es })
                          : "Selecciona fecha"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate ? parseISO(dueDate.slice(0, 10)) : undefined}
                      onSelect={(d) => setDueDate(d ? format(d, "yyyy-MM-dd") : "")}
                      initialFocus
                      locale={es}
                      className={cn("p-3 pointer-events-auto font-light")}
                    />
                  </PopoverContent>
                </Popover>
                <Input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="w-[88px] shrink-0 h-9 px-2 text-xs font-light"
                />
              </div>
            </div>
            <div className="space-y-2 col-span-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Prioridad</div>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-9 font-light">
                  <SelectValue>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-block h-2.5 w-2.5 rounded-full",
                          priority === "low" && "bg-green-500",
                          priority === "medium" && "bg-yellow-500",
                          priority === "high" && "bg-red-500",
                        )}
                      />
                      <span className="capitalize">
                        {priority === "low" ? "Baja" : priority === "high" ? "Alta" : "Media"}
                      </span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                      Baja
                    </span>
                  </SelectItem>
                  <SelectItem value="medium">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-500" />
                      Media
                    </span>
                  </SelectItem>
                  <SelectItem value="high">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
                      Alta
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>
          <section className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Vincular a Negocio</div>
            <SearchableSelect
              value={dealId || "none"}
              onValueChange={(v) => setDealId(v === "none" ? "" : v)}
              options={[
                { value: "none", label: "Ninguno" },
                ...((deals || []).map((d: any) => ({ value: d.id, label: d.title }))),
              ]}
              placeholder="Buscar negocio..."
            />
          </section>
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2 min-w-0">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Vincular a Empresa</div>
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
            <div className="space-y-2 min-w-0">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Vincular a Contacto</div>
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
          </section>
        </form>
        {/* Footer fijo, similar al detalle */}
        <div className="border-t bg-muted/30 px-5 py-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end shrink-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" disabled={createTask.isPending} onClick={handleSubmit}>
              {createTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear Actividad / Tarea"}
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
