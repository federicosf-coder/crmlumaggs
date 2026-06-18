import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { ShieldAlert, Plus, Pencil, CheckCircle2, Trash2 } from "lucide-react";

const TIPO_LABEL: Record<string, string> = {
  legal: "Legal", stock_proveedor: "Stock proveedor", logistica: "Logística", otro: "Otro",
};
const TIPO_COLOR: Record<string, string> = {
  legal: "bg-red-100 text-red-800 border-red-200",
  stock_proveedor: "bg-orange-100 text-orange-800 border-orange-200",
  logistica: "bg-blue-100 text-blue-800 border-blue-200",
  otro: "bg-gray-100 text-gray-700 border-gray-200",
};
const MARCA_COLOR: Record<string, string> = {
  chevron: "bg-blue-100 text-blue-800 border-blue-200",
  phillips66: "bg-red-100 text-red-800 border-red-200",
};
const PEDIDOS_ACTIVOS = ["CHV-MXL-NAL", "CHV-MXL-IMP", "CHV-TJ-NAL", "CHV-TJ-IMP", "P66-MXL-IMP"];

type Restriccion = any;

export default function Restricciones() {
  const qc = useQueryClient();
  const { hasAnyRole, user } = useAuth();
  const puedeEditar = hasAnyRole(["admin", "manager", "warehouse"]);

  const [tipoFilter, setTipoFilter] = useState("todos");
  const [marcaFilter, setMarcaFilter] = useState("todas");
  const [activaFilter, setActivaFilter] = useState<"si" | "no" | "todas">("si");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Restriccion | null>(null);
  const [resolveTarget, setResolveTarget] = useState<Restriccion | null>(null);

  const { data: restricciones = [] } = useQuery({
    queryKey: ["inv_restricciones"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("inv_restricciones")
        .select("*").order("activa", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: niveles = [] } = useQuery({
    queryKey: ["inv_niveles_min"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("inv_niveles_inventario")
        .select("codigo_producto, nombre_producto").order("codigo_producto");
      return data || [];
    },
  });
  const productMap = useMemo(() => {
    const m: Record<string, string> = {};
    niveles.forEach((n: any) => { if (n.codigo_producto) m[n.codigo_producto] = n.nombre_producto || ""; });
    return m;
  }, [niveles]);

  const filtered = useMemo(() => restricciones.filter((r: Restriccion) => {
    if (tipoFilter !== "todos" && r.tipo !== tipoFilter) return false;
    if (marcaFilter !== "todas" && r.marca !== marcaFilter) return false;
    if (activaFilter === "si" && !r.activa) return false;
    if (activaFilter === "no" && r.activa) return false;
    return true;
  }), [restricciones, tipoFilter, marcaFilter, activaFilter]);

  const activas = restricciones.filter((r: Restriccion) => r.activa);
  const skusBloqueados = new Set(activas.filter((r: Restriccion) => r.codigo_producto).map((r: Restriccion) => r.codigo_producto)).size;
  const sinFecha = activas.filter((r: Restriccion) => !r.fecha_fin).length;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const resueltasMes = restricciones.filter((r: Restriccion) =>
    r.resuelta && r.fecha_resolucion && new Date(r.fecha_resolucion) >= monthStart
  ).length;

  const toggleActiva = async (r: Restriccion) => {
    const { error } = await (supabase as any).from("inv_restricciones")
      .update({ activa: !r.activa }).eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success(r.activa ? "Desactivada" : "Activada"); qc.invalidateQueries({ queryKey: ["inv_restricciones"] }); }
  };

  const eliminar = async (r: Restriccion) => {
    if (!confirm("¿Eliminar restricción?")) return;
    const { error } = await (supabase as any).from("inv_restricciones").delete().eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success("Eliminada"); qc.invalidateQueries({ queryKey: ["inv_restricciones"] }); }
  };

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-light flex items-center gap-2 tracking-tight">
              <ShieldAlert className="h-6 w-6" /> Restricciones de Pedido
            </h1>
            <p className="text-xs text-muted-foreground font-light mt-1">
              SKUs y marcas bloqueadas que afectan los pedidos de reabastecimiento
            </p>
          </div>
          {puedeEditar && (
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Nueva restricción
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi label="Restricciones activas" value={activas.length} tone="red" />
          <Kpi label="SKUs bloqueados" value={skusBloqueados} tone="orange" />
          <Kpi label="Sin fecha de vencimiento" value={sinFecha} tone="amber" />
          <Kpi label="Resueltas este mes" value={resueltasMes} tone="green" />
        </div>

        <Card>
          <CardContent className="p-4 flex flex-wrap gap-2 items-center">
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los tipos</SelectItem>
                <SelectItem value="legal">Legal</SelectItem>
                <SelectItem value="stock_proveedor">Stock proveedor</SelectItem>
                <SelectItem value="logistica">Logística</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={marcaFilter} onValueChange={setMarcaFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las marcas</SelectItem>
                <SelectItem value="chevron">Chevron</SelectItem>
                <SelectItem value="phillips66">Phillips 66</SelectItem>
              </SelectContent>
            </Select>
            <Select value={activaFilter} onValueChange={(v) => setActivaFilter(v as any)}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="si">Solo activas</SelectItem>
                <SelectItem value="no">Solo inactivas</SelectItem>
                <SelectItem value="todas">Todas</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30">
                <TableRow>
                  <Th>Tipo</Th><Th>Código</Th><Th>Producto</Th><Th>Marca</Th>
                  <Th>Pedido</Th><Th>Descripción</Th>
                  <Th>Inicio</Th><Th>Fin</Th><Th>Activa</Th><Th>Acciones</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r: Restriccion, i: number) => (
                  <TableRow key={r.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                    <TableCell><Badge variant="outline" className={TIPO_COLOR[r.tipo]}>{TIPO_LABEL[r.tipo] || r.tipo}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{r.codigo_producto || <span className="italic text-muted-foreground">Toda la marca</span>}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{r.codigo_producto ? (productMap[r.codigo_producto] || "—") : "—"}</TableCell>
                    <TableCell><Badge variant="outline" className={MARCA_COLOR[r.marca]}>{r.marca === "phillips66" ? "Phillips 66" : "Chevron"}</Badge></TableCell>
                    <TableCell className="text-xs">{r.pedido_activo_id || <span className="italic text-muted-foreground">Todos</span>}</TableCell>
                    <TableCell className="max-w-[260px]"><div className="truncate" title={r.descripcion}>{r.descripcion}</div></TableCell>
                    <TableCell className="text-xs">{r.fecha_inicio || "—"}</TableCell>
                    <TableCell>{r.fecha_fin ? <span className="text-xs">{r.fecha_fin}</span> : <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">Sin fecha</Badge>}</TableCell>
                    <TableCell>
                      <Switch checked={!!r.activa} disabled={!puedeEditar} onCheckedChange={() => toggleActiva(r)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {puedeEditar && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setDialogOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                            {!r.resuelta && <Button size="icon" variant="ghost" onClick={() => setResolveTarget(r)}><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /></Button>}
                            <Button size="icon" variant="ghost" onClick={() => eliminar(r)}><Trash2 className="h-3.5 w-3.5 text-red-600" /></Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Sin restricciones</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <RestriccionDialog
          open={dialogOpen} onOpenChange={setDialogOpen}
          initial={editing} niveles={niveles} userId={user?.id ?? null}
          onSaved={() => qc.invalidateQueries({ queryKey: ["inv_restricciones"] })}
        />
        <ResolveDialog
          target={resolveTarget} onClose={() => setResolveTarget(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["inv_restricciones"] })}
        />
      </div>
    </TooltipProvider>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <TableHead className="uppercase tracking-wide text-xs font-medium">{children}</TableHead>;
}
function Kpi({ label, value, tone }: { label: string; value: number; tone: "red" | "orange" | "amber" | "green" }) {
  const colors: Record<string, string> = {
    red: "text-red-700", orange: "text-orange-700", amber: "text-amber-700", green: "text-green-700",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-3xl font-light mt-1 ${colors[tone]}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function RestriccionDialog({ open, onOpenChange, initial, niveles, userId, onSaved }: any) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState<any>(() => initial || {
    tipo: "stock_proveedor", marca: "chevron",
    aplicaSku: false, codigo_producto: "", pedido_activo_id: "", descripcion: "",
    fecha_inicio: new Date().toISOString().slice(0, 10), fecha_fin: "",
    excluir_de_pedido: true, permitir_override: false,
  });
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Re-init when opening
  useMemo(() => {
    if (open) {
      setForm(initial ? {
        ...initial,
        aplicaSku: !!initial.codigo_producto,
        pedido_activo_id: initial.pedido_activo_id || "",
        fecha_fin: initial.fecha_fin || "",
      } : {
        tipo: "stock_proveedor", marca: "chevron",
        aplicaSku: false, codigo_producto: "", pedido_activo_id: "", descripcion: "",
        fecha_inicio: new Date().toISOString().slice(0, 10), fecha_fin: "",
        excluir_de_pedido: true, permitir_override: false,
      });
      setSearch("");
    }
  }, [open, initial]);

  const matches = useMemo(() => {
    if (!search || search.length < 2) return [];
    const q = search.toLowerCase();
    return niveles.filter((n: any) =>
      (n.codigo_producto || "").toLowerCase().includes(q) ||
      (n.nombre_producto || "").toLowerCase().includes(q)
    ).slice(0, 8);
  }, [search, niveles]);

  const onSubmit = async () => {
    if (!form.descripcion?.trim()) { toast.error("La descripción es obligatoria"); return; }
    if (form.aplicaSku && !form.codigo_producto) { toast.error("Selecciona un código"); return; }
    setSaving(true);
    const payload: any = {
      tipo: form.tipo, marca: form.marca,
      codigo_producto: form.aplicaSku ? form.codigo_producto : null,
      pedido_activo_id: form.pedido_activo_id || null,
      descripcion: form.descripcion,
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
      excluir_de_pedido: !!form.excluir_de_pedido,
      permitir_override: !!form.permitir_override,
    };
    try {
      if (isEdit) {
        const { error } = await (supabase as any).from("inv_restricciones").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("inv_restricciones")
          .insert({ ...payload, activa: true, creado_por: userId });
        if (error) throw error;
      }
      toast.success(isEdit ? "Restricción actualizada" : "Restricción creada");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4 border-b shrink-0">
          <DialogTitle className="text-lg font-semibold tracking-tight">
            {isEdit ? "Editar restricción" : "Nueva restricción"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 px-5 py-5 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger className="h-9 font-light"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="legal">Legal</SelectItem>
                  <SelectItem value="stock_proveedor">Stock proveedor</SelectItem>
                  <SelectItem value="logistica">Logística</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Marca</Label>
              <Select value={form.marca} onValueChange={(v) => setForm({ ...form, marca: v })}>
                <SelectTrigger className="h-9 font-light"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="chevron">Chevron</SelectItem>
                  <SelectItem value="phillips66">Phillips 66</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between border rounded-md p-3">
            <div>
              <div className="text-sm font-medium">¿Aplica a SKU específico?</div>
              <div className="text-xs text-muted-foreground font-light">Si no, aplica a toda la marca</div>
            </div>
            <Switch checked={form.aplicaSku} onCheckedChange={(v) => setForm({ ...form, aplicaSku: v, codigo_producto: v ? form.codigo_producto : "" })} />
          </div>

          {form.aplicaSku && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Código del producto</Label>
              {form.codigo_producto ? (
                <div className="flex items-center justify-between border rounded-md p-2">
                  <div>
                    <div className="font-mono text-sm">{form.codigo_producto}</div>
                    <div className="text-xs text-muted-foreground">{niveles.find((n: any) => n.codigo_producto === form.codigo_producto)?.nombre_producto || ""}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, codigo_producto: "" })}>Cambiar</Button>
                </div>
              ) : (
                <>
                  <Input className="h-9 font-light" placeholder="Buscar código o nombre…" value={search} onChange={(e) => setSearch(e.target.value)} />
                  {matches.length > 0 && (
                    <div className="border rounded-md max-h-48 overflow-auto">
                      {matches.map((m: any) => (
                        <button key={m.codigo_producto} type="button" className="w-full text-left px-3 py-2 hover:bg-muted/40 border-b last:border-b-0"
                          onClick={() => { setForm({ ...form, codigo_producto: m.codigo_producto }); setSearch(""); }}>
                          <div className="font-mono text-xs">{m.codigo_producto}</div>
                          <div className="text-xs text-muted-foreground truncate">{m.nombre_producto}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Pedido afectado</Label>
            <Select value={form.pedido_activo_id || "todos"} onValueChange={(v) => setForm({ ...form, pedido_activo_id: v === "todos" ? "" : v })}>
              <SelectTrigger className="h-9 font-light"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {PEDIDOS_ACTIVOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Descripción *</Label>
            <Textarea className="font-light" rows={3} value={form.descripcion || ""} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Fecha inicio</Label>
              <Input type="date" className="h-9 font-light" value={form.fecha_inicio || ""} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Fecha fin (opcional)</Label>
              <Input type="date" className="h-9 font-light" value={form.fecha_fin || ""} onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between border rounded-md p-3">
              <div>
                <div className="text-sm font-medium">Excluir de pedido</div>
                <div className="text-xs text-muted-foreground font-light">El SKU se omite al calcular pedidos sugeridos</div>
              </div>
              <Switch checked={!!form.excluir_de_pedido} onCheckedChange={(v) => setForm({ ...form, excluir_de_pedido: v })} />
            </div>
            <div className="flex items-center justify-between border rounded-md p-3">
              <div>
                <div className="text-sm font-medium">Permitir override manual</div>
                <div className="text-xs text-muted-foreground font-light">El usuario puede ignorar la restricción</div>
              </div>
              <Switch checked={!!form.permitir_override} onCheckedChange={(v) => setForm({ ...form, permitir_override: v })} />
            </div>
          </div>
        </div>
        <DialogFooter className="border-t bg-muted/30 px-5 py-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={saving}>{saving ? "Guardando…" : (isEdit ? "Actualizar" : "Crear")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResolveDialog({ target, onClose, onSaved }: any) {
  const [notas, setNotas] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useMemo(() => { if (target) { setNotas(""); setFecha(new Date().toISOString().slice(0, 10)); } }, [target]);

  if (!target) return null;

  const onSubmit = async () => {
    setSaving(true);
    const { error } = await (supabase as any).from("inv_restricciones").update({
      resuelta: true, activa: false, fecha_resolucion: fecha, notas_resolucion: notas || null,
    }).eq("id", target.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Restricción resuelta");
    onSaved?.();
    onClose();
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4 border-b">
          <DialogTitle className="text-lg font-semibold tracking-tight">Resolver restricción</DialogTitle>
        </DialogHeader>
        <div className="px-5 py-5 space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Fecha de resolución</Label>
            <Input type="date" className="h-9 font-light" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Notas de resolución</Label>
            <Textarea className="font-light" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="border-t bg-muted/30 px-5 py-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={saving}>{saving ? "Guardando…" : "Resolver"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}