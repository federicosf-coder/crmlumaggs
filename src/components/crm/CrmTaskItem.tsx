import { useState } from "react";
import { CrmTask, useUpdateCrmTask, useDeleteCrmTask } from "@/hooks/useCrmTasks";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreateCrmTaskDialog } from "@/components/crm/CreateCrmTaskDialog";
import { TaskTypeKey, ParentCategoryKey, PARENT_CATEGORY_META } from "@/lib/taskTypes";
import { Trash2, Calendar, LinkIcon } from "lucide-react";
import { formatDistanceToNow, isPast, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface CrmTaskItemProps {
  task: CrmTask;
  onClick?: () => void;
}

const priorityColors: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  low: "bg-muted text-muted-foreground border-border",
};

export function CrmTaskItem({ task, onClick }: CrmTaskItemProps) {
  const updateTask = useUpdateCrmTask();
  const deleteTask = useDeleteCrmTask();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [createNextOpen, setCreateNextOpen] = useState(false);
  const overdue = task.due_date && !task.completed && isPast(parseISO(task.due_date));

  const doComplete = (alsoCreate: boolean) => {
    updateTask.mutate({ id: task.id, completed: true, completed_at: new Date().toISOString() });
    setConfirmOpen(false);
    if (alsoCreate) setCreateNextOpen(true);
  };

  const parentCat = (task as any).parent_category as ParentCategoryKey | null;

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 transition-colors cursor-pointer hover:bg-muted/50 ${task.completed ? "opacity-60" : ""}`} onClick={onClick}>
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={task.completed}
          onCheckedChange={(checked) => {
            if (task.completed && !checked) {
              updateTask.mutate({ id: task.id, completed: false, completed_at: null });
            } else if (!task.completed && checked) {
              setConfirmOpen(true);
            }
          }}
          className="mt-0.5"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.completed ? "line-through" : ""}`}>{task.title}</p>
        {task.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <Badge variant="outline" className={`text-[10px] ${priorityColors[task.priority] || ""}`}>
            {task.priority === "high" ? "Alta" : task.priority === "medium" ? "Media" : "Baja"}
          </Badge>
          {parentCat && (() => {
            const pc = PARENT_CATEGORY_META[parentCat];
            const PIcon = pc.Icon;
            return (
              <Badge variant="outline" className={`text-[10px] gap-1 ${pc.soft}`}>
                <PIcon className="h-3 w-3" /> {pc.label}
              </Badge>
            );
          })()}
          {task.due_date && (
            <span className={`flex items-center gap-1 text-[11px] ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
              <Calendar className="h-3 w-3" />
              {formatDistanceToNow(parseISO(task.due_date), { addSuffix: true, locale: es })}
            </span>
          )}
          {(task.crm_deals || task.contacts) && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <LinkIcon className="h-3 w-3" />
              {task.crm_deals?.title || `${task.contacts?.first_name} ${task.contacts?.last_name}`}
            </span>
          )}
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => { e.stopPropagation(); deleteTask.mutate(task.id); }}>
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>

      <div onClick={(e) => e.stopPropagation()}>
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Completar tarea?</AlertDialogTitle>
              <AlertDialogDescription>
                Marca "{task.title}" como completada. ¿Quieres además crear una nueva tarea relacionada?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-2">
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button variant="outline" onClick={() => doComplete(false)}>Completar</Button>
              <AlertDialogAction onClick={() => doComplete(true)}>Completar y crear nueva</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <CreateCrmTaskDialog
          open={createNextOpen}
          onOpenChange={setCreateNextOpen}
          defaultCompanyId={task.company_id || undefined}
          defaultContactId={task.contact_id || undefined}
          defaultDealId={task.deal_id || undefined}
          parentTaskId={(task as any).parent_task_id || null}
          defaultParentCategory={!(task as any).parent_task_id ? parentCat : null}
          defaultTaskType={(task.task_type as TaskTypeKey) || null}
        />
      </div>
    </div>
  );
}
