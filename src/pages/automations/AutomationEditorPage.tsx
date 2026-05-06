import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { PageBanner } from "@/components/PageBanner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AutomationStepConfig } from "@/components/automations/AutomationStepConfig";
import { AutomationStepTrigger } from "@/components/automations/AutomationStepTrigger";
import { AutomationStepConditions } from "@/components/automations/AutomationStepConditions";
import { AutomationStepActions } from "@/components/automations/AutomationStepActions";
import {
  type ActionDraft, type AutomationDraft, triggerLabel, actionLabel,
} from "@/components/automations/types";

const STEPS = [
  { id: 1, label: "Configuración" },
  { id: 2, label: "Disparador" },
  { id: 3, label: "Condiciones" },
  { id: 4, label: "Acciones" },
];

const EMPTY: AutomationDraft = {
  name: "",
  description: "",
  is_active: true,
  entity_type: "deal",
  trigger_type: "",
  trigger_config: {},
  conditions: { logic: "AND", items: [] },
};

export default function AutomationEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<AutomationDraft>(EMPTY);
  const [actions, setActions] = useState<ActionDraft[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const { data: a, error } = await (supabase as any)
        .from("automations").select("*").eq("id", id).single();
      if (error) {
        toast.error("No se pudo cargar la automatización");
        navigate("/automations");
        return;
      }
      setDraft({
        name: a.name,
        description: a.description ?? "",
        is_active: a.is_active,
        entity_type: a.entity_type,
        trigger_type: a.trigger_type,
        trigger_config: a.trigger_config ?? {},
        conditions: a.conditions ?? { logic: "AND", items: [] },
      });
      const { data: acts } = await (supabase as any)
        .from("automation_actions")
        .select("action_type, action_config, position")
        .eq("automation_id", id)
        .order("position");
      setActions((acts || []).map((x: any) => ({
        action_type: x.action_type,
        action_config: x.action_config ?? {},
      })));
      setLoading(false);
    })();
  }, [id, isEdit, navigate]);

  const updateDraft = (patch: Partial<AutomationDraft>) => {
    dirty.current = true;
    setDraft((d) => ({ ...d, ...patch }));
  };
  const updateActions = (next: ActionDraft[]) => {
    dirty.current = true;
    setActions(next);
  };

  const canNext = useMemo(() => {
    if (step === 1) return draft.name.trim().length > 0;
    if (step === 2) return !!draft.trigger_type;
    return true;
  }, [step, draft]);

  const handleCancel = () => {
    if (dirty.current) setConfirmCancel(true);
    else navigate(-1);
  };

  const handleSave = async () => {
    if (!draft.name.trim()) { toast.error("El nombre es requerido"); setStep(1); return; }
    if (!draft.trigger_type) { toast.error("Selecciona un disparador"); setStep(2); return; }
    if (actions.length === 0) { toast.error("Agrega al menos una acción"); return; }

    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description || null,
        is_active: draft.is_active,
        entity_type: draft.entity_type,
        trigger_type: draft.trigger_type,
        trigger_config: draft.trigger_config,
        conditions: draft.conditions,
      };
      let automationId = id;
      if (isEdit) {
        const { error } = await (supabase as any)
          .from("automations").update(payload).eq("id", id);
        if (error) throw error;
        const { error: delErr } = await (supabase as any)
          .from("automation_actions").delete().eq("automation_id", id);
        if (delErr) throw delErr;
      } else {
        const { data, error } = await (supabase as any)
          .from("automations").insert(payload).select("id").single();
        if (error) throw error;
        automationId = data.id;
      }
      if (actions.length > 0) {
        const rows = actions.map((a, i) => ({
          automation_id: automationId,
          position: i,
          action_type: a.action_type,
          action_config: a.action_config,
        }));
        const { error } = await (supabase as any).from("automation_actions").insert(rows);
        if (error) throw error;
      }
      toast.success("Automatización guardada");
      navigate("/automations");
    } catch (e: any) {
      toast.error(e.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <PageBanner
        title={isEdit ? "Editar automatización" : "Nueva automatización"}
        description="Configura el disparador, las condiciones y las acciones."
      >
        <Button variant="outline" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4" /> Cancelar
        </Button>
      </PageBanner>

      <Stepper current={step} onJump={setStep} />

      <Card className="p-6 mt-4">
        {step === 1 && <AutomationStepConfig draft={draft} onChange={updateDraft} />}
        {step === 2 && <AutomationStepTrigger draft={draft} onChange={updateDraft} />}
        {step === 3 && <AutomationStepConditions draft={draft} onChange={updateDraft} />}
        {step === 4 && (
          <div className="space-y-4">
            <Accordion type="single" collapsible>
              <AccordionItem value="summary">
                <AccordionTrigger>Resumen de configuración</AccordionTrigger>
                <AccordionContent>
                  <Summary draft={draft} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            <Separator />
            <AutomationStepActions actions={actions} onChange={updateActions} />
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between mt-4">
        <Button variant="outline" disabled={step === 1} onClick={() => setStep(step - 1)}>
          Anterior
        </Button>
        {step < 4 ? (
          <Button disabled={!canNext} onClick={() => setStep(step + 1)}>Siguiente</Button>
        ) : (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar automatización"}
          </Button>
        )}
      </div>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar cambios?</AlertDialogTitle>
            <AlertDialogDescription>
              Tienes cambios sin guardar. ¿Quieres salir de todas formas?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate(-1)}>Descartar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stepper({ current, onJump }: { current: number; onJump: (s: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const done = current > s.id;
        const active = current === s.id;
        return (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <button
              type="button"
              onClick={() => onJump(s.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active && "bg-primary text-primary-foreground",
                !active && done && "text-primary",
                !active && !done && "text-muted-foreground",
              )}
            >
              <span className={cn(
                "h-6 w-6 rounded-full border flex items-center justify-center text-xs",
                active && "border-primary-foreground",
                done && "bg-primary text-primary-foreground border-primary",
              )}>
                {done ? <Check className="h-3 w-3" /> : s.id}
              </span>
              {s.label}
            </button>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

function Summary({ draft }: { draft: AutomationDraft }) {
  const items = draft.conditions?.items || [];
  return (
    <div className="space-y-2 text-sm">
      <div>
        <span className="text-muted-foreground">Disparador: </span>
        <Badge variant="outline">{triggerLabel(draft.trigger_type) || "—"}</Badge>
      </div>
      <div>
        <span className="text-muted-foreground">Condiciones: </span>
        {items.length === 0 ? (
          <span>Sin condiciones</span>
        ) : (
          <span>
            {items.length} {items.length === 1 ? "condición" : "condiciones"} ({draft.conditions.logic})
          </span>
        )}
      </div>
    </div>
  );
}

// Re-export to satisfy linter on unused import
export const _used = actionLabel;