import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Percent, Tags } from "lucide-react";

export const MARGIN_LEVELS = [
  { key: "margen_uf1", label: "UF1" },
  { key: "margen_uf2", label: "UF2" },
  { key: "margen_uf3", label: "UF3" },
  { key: "margen_uf4", label: "UF4" },
  { key: "margen_r1",  label: "R1" },
  { key: "margen_r2",  label: "R2" },
  { key: "margen_r3",  label: "R3" },
  { key: "margen_r4",  label: "R4" },
] as const;

/** Mapping from margin column → product price column. */
export const MARGIN_TO_PRICE: Record<string, string> = {
  margen_uf1: "precio_base_uf1",
  margen_uf2: "precio_uf2",
  margen_uf3: "precio_uf3",
  margen_uf4: "precio_uf4",
  margen_r1:  "precio_r1",
  margen_r2:  "precio_r2",
  margen_r3:  "precio_r3",
  margen_r4:  "precio_r4",
};

type Margins = Record<string, number>;

/** Compute prices from costo + margins. price = costo / (1 - margen%/100). */
export function computePricesFromCost(costo: number, margins: Margins): Record<string, number> {
  const out: Record<string, number> = {};
  for (const lvl of MARGIN_LEVELS) {
    const m = Number(margins[lvl.key] ?? 0);
    if (m >= 100) { out[MARGIN_TO_PRICE[lvl.key]] = 0; continue; }
    const denom = 1 - m / 100;
    out[MARGIN_TO_PRICE[lvl.key]] = denom > 0 ? Number((costo / denom).toFixed(2)) : 0;
  }
  return out;
}

// ─── Sección A: Márgenes Generales ─────────────────────────────
function GlobalMarginsSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["precio_config_global"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("precio_config_global")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<Margins>({});
  useEffect(() => {
    if (data) {
      const f: Margins = {};
      for (const lvl of MARGIN_LEVELS) f[lvl.key] = Number((data as any)[lvl.key] ?? 0);
      setForm(f);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error("Sin registro de configuración");
      const { error } = await supabase
        .from("precio_config_global")
        .update(form as any)
        .eq("id", (data as any).id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["precio_config_global"] });
      toast.success("Márgenes generales actualizados");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Percent className="h-4 w-4" /> Márgenes Generales
        </CardTitle>
        <p className="text-xs text-muted-foreground font-light">
          Porcentaje de utilidad por defecto cuando un producto no tiene clasificación asignada.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground text-sm">Cargando...</p> : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {MARGIN_LEVELS.map(lvl => (
                <div key={lvl.key}>
                  <Label className="text-xs uppercase tracking-wide">{lvl.label} (%)</Label>
                  <Input
                    type="number" step="0.01" min={0} max={99.99}
                    value={form[lvl.key] ?? 0}
                    onChange={e => setForm(prev => ({ ...prev, [lvl.key]: Number(e.target.value) }))}
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? "Guardando..." : "Guardar márgenes generales"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Sección B: Clasificaciones ─────────────────────────────────
const emptyClasif = {
  nombre: "", descripcion: "", activo: true,
  margen_uf1: 0, margen_uf2: 0, margen_uf3: 0, margen_uf4: 0,
  margen_r1: 0, margen_r2: 0, margen_r3: 0, margen_r4: 0,
};

function ClasificacionesSection() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["precio_clasificaciones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("precio_clasificaciones").select("*").order("nombre");
      if (error) throw error;
      return data;
    },
  });

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyClasif);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const openNew = () => { setEditingId(null); setForm(emptyClasif); setOpen(true); };
  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      nombre: c.nombre, descripcion: c.descripcion || "", activo: c.activo,
      ...Object.fromEntries(MARGIN_LEVELS.map(l => [l.key, Number(c[l.key] ?? 0)])),
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.nombre?.trim()) throw new Error("El nombre es requerido");
      if (editingId) {
        const { error } = await supabase.from("precio_clasificaciones").update(form).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("precio_clasificaciones").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["precio_clasificaciones"] });
      setOpen(false);
      toast.success(editingId ? "Clasificación actualizada" : "Clasificación creada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("precio_clasificaciones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["precio_clasificaciones"] });
      setConfirmDelete(null);
      toast.success("Clasificación eliminada");
    },
    onError: (e: any) => { toast.error(e.message); setConfirmDelete(null); },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Tags className="h-4 w-4" /> Clasificaciones para Precio
          </CardTitle>
          <p className="text-xs text-muted-foreground font-light mt-1">
            Cada clasificación define sus propios 8 porcentajes de margen.
          </p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nueva</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground text-sm">Cargando...</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-xs">Márgenes UF</TableHead>
                <TableHead className="text-xs">Márgenes R</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead className="w-24 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nombre}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.descripcion || "—"}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    UF1: {Number(c.margen_uf1).toFixed(1)}% · UF2: {Number(c.margen_uf2).toFixed(1)}%<br/>
                    UF3: {Number(c.margen_uf3).toFixed(1)}% · UF4: {Number(c.margen_uf4).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    R1: {Number(c.margen_r1).toFixed(1)}% · R2: {Number(c.margen_r2).toFixed(1)}%<br/>
                    R3: {Number(c.margen_r3).toFixed(1)}% · R4: {Number(c.margen_r4).toFixed(1)}%
                  </TableCell>
                  <TableCell><Badge variant={c.activo ? "default" : "secondary"}>{c.activo ? "Sí" : "No"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setConfirmDelete(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin clasificaciones</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyClasif); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 -mx-6 -mt-6 px-6 py-4 border-b">
            <DialogTitle className="text-base font-medium">{editingId ? "Editar Clasificación" : "Nueva Clasificación"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 font-light">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase tracking-wide">Nombre *</Label>
                <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
              </div>
              <div className="flex items-end gap-2">
                <Switch checked={form.activo} onCheckedChange={v => setForm({ ...form, activo: v })} />
                <Label>Activo</Label>
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs uppercase tracking-wide">Descripción</Label>
                <Textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide mb-2 block">Márgenes (%)</Label>
              <div className="grid grid-cols-4 gap-3">
                {MARGIN_LEVELS.map(lvl => (
                  <div key={lvl.key}>
                    <Label className="text-xs">{lvl.label}</Label>
                    <Input
                      type="number" step="0.01" min={0} max={99.99}
                      value={form[lvl.key] ?? 0}
                      onChange={e => setForm({ ...form, [lvl.key]: Number(e.target.value) })}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="-mx-6 -mb-6 px-6 py-3 bg-muted/30 border-t">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar clasificación?</AlertDialogTitle>
            <AlertDialogDescription>
              Los productos que la tengan asignada quedarán sin clasificación (usarán márgenes generales).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && remove.mutate(confirmDelete)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default function PreciosConfigTab() {
  return (
    <div className="space-y-4">
      <GlobalMarginsSection />
      <ClasificacionesSection />
    </div>
  );
}