import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useCrmActivities, CrmActivityType, ACTIVITY_TYPE_CONFIG } from "@/hooks/useCrmActivities";
import { useCrmTasks, CrmTask } from "@/hooks/useCrmTasks";
import { CrmActivityItem } from "@/components/crm/CrmActivityItem";
import { CrmTaskItem } from "@/components/crm/CrmTaskItem";
import { CreateCrmActivityTaskDialog } from "@/components/crm/CreateCrmActivityTaskDialog";
import { CrmTaskDetailDialog } from "@/components/crm/CrmTaskDetailDialog";
import { PageBanner } from "@/components/PageBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Activity as ActivityIcon } from "lucide-react";

export default function CrmActivitiesTasks() {
  const [searchParams] = useSearchParams();
  const defaultBrand = searchParams.get("brand") || "";

  const [tab, setTab] = useState<"all" | "activities" | "tasks" | "completed">("all");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<CrmTask | null>(null);

  const { data: activities = [], isLoading: activitiesLoading } = useCrmActivities(
    typeFilter && typeFilter !== "task" ? { type: typeFilter } : undefined
  );
  const { data: pendingTasks = [], isLoading: tasksLoading } = useCrmTasks({ completed: false });
  const { data: completedTasks = [], isLoading: completedLoading } = useCrmTasks({ completed: true });

  const isLoading = activitiesLoading || tasksLoading || completedLoading;

  const filteredActivities = activities.filter(
    (a) => !searchQuery || a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPendingTasks = pendingTasks.filter(
    (t) => !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase())
  ).filter((t) => !typeFilter || typeFilter === "task");

  const filteredCompletedTasks = completedTasks.filter(
    (t) => !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageBanner title="Actividades / Tareas" description="Registra interacciones y gestiona pendientes.">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nueva
        </Button>
      </PageBanner>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="all">Todo</TabsTrigger>
            <TabsTrigger value="activities">Actividades</TabsTrigger>
            <TabsTrigger value="tasks">Pendientes</TabsTrigger>
            <TabsTrigger value="completed">Completadas</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Todos los tipos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(ACTIVITY_TYPE_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.emoji} {config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : (
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
            <div className="flex flex-col items-center py-16">
              <ActivityIcon className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <h3 className="font-semibold text-lg">Sin actividades ni tareas</h3>
              <p className="text-muted-foreground text-sm mb-4">Comienza registrando una actividad o tarea.</p>
              <Button variant="secondary" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Nueva
              </Button>
            </div>
          )}
          {tab === "activities" && filteredActivities.length === 0 && (
            <div className="flex flex-col items-center py-16">
              <ActivityIcon className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <h3 className="font-semibold text-lg">Sin actividades</h3>
              <p className="text-muted-foreground text-sm mb-4">Registra llamadas, correos, reuniones y más.</p>
              <Button variant="secondary" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Nueva
              </Button>
            </div>
          )}
          {tab === "tasks" && filteredPendingTasks.length === 0 && (
            <div className="flex flex-col items-center py-16">
              <ActivityIcon className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <h3 className="font-semibold text-lg">Sin tareas pendientes</h3>
              <p className="text-muted-foreground text-sm mb-4">Crea una tarea para comenzar.</p>
              <Button variant="secondary" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Nueva
              </Button>
            </div>
          )}
          {tab === "completed" && filteredCompletedTasks.length === 0 && (
            <div className="flex flex-col items-center py-16">
              <ActivityIcon className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <h3 className="font-semibold text-lg">Sin tareas completadas</h3>
              <p className="text-muted-foreground text-sm mb-4">Completa una tarea para verla aquí.</p>
            </div>
          )}
        </div>
      )}

      <CreateCrmActivityTaskDialog open={createOpen} onOpenChange={setCreateOpen} defaultBrand={defaultBrand} />
      <CrmTaskDetailDialog task={selectedTask} open={!!selectedTask} onOpenChange={(o) => { if (!o) setSelectedTask(null); }} />
    </div>
  );
}
