import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useCrmItems,
  useCrmItemsCount,
  useFinalizeCrmItem,
  useReopenCrmItem,
  useDeleteCrmItem,
  CRM_ITEM_TYPE_CONFIG,
  type CrmItemTab,
  type CrmItemUnified,
} from "@/hooks/useCrmItems";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageBanner } from "@/components/PageBanner";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  ChevronLeft, ChevronRight, Search, CheckCircle2, RotateCcw, Trash2,
  Plus, Filter, AlertCircle, Calendar, User, Building2, Pencil, CalendarClock,
  SlidersHorizontal, ChevronDown, ChevronUp, ListChecks,
} from "lucide-react";
import {
  format, parseISO, isValid, addHours, startOfHour, startOfDay, endOfDay,
  addDays, addMonths, isSameDay, differenceInDays,
} from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CreateCrmActivityTaskDialog } from "@/components/crm/CreateCrmActivityTaskDialog";
import { CrmTaskDetailDialog } from "@/components/crm/CrmTaskDetailDialog";
import { CrmActivityDetailDialog } from "@/components/crm/CrmActivityDetailDialog";
import { Checkbox } from "@/components/ui/checkbox";

const PAGE_SIZE_OPTIONS = [10, 25, 50, "all"] as const;

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "bg-amber-100 text-amber-800 border-amber-200" },
  en_progreso: { label: "En progreso", className: "bg-blue-100 text-blue-800 border-blue-200" },
  completada: { label: "Completada", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  cancelada: { label: "Cancelada", className: "bg-gray-100 text-gray-700 border-gray-200" },
  vencida: { label: "Vencida", className: "bg-red-100 text-red-800 border-red-200" },
};

type TaskTypeKey = "call" | "email" | "meeting" | "field_visit" | "whatsapp" | "cobranza" | "follow_up" | "note";

const TASK_TYPE_META: Record<TaskTypeKey, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  call:        { label: "Llamada",     Icon: Phone },
  email:       { label: "Email",       Icon: Mail },
  meeting:     { label: "Reunión",     Icon: CalendarCheck },
  field_visit: { label: "Visita",      Icon: Car },
  whatsapp:    { label: "WhatsApp",    Icon: MessageCircle },
  cobranza:    { label: "Cobranza",    Icon: Banknote },
  follow_up:   { label: "Seguimiento", Icon: RefreshCw },
  note:        { label: "Nota",        Icon: FileText },
};

const TASK_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  planned:     { label: "Planificada",  className: "bg-gray-100 text-gray-700 border-gray-200" },
  in_progress: { label: "En progreso",  className: "bg-blue-100 text-blue-800 border-blue-200" },
  done:        { label: "Realizada",    className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  cancelled:   { label: "Cancelada",    className: "bg-red-100 text-red-800 border-red-200" },
  rescheduled: { label: "Reprogramada", className: "bg-amber-100 text-amber-800 border-amber-200" },
};

const PRIORITY_LABEL: Record<string, string> = { high: "Alta", medium: "Media", low: "Baja" };

function fmtDate(s: string | null) {
  if (!s) return "—";
  const d = parseISO(s);
  if (!isValid(d)) return "—";
  return format(d, "d MMM yyyy HH:mm", { locale: es });
}

function fmtTime(s: string | null) {
  if (!s) return "—";
  const d = parseISO(s);
  if (!isValid(d)) return "—";
  return format(d, "h:mm a", { locale: es });
}

/** Sugerir el siguiente task_type al completar */
function suggestNextType(prev: string | null | undefined): TaskTypeKey {
  switch (prev) {
    case "call": return "call";
    case "cobranza": return "cobranza";
    case "meeting": return "follow_up";
    case "field_visit": return "follow_up";
    case "whatsapp": return "follow_up";
    case "email": return "follow_up";
    default: return "follow_up";
  }
}

export default function CrmItemsPage() {
  const [params, setParams] = useSearchParams();
  const { session, hasAnyRole } = useAuth();
  const myUserId = session?.user?.id ?? "";
  const canSeeAssignedFilter = hasAnyRole(["admin", "manager"]);

  // ── Vista superior: Lista | Hoy | Esta semana ──
  const [viewTab, setViewTab] = useState<"lista" | "hoy" | "semana" | "cobranza">("lista");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filtros cliente adicionales (Tab Lista)
  const [clientTypes, setClientTypes] = useState<TaskTypeKey[]>([]); // multi
  const [clientStatus, setClientStatus] = useState<string>("all"); // all|planned|in_progress|done|cancelled|rescheduled
  const [clientPriority, setClientPriority] = useState<string>("all"); // all|high|medium|low
  const [clientAssignedTo, setClientAssignedTo] = useState<string>("all");

  const tab = (params.get("tab") as CrmItemTab) || "pendientes";
  const kindParam = (params.get("kind") as "todos" | "tarea" | "actividad") || "todos";
  const typeParam = params.get("type") || "";
  const marcaParam = params.get("marca") || "";
  const userParam = params.get("user") || "";
  const search = params.get("q") || "";
  const page = Math.max(1, Number(params.get("page") || "1"));
  const pageSizeRaw = params.get("size") || "10";
  const pageSize: number | "all" = pageSizeRaw === "all" ? "all" : Number(pageSizeRaw) || 10;

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.set("page", "1");
    setParams(next, { replace: true });
  };

  // Data
  const { data, isLoading } = useCrmItems({
    tab,
    kind: kindParam,
    type: typeParam || undefined,
    marca: marcaParam || undefined,
    userId: userParam || undefined,
    search: search || undefined,
    page,
    pageSize,
  });
  const rows = data?.rows ?? [];

  // Tab counts
  const counts = {
    hoy: useCrmItemsCount("hoy").data ?? 0,
    pendientes: useCrmItemsCount("pendientes").data ?? 0,
    vencidas: useCrmItemsCount("vencidas").data ?? 0,
    completadas: useCrmItemsCount("completadas").data ?? 0,
    creadas: useCrmItemsCount("creadas").data ?? 0,
    todas: useCrmItemsCount("todas").data ?? 0,
  };

  // Lookup users for filter & display
  const { data: users = [] } = useQuery({
    queryKey: ["profiles_for_items"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, email").eq("is_active", true);
      return data || [];
    },
  });
  const userMap = useMemo(() => {
    const m = new Map<string, string>();
    users.forEach((u: any) => m.set(u.user_id, u.full_name || u.email));
    return m;
  }, [users]);

  // Lookup companies/contacts/deals on the fly for the visible page only
  const companyIds = Array.from(new Set(rows.map(r => r.company_id).filter(Boolean) as string[]));
  const contactIds = Array.from(new Set(rows.map(r => r.contact_id).filter(Boolean) as string[]));
  const dealIds = Array.from(new Set(rows.map(r => r.deal_id).filter(Boolean) as string[]));

  const { data: companies = [] } = useQuery({
    queryKey: ["items_companies", companyIds],
    enabled: companyIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, name").in("id", companyIds);
      return data || [];
    },
  });
  const { data: contacts = [] } = useQuery({
    queryKey: ["items_contacts", contactIds],
    enabled: contactIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, first_name, last_name").in("id", contactIds);
      return data || [];
    },
  });
  const { data: deals = [] } = useQuery({
    queryKey: ["items_deals", dealIds],
    enabled: dealIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("crm_deals").select("id, title").in("id", dealIds);
      return data || [];
    },
  });

  const companyMap = new Map(companies.map((c: any) => [c.id, c.name]));
  const contactMap = new Map(contacts.map((c: any) => [c.id, `${c.first_name} ${c.last_name}`.trim()]));
  const dealMap = new Map(deals.map((d: any) => [d.id, d.title]));

  // Pagination
  const total = counts[tab] || 0;
  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(total / (pageSize as number)));

  // Mutations
  const finalize = useFinalizeCrmItem();
  const reopen = useReopenCrmItem();
  const del = useDeleteCrmItem();

  const [finalizeTarget, setFinalizeTarget] = useState<CrmItemUnified | null>(null);
  const [resultadoText, setResultadoText] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<{
    defaultCompanyId?: string;
    defaultTaskType?: TaskTypeKey;
    defaultDescription?: string;
    defaultDate?: string;
    origenTareaId?: string;
  }>({});
  const [editTask, setEditTask] = useState<any | null>(null);
  const [editActivity, setEditActivity] = useState<any | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<CrmItemUnified | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [rescheduleSaving, setRescheduleSaving] = useState(false);

  // ── Modal "¿Qué sigue?" tras finalizar ──
  const [nextStepTarget, setNextStepTarget] = useState<{ task: any | null } | null>(null);

  // Fetch reschedule_count for visible task rows (badge "Reprog. Nx")
  const taskIds = rows.filter(r => r.source_table === "crm_tasks").map(r => r.id);
  const { data: tasksMeta = [] } = useQuery({
    queryKey: ["items_tasks_meta", taskIds],
    enabled: taskIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_tasks")
        .select("id, reschedule_count")
        .in("id", taskIds);
      return data || [];
    },
  });
  const rescheduleMap = new Map<string, number>(
    (tasksMeta as any[]).map(t => [t.id, t.reschedule_count || 0])
  );

  const openReschedule = (it: CrmItemUnified) => {
    const base = it.fecha_vencimiento ? new Date(it.fecha_vencimiento) : addHours(startOfHour(new Date()), 1);
    setRescheduleDate(format(base, "yyyy-MM-dd'T'HH:mm"));
    setRescheduleReason("");
    setRescheduleTarget(it);
  };

  const submitReschedule = async () => {
    if (!rescheduleTarget || !rescheduleDate) return;
    setRescheduleSaving(true);
    try {
      const current = rescheduleMap.get(rescheduleTarget.id) || 0;
      const { error } = await supabase
        .from("crm_tasks")
        .update({
          due_date: new Date(rescheduleDate).toISOString(),
          task_status: "rescheduled",
          reschedule_count: current + 1,
          reschedule_reason: rescheduleReason || null,
        } as any)
        .eq("id", rescheduleTarget.id);
      if (error) throw error;
      toast.success("Tarea reprogramada");
      setRescheduleTarget(null);
      // Refrescar datos
      // (las invalidaciones globales del hook ocurrirán en el próximo poll; forzamos refetch básico)
      window.dispatchEvent(new Event("focus"));
    } catch (e: any) {
      toast.error(e.message || "No se pudo reprogramar");
    } finally {
      setRescheduleSaving(false);
    }
  };

  const openEdit = async (it: CrmItemUnified) => {
    try {
      if (it.source_table === "crm_activities") {
        const { data, error } = await supabase.from("crm_activities").select("*").eq("id", it.id).maybeSingle();
        if (error) throw error;
        if (data) setEditActivity(data);
      } else {
        // crm_tasks o crm_items (que comparte columnas básicas con tasks)
        const table = it.source_table === "crm_items" ? "crm_items" : "crm_tasks";
        const { data, error } = await supabase.from(table as any).select("*").eq("id", it.id).maybeSingle();
        if (error) throw error;
        if (data) setEditTask(data);
      }
    } catch (e: any) {
      toast.error(e.message || "No se pudo abrir el registro");
    }
  };

  const onFinalize = async () => {
    if (!finalizeTarget) return;
    try {
      const target = finalizeTarget;
      await finalize.mutateAsync({
        id: target.id,
        source_table: target.source_table,
        resultado: resultadoText || undefined,
      });
      toast.success("Tarea finalizada");
      setFinalizeTarget(null);
      setResultadoText("");
      // Solo ofrecer seguimiento para crm_tasks
      if (target.source_table === "crm_tasks") {
        // Asegurar task_status='done' (el trigger maneja completed_at)
        await supabase.from("crm_tasks").update({ task_status: "done" } as any).eq("id", target.id);
        const { data: taskRow } = await supabase
          .from("crm_tasks")
          .select("id, company_id, task_type, due_date, title, description, priority, user_id, contact_id, deal_id, recurrence")
          .eq("id", target.id)
          .maybeSingle();
        if (taskRow) {
          // Recurrencia: si la tarea es recurrente, crear automáticamente la siguiente.
          const rec = (taskRow as any).recurrence as string | null;
          if (rec && rec !== "none" && taskRow.due_date) {
            const base = new Date(taskRow.due_date as string);
            let next: Date | null = null;
            if (rec === "daily") next = addDays(base, 1);
            else if (rec === "weekly") next = addDays(base, 7);
            else if (rec === "monthly") next = addMonths(base, 1);
            if (next) {
              const { error: insErr } = await supabase.from("crm_tasks").insert({
                user_id: (taskRow as any).user_id,
                title: taskRow.title,
                description: (taskRow as any).description ?? null,
                priority: (taskRow as any).priority ?? "medium",
                company_id: (taskRow as any).company_id ?? null,
                contact_id: (taskRow as any).contact_id ?? null,
                deal_id: (taskRow as any).deal_id ?? null,
                task_type: (taskRow as any).task_type ?? null,
                task_status: "planned",
                recurrence: rec,
                due_date: next.toISOString(),
                origen_tarea_id: taskRow.id,
              } as any);
              if (!insErr) {
                toast.success(`Tarea recurrente reprogramada para ${format(next, "d MMM yyyy HH:mm", { locale: es })}`);
              }
            }
          }
          setNextStepTarget({ task: taskRow });
        }
      }
    } catch (e: any) {
      toast.error(e.message || "No se pudo finalizar");
    }
  };

  const handleScheduleFollowUp = () => {
    const t = nextStepTarget?.task;
    if (!t) return;
    const baseDate = t.due_date ? new Date(t.due_date) : new Date();
    const nextDate = addDays(baseDate, 1);
    setCreatePrefill({
      defaultCompanyId: t.company_id || undefined,
      defaultTaskType: suggestNextType(t.task_type),
      defaultDate: format(nextDate, "yyyy-MM-dd'T'HH:mm"),
      origenTareaId: t.id,
      defaultDescription: `Seguimiento de: ${t.title || ""}`.trim(),
    });
    setNextStepTarget(null);
    setCreateOpen(true);
  };

  const handleNewTaskClick = () => {
    setCreatePrefill({});
    setCreateOpen(true);
  };

  // ───────── Queries propias para Hoy / Esta semana ─────────
  const todayRange = useMemo(() => {
    const now = new Date();
    return { start: startOfDay(now), end: endOfDay(now), now };
  }, []);
  const weekRange = useMemo(() => {
    const now = new Date();
    return { start: startOfDay(now), end: endOfDay(addDays(now, 6)) };
  }, []);

  const { data: hoyTasks = [], isLoading: hoyLoading, refetch: refetchHoy } = useQuery({
    queryKey: ["tasks_hoy_v1", myUserId],
    enabled: viewTab === "hoy",
    queryFn: async () => {
      // Tareas de hoy (rango) o vencidas planificadas anteriores a hoy
      const todayStartIso = todayRange.start.toISOString();
      const todayEndIso = todayRange.end.toISOString();
      const { data, error } = await supabase
        .from("crm_tasks")
        .select("*")
        .or(
          `and(due_date.gte.${todayStartIso},due_date.lte.${todayEndIso}),and(task_status.eq.planned,due_date.lt.${todayStartIso})`
        )
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: weekTasks = [], isLoading: weekLoading, refetch: refetchWeek } = useQuery({
    queryKey: ["tasks_semana_v1", myUserId],
    enabled: viewTab === "semana",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_tasks")
        .select("*")
        .gte("due_date", weekRange.start.toISOString())
        .lte("due_date", weekRange.end.toISOString())
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // ── Tab Cobranza: tareas tipo cobranza no finalizadas, con datos enriquecidos ──
  const { data: cobranzaData = [], isLoading: cobranzaLoading, refetch: refetchCobranza } = useQuery({
    queryKey: ["tasks_cobranza_v1"],
    enabled: viewTab === "cobranza",
    queryFn: async () => {
      const { data: tareas, error } = await supabase
        .from("crm_tasks")
        .select("*")
        .eq("task_type", "cobranza")
        .neq("task_status", "done")
        .order("due_date", { ascending: true });
      if (error) throw error;
      const list = (tareas || []) as any[];
      const companyIds = Array.from(new Set(list.map((t) => t.company_id).filter(Boolean)));
      const empresasMap = new Map<string, { name: string }>();
      const saldoMap = new Map<string, number>();
      const intentosMap = new Map<string, number>();
      if (companyIds.length > 0) {
        const [{ data: comps }, { data: docs }, { data: intentos }] = await Promise.all([
          supabase.from("companies").select("id, name").in("id", companyIds),
          supabase
            .from("documentos")
            .select("empresa_id, saldo_pendiente_cobranza, fecha_documento, estado_cobranza")
            .in("empresa_id", companyIds)
            .eq("estado_cobranza", "vencida")
            .order("fecha_documento", { ascending: false }),
          supabase
            .from("crm_tasks")
            .select("company_id")
            .eq("task_type", "cobranza")
            .in("company_id", companyIds),
        ]);
        (comps || []).forEach((c: any) => empresasMap.set(c.id, { name: c.name }));
        (docs || []).forEach((d: any) => {
          if (!saldoMap.has(d.empresa_id)) {
            saldoMap.set(d.empresa_id, Number(d.saldo_pendiente_cobranza || 0));
          }
        });
        (intentos || []).forEach((t: any) => {
          intentosMap.set(t.company_id, (intentosMap.get(t.company_id) || 0) + 1);
        });
      }
      return list.map((t) => ({
        ...t,
        _company_name: t.company_id ? (empresasMap.get(t.company_id)?.name || "Cliente") : "Cliente",
        _saldo_pendiente: t.company_id ? (saldoMap.get(t.company_id) || 0) : 0,
        _intentos: t.company_id ? (intentosMap.get(t.company_id) || 1) : 1,
      }));
    },
  });

  // Refetch on dialogs close so cards reflect updates
  useEffect(() => {
    if (!finalizeTarget && !rescheduleTarget && !createOpen) {
      if (viewTab === "hoy") refetchHoy();
      if (viewTab === "semana") refetchWeek();
      if (viewTab === "cobranza") refetchCobranza();
    }
  }, [finalizeTarget, rescheduleTarget, createOpen, viewTab, refetchHoy, refetchWeek, refetchCobranza]);

  // Aplicar filtros cliente sobre rows (Tab Lista)
  const filteredRows = useMemo(() => {
    if (viewTab !== "lista") return rows;
    return rows.filter((r) => {
      if (clientTypes.length > 0 && !clientTypes.includes(r.type as TaskTypeKey)) return false;
      if (clientPriority !== "all" && r.priority !== clientPriority) return false;
      if (clientAssignedTo !== "all" && r.assigned_to !== clientAssignedTo) return false;
      if (clientStatus !== "all") {
        // Mapear: planned / in_progress (planned + due<now) / done / cancelled / rescheduled
        // Usamos el campo it.status que viene normalizado del hook (pendiente/completada/cancelada/vencida)
        const isOverdue = r.fecha_vencimiento && new Date(r.fecha_vencimiento) < new Date();
        if (clientStatus === "planned"     && r.status !== "pendiente") return false;
        if (clientStatus === "in_progress" && !(r.status === "pendiente" && isOverdue)) return false;
        if (clientStatus === "done"        && r.status !== "completada") return false;
        if (clientStatus === "cancelled"   && r.status !== "cancelada") return false;
        if (clientStatus === "rescheduled") {
          const meta = rescheduleMap.get(r.id) || 0;
          if (meta === 0) return false;
        }
      }
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, clientTypes, clientStatus, clientPriority, clientAssignedTo, viewTab]);

  const clearFilters = () => {
    setClientTypes([]);
    setClientStatus("all");
    setClientPriority("all");
    setClientAssignedTo("all");
    setParam("kind", null);
    setParam("type", null);
    setParam("marca", null);
    setParam("user", null);
  };

  const toggleClientType = (t: TaskTypeKey) => {
    setClientTypes((curr) => curr.includes(t) ? curr.filter(x => x !== t) : [...curr, t]);
  };

  // Helpers para tarjetas de tarea (Hoy / Semana)
  const renderTaskCard = (t: any, opts: { compact?: boolean; highlightOverdue?: boolean } = {}) => {
    const meta = TASK_TYPE_META[(t.task_type as TaskTypeKey) || "follow_up"] || TASK_TYPE_META.follow_up;
    const Icon = meta.Icon;
    const status = TASK_STATUS_BADGE[t.task_status || (t.completed ? "done" : "planned")] || TASK_STATUS_BADGE.planned;
    const isOverdue = !t.completed && t.task_status === "planned" && t.due_date && new Date(t.due_date) < startOfDay(new Date());
    const daysOver = isOverdue ? differenceInDays(startOfDay(new Date()), new Date(t.due_date)) : 0;

    if (opts.compact) {
      return (
        <div key={t.id} className="rounded-md border bg-card p-2 hover:bg-accent/30 cursor-pointer"
          onClick={() => setEditTask(t)}>
          <div className="flex items-center gap-1.5 text-xs">
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{t.title}</span>
          </div>
          {t.due_date && <div className="text-[10px] text-muted-foreground mt-0.5">{fmtTime(t.due_date)}</div>}
        </div>
      );
    }

    return (
      <div key={t.id} className={cn("rounded-lg border bg-card p-3", opts.highlightOverdue && "border-destructive/30")}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Icon className="h-4 w-4 text-primary" />
              <span className="font-medium truncate">{t.title}</span>
              <Badge variant="outline" className={cn("text-xs", status.className)}>{status.label}</Badge>
              {t.priority && (
                <Badge variant="outline" className="text-xs">{PRIORITY_LABEL[t.priority] || t.priority}</Badge>
              )}
              {(t.reschedule_count || 0) > 0 && (
                <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-200">
                  Reprog. {t.reschedule_count}x
                </Badge>
              )}
            </div>
            {t.description && <div className="text-sm text-muted-foreground line-clamp-2">{t.description}</div>}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
              {t.company_id && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> {companyMap.get(t.company_id) || "—"}
                </span>
              )}
              {t.due_date && (
                <span className={cn("flex items-center gap-1", isOverdue && "text-destructive font-medium")}>
                  <Calendar className="h-3 w-3" />
                  {isOverdue
                    ? `Vence hace ${daysOver} día${daysOver === 1 ? "" : "s"}`
                    : fmtDate(t.due_date)}
                </span>
              )}
            </div>
            <TaskChecklist taskId={t.id} />
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            <Button size="sm" variant="default" className="gap-1" onClick={() => {
              setFinalizeTarget({
                id: t.id, source_table: "crm_tasks", title: t.title, status: "pendiente",
                type: t.task_type, kind: "tarea", priority: t.priority, marca: null,
                company_id: t.company_id, contact_id: t.contact_id, deal_id: t.deal_id,
                description: t.description, fecha_creacion: t.created_at, fecha_vencimiento: t.due_date,
                fecha_terminacion: null, completed_by: null, created_by: t.user_id, assigned_to: null,
                resultado: null,
              } as any);
              setResultadoText("");
            }}>
              <CheckCircle2 className="h-4 w-4" /> Completar
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => openReschedule({
              id: t.id, source_table: "crm_tasks", title: t.title,
              fecha_vencimiento: t.due_date,
            } as any)}>
              <CalendarClock className="h-4 w-4" /> Reprogramar
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-3 sm:px-6 py-4 space-y-4">
      <BackButton />
      <PageBanner
        title="Tareas y Actividades"
        description="Sistema unificado: todas las tareas y actividades del CRM en un solo lugar."
      />

      {/* ── Vista superior: Lista | Hoy | Esta semana ── */}
      <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as any)}>
        <TabsList>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="hoy">Hoy</TabsTrigger>
          <TabsTrigger value="semana">Esta semana</TabsTrigger>
          <TabsTrigger value="cobranza">Cobranza</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Toolbar: búsqueda + Filtros + Nueva (siempre visibles) */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              defaultValue={search}
              onKeyDown={(e) => {
                if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value);
              }}
              className="pl-8 w-56"
            />
          </div>
          {viewTab === "lista" && (
            <Button variant="outline" className="gap-1" onClick={() => setFiltersOpen(o => !o)}>
              <SlidersHorizontal className="h-4 w-4" /> Filtros
            </Button>
          )}
        </div>

        <Button onClick={handleNewTaskClick} className="gap-1">
          <Plus className="h-4 w-4" /> Nueva tarea
        </Button>
      </div>

      {/* ── Panel de filtros colapsable (solo Lista) ── */}
      {viewTab === "lista" && filtersOpen && (
        <div className="border rounded-lg bg-card p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Tipo (multi) */}
            <div className="space-y-1 col-span-2 md:col-span-1">
              <label className="text-xs font-medium text-muted-foreground">Tipo</label>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(TASK_TYPE_META) as TaskTypeKey[]).map((k) => {
                  const M = TASK_TYPE_META[k];
                  const sel = clientTypes.includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => toggleClientType(k)}
                      className={cn(
                        "flex items-center gap-1 text-xs rounded border px-2 py-1 transition",
                        sel ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent",
                      )}
                    >
                      <M.Icon className="h-3 w-3" /> {M.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Estatus */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Estatus</label>
              <Select value={clientStatus} onValueChange={setClientStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="planned">Planificada</SelectItem>
                  <SelectItem value="in_progress">En progreso</SelectItem>
                  <SelectItem value="done">Realizada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                  <SelectItem value="rescheduled">Reprogramada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Prioridad */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Prioridad</label>
              <Select value={clientPriority} onValueChange={setClientPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="low">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Asignado a (admin/manager) */}
            {canSeeAssignedFilter && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Asignado a</label>
                <Select value={clientAssignedTo} onValueChange={setClientAssignedTo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {users.map((u: any) => (
                      <SelectItem key={u.user_id} value={u.user_id}>{u.full_name || u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={clearFilters}>Limpiar filtros</Button>
          </div>
        </div>
      )}

      {/* ── Tabs internos solo para Lista ── */}
      {viewTab === "lista" && (
      <Tabs value={tab} onValueChange={(v) => setParam("tab", v)}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="hoy">Hoy <Badge variant="secondary" className="ml-2">{counts.hoy}</Badge></TabsTrigger>
          <TabsTrigger value="pendientes">Pendientes <Badge variant="secondary" className="ml-2">{counts.pendientes}</Badge></TabsTrigger>
          <TabsTrigger value="vencidas">Vencidas <Badge variant="destructive" className="ml-2">{counts.vencidas}</Badge></TabsTrigger>
          <TabsTrigger value="completadas">Completadas <Badge variant="secondary" className="ml-2">{counts.completadas}</Badge></TabsTrigger>
          <TabsTrigger value="creadas">Creadas por mí <Badge variant="secondary" className="ml-2">{counts.creadas}</Badge></TabsTrigger>
          <TabsTrigger value="todas">Todas <Badge variant="secondary" className="ml-2">{counts.todas}</Badge></TabsTrigger>
        </TabsList>
      </Tabs>
      )}

      {/* ───── VISTA: LISTA (la existente, mejorada) ───── */}
      {viewTab === "lista" && (
      <div className="border rounded-lg bg-card">
        {/* Header del bloque con selector de cantidad a la derecha */}
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <div className="text-sm text-muted-foreground">
            {isLoading ? "Cargando..." : `${total} registro${total === 1 ? "" : "s"}`}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Mostrar</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => setParam("size", v)}
            >
              <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((o) => (
                  <SelectItem key={String(o)} value={String(o)}>
                    {o === "all" ? "Todas" : o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Lista */}
        <div className="divide-y">
          {isLoading && (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          )}
          {!isLoading && filteredRows.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No hay registros con los filtros actuales.
            </div>
          )}
          {!isLoading && filteredRows.map((it) => {
            const cfg = CRM_ITEM_TYPE_CONFIG[it.type] || CRM_ITEM_TYPE_CONFIG.otro;
            const status = STATUS_BADGE[it.status] || STATUS_BADGE.pendiente;
            const overdue = it.status === "pendiente" && it.fecha_vencimiento && new Date(it.fecha_vencimiento) < new Date();
            return (
              <div key={`${it.source_table}-${it.id}`} className="p-3 sm:p-4 hover:bg-accent/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-lg">{cfg.emoji}</span>
                      <span className="font-medium truncate">{it.title}</span>
                      <Badge variant="outline" className={cn("text-xs", status.className)}>
                        {overdue && it.status === "pendiente" ? "Vencida" : status.label}
                      </Badge>
                      {it.kind === "actividad" && (
                        <Badge variant="outline" className="text-xs">Actividad</Badge>
                      )}
                      {it.marca && (
                        <Badge variant="outline" className="text-xs capitalize">{it.marca}</Badge>
                      )}
                      {it.source_table === "crm_tasks" && (rescheduleMap.get(it.id) || 0) > 0 && (
                        <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-200">
                          Reprog. {rescheduleMap.get(it.id)}x
                        </Badge>
                      )}
                    </div>
                    {it.description && (
                      <div className="text-sm text-muted-foreground line-clamp-2">{it.description}</div>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                      {it.company_id && (
                        <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {companyMap.get(it.company_id) || "—"}</span>
                      )}
                      {it.contact_id && (
                        <span>{contactMap.get(it.contact_id) || ""}</span>
                      )}
                      {it.deal_id && (
                        <span>Negocio: {dealMap.get(it.deal_id) || ""}</span>
                      )}
                      <span className="flex items-center gap-1"><User className="h-3 w-3" />
                        Creado por: {userMap.get(it.created_by) || "—"}
                      </span>
                      {it.assigned_to && (
                        <span>Asignado a: {userMap.get(it.assigned_to) || "—"}</span>
                      )}
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />
                        Creada: {fmtDate(it.fecha_creacion)}
                      </span>
                      {it.fecha_vencimiento && (
                        <span className={cn("flex items-center gap-1", overdue && "text-destructive font-medium")}>
                          Vence: {fmtDate(it.fecha_vencimiento)}
                        </span>
                      )}
                      {it.fecha_terminacion && (
                        <span>Terminada: {fmtDate(it.fecha_terminacion)} {it.completed_by && `por ${userMap.get(it.completed_by) || ""}`}</span>
                      )}
                    </div>
                    {it.resultado && (
                      <div className="text-xs mt-2 p-2 rounded bg-muted/50">
                        <span className="font-medium">Resultado: </span>{it.resultado}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button size="sm" variant="outline" className="gap-1"
                      onClick={() => openEdit(it)}>
                      <Pencil className="h-4 w-4" /> Abrir
                    </Button>
                    {it.status !== "completada" && (
                      <Button size="sm" variant="default" className="gap-1"
                        onClick={() => { setFinalizeTarget(it); setResultadoText(""); }}>
                        <CheckCircle2 className="h-4 w-4" /> Finalizar
                      </Button>
                    )}
                    {it.source_table === "crm_tasks" && it.status !== "completada" && (
                      <Button size="sm" variant="outline" className="gap-1"
                        onClick={() => openReschedule(it)}>
                        <CalendarClock className="h-4 w-4" /> Reprogramar
                      </Button>
                    )}
                    {it.status === "completada" && it.source_table !== "crm_activities" && (
                      <Button size="sm" variant="outline" className="gap-1"
                        onClick={() => reopen.mutate({ id: it.id, source_table: it.source_table })}>
                        <RotateCcw className="h-4 w-4" /> Reabrir
                      </Button>
                    )}
                    {(it.created_by === myUserId) && (
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive gap-1"
                        onClick={() => {
                          if (confirm("¿Eliminar este registro?")) del.mutate({ id: it.id, source_table: it.source_table });
                        }}>
                        <Trash2 className="h-4 w-4" /> Eliminar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Paginación inferior */}
        {pageSize !== "all" && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t">
            <div className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1}
                onClick={() => setParam("page", String(page - 1))}>
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages}
                onClick={() => setParam("page", String(page + 1))}>
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ───── VISTA: HOY ───── */}
      {viewTab === "hoy" && (
        <HoyView
          tasks={hoyTasks as any[]}
          loading={hoyLoading}
          renderCard={renderTaskCard}
          todayStart={todayRange.start}
        />
      )}

      {/* ───── VISTA: ESTA SEMANA ───── */}
      {viewTab === "semana" && (
        <SemanaView
          tasks={weekTasks as any[]}
          loading={weekLoading}
          renderCard={renderTaskCard}
          weekStart={weekRange.start}
        />
      )}

      {/* ───── VISTA: COBRANZA ───── */}
      {viewTab === "cobranza" && (
        <CobranzaView
          tasks={cobranzaData as any[]}
          loading={cobranzaLoading}
          onComplete={(t) => {
            setFinalizeTarget({
              id: t.id, source_table: "crm_tasks", title: t.title, status: "pendiente",
              type: t.task_type, kind: "tarea", priority: t.priority, marca: null,
              company_id: t.company_id, contact_id: t.contact_id, deal_id: t.deal_id,
              description: t.description, fecha_creacion: t.created_at, fecha_vencimiento: t.due_date,
              fecha_terminacion: null, completed_by: null, created_by: t.user_id, assigned_to: null,
              resultado: null,
            } as any);
            setResultadoText("");
          }}
          onReschedule={(t) => openReschedule({
            id: t.id, source_table: "crm_tasks", title: t.title, fecha_vencimiento: t.due_date,
          } as any)}
        />
      )}

      {/* Dialog finalizar */}
      <Dialog open={!!finalizeTarget} onOpenChange={(o) => !o && setFinalizeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar: {finalizeTarget?.title}</DialogTitle>
            <DialogDescription>
              Captura el resultado o nota de cierre. Quedará registrado con tu usuario y fecha actual.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Resultado, conclusiones, próximos pasos..."
            value={resultadoText}
            onChange={(e) => setResultadoText(e.target.value)}
            rows={5}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinalizeTarget(null)}>Cancelar</Button>
            <Button onClick={onFinalize} disabled={finalize.isPending}>
              {finalize.isPending ? "Guardando..." : "Finalizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog crear (reusa el existente para no romper nada) */}
      <CreateCrmActivityTaskDialog
        open={createOpen}
        onOpenChange={(o) => { setCreateOpen(o); if (!o) setCreatePrefill({}); }}
        defaultCompanyId={createPrefill.defaultCompanyId}
        defaultTaskType={createPrefill.defaultTaskType}
        defaultDescription={createPrefill.defaultDescription}
        defaultDate={createPrefill.defaultDate}
        origenTareaId={createPrefill.origenTareaId}
      />

      {/* Dialogs editar */}
      <CrmTaskDetailDialog
        task={editTask}
        open={!!editTask}
        onOpenChange={(o) => !o && setEditTask(null)}
      />
      <CrmActivityDetailDialog
        activity={editActivity}
        open={!!editActivity}
        onOpenChange={(o) => !o && setEditActivity(null)}
      />

      {/* Dialog reprogramar */}
      <Dialog open={!!rescheduleTarget} onOpenChange={(o) => !o && setRescheduleTarget(null)}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Reprogramar: {rescheduleTarget?.title}</DialogTitle>
            <DialogDescription>
              Selecciona una nueva fecha y hora. Opcionalmente indica el motivo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nueva fecha y hora *</label>
              <Input
                type="datetime-local"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Motivo</label>
              <Textarea
                placeholder="¿Por qué se reprograma?"
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleTarget(null)}>Cancelar</Button>
            <Button onClick={submitReschedule} disabled={rescheduleSaving || !rescheduleDate}>
              {rescheduleSaving ? "Guardando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal "¿Qué sigue?" */}
      <Dialog open={!!nextStepTarget} onOpenChange={(o) => !o && setNextStepTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Cuál es el siguiente paso?</DialogTitle>
            <DialogDescription>
              Tarea completada. ¿Quieres agendar un seguimiento?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setNextStepTarget(null)}>
              No, solo completar
            </Button>
            <Button onClick={handleScheduleFollowUp}>
              Sí, agendar seguimiento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───────────────────── Sub-vistas ───────────────────── */

function HoyView({
  tasks, loading, renderCard, todayStart,
}: {
  tasks: any[]; loading: boolean;
  renderCard: (t: any, opts?: { compact?: boolean; highlightOverdue?: boolean }) => JSX.Element;
  todayStart: Date;
}) {
  const overdue = tasks
    .filter((t) => t.task_status === "planned" && t.due_date && new Date(t.due_date) < todayStart)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  const today = tasks
    .filter((t) => t.due_date && new Date(t.due_date) >= todayStart)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  if (loading) {
    return <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {overdue.length > 0 && (
        <section className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 space-y-2">
          <h2 className="text-sm font-semibold text-destructive flex items-center gap-1">
            <AlertCircle className="h-4 w-4" /> Vencidas ({overdue.length})
          </h2>
          <div className="space-y-2">
            {overdue.map((t) => renderCard(t, { highlightOverdue: true }))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold flex items-center gap-1">
          <Calendar className="h-4 w-4" /> Hoy ({today.length})
        </h2>
        {today.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 border rounded-lg">
            Sin tareas para hoy
          </div>
        ) : (
          <div className="space-y-2">
            {today.map((t) => (
              <div key={t.id}>
                <div className="text-xs text-muted-foreground mb-1">{fmtTime(t.due_date)}</div>
                {renderCard(t)}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SemanaView({
  tasks, loading, renderCard, weekStart,
}: {
  tasks: any[]; loading: boolean;
  renderCard: (t: any, opts?: { compact?: boolean }) => JSX.Element;
  weekStart: Date;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  if (loading) {
    return <div className="grid grid-cols-2 md:grid-cols-7 gap-2">{[...Array(7)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-flow-col auto-cols-[minmax(160px,1fr)] md:grid-flow-row md:grid-cols-7 gap-2">
        {days.map((day) => {
          const dayTasks = tasks
            .filter((t) => t.due_date && isSameDay(new Date(t.due_date), day))
            .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
          const isToday = isSameDay(day, today);
          return (
            <div key={day.toISOString()} className="border rounded-lg flex flex-col min-h-[200px] bg-card">
              <div className={cn(
                "px-2 py-1.5 border-b flex items-center justify-between",
                isToday && "bg-primary/10",
              )}>
                <span className="text-xs font-semibold capitalize">
                  {format(day, "EEE d", { locale: es })}
                </span>
                <Badge variant="secondary" className="text-[10px] h-5">{dayTasks.length}</Badge>
              </div>
              <div className="p-2 space-y-1.5 flex-1">
                {dayTasks.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground/60 text-center py-6">Sin tareas</div>
                ) : (
                  dayTasks.map((t) => renderCard(t, { compact: true }))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Checklist (subtareas) por tarea, con lazy load ── */
function TaskChecklist({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("crm_task_subtasks" as any)
      .select("*")
      .eq("task_id", taskId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (!error) setItems((data || []) as any[]);
    setLoaded(true);
    setLoading(false);
  };

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) await load();
  };

  const setCompleted = async (id: string, completed: boolean) => {
    setItems((arr) => arr.map((it) => it.id === id ? { ...it, completed, completed_at: completed ? new Date().toISOString() : null } : it));
    const { error } = await supabase
      .from("crm_task_subtasks" as any)
      .update({ completed, completed_at: completed ? new Date().toISOString() : null } as any)
      .eq("id", id);
    if (error) {
      toast.error("No se pudo actualizar el paso");
      load();
    }
  };

  const addItem = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    const maxPos = items.reduce((m, it) => Math.max(m, Number(it.position) || 0), 0);
    const { data, error } = await supabase
      .from("crm_task_subtasks" as any)
      .insert({ task_id: taskId, title, position: maxPos + 1 } as any)
      .select("*")
      .maybeSingle();
    setAdding(false);
    if (error) {
      toast.error("No se pudo agregar el paso");
      return;
    }
    if (data) setItems((arr) => [...arr, data]);
    setNewTitle("");
  };

  const total = items.length;
  const done = items.filter((i) => i.completed).length;
  const allDone = total > 0 && done === total;

  return (
    <div className="mt-2 border-t pt-2" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "w-full flex items-center gap-1 text-xs font-medium hover:underline",
          allDone ? "text-emerald-700" : "text-muted-foreground",
        )}
      >
        <ListChecks className="h-3.5 w-3.5" />
        Checklist {loaded && total > 0 ? `(${done}/${total})` : ""}
        {open ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
      </button>

      {open && (
        <div className="mt-2 space-y-1.5">
          {loading && <div className="text-xs text-muted-foreground">Cargando...</div>}
          {!loading && items.length === 0 && (
            <div className="text-xs text-muted-foreground">Sin pasos aún.</div>
          )}
          {items.map((it) => (
            <label key={it.id} className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={!!it.completed}
                onCheckedChange={(c) => setCompleted(it.id, !!c)}
                className="mt-0.5"
              />
              <span className={cn("flex-1", it.completed && "line-through text-muted-foreground")}>
                {it.title}
              </span>
            </label>
          ))}
          <div className="flex items-center gap-1.5 pt-1">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
              placeholder="Agregar paso..."
              className="h-8 text-sm"
            />
            <Button size="sm" variant="outline" className="h-8 px-2" disabled={adding || !newTitle.trim()} onClick={addItem}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Vista de Cobranza ── */
function CobranzaView({
  tasks, loading, onComplete, onReschedule,
}: {
  tasks: any[];
  loading: boolean;
  onComplete: (t: any) => void;
  onReschedule: (t: any) => void;
}) {
  if (loading) {
    return <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>;
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12 border rounded-lg">
        Sin tareas de cobranza pendientes.
      </div>
    );
  }

  const now = startOfDay(new Date());
  const fmtMx = (n: number) => `$${(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-3">
      {tasks.map((t) => {
        const due = t.due_date ? new Date(t.due_date) : null;
        const dias = due ? differenceInDays(now, startOfDay(due)) : 0;
        const vencida = dias > 0;
        return (
          <div key={t.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Building2 className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold truncate">{t._company_name}</h3>
                  {vencida && (
                    <Badge variant="destructive" className="text-xs">
                      Vencida hace {dias} día{dias === 1 ? "" : "s"}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {t._intentos} intento{t._intentos === 1 ? "" : "s"} de contacto
                  </Badge>
                </div>

                <div className="mt-2 text-2xl font-bold text-emerald-600">
                  {fmtMx(t._saldo_pendiente)}
                </div>
                <div className="text-xs text-muted-foreground">Saldo pendiente</div>

                {t.title && <div className="text-sm mt-2 font-medium">{t.title}</div>}
                {t.description && <div className="text-xs text-muted-foreground line-clamp-2">{t.description}</div>}

                <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Vence: {fmtDate(t.due_date)}
                </div>
                <TaskChecklist taskId={t.id} />
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Button size="sm" variant="default" className="gap-1" onClick={() => onComplete(t)}>
                  <CheckCircle2 className="h-4 w-4" /> Completar
                </Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => onReschedule(t)}>
                  <CalendarClock className="h-4 w-4" /> Reprogramar
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}