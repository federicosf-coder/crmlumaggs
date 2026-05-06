import { useMemo, useState } from "react";
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
  Plus, Filter, AlertCircle, Calendar, User, Building2, Pencil,
} from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CreateCrmActivityTaskDialog } from "@/components/crm/CreateCrmActivityTaskDialog";
import { CrmTaskDetailDialog } from "@/components/crm/CrmTaskDetailDialog";
import { CrmActivityDetailDialog } from "@/components/crm/CrmActivityDetailDialog";

const PAGE_SIZE_OPTIONS = [10, 25, 50, "all"] as const;

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "bg-amber-100 text-amber-800 border-amber-200" },
  en_progreso: { label: "En progreso", className: "bg-blue-100 text-blue-800 border-blue-200" },
  completada: { label: "Completada", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  cancelada: { label: "Cancelada", className: "bg-gray-100 text-gray-700 border-gray-200" },
  vencida: { label: "Vencida", className: "bg-red-100 text-red-800 border-red-200" },
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  const d = parseISO(s);
  if (!isValid(d)) return "—";
  return format(d, "d MMM yyyy HH:mm", { locale: es });
}

export default function CrmItemsPage() {
  const [params, setParams] = useSearchParams();
  const { session } = useAuth();
  const myUserId = session?.user?.id ?? "";

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
  const [editTask, setEditTask] = useState<any | null>(null);
  const [editActivity, setEditActivity] = useState<any | null>(null);

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
      await finalize.mutateAsync({
        id: finalizeTarget.id,
        source_table: finalizeTarget.source_table,
        resultado: resultadoText || undefined,
      });
      toast.success("Tarea finalizada");
      setFinalizeTarget(null);
      setResultadoText("");
    } catch (e: any) {
      toast.error(e.message || "No se pudo finalizar");
    }
  };

  return (
    <div className="container mx-auto px-3 sm:px-6 py-4 space-y-4">
      <BackButton />
      <PageBanner
        title="Tareas y Actividades"
        description="Sistema unificado: todas las tareas y actividades del CRM en un solo lugar."
      />

      {/* Toolbar superior */}
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

          <Select value={kindParam} onValueChange={(v) => setParam("kind", v === "todos" ? null : v)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="tarea">Tareas</SelectItem>
              <SelectItem value="actividad">Actividades</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeParam || "all"} onValueChange={(v) => setParam("type", v === "all" ? null : v)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Subtipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los subtipos</SelectItem>
              {Object.entries(CRM_ITEM_TYPE_CONFIG).map(([key, c]) => (
                <SelectItem key={key} value={key}>{c.emoji} {c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={marcaParam || "all"} onValueChange={(v) => setParam("marca", v === "all" ? null : v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Marca" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las marcas</SelectItem>
              <SelectItem value="chevron">Chevron</SelectItem>
              <SelectItem value="phillips66">Phillips 66</SelectItem>
            </SelectContent>
          </Select>

          <Select value={userParam || "all"} onValueChange={(v) => setParam("user", v === "all" ? null : v)}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Ejecutivo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los ejecutivos</SelectItem>
              {myUserId && <SelectItem value={myUserId}>Solo yo</SelectItem>}
              {users.map((u: any) => (
                <SelectItem key={u.user_id} value={u.user_id}>{u.full_name || u.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => setCreateOpen(true)} className="gap-1">
          <Plus className="h-4 w-4" /> Nueva tarea / actividad
        </Button>
      </div>

      {/* Tabs */}
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

      {/* Bloque listado */}
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
          {!isLoading && rows.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No hay registros con los filtros actuales.
            </div>
          )}
          {!isLoading && rows.map((it) => {
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
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}