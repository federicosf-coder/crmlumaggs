import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Filter, Plus, X } from "lucide-react";

export type ColumnFilterType = "text" | "number" | "date" | "select";

export interface ColumnFilterDef {
  key: string;
  label: string;
  type: ColumnFilterType;
  options?: { value: string; label: string }[];
}

export type Operator =
  | "contains" | "equals" | "not_equals"
  | "gt" | "gte" | "lt" | "lte"
  | "between" | "is_empty" | "is_not_empty";

export interface ColumnFilterCondition {
  id: string;
  column: string;
  operator: Operator;
  value: string;
  value2?: string; // for between
}

const OPERATORS_BY_TYPE: Record<ColumnFilterType, { value: Operator; label: string }[]> = {
  text: [
    { value: "contains", label: "contiene" },
    { value: "equals", label: "es igual a" },
    { value: "not_equals", label: "es distinto de" },
    { value: "is_empty", label: "está vacío" },
    { value: "is_not_empty", label: "no está vacío" },
  ],
  number: [
    { value: "equals", label: "=" },
    { value: "not_equals", label: "≠" },
    { value: "gt", label: ">" },
    { value: "gte", label: "≥" },
    { value: "lt", label: "<" },
    { value: "lte", label: "≤" },
    { value: "between", label: "entre" },
    { value: "is_empty", label: "está vacío" },
    { value: "is_not_empty", label: "no está vacío" },
  ],
  date: [
    { value: "equals", label: "es" },
    { value: "gt", label: "después de" },
    { value: "lt", label: "antes de" },
    { value: "between", label: "entre" },
    { value: "is_empty", label: "sin fecha" },
    { value: "is_not_empty", label: "con fecha" },
  ],
  select: [
    { value: "equals", label: "es" },
    { value: "not_equals", label: "no es" },
    { value: "is_empty", label: "está vacío" },
    { value: "is_not_empty", label: "no está vacío" },
  ],
};

function newCondition(columns: ColumnFilterDef[]): ColumnFilterCondition {
  const first = columns[0];
  const op = OPERATORS_BY_TYPE[first.type][0].value;
  return { id: crypto.randomUUID(), column: first.key, operator: op, value: "" };
}

interface Props {
  columns: ColumnFilterDef[];
  conditions: ColumnFilterCondition[];
  onChange: (conditions: ColumnFilterCondition[]) => void;
  combinator: "AND" | "OR";
  onCombinatorChange: (c: "AND" | "OR") => void;
  triggerLabel?: string;
}

export function ColumnFilterBuilder({ 
  columns, 
  conditions, 
  onChange, 
  combinator, 
  onCombinatorChange,
  triggerLabel = "Filtros por columna"
}: Props) {
  const [open, setOpen] = useState(false);
  const activeCount = conditions.filter((c) => c.value !== "" || c.operator === "is_empty" || c.operator === "is_not_empty").length;

  const update = (id: string, patch: Partial<ColumnFilterCondition>) => {
    onChange(conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };
  const remove = (id: string) => onChange(conditions.filter((c) => c.id !== id));
  const add = () => onChange([...conditions, newCondition(columns)]);
  const clear = () => onChange([]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Filtros por columna
          {activeCount > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{activeCount}</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[640px] max-w-[95vw] p-4" align="start">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Combinar con:</Label>
            <Select value={combinator} onValueChange={(v) => onCombinatorChange(v as "AND" | "OR")}>
              <SelectTrigger className="h-7 w-[80px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">Y</SelectItem>
                <SelectItem value="OR">O</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {conditions.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clear}>Limpiar todo</Button>
          )}
        </div>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {conditions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Sin filtros. Haz clic en "Agregar filtro" para comenzar.
            </p>
          )}
          {conditions.map((cond) => {
            const colDef = columns.find((c) => c.key === cond.column) || columns[0];
            const ops = OPERATORS_BY_TYPE[colDef.type];
            const needsValue = cond.operator !== "is_empty" && cond.operator !== "is_not_empty";
            const isBetween = cond.operator === "between";
            return (
              <div key={cond.id} className="flex items-start gap-1.5">
                <Select
                  value={cond.column}
                  onValueChange={(v) => {
                    const newCol = columns.find((c) => c.key === v)!;
                    const validOp = OPERATORS_BY_TYPE[newCol.type][0].value;
                    update(cond.id, { column: v, operator: validOp, value: "", value2: "" });
                  }}
                >
                  <SelectTrigger className="h-9 flex-1 min-w-0 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {columns.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select
                  value={cond.operator}
                  onValueChange={(v) => update(cond.id, { operator: v as Operator, value: "", value2: "" })}
                >
                  <SelectTrigger className="h-9 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ops.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {needsValue && (
                  <div className="flex-1 min-w-0 flex gap-1">
                    {colDef.type === "select" && colDef.options ? (
                      <Select value={cond.value} onValueChange={(v) => update(cond.id, { value: v })}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Valor" /></SelectTrigger>
                        <SelectContent>
                          {colDef.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={colDef.type === "date" ? "date" : colDef.type === "number" ? "number" : "text"}
                        value={cond.value}
                        onChange={(e) => update(cond.id, { value: e.target.value })}
                        className="h-9 text-xs"
                        placeholder="Valor"
                      />
                    )}
                    {isBetween && (
                      <Input
                        type={colDef.type === "date" ? "date" : "number"}
                        value={cond.value2 || ""}
                        onChange={(e) => update(cond.id, { value2: e.target.value })}
                        className="h-9 text-xs"
                        placeholder="y"
                      />
                    )}
                  </div>
                )}
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => remove(cond.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center mt-3 pt-3 border-t">
          <Button variant="outline" size="sm" onClick={add}>
            <Plus className="h-4 w-4 mr-1" /> Agregar filtro
          </Button>
          <Button size="sm" onClick={() => setOpen(false)}>Aplicar</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Evaluador genérico
export function evaluateConditions<T>(
  rows: T[],
  conditions: ColumnFilterCondition[],
  combinator: "AND" | "OR",
  getValue: (row: T, columnKey: string) => any,
): T[] {
  const active = conditions.filter((c) =>
    c.value !== "" || c.operator === "is_empty" || c.operator === "is_not_empty"
  );
  if (active.length === 0) return rows;

  const matchOne = (row: T, cond: ColumnFilterCondition): boolean => {
    const raw = getValue(row, cond.column);
    if (cond.operator === "is_empty") return raw === null || raw === undefined || raw === "";
    if (cond.operator === "is_not_empty") return !(raw === null || raw === undefined || raw === "");
    if (raw === null || raw === undefined) return false;

    const isNum = typeof raw === "number" || (!isNaN(Number(raw)) && !isNaN(Number(cond.value)) && cond.value !== "");
    const isDate = typeof raw === "string" && /^\d{4}-\d{2}-\d{2}/.test(raw);

    if (isDate || cond.operator === "between" && cond.value2) {
      const a = isDate ? new Date(raw as string).getTime() : Number(raw);
      const b = isDate ? new Date(cond.value).getTime() : Number(cond.value);
      const c2 = cond.value2 ? (isDate ? new Date(cond.value2).getTime() : Number(cond.value2)) : null;
      switch (cond.operator) {
        case "equals": return new Date(raw as string).toDateString() === new Date(cond.value).toDateString();
        case "gt": return a > b;
        case "gte": return a >= b;
        case "lt": return a < b;
        case "lte": return a <= b;
        case "between": return c2 !== null && a >= b && a <= c2;
      }
    }

    if (isNum && ["gt","gte","lt","lte","between","equals","not_equals"].includes(cond.operator)) {
      const a = Number(raw);
      const b = Number(cond.value);
      switch (cond.operator) {
        case "equals": return a === b;
        case "not_equals": return a !== b;
        case "gt": return a > b;
        case "gte": return a >= b;
        case "lt": return a < b;
        case "lte": return a <= b;
        case "between": return cond.value2 !== undefined && a >= b && a <= Number(cond.value2);
      }
    }

    const s = String(raw).toLowerCase();
    const v = String(cond.value).toLowerCase();
    switch (cond.operator) {
      case "contains": return s.includes(v);
      case "equals": return s === v;
      case "not_equals": return s !== v;
    }
    return false;
  };

  return rows.filter((row) => {
    if (combinator === "AND") return active.every((c) => matchOne(row, c));
    return active.some((c) => matchOne(row, c));
  });
}