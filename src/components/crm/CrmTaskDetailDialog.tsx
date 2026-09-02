import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { localInputToIso } from "@/lib/formatters";
import { CrmTask, useUpdateCrmTask, useDeleteCrmTask, useTaskTimeline } from "@/hooks/useCrmTasks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase as _supabaseTyped } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _supabaseTyped;
import { fetchAllRows } from "@/lib/supabasePagination";
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
  MessageCircle, Loader2, Check, ChevronLeft, ChevronRight, Plus, Pencil, Mail, GripVertical, ArrowUpRight,
} from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay } from "date-fns";
import { es } from "date-fns/locale";
import { WhatsAppActionDialog } from "@/components/whatsapp/WhatsAppActionDialog";
import { ContactFormDialog, ContactEditData } from "@/components/ContactFormDialog";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  TASK_TYPE_META, TaskTypeKey, ACTION_TASK_TYPES,
  PARENT_CATEGORIES, PARENT_CATEGORY_META, ParentCategoryKey,
} from "@/lib/taskTypes";
import { CreateCrmTaskDialog } from "@/components/crm/CreateCrmTaskDialog";
import { RescheduleActivityDialog, type RescheduleContext } from "@/components/crm/RescheduleActivityDialog";
import { TaskActionFields } from "@/components/crm/TaskActionFields";

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

const TASK_STATUS_META: Record<string, { label: string; cls: string }> = {
  planned: { label: "Programada", cls: "bg-blue-100 text-blue-800 border-blue-300" },
  done: { label: "Realizada", cls: "bg-green-100 text-green-800 border-green-300" },
  no_answered: { label: "No contestó", cls: "bg-gray-100 text-gray-800 border-gray-300" },
  rescheduled: { label: "Reagendada", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  reprogrammed: { label: "Reprogramada", cls: "bg-purple-100 text-purple-800 border-purple-300" },
};

const nextPriority = (p: string) => (p === "high" ? "medium" : p === "medium" ? "low" : "high");

const inputCls = "w-full border border-transparent hover:border-border focus:border-primary focus-visible:ring-0 transition-colors";

export function CrmTaskDetailDialog({ task, open, onOpenChange }: CrmTaskDetailDialogProps) {
  const updateTask = useUpdateCrmTask();
  const deleteTask = useDeleteCrmTask();
  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [contactFormEdit, setContactFormEdit] = useState<ContactEditData | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // local form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [completed, setCompleted] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [programable, setProgramable] = useState(false);
  const [taskType, setTaskType] = useState<TaskTypeKey>("follow_up");
  const [parentCategory, setParentCategory] = useState<ParentCategoryKey | null>(null);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [createSubOpen, setCreateSubOpen] = useState(false);
  const [createNextOpen, setCreateNextOpen] = useState(false);
  const [calMonth, setCalMonth] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [timelineRescheduleOpen, setTimelineRescheduleOpen] = useState(false);
  const [timelineRescheduleCtx, setTimelineRescheduleCtx] = useState<RescheduleContext | null>(null);
  const [deleteSubId, setDeleteSubId] = useState<string | null>(null);
  const [viewSubTask, setViewSubTask] = useState<CrmTask | null>(null);
  const initialized = useRef(false);
  const timelineSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (task && open) {
      setTitle(task.title || "");
      setDescription(task.description || "");
      setDueDate(task.due_date ? task.due_date.slice(0, 10) : "");
      setPriority(task.priority || "medium");
      setCompleted(!!task.completed);
      setCompanyId(task.company_id || null);
      setContactId(task.contact_id || null);
      setUserId(task.user_id || null);
      setProgramable(!!(task as any).programable_entrega);
      setTaskType(((task as any).task_type as TaskTypeKey) || "note");
      setParentCategory(((task as any).parent_category as ParentCategoryKey) || null);
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
      const data = await fetchAllRows<any>((from, to) => supabase.from("companies").select("id, name").eq("is_active", true).order("name").range(from, to));
      return data;
    },
  });
  const { data: contactsAll } = useQuery({
    queryKey: ["contacts-picker-task"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, email2, phone, mobile, whatsapp_phone, tel_emp, job_title, department, company_id, notes, comm_email, comm_email2, comm_whatsapp, comm_cel, comm_tel, comm_tel_emp, sede, plaza_id")
        .eq("is_active", true)
        .order("first_name")
        .limit(5000);
      return data || [];
    },
  });
  const { data: users } = useQuery({
    queryKey: ["profiles-picker-task"],
    queryFn: async () => {
      const data = await fetchAllRows<any>((from, to) => supabase.from("profiles").select("user_id, full_name, email").eq("is_active", true).order("full_name").range(from, to));
      return data;
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
  const handleSelectCompany = (val: string) => {
    const id = val === "none" ? null : val;
    setCompanyId(id);
    const updates: Record<string, any> = { company_id: id };
    if (id) {
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
      }
    }
    triggerSave(updates);
  };

  const handleTitleChange = (v: string) => { setTitle(v); triggerSave({ title: v }); };
  const handleDescChange = (v: string) => { setDescription(v); triggerSave({ description: v || null }); };
  const handleDueDateChange = (v: string) => {
    setDueDate(v);
    triggerSave({ due_date: localInputToIso(v) });
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

  const handleTaskTypeChange = (k: TaskTypeKey) => {
    setTaskType(k);
    triggerSave({ task_type: k });
  };

  const handleParentCategoryChange = (k: ParentCategoryKey | null) => {
    setParentCategory(k);
    triggerSave({ parent_category: k });
  };

  const confirmComplete = (alsoCreate: boolean) => {
    handleCompletedChange(true);
    setCompleteDialogOpen(false);
    if (alsoCreate) setCreateNextOpen(true);
  };

  // Línea de tiempo (sub-tareas) si esta tarea es cabecera
  const isParent = !!parentCategory && !task?.parent_task_id;
  const { data: timeline } = useTaskTimeline(isParent ? task?.id : null);

  const sortedTimeline = useMemo(() => {
    const list = [...(timeline || [])];
    list.sort((a: any, b: any) => {
      const sa = typeof a.sequence_order === "number" ? a.sequence_order : -1;
      const sb = typeof b.sequence_order === "number" ? b.sequence_order : -1;
      if (sa !== sb) return sb - sa; // desc
      const ca = a.created_at ? new Date(a.created_at).getTime() : 0;
      const cb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return cb - ca;
    });
    return list;
  }, [timeline]);

  const handleTimelineDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = sortedTimeline.findIndex((s) => s.id === active.id);
    const newIdx = sortedTimeline.findIndex((s) => s.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(sortedTimeline, oldIdx, newIdx);
    const total = reordered.length;
    // Display is desc; first displayed gets highest sequence_order
    await Promise.all(
      reordered.map((s, i) =>
        supabase.from("crm_tasks").update({ sequence_order: total - 1 - i }).eq("id", s.id)
      )
    );
    queryClient.invalidateQueries({ queryKey: ["crm_task_timeline", task?.id] });
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
    folio_cotizacion: null,
  };

  const pMeta = PRIORITY_META[priority] || PRIORITY_META.medium;

  const companyOptions = [{ value: "none", label: "Sin empresa" }, ...(companies || []).map((c: any) => ({ value: c.id, label: c.name }))];
  const contactOptions = [{ value: "none", label: "Sin contacto" }, ...filteredContacts.map((c: any) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` }))];
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
            <button
              type="button"
              onClick={() => {
                if (completed) handleCompletedChange(false);
                else setCompleteDialogOpen(true);
              }}
              className={cn(
                "mt-1 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors shrink-0",
                completed
                  ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
                  : "bg-background text-foreground border-input hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-700"
              )}
              title={completed ? "Marcar como pendiente" : "Marcar como completada"}
            >
              <Check className="h-3.5 w-3.5" />
              {completed ? "Completada" : "Marcar completada"}
            </button>
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
                {(() => {
                  const tm = TASK_TYPE_META[taskType];
                  const TIcon = tm.Icon;
                  return (
                    <Badge variant="outline" className={cn("text-xs gap-1", tm.soft)}>
                      <TIcon className="h-3 w-3" /> {tm.label}
                    </Badge>
                  );
                })()}
                {parentCategory && (() => {
                  const pc = PARENT_CATEGORY_META[parentCategory];
                  const PIcon = pc.Icon;
                  return (
                    <Badge variant="outline" className={cn("text-xs gap-1", pc.active)}>
                      <PIcon className="h-3 w-3" /> {pc.label}
                    </Badge>
                  );
                })()}
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
            {/* Categoría (padre): Seguimiento / Cobranza */}
            <section>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Categoría</div>
              <div className="grid grid-cols-3 gap-2">
                {PARENT_CATEGORIES.map(({ key, label, Icon, soft, active }) => {
                  const sel = parentCategory === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleParentCategoryChange(key)}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-md border p-2 text-sm font-medium transition-all",
                        sel ? active : soft
                      )}
                      aria-pressed={sel}
                    >
                      <Icon className="h-4 w-4" /> {label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handleParentCategoryChange(null)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md border p-2 text-xs font-medium transition-all",
                    parentCategory === null
                      ? "bg-slate-700 text-white border-slate-700"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  )}
                  aria-pressed={parentCategory === null}
                >
                  Otra
                </button>
              </div>
              {parentCategory && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Esta tarea encabeza una línea de tiempo de {PARENT_CATEGORY_META[parentCategory].label.toLowerCase()}. Agrega pasos abajo.
                </p>
              )}
            </section>

            {/* Línea de tiempo (sólo cabeceras) */}
            {isParent && (
              <section className={cn("rounded-md border p-3", PARENT_CATEGORY_META[parentCategory!].soft)}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold flex items-center gap-1.5">
                    {(() => {
                      const PIcon = PARENT_CATEGORY_META[parentCategory!].Icon;
                      return <PIcon className="h-4 w-4" />;
                    })()}
                    Línea de tiempo · {PARENT_CATEGORY_META[parentCategory!].label}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCreateSubOpen(true)}
                    disabled={completed}
                    title={completed ? "La tarea está completada. Reábrela para agregar pasos." : undefined}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Agregar paso
                  </Button>
                </div>
                {(timeline?.length ?? 0) === 0 ? (
                  <p className="text-xs text-muted-foreground">Aún no hay pasos. Agrega el primero.</p>
                ) : (
                  <DndContext
                    sensors={timelineSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleTimelineDragEnd}
                  >
                    <SortableContext items={sortedTimeline.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                      <ol className="space-y-1.5">
                        {sortedTimeline.map((sub, idx) => (
                          <TimelineSubItem
                            key={sub.id}
                            sub={sub}
                            idx={idx}
                            onEdit={() => setViewSubTask(sub as CrmTask)}
                            onComplete={() => updateTask.mutate({ id: sub.id, completed: true, completed_at: new Date().toISOString(), task_status: "done" } as any)}
                            onDelete={() => setDeleteSubId(sub.id)}
                            onReschedule={() => {
                              const subType = (sub.task_type as TaskTypeKey) || "note";
                              const reasonLabel = subType === "meeting" ? "Reagendada" : subType === "call" ? "No contestó" : "Reprogramada";
                              const newStatus = subType === "meeting" ? "rescheduled" : subType === "call" ? "no_answered" : "reprogrammed";
                              updateTask.mutate({
                                id: sub.id,
                                completed: true,
                                completed_at: new Date().toISOString(),
                                task_status: newStatus,
                                title: `[${reasonLabel}] ${(sub.title || "").replace(/^\[[^\]]+\]\s*/, "")}`,
                              } as any);
                              setTimelineRescheduleCtx({
                                origenTareaId: sub.id,
                                taskType: subType,
                                parentCategory,
                                parentTaskId: task!.id,
                                contactId: (sub as any).contact_id || contactId || "",
                                companyId: (sub as any).company_id || companyId || "",
                                baseTitle: (sub.title || "").replace(/^\[[^\]]+\]\s*/, ""),
                                description: (sub as any).description || null,
                                priority: (sub as any).priority || "medium",
                                reasonLabel,
                              });
                              setTimelineRescheduleOpen(true);
                            }}
                          />
                        ))}
                      </ol>
                    </SortableContext>
                  </DndContext>
                )}
              </section>
            )}

            {/* Tipo de actividad */}
            <section>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Tipo de actividad</div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {ACTION_TASK_TYPES.map(({ key, label, Icon, soft, active }) => {
                  const sel = taskType === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleTaskTypeChange(key)}
                      title={label}
                      className={cn(
                        "flex flex-col items-center justify-center gap-0.5 rounded-md border p-1.5 transition-all",
                        sel ? active : soft
                      )}
                      aria-pressed={sel}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-[10px] font-medium leading-tight">{label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Breadcrumb si es sub-tarea */}
            {task?.parent_task_id && (
              <section className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground flex items-center justify-between gap-2 flex-wrap">
                <span>Esta tarea forma parte de una secuencia.</span>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={async () => {
                    const { data, error } = await supabase
                      .from("crm_tasks")
                      .select("*, contacts(id, first_name, last_name), companies(id, name)")
                      .eq("id", task.parent_task_id!)
                      .maybeSingle();
                    if (error || !data) { toast({ title: "No se pudo cargar la tarea principal", variant: "destructive" }); return; }
                    setViewSubTask(data as unknown as CrmTask);
                  }}
                >
                  <ArrowUpRight className="h-3.5 w-3.5 mr-1" /> Ir a la tarea principal
                </Button>
              </section>
            )}

            {/* Description (oculta para email y whatsapp, que tienen su propio cuerpo) */}
            {taskType !== "email" && taskType !== "whatsapp" && (
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
            )}

            {/* Bloques específicos por tipo de actividad (email/whatsapp/llamada/visita) */}
            <TaskActionFields
              taskType={taskType}
              taskId={task?.id}
              contactId={contactId}
              companyId={companyId}
              description={description}
              setDescription={handleDescChange}
              onSent={() => {
                if (!completed) handleCompletedChange(true);
              }}
              contactOptions={contactOptions}
              onContactChange={(v) => handleSelectContact(v || "none")}
              onOpenNewContact={() => { setContactFormEdit(null); setContactFormOpen(true); }}
            />

            <Separator />

            {/* Vínculos */}
            <section>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2 min-w-0">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Vincular a Empresa</div>
                  <SearchableSelect
                    value={companyId || "none"}
                    onValueChange={handleSelectCompany}
                    options={companyOptions}
                    placeholder="Buscar empresa..."
                    className="font-light text-sm"
                  />
                </div>
                <div className="space-y-2 min-w-0">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Vincular a Contacto</div>
                  <div className="flex items-center gap-1">
                    <div className="flex-1 min-w-0">
                      <SearchableSelect
                        value={contactId || "none"}
                        onValueChange={handleSelectContact}
                        options={contactOptions}
                        placeholder="Buscar contacto..."
                        className="font-light text-sm"
                      />
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 shrink-0"
                      title="Nuevo contacto"
                      onClick={() => { setContactFormEdit(null); setContactFormOpen(true); }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 shrink-0"
                      title="Editar contacto"
                      disabled={!contactId}
                      onClick={() => {
                        const c: any = contactsAll?.find((x: any) => x.id === contactId);
                        if (!c) return;
                        setContactFormEdit({
                          id: c.id,
                          first_name: c.first_name || "",
                          last_name: c.last_name || "",
                          email: c.email ?? null,
                          email2: c.email2 ?? null,
                          phone: c.phone ?? null,
                          mobile: c.mobile ?? null,
                          whatsapp_phone: c.whatsapp_phone ?? null,
                          tel_emp: c.tel_emp ?? null,
                          job_title: c.job_title ?? null,
                          department: c.department ?? null,
                          company_id: c.company_id ?? null,
                          notes: c.notes ?? null,
                          comm_email: c.comm_email ?? null,
                          comm_email2: c.comm_email2 ?? null,
                          comm_whatsapp: c.comm_whatsapp ?? null,
                          comm_cel: c.comm_cel ?? null,
                          comm_tel: c.comm_tel ?? null,
                          comm_tel_emp: c.comm_tel_emp ?? null,
                          sede: c.sede ?? null,
                          plaza_id: c.plaza_id ?? null,
                        });
                        setContactFormOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                  {contactId && (() => {
                    const c: any = contactsAll?.find((x: any) => x.id === contactId);
                    if (!c) return null;
                    const wa = c.whatsapp_phone || c.mobile || c.phone;
                    const em = c.email || c.email2;
                    if (!wa && !em) return null;
                    return (
                      <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground pl-1">
                        {wa && (
                          <div className="flex items-center gap-1.5">
                            <MessageCircle className="h-3 w-3 text-green-600" />
                            <span>{wa}</span>
                          </div>
                        )}
                        {em && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3 w-3 text-blue-600" />
                            <span className="truncate">{em}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </section>

            <Separator />

            {/* Asignación */}
            <section>
              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
                <User className="h-4 w-4" /> Asignación
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Asignado a</label>
                <SearchableSelect
                  value={userId || "none"}
                  onValueChange={handleUserChange}
                  options={userOptions}
                  placeholder="Sin asignar"
                />
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
                <label className="text-xs text-muted-foreground mb-1 block font-medium">Fecha vencimiento</label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => handleDueDateChange(e.target.value)}
                  onFocus={() => setCalendarOpen(true)}
                  onClick={() => setCalendarOpen(true)}
                  className={cn(inputCls, "bg-background")}
                />
              </div>
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
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                if (!task) return;
                if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
                setSaveStatus("saving");
                updateTask.mutate(
                  {
                    id: task.id,
                    title,
                    description: description || null,
                    due_date: localInputToIso(dueDate),
                    priority,
                    completed,
                    completed_at: completed ? (task.completed_at || new Date().toISOString()) : null,
                    company_id: companyId,
                    contact_id: contactId,
                    user_id: userId,
                    programable_entrega: programable,
                    task_type: taskType,
                    parent_category: parentCategory,
                  } as any,
                  {
                    onSuccess: () => {
                      setSaveStatus("saved");
                      toast({ title: "Cambios guardados" });
                      setTimeout(() => setSaveStatus("idle"), 1500);
                    },
                    onError: (e: any) => {
                      setSaveStatus("idle");
                      toast({ title: "Error al guardar", description: e?.message, variant: "destructive" });
                    },
                  }
                );
              }}
              disabled={saveStatus === "saving"}
            >
              {saveStatus === "saving" ? (<><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Guardando...</>) : (<><Check className="h-4 w-4 mr-1.5" /> Guardar cambios</>)}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cerrar</Button>
          </div>
        </div>

        <WhatsAppActionDialog
          open={whatsappOpen}
          onOpenChange={setWhatsappOpen}
          phone={phone}
          variables={variables}
          defaultMessage={task.mensaje_sugerido || undefined}
          context={{ company_id: companyId, contact_id: contactId }}
          onSent={() => updateTask.mutate({ id: task.id, whatsapp_status: "enviado", whatsapp_last_sent_at: new Date().toISOString() })}
        />

        <ContactFormDialog
          open={contactFormOpen}
          onOpenChange={setContactFormOpen}
          defaultCompanyId={companyId || undefined}
          editData={contactFormEdit}
          onCreated={async (newId) => {
            await queryClient.invalidateQueries({ queryKey: ["contacts-picker-task"] });
            if (!contactFormEdit) {
              setContactId(newId);
              triggerSave({ contact_id: newId });
            }
          }}
        />

        {/* Confirmar completado */}
        <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Completar tarea?</AlertDialogTitle>
              <AlertDialogDescription>
                Marca "{title}" como completada. ¿Quieres además crear una nueva tarea relacionada?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-2">
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button variant="outline" onClick={() => confirmComplete(false)}>Completar</Button>
              <AlertDialogAction onClick={() => confirmComplete(true)}>Completar y crear nueva</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Crear sub-tarea (paso de la secuencia) */}
        {isParent && (
          <CreateCrmTaskDialog
            open={createSubOpen}
            onOpenChange={setCreateSubOpen}
            defaultCompanyId={companyId || undefined}
            defaultContactId={contactId || undefined}
            parentTaskId={task.id}
            defaultTaskType="call"
          />
        )}

        {/* Crear "nueva" después de completar */}
        <CreateCrmTaskDialog
          open={createNextOpen}
          onOpenChange={setCreateNextOpen}
          defaultCompanyId={companyId || undefined}
          defaultContactId={contactId || undefined}
          parentTaskId={task.parent_task_id || null}
          defaultParentCategory={!task.parent_task_id ? parentCategory : null}
          defaultTaskType={taskType}
        />

        {/* Reprogramar paso de la línea de tiempo */}
        <RescheduleActivityDialog
          open={timelineRescheduleOpen}
          onOpenChange={setTimelineRescheduleOpen}
          context={timelineRescheduleCtx}
        />

        {/* Ver/Editar paso de la línea de tiempo */}
        <CreateCrmTaskDialog
          open={!!viewSubTask}
          onOpenChange={(o) => !o && setViewSubTask(null)}
          editTask={viewSubTask}
        />

        {/* Confirmar eliminación de paso */}
        <AlertDialog open={!!deleteSubId} onOpenChange={(o) => !o && setDeleteSubId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar este paso?</AlertDialogTitle>
              <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteSubId) deleteTask.mutate(deleteSubId);
                  setDeleteSubId(null);
                }}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

function TimelineSubItem({
  sub, idx, onEdit, onComplete, onDelete, onReschedule,
}: {
  sub: any;
  idx: number;
  onEdit: () => void;
  onComplete: () => void;
  onDelete: () => void;
  onReschedule: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sub.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  const subType = (sub.task_type as TaskTypeKey) || "note";
  const stm = TASK_TYPE_META[subType];
  const SIcon = stm.Icon;
  const status = sub.task_status || (sub.completed ? "done" : "planned");
  const sm = TASK_STATUS_META[status] || TASK_STATUS_META.planned;
  const isDone = status === "done";
  const reasonLabel = subType === "meeting" ? "Reagendada" : subType === "call" ? "No contestó" : "Reprogramada";
  const description = (sub.description || "").trim();
  const message = (sub.mensaje_sugerido || "").trim();
  return (
    <li ref={setNodeRef} style={style} className="flex items-start gap-2 rounded bg-background border px-2 py-1.5 text-xs">
      <button type="button" {...attributes} {...listeners} className="cursor-grab touch-none text-muted-foreground hover:text-foreground mt-0.5 shrink-0" title="Arrastrar para reordenar">
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="text-[10px] text-muted-foreground w-4 mt-0.5 shrink-0">{idx + 1}.</span>
      <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted", stm.iconColor)} title={stm.label}>
        <SIcon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("flex-1 truncate", isDone && "line-through text-muted-foreground")}>{(sub.title || "").replace(/^\[[^\]]+\]\s*/, "")}</span>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", sm.cls)}>{sm.label}</Badge>
          {sub.due_date && (
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {format(parseISO(sub.due_date), sub.due_date.length >= 16 ? "d MMM HH:mm" : "d MMM", { locale: es })}
            </span>
          )}
        </div>
        {description && (
          <div className="mt-0.5 text-[11px] text-muted-foreground font-light line-clamp-2 whitespace-pre-wrap break-words">{description}</div>
        )}
        {message && (
          <div className="mt-0.5 text-[11px] text-foreground/80 font-light italic line-clamp-2 whitespace-pre-wrap break-words">{message}</div>
        )}
      </div>
      <div className="flex items-center shrink-0">
        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" title="Ver / Editar" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        {!isDone && (
          <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" title="Marcar terminada" onClick={onComplete}>
            <Check className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" title={`Reprogramar (${reasonLabel})`} onClick={onReschedule}>
          <CalendarIcon className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] text-red-600 hover:text-red-700" title="Eliminar" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}
