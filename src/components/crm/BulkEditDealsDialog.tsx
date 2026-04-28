import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import type { CrmDeal } from "@/hooks/useCrmDeals";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDeals: CrmDeal[];
  marca: string;
  onSuccess?: () => void;
}

export function BulkEditDealsDialog({ open, onOpenChange, selectedDeals, marca, onSuccess }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [updPipeline, setUpdPipeline] = useState(false);
  const [updStage, setUpdStage] = useState(false);
  const [updClose, setUpdClose] = useState(false);
  const [updOwner, setUpdOwner] = useState(false);

  const [pipelineId, setPipelineId] = useState<string>("");
  const [stageId, setStageId] = useState<string>("");
  const [closeDate, setCloseDate] = useState<string>("");
  const [ownerId, setOwnerId] = useState<string>("");

  const [confirmStep, setConfirmStep] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setUpdPipeline(false); setUpdStage(false); setUpdClose(false); setUpdOwner(false);
      setPipelineId(""); setStageId(""); setCloseDate(""); setOwnerId("");
      setConfirmStep(false); setSaving(false);
    }
  }, [open]);

  const { data: pipelines = [] } = useQuery({
    queryKey: ["bulk_pipelines", marca],
    queryFn: async () => {
      const { data } = await supabase.from("crm_pipelines").select("id, nombre, marca, pipeline_type").eq("marca", marca).order("nombre");
      return data || [];
    },
    enabled: open,
  });

  const effectivePipelineId = updPipeline ? pipelineId : "";
  const { data: stages = [] } = useQuery({
    queryKey: ["bulk_pipeline_stages", effectivePipelineId],
    queryFn: async () => {
      if (!effectivePipelineId) return [];
      const { data } = await supabase.from("crm_pipeline_stages").select("id, name, position").eq("pipeline_id", effectivePipelineId).order("position");
      return data || [];
    },
    enabled: open && !!effectivePipelineId,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["bulk_profiles_active"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, email").eq("is_active", true).order("full_name");
      return data || [];
    },
    enabled: open && updOwner,
  });

  const anyChecked = updPipeline || updStage || updClose || updOwner;

  const validate = (): string | null => {
    if (!anyChecked) return "Marca al menos un campo para actualizar";
    if (updPipeline && !pipelineId) return "Selecciona un pipeline";
    if (updStage && !stageId && !updPipeline) return "Selecciona una etapa";
    return null;
  };

  const handleApply = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    if (!confirmStep) { setConfirmStep(true); return; }

    setSaving(true);
    let okCount = 0;
    const errors: string[] = [];

    // Resolve final pipeline/stage
    let finalStageId = updStage ? stageId : "";
    if (updPipeline && !finalStageId) {
      finalStageId = (stages[0]?.id as string) || "";
      if (!finalStageId) {
        toast.error("El pipeline seleccionado no tiene etapas");
        setSaving(false);
        return;
      }
    }

    for (const deal of selectedDeals) {
      const updates: Record<string, any> = {};
      const logs: Array<{ field: string; oldV: any; newV: any }> = [];
      if (updPipeline && pipelineId !== deal.pipeline_id) {
        updates.pipeline_id = pipelineId;
        logs.push({ field: "pipeline_id", oldV: deal.pipeline_id, newV: pipelineId });
      }
      if ((updStage || updPipeline) && finalStageId && finalStageId !== deal.stage_id) {
        updates.stage_id = finalStageId;
        logs.push({ field: "stage_id", oldV: deal.stage_id, newV: finalStageId });
      }
      if (updClose) {
        const v = closeDate || null;
        if (v !== deal.close_date) {
          updates.close_date = v;
          logs.push({ field: "close_date", oldV: deal.close_date, newV: v });
        }
      }
      if (updOwner) {
        const v = ownerId || null;
        if (v !== deal.owner_id) {
          updates.owner_id = v;
          logs.push({ field: "owner_id", oldV: deal.owner_id, newV: v });
        }
      }
      if (Object.keys(updates).length === 0) { okCount++; continue; }

      const { error } = await supabase.from("crm_deals").update(updates).eq("id", deal.id);
      if (error) {
        errors.push(`${deal.title}: ${error.message}`);
      } else {
        okCount++;
        if (logs.length > 0 && user?.id) {
          await supabase.from("crm_deal_change_logs" as any).insert(
            logs.map(l => ({
              deal_id: deal.id,
              user_id: user.id,
              field_name: l.field,
              old_value: l.oldV != null ? String(l.oldV) : null,
              new_value: l.newV != null ? String(l.newV) : null,
              action: "bulk_update",
            }))
          );
        }
      }
    }

    setSaving(false);
    qc.invalidateQueries({ queryKey: ["crm_deals"] });
    qc.invalidateQueries({ queryKey: ["crm_pipelines"] });

    if (errors.length === 0) {
      toast.success(`${okCount} negocio(s) actualizados`);
      onOpenChange(false);
      onSuccess?.();
    } else {
      toast.error(`${okCount} actualizados, ${errors.length} con error`);
      console.error("Bulk edit errors:", errors);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edición masiva — {selectedDeals.length} negocio(s)</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Marca los campos a modificar. Solo esos campos se actualizarán.
        </p>

        <div className="space-y-4 mt-2">
          {/* Pipeline */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Checkbox checked={updPipeline} onCheckedChange={(v) => setUpdPipeline(!!v)} id="upd-pipeline" />
              <Label htmlFor="upd-pipeline" className="cursor-pointer">Embudo / Pipeline</Label>
            </div>
            {updPipeline && (
              <Select value={pipelineId} onValueChange={(v) => { setPipelineId(v); setStageId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecciona pipeline" /></SelectTrigger>
                <SelectContent>
                  {pipelines.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Stage */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Checkbox checked={updStage} onCheckedChange={(v) => setUpdStage(!!v)} id="upd-stage" disabled={updPipeline && !pipelineId} />
              <Label htmlFor="upd-stage" className="cursor-pointer">Etapa / Estatus</Label>
            </div>
            {(updStage || (updPipeline && pipelineId)) && (
              <Select value={stageId} onValueChange={setStageId} disabled={updPipeline && !pipelineId}>
                <SelectTrigger>
                  <SelectValue placeholder={updPipeline && !stageId ? "Primera etapa del nuevo pipeline" : "Selecciona etapa"} />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {updPipeline && !updStage && (
              <p className="text-[11px] text-muted-foreground">Si no eliges etapa, se asignará la primera del pipeline.</p>
            )}
          </div>

          {/* Close date */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Checkbox checked={updClose} onCheckedChange={(v) => setUpdClose(!!v)} id="upd-close" />
              <Label htmlFor="upd-close" className="cursor-pointer">Fecha de cierre</Label>
            </div>
            {updClose && (
              <Input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
            )}
          </div>

          {/* Owner */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Checkbox checked={updOwner} onCheckedChange={(v) => setUpdOwner(!!v)} id="upd-owner" />
              <Label htmlFor="upd-owner" className="cursor-pointer">Ejecutivo</Label>
            </div>
            {updOwner && (
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger><SelectValue placeholder="Selecciona ejecutivo" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p: any) => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {confirmStep && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              Vas a modificar <b>{selectedDeals.length}</b> negocio(s). ¿Deseas continuar?
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleApply} disabled={saving || !anyChecked}>
            {saving ? "Guardando..." : confirmStep ? "Sí, aplicar" : "Aplicar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}