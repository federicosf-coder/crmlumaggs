import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type DocTipo = "cotizacion" | "pedido" | "factura" | "entrega_corporativa";

export interface ExportFilters {
  allRecords: boolean;
  startDate: string;
  endDate: string;
  tipos: DocTipo[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (filters: ExportFilters) => void;
  loading?: boolean;
}

const TIPO_OPTIONS: { key: DocTipo; label: string }[] = [
  { key: "cotizacion", label: "Cotizaciones" },
  { key: "pedido", label: "Pedidos" },
  { key: "factura", label: "Facturas" },
  { key: "entrega_corporativa", label: "Entregas Corporativas" },
];

export function ExportFilterDialog({ open, onOpenChange, onConfirm, loading }: Props) {
  const [allRecords, setAllRecords] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tipos, setTipos] = useState<Set<DocTipo>>(
    new Set(["cotizacion", "pedido", "factura", "entrega_corporativa"]),
  );

  useEffect(() => {
    if (open) {
      setAllRecords(true);
      setStartDate("");
      setEndDate("");
      setTipos(new Set(["cotizacion", "pedido", "factura", "entrega_corporativa"]));
    }
  }, [open]);

  const toggleTipo = (key: DocTipo) => {
    setTipos((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const datesValid = allRecords || (!!startDate && !!endDate);
  const canExport = tipos.size > 0 && datesValid && !loading;

  const handleConfirm = () => {
    onConfirm({
      allRecords,
      startDate,
      endDate,
      tipos: Array.from(tipos),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Filtros de exportación</DialogTitle>
          <DialogDescription>
            Configura el rango y los tipos de documento a exportar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Rango de fechas</Label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={allRecords}
                onCheckedChange={(v) => setAllRecords(!!v)}
              />
              <span className="text-sm">Todos los registros</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="exp-start" className="text-xs text-muted-foreground">
                  Fecha inicio
                </Label>
                <Input
                  id="exp-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={allRecords}
                />
              </div>
              <div>
                <Label htmlFor="exp-end" className="text-xs text-muted-foreground">
                  Fecha fin
                </Label>
                <Input
                  id="exp-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={allRecords}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Tipo de documento</Label>
            <div className="space-y-1">
              {TIPO_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={tipos.has(opt.key)}
                    onCheckedChange={() => toggleTipo(opt.key)}
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canExport}>
            {loading ? "Exportando..." : "Exportar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
