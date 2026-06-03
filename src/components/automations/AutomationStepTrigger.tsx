import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase as _supabaseTyped } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _supabaseTyped;
import { cn } from "@/lib/utils";
import {
  TRIGGER_GROUPS, DATE_FIELDS_BY_ENTITY, type AutomationDraft,
} from "./types";
import { AvailableFieldsDialog, FieldPickerDialog, getFieldOptions } from "./AvailableFieldsDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EXISTING_BUTTONS, type ExistingButton } from "./existingButtonsCatalog";
import { detectButtonsFromSource, mergeButtons } from "./detectButtons";
import { ArrowUp, ArrowDown, ArrowUpDown, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

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
    setStages([]);
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
            entityType: draft.entity_type,
          })}
        </Card>
      )}
    </div>
  );
}

function defaultConfigFor(trigger: string): Record<string, any> {
  switch (trigger) {
    case "existing_button_click":
      return { button_id: "", location: "" };
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
  trigger, config, setConfig, stages, dateFields, entityType,
}: {
  trigger: string;
  config: Record<string, any>;
  setConfig: (p: Record<string, any>) => void;
  stages: { id: string; name: string }[];
  dateFields: { value: string; label: string }[];
  entityType: import("./types").EntityType;
}) {
  switch (trigger) {
    case "existing_button_click":
      return <ExistingButtonPicker config={config} setConfig={setConfig} />;
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
          <FieldPickerDialog entityType={entityType} value={config.field_name} onChange={(v) => setConfig({ field_name: v })} />
          <ValueField label="Valor anterior (opcional)" field={config.field_name} value={config.old_value} onChange={(v) => setConfig({ old_value: v })} />
          <ValueField label="Valor nuevo (opcional)" field={config.field_name} value={config.new_value} onChange={(v) => setConfig({ new_value: v })} />
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
          <div>
            <Label>Campo de estatus</Label>
            <SelectField
              value={config.field_name}
              onChange={(v) => setConfig({ field_name: v, from_value: "", to_value: "" })}
              options={[
                { value: "estatus_cotizacion", label: "Estatus Cotización" },
                { value: "estatus_pedido", label: "Estatus Pedido" },
                { value: "estatus_factura", label: "Estatus Factura" },
                { value: "estatus_entrega_corporativa", label: "Estatus Entrega" },
                { value: "estatus_pago", label: "Estatus Pago" },
                { value: "estatus_tarea", label: "Estatus Tarea/Actividad" },
              ]}
            />
          </div>
          <ValueField label="Valor anterior" field={config.field_name} value={config.from_value} onChange={(v) => setConfig({ from_value: v })} />
          <ValueField label="Valor nuevo" field={config.field_name} value={config.to_value} onChange={(v) => setConfig({ to_value: v })} />
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
          <FieldPickerDialog entityType={entityType} value={config.field_name} onChange={(v) => setConfig({ field_name: v })} />
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

function ValueField({
  label, field, value, onChange,
}: {
  label: string;
  field?: string;
  value: any;
  onChange: (v: string) => void;
}) {
  const options = getFieldOptions(field);
  if (options) {
    return (
      <div>
        <Label>{label}</Label>
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  return <TextField label={label} value={value} onChange={onChange} />;
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

function ExistingButtonPicker({
  config, setConfig,
}: {
  config: Record<string, any>;
  setConfig: (p: Record<string, any>) => void;
}) {
  const [buttons, setButtons] = useState<ExistingButton[]>(EXISTING_BUTTONS);
  const selected = buttons.find((b) => b.id === config.button_id);
  const [sortBy, setSortBy] = useState<"name" | "location" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const handleAutoDetect = () => {
    const detected = detectButtonsFromSource();
    const merged = mergeButtons(EXISTING_BUTTONS, detected);
    const added = merged.length - buttons.length;
    setButtons(merged);
    toast.success(
      added > 0
        ? `${added} botón(es) nuevo(s) detectado(s)`
        : "No se encontraron botones nuevos",
    );
  };
  const toggleSort = (col: "name" | "location") => {
    if (sortBy !== col) { setSortBy(col); setSortDir("asc"); return; }
    if (sortDir === "asc") { setSortDir("desc"); return; }
    setSortBy(null);
  };
  const sorted = [...buttons].sort((a, b) => {
    if (!sortBy) return 0;
    const av = (a as any)[sortBy] as string;
    const bv = (b as any)[sortBy] as string;
    const cmp = av.localeCompare(bv, "es", { sensitivity: "base" });
    return sortDir === "asc" ? cmp : -cmp;
  });
  const SortIcon = ({ col }: { col: "name" | "location" }) => {
    if (sortBy !== col) return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />;
    return sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
  };
  return (
    <div className="space-y-2">
      <Label>Botón existente</Label>
      <div className="flex items-center gap-2">
        <div className="flex-1 text-sm">
          {selected ? (
            <span>
              <span className="font-medium">{selected.name}</span>
              <span className="text-muted-foreground"> — {selected.location}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Ningún botón seleccionado.</span>
          )}
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              {selected ? "Cambiar" : "Seleccionar botón"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between gap-2">
                <span>Botones disponibles en la aplicación</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAutoDetect}
                  className="mr-6"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Actializar botones
                </Button>
              </DialogTitle>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:text-foreground"
                      onClick={() => toggleSort("name")}
                    >
                      Nombre <SortIcon col="name" />
                    </button>
                  </TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:text-foreground"
                      onClick={() => toggleSort("location")}
                    >
                      Ubicación <SortIcon col="location" />
                    </button>
                  </TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((b) => (
                  <TableRow key={b.id} className={config.button_id === b.id ? "bg-primary/5" : ""}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{b.description}</TableCell>
                    <TableCell className="text-sm">{b.location}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DialogTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            variant={config.button_id === b.id ? "default" : "outline"}
                            onClick={() =>
                              setConfig({ button_id: b.id, button_name: b.name, location: b.location })
                            }
                          >
                            {config.button_id === b.id ? "Elegido" : "Elegir"}
                          </Button>
                        </DialogTrigger>
                        {b.path && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            title="Abrir en nueva ventana"
                            onClick={() => window.open(b.path, "_blank", "noopener,noreferrer")}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}