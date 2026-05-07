import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  TOMADOR_DECISION_OPTIONS,
  RIESGO_OPTIONS,
  ORIGEN_CONTACTO_OPTIONS,
  EVALUACION_OPTIONS,
  ROL_LUBRICANTE_OPTIONS,
} from "@/components/CompanyFormDialog";

interface Props { companyId: string }

export function CompanyProcesoDecisionBlock({ companyId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: company } = useQuery({
    queryKey: ["company-proceso-decision", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, tomador_decision, riesgo_cambio_marca, origen_contacto, evaluacion_lubricante, rol_lubricante")
        .eq("id", companyId)
        .maybeSingle();
      return data;
    },
  });

  const update = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.from("companies").update(patch).eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-proceso-decision", companyId] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const Field = ({ label, value, field, options }: { label: string; value: string | null | undefined; field: string; options: string[] }) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value || ""} onValueChange={(v) => update.mutate({ [field]: v || null })}>
        <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-primary">
        <Users className="h-3.5 w-3.5" /> Proceso de Decisión
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Tomador de decisión" value={company?.tomador_decision} field="tomador_decision" options={TOMADOR_DECISION_OPTIONS} />
        <Field label="Riesgo cambio de marca" value={company?.riesgo_cambio_marca} field="riesgo_cambio_marca" options={RIESGO_OPTIONS} />
        <Field label="Origen contacto" value={company?.origen_contacto} field="origen_contacto" options={ORIGEN_CONTACTO_OPTIONS} />
        <Field label="Evaluación lubricante" value={company?.evaluacion_lubricante} field="evaluacion_lubricante" options={EVALUACION_OPTIONS} />
        <Field label="Rol del lubricante" value={company?.rol_lubricante} field="rol_lubricante" options={ROL_LUBRICANTE_OPTIONS} />
      </div>
    </Card>
  );
}