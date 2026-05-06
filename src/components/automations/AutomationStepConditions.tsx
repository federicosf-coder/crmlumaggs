import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AutomationDraft, FILTER_FIELDS_BY_ENTITY, OPERATORS_BY_TYPE, type Condition,
} from "./types";

export function AutomationStepConditions({
  draft, onChange,
}: {
  draft: AutomationDraft;
  onChange: (patch: Partial<AutomationDraft>) => void;
}) {
  const fields = FILTER_FIELDS_BY_ENTITY[draft.entity_type] || [];
  const items = draft.conditions?.items ?? [];
  const logic = draft.conditions?.logic ?? "AND";

  const setItems = (next: Condition[]) =>
    onChange({ conditions: { logic, items: next } });
  const setLogic = (l: "AND" | "OR") =>
    onChange({ conditions: { logic: l, items } });

  const addCondition = () => {
    const first = fields[0];
    setItems([
      ...items,
      { field: first?.value ?? "", operator: "eq", value: "" },
    ]);
  };

  const update = (idx: number, patch: Partial<Condition>) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    setItems(next);
  };

  const remove = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  if (fields.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4 border rounded-lg">
        No hay campos filtrables para esta entidad. La automatización se ejecutará siempre que ocurra el disparador.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Sin condiciones: la automatización se ejecuta siempre que ocurra el disparador.
        </p>
      )}

      {items.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Combinar con:</span>
          <Select value={logic} onValueChange={(v) => setLogic(v as any)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="AND">Y (AND)</SelectItem>
              <SelectItem value="OR">O (OR)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        {items.map((c, idx) => {
          const fieldDef = fields.find((f) => f.value === c.field) ?? fields[0];
          const ops = OPERATORS_BY_TYPE[fieldDef.type] || [];
          const opDef = ops.find((o) => o.value === c.operator);
          return (
            <div key={idx} className="flex flex-wrap items-center gap-2 p-3 border rounded-md">
              <Select
                value={c.field}
                onValueChange={(v) => {
                  const newField = fields.find((f) => f.value === v);
                  const newOps = OPERATORS_BY_TYPE[newField?.type ?? "text"];
                  update(idx, { field: v, operator: newOps[0].value, value: "" });
                }}
              >
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {fields.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={c.operator} onValueChange={(v) => update(idx, { operator: v })}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ops.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {!opDef?.noValue && (
                <Input
                  className="w-56"
                  type={fieldDef.type === "number" ? "number" : "text"}
                  value={c.value ?? ""}
                  onChange={(e) => update(idx, { value: e.target.value })}
                  placeholder="Valor"
                />
              )}

              <Button size="icon" variant="ghost" onClick={() => remove(idx)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>

      <Button variant="outline" onClick={addCondition}>
        <Plus className="h-4 w-4" /> Agregar condición
      </Button>
    </div>
  );
}