import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { toast } from "sonner";

export interface ExportField {
  key: string;
  label: string;
  /** Optional accessor to derive value from a doc row */
  accessor?: (doc: any) => any;
}

interface ExportFieldsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: any[];
  fields: ExportField[];
  defaultSelected?: string[];
  filenameBase: string;
}

export function ExportFieldsDialog({
  open,
  onOpenChange,
  data,
  fields,
  defaultSelected,
  filenameBase,
}: ExportFieldsDialogProps) {
  const initial = useMemo(
    () => new Set(defaultSelected ?? fields.map((f) => f.key)),
    [defaultSelected, fields],
  );
  const [selected, setSelected] = useState<Set<string>>(initial);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(fields.map((f) => f.key)));
  const clearAll = () => setSelected(new Set());

  const handleExport = () => {
    if (data.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }
    const chosen = fields.filter((f) => selected.has(f.key));
    if (chosen.length === 0) {
      toast.error("Selecciona al menos un campo");
      return;
    }
    const headers = chosen.map((f) => f.label);
    const rows = data.map((doc) =>
      chosen.map((f) => {
        const val = f.accessor ? f.accessor(doc) : doc[f.key];
        if (val === null || val === undefined) return "";
        if (Array.isArray(val)) return val.join("; ");
        return String(val);
      }),
    );
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filenameBase}_${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportación completada");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Exportar campos</DialogTitle>
          <DialogDescription>
            Selecciona los campos que deseas incluir en el archivo CSV.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {selected.size} de {fields.length} seleccionados
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Seleccionar todos
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Limpiar
            </Button>
          </div>
        </div>
        <ScrollArea className="h-72 pr-3">
          <div className="grid grid-cols-2 gap-2">
            {fields.map((f) => (
              <label
                key={f.key}
                className="flex items-center gap-2 text-sm cursor-pointer rounded px-2 py-1.5 hover:bg-muted"
              >
                <Checkbox
                  checked={selected.has(f.key)}
                  onCheckedChange={() => toggle(f.key)}
                />
                <span>{f.label}</span>
              </label>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleExport}>Exportar CSV</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
