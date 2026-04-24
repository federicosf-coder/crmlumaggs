import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Save, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const TIPOS = [
  { v: "seguimiento_cotizacion", l: "Seguimiento de cotización" },
  { v: "recompra", l: "Recompra" },
  { v: "expansion", l: "Expansión" },
  { v: "prospecto", l: "Prospecto" },
  { v: "cobranza", l: "Cobranza" },
  { v: "entrega", l: "Entrega" },
  { v: "general", l: "General" },
];

interface Tpl {
  id: string;
  nombre: string;
  tipo: string;
  mensaje: string;
  activo: boolean;
  orden: number;
}

const empty = (): Partial<Tpl> => ({ nombre: "", tipo: "seguimiento_cotizacion", mensaje: "", activo: true, orden: 0 });

export function WhatsAppTemplatesTab() {
  const [items, setItems] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<Partial<Tpl>>(empty());
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_message_templates" as any)
      .select("id,nombre,tipo,mensaje,activo,orden")
      .order("tipo").order("orden");
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setItems((data || []) as unknown as Tpl[]);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty()); setEditingId(null); setDialogOpen(true); };
  const openEdit = (t: Tpl) => { setForm(t); setEditingId(t.id); setDialogOpen(true); };

  const save = async () => {
    if (!form.nombre || !form.mensaje || !form.tipo) { toast.error("Completa nombre, tipo y mensaje"); return; }
    if (editingId) {
      const { error } = await supabase.from("whatsapp_message_templates" as any)
        .update({ nombre: form.nombre, tipo: form.tipo, mensaje: form.mensaje, activo: form.activo, orden: form.orden ?? 0 } as any)
        .eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      toast.success("Plantilla actualizada");
    } else {
      const { error } = await supabase.from("whatsapp_message_templates" as any)
        .insert({ nombre: form.nombre, tipo: form.tipo, mensaje: form.mensaje, activo: form.activo, orden: form.orden ?? 0 } as any);
      if (error) { toast.error(error.message); return; }
      toast.success("Plantilla creada");
    }
    setDialogOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar plantilla?")) return;
    const { error } = await supabase.from("whatsapp_message_templates" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Eliminada");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Plantillas WhatsApp (locales)</h2>
          <p className="text-sm text-muted-foreground">
            Variables disponibles: <code>{`{{contacto_nombre}} {{empresa_nombre}} {{producto_categoria}} {{folio_cotizacion}} {{total_cotizacion}} {{fecha_vencimiento}} {{ejecutivo_nombre}}`}</code>
          </p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nueva plantilla</Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Mensaje</TableHead>
              <TableHead>Orden</TableHead>
              <TableHead>Activo</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Cargando…</TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sin plantillas.</TableCell></TableRow>
            ) : items.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.nombre}</TableCell>
                <TableCell><Badge variant="outline">{TIPOS.find(x => x.v === t.tipo)?.l || t.tipo}</Badge></TableCell>
                <TableCell className="max-w-md text-sm text-muted-foreground truncate">{t.mensaje}</TableCell>
                <TableCell>{t.orden}</TableCell>
                <TableCell>{t.activo ? <Badge>Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar" : "Nueva"} plantilla WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Nombre</Label><Input value={form.nombre || ""} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Mensaje</Label><Textarea rows={5} value={form.mensaje || ""} onChange={(e) => setForm({ ...form, mensaje: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Orden</Label><Input type="number" value={form.orden ?? 0} onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })} /></div>
              <div className="space-y-1 flex items-center gap-2"><Switch checked={!!form.activo} onCheckedChange={(v) => setForm({ ...form, activo: v })} /><Label>Activo</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
            <Button onClick={save}><Save className="h-4 w-4 mr-1" /> Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
