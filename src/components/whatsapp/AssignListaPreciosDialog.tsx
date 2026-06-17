import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LISTA_PRECIOS_OPTIONS } from "@/components/CompanyFormDialog";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  companyName?: string;
  onAssigned: (lista: string) => void;
}

export function AssignListaPreciosDialog({ open, onOpenChange, companyId, companyName, onAssigned }: Props) {
  const [lista, setLista] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!lista) { toast.error("Selecciona una lista de precios"); return; }
    setSaving(true);
    const { error } = await supabase.from("companies").update({ lista_precios: lista }).eq("id", companyId);
    setSaving(false);
    if (error) { toast.error("No se pudo guardar: " + error.message); return; }
    toast.success("Lista de precios asignada");
    onAssigned(lista);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4 border-b">
          <DialogTitle className="text-base font-semibold tracking-tight">Asignar lista de precios</DialogTitle>
          <p className="text-xs text-muted-foreground font-light mt-0.5">
            {companyName ? <>La empresa <strong>{companyName}</strong> no tiene lista asignada. </> : null}
            Selecciona la lista para calcular precios al cotizar.
          </p>
        </div>
        <div className="px-5 py-5 space-y-2">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Lista de precios</Label>
          <Select value={lista} onValueChange={setLista}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
            <SelectContent>
              {LISTA_PRECIOS_OPTIONS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="px-5 py-3 bg-muted/40 border-t flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={save} disabled={saving || !lista}>
            {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Guardar y continuar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}