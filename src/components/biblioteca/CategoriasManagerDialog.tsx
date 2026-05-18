import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus, Pencil, ChevronRight, FolderPlus, X, Check } from "lucide-react";

interface Categoria {
  id: string;
  nombre: string;
  color: string | null;
  icono: string | null;
  orden: number | null;
  solo_admin: boolean;
  parent_id?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categorias: Categoria[];
  onChanged: () => void;
}

export function CategoriasManagerDialog({ open, onOpenChange, categorias, onChanged }: Props) {
  // creación nueva categoría raíz
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [soloAdmin, setSoloAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

  // edición inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editColor, setEditColor] = useState("#6366f1");
  const [editSoloAdmin, setEditSoloAdmin] = useState(false);

  // crear subcategoría
  const [addSubFor, setAddSubFor] = useState<string | null>(null);
  const [subNombre, setSubNombre] = useState("");
  const [subColor, setSubColor] = useState("#6366f1");

  const raices = categorias.filter((c) => !c.parent_id);
  const hijosDe = (id: string) => categorias.filter((c) => c.parent_id === id);

  const addCat = async (parentId: string | null, nom: string, col: string, sa: boolean) => {
    if (!nom.trim()) {
      toast.error("Nombre requerido");
      return;
    }
    setSaving(true);
    const siblings = categorias.filter((c) => (c.parent_id ?? null) === parentId);
    const { error } = await supabase.from("biblioteca_categorias" as any).insert({
      nombre: nom.trim(),
      color: col,
      icono: "Folder",
      solo_admin: sa,
      orden: siblings.length + 1,
      parent_id: parentId,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(parentId ? "Subcategoría creada" : "Categoría creada");
    onChanged();
  };

  const startEdit = (c: Categoria) => {
    setEditingId(c.id);
    setEditNombre(c.nombre);
    setEditColor(c.color || "#6366f1");
    setEditSoloAdmin(c.solo_admin);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!editNombre.trim()) {
      toast.error("Nombre requerido");
      return;
    }
    const { error } = await supabase
      .from("biblioteca_categorias" as any)
      .update({ nombre: editNombre.trim(), color: editColor, solo_admin: editSoloAdmin })
      .eq("id", editingId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Categoría actualizada");
    setEditingId(null);
    onChanged();
  };

  const deleteCat = async (id: string, nom: string) => {
    const hijos = hijosDe(id);
    const msg = hijos.length
      ? `¿Eliminar "${nom}" y sus ${hijos.length} subcategoría(s)? Los archivos quedarán sin categoría.`
      : `¿Eliminar "${nom}"? Los archivos quedarán sin categoría.`;
    if (!confirm(msg)) return;
    const { error } = await supabase.from("biblioteca_categorias" as any).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Categoría eliminada");
    onChanged();
  };

  const submitSub = async (parentId: string) => {
    await addCat(parentId, subNombre, subColor, false);
    setSubNombre("");
    setSubColor("#6366f1");
    setAddSubFor(null);
  };

  const renderRow = (c: Categoria, depth = 0) => {
    const hijos = hijosDe(c.id);
    const isEditing = editingId === c.id;
    return (
      <div key={c.id}>
        <div
          className="flex items-center gap-2 p-2 border rounded-lg bg-background"
          style={{ marginLeft: depth * 20 }}
        >
          {depth > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
          {isEditing ? (
            <>
              <Input
                type="color"
                value={editColor}
                onChange={(e) => setEditColor(e.target.value)}
                className="w-10 h-8 p-1 shrink-0"
              />
              <Input
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
                className="flex-1 h-8 text-sm"
              />
              <div className="flex items-center gap-1">
                <Checkbox
                  id={`sa-${c.id}`}
                  checked={editSoloAdmin}
                  onCheckedChange={(v) => setEditSoloAdmin(!!v)}
                />
                <label htmlFor={`sa-${c.id}`} className="text-[10px] text-muted-foreground">
                  Admin
                </label>
              </div>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600" onClick={saveEdit}>
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => setEditingId(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <div className="h-6 w-6 rounded shrink-0" style={{ backgroundColor: c.color || "#6366f1" }} />
              <span className="flex-1 text-sm truncate">{c.nombre}</span>
              {c.solo_admin && (
                <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                  Solo Admin
                </span>
              )}
              {depth === 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  title="Agregar subcategoría"
                  onClick={() => {
                    setAddSubFor(addSubFor === c.id ? null : c.id);
                    setSubNombre("");
                  }}
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                title="Editar"
                onClick={() => startEdit(c)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-destructive"
                title="Eliminar"
                onClick={() => deleteCat(c.id, c.nombre)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
        {addSubFor === c.id && (
          <div
            className="flex items-center gap-2 p-2 mt-1 border border-dashed rounded-lg bg-muted/30"
            style={{ marginLeft: (depth + 1) * 20 }}
          >
            <Input
              type="color"
              value={subColor}
              onChange={(e) => setSubColor(e.target.value)}
              className="w-10 h-8 p-1 shrink-0"
            />
            <Input
              autoFocus
              value={subNombre}
              onChange={(e) => setSubNombre(e.target.value)}
              placeholder="Nombre de la subcategoría"
              className="flex-1 h-8 text-sm"
              onKeyDown={(e) => e.key === "Enter" && submitSub(c.id)}
            />
            <Button size="sm" className="h-7" onClick={() => submitSub(c.id)} disabled={saving}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setAddSubFor(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        {hijos.length > 0 && <div className="mt-1 space-y-1">{hijos.map((h) => renderRow(h, depth + 1))}</div>}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 bg-gradient-to-r from-violet-50 to-blue-50 border-b">
          <DialogTitle className="text-xl font-light tracking-tight">Gestionar categorías</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto font-light">
          <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Nueva categoría raíz
            </Label>
            <div className="flex gap-2">
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre"
                className="flex-1"
              />
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-16 p-1" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="solo-admin"
                checked={soloAdmin}
                onCheckedChange={(v) => setSoloAdmin(!!v)}
              />
              <label htmlFor="solo-admin" className="text-sm">
                Solo visible para Admin/Manager
              </label>
            </div>
            <Button
              onClick={async () => {
                await addCat(null, nombre, color, soloAdmin);
                setNombre("");
                setSoloAdmin(false);
              }}
              disabled={saving}
              size="sm"
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-1" /> Agregar categoría
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Categorías y subcategorías
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Usa el ícono <FolderPlus className="inline h-3 w-3" /> para crear subcarpetas dentro de una categoría.
            </p>
            <div className="space-y-1">{raices.map((c) => renderRow(c))}</div>
          </div>
        </div>
        <DialogFooter className="px-6 py-3 bg-muted/30 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}