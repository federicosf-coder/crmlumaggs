import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { BackButton } from "@/components/BackButton";
import { Plus, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CreditoFormatosEditor from "./CreditoFormatosEditor";

interface DocType {
  id: string;
  nombre: string;
  descripcion: string | null;
  instrucciones_cliente: string | null;
  aplica_moral: boolean;
  aplica_fisica: boolean;
  aplica_cescemex: boolean;
  aplica_directo: boolean;
  requerido: boolean;
  vigencia_dias: number | null;
  sort_order: number;
  is_active: boolean;
}

const empty: Partial<DocType> = {
  nombre: "",
  instrucciones_cliente: "",
  aplica_moral: true,
  aplica_fisica: true,
  aplica_cescemex: true,
  aplica_directo: true,
  requerido: true,
  vigencia_dias: null,
  is_active: true,
};

export default function CreditoConfiguracion() {
  const { hasAnyRole } = useAuth();
  const [items, setItems] = useState<DocType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<DocType> | null>(null);
  const [saving, setSaving] = useState(false);

  const canManage = hasAnyRole(["admin", "manager"]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("credit_doc_types")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) toast.error(error.message);
    setItems((data || []) as DocType[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (!canManage) return <Navigate to="/credito" replace />;

  const toggleField = async (row: DocType, field: keyof DocType, value: boolean) => {
    const { error } = await (supabase as any)
      .from("credit_doc_types")
      .update({ [field]: value })
      .eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    setItems((p) => p.map((r) => (r.id === row.id ? { ...r, [field]: value } : r)));
  };

  const move = async (row: DocType, dir: -1 | 1) => {
    const idx = items.findIndex((r) => r.id === row.id);
    const swap = items[idx + dir];
    if (!swap) return;
    await (supabase as any).from("credit_doc_types").update({ sort_order: swap.sort_order }).eq("id", row.id);
    await (supabase as any).from("credit_doc_types").update({ sort_order: row.sort_order }).eq("id", swap.id);
    load();
  };

  const save = async () => {
    if (!editing?.nombre) { toast.error("Nombre requerido"); return; }
    setSaving(true);
    const payload: any = {
      nombre: editing.nombre,
      instrucciones_cliente: editing.instrucciones_cliente || null,
      aplica_moral: editing.aplica_moral ?? true,
      aplica_fisica: editing.aplica_fisica ?? true,
      aplica_cescemex: editing.aplica_cescemex ?? true,
      aplica_directo: editing.aplica_directo ?? true,
      requerido: editing.requerido ?? true,
      vigencia_dias: editing.vigencia_dias ?? null,
      is_active: editing.is_active ?? true,
    };
    let error;
    if (editing.id) {
      ({ error } = await (supabase as any).from("credit_doc_types").update(payload).eq("id", editing.id));
    } else {
      const maxSort = items.reduce((m, i) => Math.max(m, i.sort_order), 0);
      payload.sort_order = maxSort + 10;
      ({ error } = await (supabase as any).from("credit_doc_types").insert(payload));
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Guardado");
    setEditing(null);
    load();
  };

  return (
    <div className="container mx-auto py-6 space-y-4">
      <BackButton fallback="/credito" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Configuración de crédito</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Administra los documentos requeridos y los formatos imprimibles del expediente.
          </p>
        </div>
      </div>

      <Tabs defaultValue="docs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="docs">Documentos requeridos</TabsTrigger>
          <TabsTrigger value="formatos">Formatos imprimibles</TabsTrigger>
        </TabsList>

        <TabsContent value="docs" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setEditing(empty)}>
              <Plus className="h-4 w-4 mr-2" /> Nuevo tipo
            </Button>
          </div>
          <Card>
        <CardHeader>
          <CardTitle className="text-base">Tipos de documento</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Orden</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-center">Moral</TableHead>
                  <TableHead className="text-center">Física</TableHead>
                  <TableHead className="text-center">Cescemex</TableHead>
                  <TableHead className="text-center">Directo</TableHead>
                  <TableHead className="text-center">Requerido</TableHead>
                  <TableHead className="text-center">Vigencia (días)</TableHead>
                  <TableHead className="text-center">Activo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r, idx) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setEditing(r)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === 0} onClick={() => move(r, -1)}>
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === items.length - 1} onClick={() => move(r, 1)}>
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{r.nombre}</TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Switch checked={r.aplica_moral} onCheckedChange={(v) => toggleField(r, "aplica_moral", v)} />
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Switch checked={r.aplica_fisica} onCheckedChange={(v) => toggleField(r, "aplica_fisica", v)} />
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Switch checked={r.aplica_cescemex} onCheckedChange={(v) => toggleField(r, "aplica_cescemex", v)} />
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Switch checked={r.aplica_directo} onCheckedChange={(v) => toggleField(r, "aplica_directo", v)} />
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Switch checked={r.requerido} onCheckedChange={(v) => toggleField(r, "requerido", v)} />
                    </TableCell>
                    <TableCell className="text-center text-sm">{r.vigencia_dias ?? "—"}</TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Switch checked={r.is_active} onCheckedChange={(v) => toggleField(r, "is_active", v)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="formatos">
          <CreditoFormatosEditor />
        </TabsContent>
      </Tabs>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="bg-gradient-to-r from-violet-50 to-blue-50 -mx-6 -mt-6 px-6 py-5 mb-4 border-b">
            <SheetTitle className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              {editing?.id ? "Editar tipo de documento" : "Nuevo tipo de documento"}
            </SheetTitle>
          </SheetHeader>
          {editing && (
            <div className="space-y-4 font-light">
              <div>
                <Label className="text-xs uppercase tracking-wide">Nombre *</Label>
                <Input value={editing.nombre || ""} onChange={(e) => setEditing({ ...editing, nombre: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wide">Instrucciones al cliente</Label>
                <Textarea
                  value={editing.instrucciones_cliente || ""}
                  onChange={(e) => setEditing({ ...editing, instrucciones_cliente: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center justify-between border rounded-md px-3 py-2">
                  <span className="text-sm">Aplica Moral</span>
                  <Switch checked={editing.aplica_moral ?? true} onCheckedChange={(v) => setEditing({ ...editing, aplica_moral: v })} />
                </label>
                <label className="flex items-center justify-between border rounded-md px-3 py-2">
                  <span className="text-sm">Aplica Física</span>
                  <Switch checked={editing.aplica_fisica ?? true} onCheckedChange={(v) => setEditing({ ...editing, aplica_fisica: v })} />
                </label>
                <label className="flex items-center justify-between border rounded-md px-3 py-2">
                  <span className="text-sm">Cescemex</span>
                  <Switch checked={editing.aplica_cescemex ?? true} onCheckedChange={(v) => setEditing({ ...editing, aplica_cescemex: v })} />
                </label>
                <label className="flex items-center justify-between border rounded-md px-3 py-2">
                  <span className="text-sm">Directo</span>
                  <Switch checked={editing.aplica_directo ?? true} onCheckedChange={(v) => setEditing({ ...editing, aplica_directo: v })} />
                </label>
                <label className="flex items-center justify-between border rounded-md px-3 py-2">
                  <span className="text-sm">Requerido</span>
                  <Switch checked={editing.requerido ?? true} onCheckedChange={(v) => setEditing({ ...editing, requerido: v })} />
                </label>
                <label className="flex items-center justify-between border rounded-md px-3 py-2">
                  <span className="text-sm">Activo</span>
                  <Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                </label>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wide">Vigencia (días)</Label>
                <Input
                  type="number"
                  value={editing.vigencia_dias ?? ""}
                  onChange={(e) => setEditing({ ...editing, vigencia_dias: e.target.value ? Number(e.target.value) : null })}
                  placeholder="Sin vigencia"
                />
              </div>
            </div>
          )}
          <SheetFooter className="mt-6 bg-muted/30 -mx-6 -mb-6 px-6 py-4 border-t">
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}