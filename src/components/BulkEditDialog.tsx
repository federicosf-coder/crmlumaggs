import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

interface BulkField {
  key: string;
  label: string;
  type: "select" | "text";
  options?: { value: string; label: string }[];
}

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  table: "documentos" | "companies" | "contacts";
  fields: BulkField[];
  onSuccess: () => void;
}

export function BulkEditDialog({ open, onOpenChange, selectedIds, table, fields, onSuccess }: BulkEditDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const updates: Record<string, any> = {};
    for (const [key, val] of Object.entries(values)) {
      if (val && val !== "__none__") {
        updates[key] = val === "__true__" ? true : val === "__false__" ? false : val;
      }
    }
    if (Object.keys(updates).length === 0) {
      toast.error("Selecciona al menos un campo para editar");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from(table).update(updates).in("id", selectedIds);
      if (error) throw error;
      toast.success(`${selectedIds.length} registro(s) actualizados`);
      setValues({});
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
