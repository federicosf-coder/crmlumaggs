import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { toast } from "sonner";

export interface ExportField {
  key: string;
  label: string;
  /** Optional accessor to derive value from a doc row */
  accessor?: (doc: any) => any;
  /** Whether this field is importable (true) or calculated/referenced (false). Default true. */
  importable?: boolean;
}

interface ExportFieldsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: any[];
  fields: ExportField[];
  /** Ignored — kept for backwards compatibility */
  defaultSelected?: string[];
  filenameBase: string;
}

type Mode = "importable" | "all";

export function ExportFieldsDialog({
  open,
  onOpenChange,
  data,
  fields,
  filenameBase,
}: ExportFieldsDialogProps) {
  const [mode, setMode] = useState<Mode>("importable");

  const importableCount = fields.filter((f) => f.importable !== false).length;

  const handleExport = () => {
    if (data.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }
    const chosen =
      mode === "importable"
        ? fields.filter((f) => f.importable !== false)
        : fields;
    if (chosen.length === 0) {
      toast.error("No hay campos disponibles para exportar");
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
    a.download = `${filenameBase}_${mode}_${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportación completada");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar a CSV</DialogTitle>
          <DialogDescription>
            Elige qué campos quieres incluir en el archivo.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={mode}
          onValueChange={(v) => setMode(v as Mode)}
          className="space-y-2"
        >
          <label
            htmlFor="opt-importable"
            className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted"
          >
            <RadioGroupItem value="importable" id="opt-importable" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="opt-importable" className="font-medium cursor-pointer">
                Solo campos importables
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Excluye campos calculados o referenciados. Útil para reimportar
                ({importableCount} campos)
              </p>
            </div>
          </label>
          <label
            htmlFor="opt-all"
            className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted"
          >
            <RadioGroupItem value="all" id="opt-all" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="opt-all" className="font-medium cursor-pointer">
                Todos los campos
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Incluye todos los campos disponibles ({fields.length} campos)
              </p>
            </div>
          </label>
        </RadioGroup>
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
