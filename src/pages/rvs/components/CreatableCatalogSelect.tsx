import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface Props {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  createTitle: string;
  onCreate: (nombre: string) => Promise<string | null>;
  className?: string;
}

export function CreatableCatalogSelect({
  value,
  onValueChange,
  options,
  placeholder = "Seleccionar...",
  createTitle,
  onCreate,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!nombre.trim()) return;
    setSaving(true);
    const newId = await onCreate(nombre.trim());
    setSaving(false);
    if (newId) {
      onValueChange(newId);
      setNombre("");
      setOpen(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <SearchableSelect
        value={value}
        onValueChange={onValueChange}
        options={options}
        placeholder={placeholder}
        className={className}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        title={createTitle}
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
          <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4">
            <DialogTitle className="text-base font-semibold">{createTitle}</DialogTitle>
            <DialogDescription className="text-xs font-light">
              Se agregará al catálogo y quedará seleccionada.
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 py-4 space-y-2">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Nombre</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>
          <DialogFooter className="bg-muted/40 px-5 py-3">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={saving || !nombre.trim()}>
              {saving ? "Guardando..." : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
