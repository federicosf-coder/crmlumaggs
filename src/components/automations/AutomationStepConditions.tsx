import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  SelectGroup, SelectLabel,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { supabase } from "@/integrations/supabase/client";
import {
  AutomationDraft, GROUPED_FILTER_FIELDS, OPERATORS_BY_TYPE, findGroupedField,
  type Condition, type FieldDef,
} from "./types";
import { FIELD_OPTIONS } from "./AvailableFieldsDialog";

function getOptionsForField(fieldValue: string) {
  const key = fieldValue.includes(".") ? fieldValue.split(".")[1] : fieldValue;
  return FIELD_OPTIONS[key] || null;
}

type RemoteSource = "companies" | "contacts" | "products" | "users";

function getRemoteSource(fieldValue: string): RemoteSource | null {
  // Fields that reference a company record
  if (
    fieldValue === "document.company_id" ||
    fieldValue === "deal.company_id" ||
    fieldValue === "company.name" ||
    fieldValue === "company.razon_social" ||
    fieldValue === "company.id_contpaq"
  ) return "companies";
  // Fields that reference a contact record
  if (
    fieldValue === "document.contact_id" ||
    fieldValue === "deal.contact_id" ||
    fieldValue === "contact.first_name" ||
    fieldValue === "contact.last_name" ||
    fieldValue === "contact.email"
  ) return "contacts";
  if (fieldValue === "product.codigo" || fieldValue === "product.nombre_producto") return "products";
  if (fieldValue === "user.full_name" || fieldValue === "user.email") return "users";
  return null;
}

function RemotePicker({
  source, fieldValue, value, onChange,
}: {
  source: RemoteSource;
  fieldValue: string;
  value: any;
  onChange: (v: string) => void;
}) {
  const [options, setOptions] = useState<{ value: string; label: string; searchText?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [customMode, setCustomMode] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        if (source === "companies") {
          const { data } = await supabase
            .from("companies")
            .select("id, name, razon_social, id_contpaq")
            .eq("is_active", true)
            .order("name")
            .limit(1000);
          const useId = fieldValue.endsWith("_id") || fieldValue === "document.company_id";
          const opts = (data || []).map((c: any) => {
            const label = c.name || c.razon_social || c.id_contpaq || c.id;
            const val = useId
              ? c.id
              : fieldValue === "company.razon_social"
              ? (c.razon_social || "")
              : fieldValue === "company.id_contpaq"
              ? (c.id_contpaq || "")
              : (c.name || "");
            return { value: String(val), label: String(label), searchText: `${c.name} ${c.razon_social ?? ""} ${c.id_contpaq ?? ""}` };
          }).filter((o) => o.value);
          if (active) setOptions(opts);
        } else if (source === "contacts") {
          const { data } = await supabase
            .from("contacts")
            .select("id, first_name, last_name, email")
            .eq("is_active", true)
            .order("first_name")
            .limit(1000);
          const useId = fieldValue.endsWith("_id");
          const opts = (data || []).map((c: any) => {
            const full = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
            const label = full || c.email || c.id;
            const val = useId
              ? c.id
              : fieldValue === "contact.first_name"
              ? (c.first_name || "")
              : fieldValue === "contact.last_name"
              ? (c.last_name || "")
              : fieldValue === "contact.email"
              ? (c.email || "")
              : "";
            return { value: String(val), label: String(label), searchText: `${full} ${c.email ?? ""}` };
          }).filter((o) => o.value);
          if (active) setOptions(opts);
        } else if (source === "products") {
          const { data } = await supabase
            .from("products")
            .select("id, codigo, nombre_producto")
            .eq("is_active", true)
            .order("nombre_producto")
            .limit(1000);
          const opts = (data || []).map((p: any) => {
            const val = fieldValue === "product.codigo" ? (p.codigo || "") : (p.nombre_producto || "");
            const label = `${p.codigo ?? ""} — ${p.nombre_producto ?? ""}`.trim();
            return { value: String(val), label, searchText: `${p.codigo ?? ""} ${p.nombre_producto ?? ""}` };
          }).filter((o) => o.value);
          if (active) setOptions(opts);
        } else if (source === "users") {
          const { data } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .order("full_name")
            .limit(500);
          const opts = (data || []).map((u: any) => {
            const val = fieldValue === "user.email" ? (u.email || "") : (u.full_name || "");
            const label = u.full_name || u.email || u.id;
            return { value: String(val), label, searchText: `${u.full_name ?? ""} ${u.email ?? ""}` };
          }).filter((o) => o.value);
          if (active) setOptions(opts);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [source, fieldValue]);

  const current = String(value ?? "");
  const matches = options.some((o) => o.value === current);

  if (customMode || (current && !matches && !loading)) {
    return (
      <div className="flex items-center gap-2">
        <Input
          className="w-56"
          value={current}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Valor personalizado"
        />
        <Button size="sm" variant="ghost" onClick={() => { setCustomMode(false); onChange(""); }}>
          Lista
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <SearchableSelect
        className="w-64"
        value={current}
        onValueChange={onChange}
        options={options}
        placeholder={loading ? "Cargando…" : "Selecciona…"}
      />
      <Button size="sm" variant="ghost" onClick={() => { setCustomMode(true); onChange(""); }}>
        Otro
      </Button>
    </div>
  );
}

function ValuePicker({
  fieldValue, type, value, onChange,
}: {
  fieldValue: string;
  type: "text" | "number" | "boolean";
  value: any;
  onChange: (v: string) => void;
}) {
  const remote = getRemoteSource(fieldValue);
  if (remote) {
    return <RemotePicker source={remote} fieldValue={fieldValue} value={value} onChange={onChange} />;
  }
  const options = getOptionsForField(fieldValue);
  if (!options || options.length === 0) {
    return (
      <Input
        className="w-56"
        type={type === "number" ? "number" : "text"}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Valor"
      />
    );
  }
  const current = String(value ?? "");
  const matches = options.some((o) => o.value === current);
  const selectVal = current === "" ? "" : matches ? current : "__custom__";
  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectVal}
        onValueChange={(v) => {
          if (v === "__custom__") onChange("");
          else onChange(v);
        }}
      >
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Selecciona o escribe…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
          <SelectItem value="__custom__">Otro (escribir valor)…</SelectItem>
        </SelectContent>
      </Select>
      {selectVal === "__custom__" && (
        <Input
          className="w-44"
          value={current}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Valor personalizado"
        />
      )}
    </div>
  );
}

export function AutomationStepConditions({
  draft, onChange,
}: {
  draft: AutomationDraft;
  onChange: (patch: Partial<AutomationDraft>) => void;
}) {
  const groups = GROUPED_FILTER_FIELDS;
  const allFields: FieldDef[] = groups.flatMap((g) => g.fields);
  const items = draft.conditions?.items ?? [];
  const logic = draft.conditions?.logic ?? "AND";

  const setItems = (next: Condition[]) =>
    onChange({ conditions: { logic, items: next } });
  const setLogic = (l: "AND" | "OR") =>
    onChange({ conditions: { logic: l, items } });

  const addCondition = () => {
    const first = allFields[0];
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

  if (allFields.length === 0) {
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
          const fieldDef = findGroupedField(c.field) ?? allFields[0];
          const ops = OPERATORS_BY_TYPE[fieldDef.type] || [];
          const opDef = ops.find((o) => o.value === c.operator);
          return (
            <div key={idx} className="flex flex-wrap items-center gap-2 p-3 border rounded-md">
              <Select
                value={c.field}
                onValueChange={(v) => {
                  const newField = findGroupedField(v);
                  const newOps = OPERATORS_BY_TYPE[newField?.type ?? "text"];
                  update(idx, { field: v, operator: newOps[0].value, value: "" });
                }}
              >
                <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-96">
                  {groups.map((g) => (
                    <SelectGroup key={g.label}>
                      <SelectLabel>{g.label}</SelectLabel>
                      {g.fields.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectGroup>
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
                <ValuePicker
                  fieldValue={c.field}
                  type={fieldDef.type}
                  value={c.value}
                  onChange={(v) => update(idx, { value: v })}
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