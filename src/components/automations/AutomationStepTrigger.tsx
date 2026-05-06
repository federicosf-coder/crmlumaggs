import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  TRIGGER_GROUPS, DATE_FIELDS_BY_ENTITY, type AutomationDraft,
} from "./types";
import { AvailableFieldsDialog } from "./AvailableFieldsDialog";

const BUTTON_ICONS = ["Send", "Mail", "Phone", "Check", "X", "Star", "Bell", "Zap", "ArrowRight"];
const BUTTON_COLORS = ["default", "blue", "green", "red", "orange"];

export function AutomationStepTrigger({
  draft, onChange,
}: {
  draft: AutomationDraft;
  onChange: (patch: Partial<AutomationDraft>) => void;
}) {
  const setTrigger = (trigger_type: string) => {
    onChange({ trigger_type, trigger_config: defaultConfigFor(trigger_type) });
  };
  const setConfig = (patch: Record<string, any>) => {
    onChange({ trigger_config: { ...draft.trigger_config, ...patch } });
  };

  const [stages, setStages] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (draft.trigger_type !== "on_stage_change") return;
    (async () => {
      const { data: pipelines } = await (supabase as any)
        .from("crm_pipelines")
        .select("id,nombre,marca,pipeline_type");
      const { data: stagesData } = await (supabase as any)
        .from("crm_pipeline_stages")
        .select("id,name,position,pipeline_id")
        .order("position");
      const pipMap = new Map<string, string>();
      (pipelines || []).forEach((p: any) => {
        const marca = p.marca === "chevron" ? "Chevron" : p.marca === "phillips66" ? "Phillips 66" : p.marca;
        const tipo = p.pipeline_type === "primera_compra" ? "Primera Compra" : p.pipeline_type === "recompra" ? "Recompra" : "";
        pipMap.set(p.id, [marca, tipo].filter(Boolean).join(" "));
      });
      setStages(
        (stagesData || []).map((s: any) => ({
          id: s.id,
          name: pipMap.get(s.pipeline_id) ? `${s.name} - ${pipMap.get(s.pipeline_id)}` : s.name,
        })),
      );
    })();
  }, [draft.trigger_type]);

  const dateFields = DATE_FIELDS_BY_ENTITY[draft.entity_type] || [];

  return (
    <div className="space-y-6">
      {TRIGGER_GROUPS.map((group) => (
        <div key={group.label}>
          <h3 className="text-sm font-semibold mb-2 text-muted-foreground">{group.label}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {group.triggers.map((t) => {
              const selected = draft.trigger_type === t.value;
              return (
                <Card
                  key={t.value}
                  onClick={() => setTrigger(t.value)}
                  className={cn(
                    "p-3 cursor-pointer hover:border-primary transition-colors",
                    selected && "border-primary bg-primary/5",
                  )}
                >
                  <p className="text-sm font-medium">{t.label}</p>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {draft.trigger_type && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Configuración del disparador</p>
            <AvailableFieldsDialog entityType={draft.entity_type} />
          </div>
          {renderConfig({
            trigger: draft.trigger_type,
            config: draft.trigger_config,
            setConfig,
            stages,
            dateFields,
          })}
        </Card>
      )}
    </div>
  );
}

function defaultConfigFor(trigger: string): Record<string, any> {
  switch (trigger) {
    case "existing_button_click":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TextField
            label="Identificador del botón"
            value={config.button_id}
            onChange={(v) => setConfig({ button_id: v })}
          />
          <TextField
            label="Ubicación / pantalla (opcional)"
            value={config.location}
            onChange={(v) => setConfig({ location: v })}
          />
        </div>
      );
    case "button_click":
      return { button_label: "Ejecutar", button_icon: "Send", button_color: "default" };
    case "date_reached":
    case "days_before_date":
    case "days_after_date":
      return { time_of_day: "07:00", days: 1 };
    case "deal_stalled":
      return { days: 7, time_of_day: "07:00" };
    case "month_start":
    case "month_end":
    case "daily_at_time":
      return { time_of_day: "07:00" };
    case "month_day":
      return { day: 1, time_of_day: "07:00" };
    case "field_value_reaches":
      return { operator: "mayor_que" };
    default:
      return {};
  }
}

function renderConfig({
  trigger, config, setConfig, stages, dateFields,
}: {
  trigger: string;
  config: Record<string, any>;
  setConfig: (p: Record<string, any>) => void;
  stages: { id: string; name: string }[];
  dateFields: { value: string; label: string }[];
}) {
  switch (trigger) {
    case "button_click":
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Texto del botón</Label>
            <Input value={config.button_label || ""} onChange={(e) => setConfig({ button_label: e.target.value })} />
          </div>
          <div>
            <Label>Ícono</Label>
            <SelectField value={config.button_icon} onChange={(v) => setConfig({ button_icon: v })} options={BUTTON_ICONS} />
          </div>
          <div>
            <Label>Color</Label>
            <SelectField value={config.button_color} onChange={(v) => setConfig({ button_color: v })} options={BUTTON_COLORS} />
          </div>
        </div>
      );
    case "on_save":
    case "on_create":
      return <p className="text-sm text-muted-foreground">No requiere configuración adicional.</p>;
    case "on_field_change":
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <TextField label="Campo" value={config.field_name} onChange={(v) => setConfig({ field_name: v })} />
          <TextField label="Valor anterior (opcional)" value={config.old_value} onChange={(v) => setConfig({ old_value: v })} />
          <TextField label="Valor nuevo (opcional)" value={config.new_value} onChange={(v) => setConfig({ new_value: v })} />
        </div>
      );
    case "on_stage_change":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Desde etapa (opcional)</Label>
            <SelectField
              value={config.from_stage_id || "__any__"}
              onChange={(v) => setConfig({ from_stage_id: v === "__any__" ? null : v })}
              options={[{ value: "__any__", label: "Cualquiera" }, ...stages.map((s) => ({ value: s.id, label: s.name }))]}
            />
          </div>
          <div>
            <Label>Hacia etapa (opcional)</Label>
            <SelectField
              value={config.to_stage_id || "__any__"}
              onChange={(v) => setConfig({ to_stage_id: v === "__any__" ? null : v })}
              options={[{ value: "__any__", label: "Cualquiera" }, ...stages.map((s) => ({ value: s.id, label: s.name }))]}
            />
          </div>
        </div>
      );
    case "on_status_change":
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <TextField label="Campo" value={config.field_name} onChange={(v) => setConfig({ field_name: v })} />
          <TextField label="Valor anterior" value={config.from_value} onChange={(v) => setConfig({ from_value: v })} />
          <TextField label="Valor nuevo" value={config.to_value} onChange={(v) => setConfig({ to_value: v })} />
        </div>
      );
    case "date_reached":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <DateFieldSelect value={config.date_field} onChange={(v) => setConfig({ date_field: v })} options={dateFields} />
          <TimeField value={config.time_of_day} onChange={(v) => setConfig({ time_of_day: v })} />
        </div>
      );
    case "days_before_date":
    case "days_after_date":
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <NumberField label="Días" value={config.days} min={1} max={90} onChange={(v) => setConfig({ days: v })} />
          <DateFieldSelect value={config.date_field} onChange={(v) => setConfig({ date_field: v })} options={dateFields} />
          <TimeField value={config.time_of_day} onChange={(v) => setConfig({ time_of_day: v })} />
        </div>
      );
    case "deal_stalled":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <NumberField label="Días sin movimiento" value={config.days} min={1} onChange={(v) => setConfig({ days: v })} />
          <TimeField value={config.time_of_day} onChange={(v) => setConfig({ time_of_day: v })} />
        </div>
      );
    case "month_start":
    case "month_end":
    case "daily_at_time":
      return <TimeField value={config.time_of_day} onChange={(v) => setConfig({ time_of_day: v })} />;
    case "month_day":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <NumberField label="Día del mes (1-28)" value={config.day} min={1} max={28} onChange={(v) => setConfig({ day: v })} />
          <TimeField value={config.time_of_day} onChange={(v) => setConfig({ time_of_day: v })} />
        </div>
      );
    case "field_value_reaches":
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <TextField label="Campo" value={config.field_name} onChange={(v) => setConfig({ field_name: v })} />
          <div>
            <Label>Operador</Label>
            <SelectField
              value={config.operator}
              onChange={(v) => setConfig({ operator: v })}
              options={[
                { value: "mayor_que", label: "Mayor que" },
                { value: "igual_a", label: "Igual a" },
                { value: "menor_que", label: "Menor que" },
              ]}
            />
          </div>
          <NumberField label="Valor" value={config.value} onChange={(v) => setConfig({ value: v })} />
        </div>
      );
    default:
      return null;
  }
}

function TextField({ label, value, onChange }: { label: string; value: any; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: any; min?: number; max?: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type="number" min={min} max={max} value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function TimeField({ value, onChange }: { value: any; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>Hora del día</Label>
      <Input type="time" value={value || "07:00"} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function DateFieldSelect({ value, onChange, options }: { value: any; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <Label>Campo de fecha</Label>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No hay campos de fecha para esta entidad.</p>
      ) : (
        <SelectField value={value} onChange={onChange} options={options} />
      )}
    </div>
  );
}

function SelectField({
  value, onChange, options,
}: {
  value: any;
  onChange: (v: string) => void;
  options: (string | { value: string; label: string })[];
}) {
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <Select value={value || ""} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
      <SelectContent>
        {opts.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}