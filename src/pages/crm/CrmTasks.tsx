import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCrmTasks, CrmTask } from "@/hooks/useCrmTasks";
import { CrmTaskItem } from "@/components/crm/CrmTaskItem";
import { CreateCrmTaskDialog } from "@/components/crm/CreateCrmTaskDialog";
import { CrmTaskDetailDialog } from "@/components/crm/CrmTaskDetailDialog";
import { PageBanner } from "@/components/PageBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, CheckSquare, Search, ArrowLeft } from "lucide-react";

export default function CrmTasks() {
  const { brand } = useParams<{ brand: string }>();
  const brandLabel = brand === "chevron" ? "Chevron" : "Phillips 66";
  const navigate = useNavigate();

  const [tab, setTab] = useState("todo");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const { data: tasks, isLoading } = useCrmTasks({ completed: tab === "completed" });
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<CrmTask | null>(null);

  const filtered = tasks
    ?.filter((t) => !priorityFilter || t.priority === priorityFilter)
    .filter((t) => !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageBanner title={`Tareas — ${brandLabel}`} description="Gestiona tus pendientes y recordatorios.">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/crm")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nueva Tarea
          </Button>
        </div>
      </PageBanner>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="todo">Pendientes</TabsTrigger>
            <TabsTrigger value="completed">Completadas</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tareas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="Prioridad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="medium">Media</SelectItem>
            <SelectItem value="low">Baja</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : !filtered?.length ? (
        <div className="flex flex-col items-center py-16">
          <CheckSquare className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold text-lg">{tab === "todo" ? "Sin tareas" : "Sin tareas completadas"}</h3>
          <p className="text-muted-foreground text-sm mb-4">
            {tab === "todo" ? "Crea tu primera tarea para comenzar." : "Completa una tarea para verla aquí."}
          </p>
          {tab === "todo" && (
            <Button variant="secondary" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nueva tarea
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => <CrmTaskItem key={task.id} task={task} onClick={() => setSelectedTask(task)} />)}
        </div>
      )}

      <CreateCrmTaskDialog open={createOpen} onOpenChange={setCreateOpen} />
      <CrmTaskDetailDialog task={selectedTask} open={!!selectedTask} onOpenChange={(o) => { if (!o) setSelectedTask(null); }} />
    </div>
  );
}
