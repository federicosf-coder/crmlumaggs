import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useCrmActivities, CrmActivityType, ACTIVITY_TYPE_CONFIG } from "@/hooks/useCrmActivities";
import { useCrmTasks, CrmTask } from "@/hooks/useCrmTasks";
import { CrmActivityItem } from "@/components/crm/CrmActivityItem";
import { CrmTaskItem } from "@/components/crm/CrmTaskItem";
import { CreateCrmActivityTaskDialog } from "@/components/crm/CreateCrmActivityTaskDialog";
import { CrmTaskDetailDialog } from "@/components/crm/CrmTaskDetailDialog";
import { PageBanner } from "@/components/PageBanner";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Activity as ActivityIcon, CalendarDays, List, ChevronLeft, ChevronRight } from "lucide-react";
import { SortMenu } from "@/components/SortMenu";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function CrmActivitiesTasks() {
  const [searchParams] = useSearchParams();
  const defaultBrand = searchParams.get("brand") || "";

  const [tab, setTab] = useState<"all" | "activities" | "tasks" | "completed">("all");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [userFilter, setUserFilter] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaultDate, setCreateDefaultDate] = useState<string | undefined>();
  const [selectedTask, setSelectedTask] = useState<CrmTask | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [sortBy, setSortBy] = useState("date_desc");

  const { data: activities = [], isLoading: activitiesLoading } = useCrmActivities(
    typeFilter && typeFilter !== "task" ? { type: typeFilter } : undefined
  );
  const { data: pendingTasks = [], isLoading: tasksLoading } = useCrmTasks({ completed: false });
  const { data: completedTasks = [], isLoading: completedLoading } = useCrmTasks({ completed: true });

  const { data: users = [] } = useQuery({
    queryKey: ["profiles_list_activities"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name").eq("is_active", true).order("full_name");
      return data || [];
    },
  });

  const isLoading = activitiesLoading || tasksLoading || completedLoading;

  const sortItems = <T extends { due_date?: string | null; activity_date?: string; created_at?: string; title?: string }>(items: T[]): T[] => {
    return [...items].sort((a, b) => {
      const dateA = new Date(a.due_date || a.activity_date || a.created_at || "").getTime();
      const dateB = new Date(b.due_date || b.activity_date || b.created_at || "").getTime();
      switch (sortBy) {
        case "date_desc": return dateB - dateA;
        case "date_asc": return dateA - dateB;
        case "title_asc": return (a.title || "").localeCompare(b.title || "");
        default: return 0;
      }
    });
  };

  const filteredActivities = sortItems(
    activities
      .filter((a) => !searchQuery || a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.description?.toLowerCase().includes(searchQuery.toLowerCase()))
      .filter((a) => !userFilter || a.user_id === userFilter)
  );

  const filteredPendingTasks = sortItems(
    pendingTasks
      .filter((t) => !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase()))
      .filter((t) => !typeFilter || typeFilter === "task")
      .filter((t) => !userFilter || t.user_id === userFilter)
  );

  const filteredCompletedTasks = sortItems(
    completedTasks
      .filter((t) => !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase()))
      .filter((t) => !userFilter || t.user_id === userFilter)
  );

  // Calendar data
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [calendarMonth]);

  // Merge activities + tasks into calendar events
  const calendarEvents = useMemo(() => {
    const events: { date: string; type: "activity" | "task"; label: string; emoji: string; id: string; priority?: string; completed?: boolean }[] = [];
    filteredActivities.forEach((a) => {
      const dateStr = format(new Date(a.activity_date || a.created_at), "yyyy-MM-dd");
      const config = ACTIVITY_TYPE_CONFIG[a.type as CrmActivityType];
      events.push({ date: dateStr, type: "activity", label: config?.label || a.type, emoji: config?.emoji || "📋", id: a.id });
    });
    const allTasks = tab === "completed" ? filteredCompletedTasks : [...filteredPendingTasks, ...(tab === "all" ? filteredCompletedTasks : [])];
    allTasks.forEach((t) => {
      if (t.due_date) {
        const dateStr = format(new Date(t.due_date), "yyyy-MM-dd");
        events.push({ date: dateStr, type: "task", label: t.title, emoji: "✅", id: t.id, priority: t.priority, completed: t.completed });
      }
    });
    return events;
  }, [filteredActivities, filteredPendingTasks, filteredCompletedTasks, tab]);

  const handleCalendarDayClick = (day: Date) => {
    setCreateDefaultDate(format(day, "yyyy-MM-dd'T'10:00"));
    setCreateOpen(true);
  };

  const handleCreateOpen = () => {
    setCreateDefaultDate(undefined);
    setCreateOpen(true);
  };

  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <div className="space-y-6">
      <BackButton />
      <PageBanner title="Actividades / Tareas" description="Registra interacciones y gestiona pendientes.">
        <Button onClick={handleCreateOpen}>
          <Plus className="h-4 w-4 mr-2" /> Nueva
        </Button>
      </PageBanner>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="all">Todo</TabsTrigger>
            <TabsTrigger value="activities">Actividades</TabsTrigger>
            <TabsTrigger value="tasks">Pendientes</TabsTrigger>
            <TabsTrigger value="completed">Completadas</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-1 border rounded-md p-0.5">
          <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setViewMode("list")}>
            <List className="h-4 w-4" />
          </Button>
          <Button variant={viewMode === "calendar" ? "default" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setViewMode("calendar")}>
            <CalendarDays className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative w-full sm:w-52">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Todos los tipos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(ACTIVITY_TYPE_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.emoji} {config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SortMenu
          value={sortBy}
          onChange={setSortBy}
          options={[
            { value: "date_desc", label: "Fecha ↓" },
            { value: "date_asc", label: "Fecha ↑" },
            { value: "title_asc", label: "Título A-Z" },
          ]}
        />
        <Select value={userFilter || "all"} onValueChange={(v) => setUserFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Todos los usuarios" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los usuarios</SelectItem>
            {users.map((u: any) => <SelectItem key={u.user_id} value={u.user_id}>{u.full_name || u.user_id}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : viewMode === "list" ? (
        /* ─── LIST VIEW ─── */
        <div className="space-y-3">
          {(tab === "all" || tab === "tasks") && filteredPendingTasks.length > 0 && (
            <>
              {tab === "all" && <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pendientes</h3>}
              {filteredPendingTasks.map((task) => (
                <CrmTaskItem key={task.id} task={task} onClick={() => setSelectedTask(task)} />
              ))}
            </>
          )}

          {(tab === "all" || tab === "activities") && filteredActivities.length > 0 && (
            <>
              {tab === "all" && <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mt-4">Actividades</h3>}
              {filteredActivities.map((a) => (
                <CrmActivityItem key={a.id} activity={a} />
              ))}
            </>
          )}

          {tab === "completed" && filteredCompletedTasks.map((task) => (
            <CrmTaskItem key={task.id} task={task} onClick={() => setSelectedTask(task)} />
          ))}

          {tab === "all" && filteredActivities.length === 0 && filteredPendingTasks.length === 0 && (
            <EmptyState onNew={handleCreateOpen} message="Sin actividades ni tareas" sub="Comienza registrando una actividad o tarea." />
          )}
          {tab === "activities" && filteredActivities.length === 0 && (
            <EmptyState onNew={handleCreateOpen} message="Sin actividades" sub="Registra llamadas, correos, reuniones y más." />
          )}
          {tab === "tasks" && filteredPendingTasks.length === 0 && (
            <EmptyState onNew={handleCreateOpen} message="Sin tareas pendientes" sub="Crea una tarea para comenzar." />
          )}
          {tab === "completed" && filteredCompletedTasks.length === 0 && (
            <EmptyState message="Sin tareas completadas" sub="Completa una tarea para verla aquí." />
          )}
        </div>
      ) : (
        /* ─── CALENDAR VIEW ─── */
        <div className="border rounded-lg overflow-hidden">
          {/* Calendar header */}
          <div className="flex items-center justify-between p-3 bg-muted/30 border-b">
            <Button variant="ghost" size="icon" onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="font-semibold text-lg capitalize">
              {format(calendarMonth, "MMMM yyyy", { locale: es })}
            </h3>
            <Button variant="ghost" size="icon" onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Week day headers */}
          <div className="grid grid-cols-7 border-b">
            {weekDays.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2 border-r last:border-r-0">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const dayEvents = calendarEvents.filter((e) => e.date === dateStr);
              const isCurrentMonth = isSameMonth(day, calendarMonth);
              const isToday = isSameDay(day, new Date());
              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-[80px] sm:min-h-[100px] border-r border-b last:border-r-0 p-1 cursor-pointer hover:bg-accent/30 transition-colors",
                    !isCurrentMonth && "bg-muted/20 text-muted-foreground",
                  )}
                  onClick={() => handleCalendarDayClick(day)}
                >
                  <div className={cn(
                    "text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full",
                    isToday && "bg-primary text-primary-foreground",
                  )}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5 overflow-hidden">
                    {dayEvents.slice(0, 3).map((evt) => (
                      <div
                        key={evt.id}
                        className={cn(
                          "text-[10px] leading-tight truncate rounded px-1 py-0.5",
                          evt.type === "task"
                            ? evt.completed
                              ? "bg-muted text-muted-foreground line-through"
                              : evt.priority === "high"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-primary/10 text-primary"
                            : "bg-accent text-accent-foreground"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (evt.type === "task") {
                            const task = [...pendingTasks, ...completedTasks].find((t) => t.id === evt.id);
                            if (task) setSelectedTask(task);
                          }
                        }}
                      >
                        {evt.emoji} {evt.label}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} más</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <CreateCrmActivityTaskDialog open={createOpen} onOpenChange={setCreateOpen} defaultBrand={defaultBrand} defaultDate={createDefaultDate} />
      <CrmTaskDetailDialog task={selectedTask} open={!!selectedTask} onOpenChange={(o) => { if (!o) setSelectedTask(null); }} />
    </div>
  );
}

function EmptyState({ onNew, message, sub }: { onNew?: () => void; message: string; sub: string }) {
  return (
    <div className="flex flex-col items-center py-16">
      <ActivityIcon className="h-12 w-12 text-muted-foreground/40 mb-3" />
      <h3 className="font-semibold text-lg">{message}</h3>
      <p className="text-muted-foreground text-sm mb-4">{sub}</p>
      {onNew && (
        <Button variant="secondary" onClick={onNew}>
          <Plus className="h-4 w-4 mr-2" /> Nueva
        </Button>
      )}
    </div>
  );
}
