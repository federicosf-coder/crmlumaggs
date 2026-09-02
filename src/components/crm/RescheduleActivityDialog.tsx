import { useEffect, useState } from "react";
import { localInputToIso } from "@/lib/formatters";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateCrmTask } from "@/hooks/useCrmTasks";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Loader2 } from "lucide-react";
import type { TaskTypeKey, ParentCategoryKey } from "@/lib/taskTypes";

export interface RescheduleContext {
  origenTareaId: string | null;
  taskType: TaskTypeKey | null;
  parentCategory: ParentCategoryKey | null;
  parentTaskId: string | null;
  contactId: string;
  companyId: string;
  baseTitle: string;
  description: string | null;
  priority: string;
  reasonLabel: string; // "No contestó", "Reagendada", "Reprogramada"
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  context: RescheduleContext | null;
}

export function RescheduleActivityDialog({ open, onOpenChange, context }: Props) {
  const { session } = useAuth();
  const createTask = useCreateCrmTask();
  const { toast } = useToast();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  useEffect(() => {
    if (open) { setDate(""); setTime(""); }
  }, [open]);

  const handleSchedule = () => {
    if (!session?.user || !context) return;
    if (!date) {
      toast({ title: "Falta fecha", description: "Selecciona la fecha (y hora) para reprogramar.", variant: "destructive" });
      return;
    }
    const dueIso = localInputToIso(time ? `${date}T${time}:00` : date) || date;
    const newTitle = `[Programada] ${context.baseTitle || "Actividad"}`.trim();
    createTask.mutate(
      {
        user_id: session.user.id,
        title: newTitle,
        description: context.description,
        due_date: dueIso,
        priority: context.priority,
        contact_id: context.contactId && context.contactId !== "none" ? context.contactId : null,
        company_id: context.companyId && context.companyId !== "none" ? context.companyId : null,
        task_type: context.taskType || null,
        parent_task_id: context.parentTaskId || null,
        parent_category: context.parentTaskId ? null : context.parentCategory,
        origen_tarea_id: context.origenTareaId,
        task_status: "planned",
        completed: false,
      } as any,
      {
        onSuccess: () => {
          toast({ title: "Nueva actividad programada", description: `Origen: ${context.reasonLabel}` });
          onOpenChange(false);
        },
        onError: (e: any) => {
          toast({ title: "No se pudo programar", description: e?.message, variant: "destructive" });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4 border-b">
          <DialogTitle className="text-lg font-semibold tracking-tight">Programar nueva actividad</DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5 font-light">
            Origen: {context?.reasonLabel || "—"}. Captura sólo la nueva fecha y hora.
          </p>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Fecha *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="font-light h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Hora</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="font-light h-9" />
            </div>
          </div>
        </div>
        <div className="border-t bg-muted/30 px-4 py-3 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={handleSchedule} disabled={createTask.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {createTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><CalendarIcon className="h-4 w-4 mr-1" /> Programar</>)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}