import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categorias: any[];
  onChanged: () => void;
}

export function CategoriasManagerDialog({ open, onOpenChange, categorias, onChanged }: Props) {
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [soloAdmin, setSoloAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

  const addCat = async () => {
    if (!nombre.trim()) {
      toast.error("Nombre requerido");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("biblioteca_categorias" as any).insert({
      nombre: nombre.trim(),
      color,
      icono: "Folder",
      solo_admin: soloAdmin,
      orden: categorias.length + 1,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNombre("");
    setSoloAdmin(false);
    toast.success("Categoría creada");
    onChanged();
  };

  const deleteCat = async (id: string, nom: string) => {
    if (!confirm(`¿Eliminar la categoría "${nom}"? Los archivos quedarán sin categoría.`)) return;
    const { error } = await supabase.from("biblioteca_categorias" as any).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Categoría eliminada");
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 bg-gradient-to-r from-violet-50 to-blue-50 border-b">
          <DialogTitle className="text-xl font-light tracking-tight">Gestionar categorías</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto font-light">
          <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nueva categoría</Label>
            <div className="flex gap-2">
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" className="flex-1" />
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-16 p-1" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="solo-admin" checked={soloAdmin} onCheckedChange={(v) => setSoloAdmin(!!v)} />
              <label htmlFor="solo-admin" className="text-sm">Solo visible para Admin/Manager</label>
            </div>
            <Button onClick={addCat} disabled={saving} size="sm" className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Categorías existentes</Label>
            {categorias.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-2 border rounded-lg">
                <div className="h-6 w-6 rounded" style={{ backgroundColor: c.color || "#6366f1" }} />
                <span className="flex-1 text-sm">{c.nombre}</span>
                {c.solo_admin && <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">Solo Admin</span>}
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteCat(c.id, c.nombre)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter className="px-6 py-3 bg-muted/30 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}