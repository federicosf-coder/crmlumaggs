import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabasePagination";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

interface BulkField {
  key: string;
  label: string;
  type: "select" | "text" | "ejecutivos";
  options?: { value: string; label: string }[];
  // For ejecutivos type: junction table info
  junctionTable?: "company_ejecutivos" | "contact_ejecutivos";
  junctionFkColumn?: "company_id" | "contact_id";
}

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  table: "documentos" | "companies" | "contacts" | "direcciones_empresa";
  fields: BulkField[];
  onSuccess: () => void;
}

export function BulkEditDialog({ open, onOpenChange, selectedIds, table, fields, onSuccess }: BulkEditDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [ejecutivos, setEjecutivos] = useState<Record<string, { ids: string[]; mode: "replace" | "add" }>>({});
  const [saving, setSaving] = useState(false);

  const ejecutivoFields = fields.filter(f => f.type === "ejecutivos");

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_active_bulk"],
    queryFn: async () => {
      const data = await fetchAllRows<any>((from, to) => supabase.from("profiles").select("user_id, full_name, email").eq("is_active", true).order("full_name").range(from, to));
      return data;
    },
    enabled: open && ejecutivoFields.length > 0,
  });

  const toggleEjecutivo = (key: string, uid: string) => {
    setEjecutivos(prev => {
      const cur = prev[key] || { ids: [], mode: "add" as const };
      const ids = cur.ids.includes(uid) ? cur.ids.filter(i => i !== uid) : [...cur.ids, uid];
      return { ...prev, [key]: { ...cur, ids } };
    });
  };

  const setEjecutivoMode = (key: string, mode: "replace" | "add") => {
    setEjecutivos(prev => ({ ...prev, [key]: { ids: prev[key]?.ids || [], mode } }));
  };

  const handleSave = async () => {
    const updates: Record<string, any> = {};
    for (const [key, val] of Object.entries(values)) {
      if (val && val !== "__none__") {
        updates[key] = val === "__true__" ? true : val === "__false__" ? false : val;
      }
    }
    const ejecutivoChanges = Object.entries(ejecutivos).filter(([_, v]) => v.ids.length > 0);
    if (Object.keys(updates).length === 0 && ejecutivoChanges.length === 0) {
      toast.error("Selecciona al menos un campo para editar");
      return;
    }
    setSaving(true);
    try {
      if (Object.keys(updates).length > 0) {
        const { error } = await (supabase.from(table) as any).update(updates).in("id", selectedIds);
        if (error) throw error;
      }

      // Apply ejecutivo changes via junction tables
      for (const [key, { ids, mode }] of ejecutivoChanges) {
        const field = ejecutivoFields.find(f => f.key === key);
        if (!field?.junctionTable || !field.junctionFkColumn) continue;
        const fk = field.junctionFkColumn;
        if (mode === "replace") {
          await (supabase.from(field.junctionTable) as any).delete().in(fk, selectedIds);
        }
        const rows: any[] = [];
        for (const recId of selectedIds) {
          for (const uid of ids) {
            rows.push({ [fk]: recId, user_id: uid });
          }
        }
        if (rows.length > 0) {
          // upsert-like: ignore duplicates by deleting matching pairs first when adding
          if (mode === "add") {
            for (const recId of selectedIds) {
              await (supabase.from(field.junctionTable) as any).delete().eq(fk, recId).in("user_id", ids);
            }
          }
          const { error: insErr } = await (supabase.from(field.junctionTable) as any).insert(rows);
          if (insErr) throw insErr;
        }
      }

      toast.success(`${selectedIds.length} registro(s) actualizados`);
      setValues({});
      setEjecutivos({});
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error("Error: " + (err.message || "Error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edición masiva — {selectedIds.length} registro(s)</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-2">
          Solo los campos que modifiques se aplicarán a todos los registros seleccionados.
        </p>
        <div className="space-y-4">
          {fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label className="text-sm">{field.label}</Label>
              {field.type === "select" && field.options ? (
                <Select
                  value={values[field.key] || "__none__"}
                  onValueChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="— Sin cambio —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sin cambio —</SelectItem>
                    {field.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : field.type === "ejecutivos" ? (
                <div className="space-y-2 rounded-md border p-2">
                  <Select
                    value={ejecutivos[field.key]?.mode || "add"}
                    onValueChange={(v) => setEjecutivoMode(field.key, v as "replace" | "add")}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="add">Agregar a los existentes</SelectItem>
                      <SelectItem value="replace">Reemplazar a los existentes</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-1.5">
                    {(ejecutivos[field.key]?.ids || []).map(uid => {
                      const p = profiles.find((pr: any) => pr.user_id === uid);
                      return p ? (
                        <Badge key={uid} variant="secondary" className="gap-1">
                          {p.full_name || p.email}
                          <X className="h-3 w-3 cursor-pointer" onClick={() => toggleEjecutivo(field.key, uid)} />
                        </Badge>
                      ) : null;
                    })}
                  </div>
                  <SearchableSelect
                    value=""
                    onValueChange={v => { if (v && !(ejecutivos[field.key]?.ids || []).includes(v)) toggleEjecutivo(field.key, v); }}
                    options={profiles
                      .filter((p: any) => !(ejecutivos[field.key]?.ids || []).includes(p.user_id))
                      .map((p: any) => ({ value: p.user_id, label: p.full_name || p.email || "Sin nombre" }))}
                    placeholder="Agregar ejecutivo..."
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Dejar vacío = sin cambio
                  </p>
                </div>
              ) : (
                <Input
                  placeholder="Dejar vacío = sin cambio"
                  value={values[field.key] || ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Aplicar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
