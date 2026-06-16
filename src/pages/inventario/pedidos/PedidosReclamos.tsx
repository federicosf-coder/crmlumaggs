import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Plus, Upload, Trash2 } from "lucide-react";
import { useReclamos } from "@/hooks/usePedidosInventario";

const TIPOS = ["faltante", "danado", "incorrecto", "otro"];
const ESTATUS_FLOW = ["abierto", "enviado_proveedor", "en_revision", "resuelto", "cerrado"];

function estatusReclamoColor(e: string) {
  return {
    abierto: "bg-gray-100 text-gray-700", enviado_proveedor: "bg-blue-100 text-blue-800",
    en_revision: "bg-amber-100 text-amber-800", resuelto: "bg-green-100 text-green-800",
    cerrado: "bg-slate-200 text-slate-700",
  }[e] || "bg-gray-100";
}

export default function PedidosReclamos() {
  const { data: reclamos = [] } = useReclamos();
  const [params] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [empresa, setEmpresa] = useState("todas");
  const [estatus, setEstatus] = useState("todos");

  useEffect(() => { if (params.get("recepcion")) setOpen(true); }, [params]);

  const filtered = reclamos.filter((r) => {
    if (empresa !== "todas" && r.empresa_vendedora !== empresa) return false;
    if (estatus !== "todos" && r.estatus !== estatus) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex gap-2">
            <Select value={empresa} onValueChange={setEmpresa}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="lumaggs">Lumaggs</SelectItem>
                <SelectItem value="galsa">Galsa</SelectItem>
              </SelectContent>
            </Select>
            <Select value={estatus} onValueChange={setEstatus}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estatus</SelectItem>
                {ESTATUS_FLOW.map((e) => <SelectItem key={e} value={e}>{e.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Nuevo reclamo</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-gradient-to-r from-violet-50 to-blue-50">
              <TableRow>{["PO","Empresa","Tipo","SKUs","Estatus","Creado","Enviado"].map((h) =>
                <TableHead key={h} className="uppercase tracking-wide text-xs font-medium">{h}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r, i) => (
                <TableRow key={r.id} className={`cursor-pointer ${i % 2 === 0 ? "" : "bg-muted/20"}`} onClick={() => setDetailId(r.id)}>
                  <TableCell className="font-mono text-xs">{r.inv_pedidos?.numero_po_interno || "—"}</TableCell>
                  <TableCell>{r.empresa_vendedora}</TableCell>
                  <TableCell><Badge variant="outline">{r.tipo_reclamo}</Badge></TableCell>
                  <TableCell className="text-right">{r.total_skus_afectados ?? 0}</TableCell>
                  <TableCell><Badge className={estatusReclamoColor(r.estatus)}>{r.estatus.replace("_", " ")}</Badge></TableCell>
                  <TableCell className="text-xs">{r.created_at ? new Date(r.created_at).toLocaleDateString("es-MX") : "—"}</TableCell>
                  <TableCell className="text-xs">{r.fecha_envio_proveedor || "—"}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Sin reclamos</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NuevoReclamoDialog open={open} onOpenChange={setOpen} recepcionId={params.get("recepcion")} pedidoId={params.get("pedido")} />
      <ReclamoDetailSheet id={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

function NuevoReclamoDialog({ open, onOpenChange, recepcionId, pedidoId }: any) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tipo, setTipo] = useState("faltante");
  const [descripcion, setDescripcion] = useState("");
  const [lineas, setLineas] = useState<any[]>([]);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !recepcionId) return;
    (async () => {
      const { data } = await (supabase as any).from("inv_recepcion_lineas").select("*").eq("recepcion_id", recepcionId).neq("diferencia", 0);
      setLineas((data || []).map((d: any) => ({
        codigo_producto: d.codigo_producto, nombre_producto: d.nombre_producto,
        cantidad_afectada: Math.abs(d.diferencia || 0), tipo_problema: d.tipo_diferencia || "faltante",
        descripcion_problema: "",
      })));
    })();
  }, [open, recepcionId]);

  const onSave = async () => {
    if (!pedidoId || !recepcionId) { toast.error("Falta pedido/recepción"); return; }
    setSaving(true);
    try {
      const { data: pedido } = await (supabase as any).from("inv_pedidos").select("empresa_vendedora").eq("id", pedidoId).single();
      const { data: rec, error } = await (supabase as any).from("inv_reclamos").insert({
        pedido_id: pedidoId, recepcion_id: recepcionId, empresa_vendedora: pedido.empresa_vendedora,
        tipo_reclamo: tipo, descripcion, estatus: "abierto",
        total_skus_afectados: lineas.length, creado_por: user?.id ?? null,
      }).select().single();
      if (error) throw error;
      if (lineas.length) await (supabase as any).from("inv_reclamo_lineas").insert(lineas.map((l) => ({ reclamo_id: rec.id, ...l })));
      for (const f of archivos) {
        const path = `${rec.id}/${Date.now()}_${f.name}`;
        const { error: uErr } = await supabase.storage.from("inventario-reclamos").upload(path, f);
        if (!uErr) await (supabase as any).from("inv_reclamo_archivos").insert({
          reclamo_id: rec.id, nombre_archivo: f.name, url_archivo: path,
          tipo_archivo: f.type, usuario_carga: user?.id ?? null,
        });
      }
      await (supabase as any).from("inv_recepciones").update({ tiene_reclamo: true }).eq("id", recepcionId);
      toast.success("Reclamo creado");
      qc.invalidateQueries();
      onOpenChange(false);
      setLineas([]); setArchivos([]); setDescripcion("");
    } catch (e: any) { toast.error(e?.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 -mx-6 -mt-6 p-6 rounded-t-lg">
          <DialogTitle className="font-light">Nuevo reclamo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs uppercase">Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label className="text-xs uppercase">Descripción</Label>
            <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} />
          </div>
          {lineas.length > 0 && (
            <div className="border rounded overflow-x-auto max-h-[260px]">
              <Table>
                <TableHeader className="bg-muted/40 sticky top-0">
                  <TableRow>{["Código","Producto","Cant.","Tipo","Descripción",""].map((h) => <TableHead key={h} className="text-xs uppercase">{h}</TableHead>)}</TableRow>
                </TableHeader>
                <TableBody>
                  {lineas.map((l, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">{l.codigo_producto}</TableCell>
                      <TableCell className="text-xs max-w-[160px] truncate">{l.nombre_producto}</TableCell>
                      <TableCell><Input type="number" value={l.cantidad_afectada} className="w-20 h-8" onChange={(e) => { const c = [...lineas]; c[idx].cantidad_afectada = e.target.value; setLineas(c); }} /></TableCell>
                      <TableCell>
                        <Select value={l.tipo_problema} onValueChange={(v) => { const c = [...lineas]; c[idx].tipo_problema = v; setLineas(c); }}>
                          <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell><Input value={l.descripcion_problema} className="h-8" onChange={(e) => { const c = [...lineas]; c[idx].descripcion_problema = e.target.value; setLineas(c); }} /></TableCell>
                      <TableCell><Button variant="ghost" size="sm" onClick={() => setLineas(lineas.filter((_, i) => i !== idx))}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div>
            <Label className="text-xs uppercase">Fotos / archivos</Label>
            <div className="flex items-center gap-2">
              <label className="inline-block">
                <input type="file" multiple className="hidden" onChange={(e) => setArchivos([...archivos, ...Array.from(e.target.files || [])])} />
                <Button asChild size="sm" variant="outline"><span><Upload className="h-3.5 w-3.5 mr-1.5" />Agregar archivos</span></Button>
              </label>
              <span className="text-xs text-muted-foreground">{archivos.length} archivo(s)</span>
            </div>
          </div>
        </div>
        <DialogFooter className="bg-muted/30 -mx-6 -mb-6 p-4 rounded-b-lg">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "Guardando..." : "Crear reclamo"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReclamoDetailSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [data, setData] = useState<any>(null);
  const [resolucion, setResolucion] = useState("");

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: rec } = await (supabase as any).from("inv_reclamos").select("*").eq("id", id).single();
      const { data: lin } = await (supabase as any).from("inv_reclamo_lineas").select("*").eq("reclamo_id", id);
      const { data: arc } = await (supabase as any).from("inv_reclamo_archivos").select("*").eq("reclamo_id", id);
      setData({ reclamo: rec, lineas: lin || [], archivos: arc || [] });
      setResolucion(rec?.resolucion || "");
    })();
  }, [id]);

  if (!id) return null;
  const r = data?.reclamo;

  const cambiarEstatus = async (nuevo: string) => {
    const update: any = { estatus: nuevo };
    if (nuevo === "enviado_proveedor") update.fecha_envio_proveedor = new Date().toISOString().slice(0, 10);
    if (nuevo === "resuelto") update.fecha_resolucion = new Date().toISOString().slice(0, 10);
    if (resolucion) update.resolucion = resolucion;
    await (supabase as any).from("inv_reclamos").update(update).eq("id", id);
    toast.success("Estatus actualizado");
    qc.invalidateQueries({ queryKey: ["inv_reclamos"] });
    setData({ ...data, reclamo: { ...r, ...update } });
  };

  const guardarResolucion = async () => {
    await (supabase as any).from("inv_reclamos").update({ resolucion }).eq("id", id);
    toast.success("Resolución guardada");
  };

  return (
    <Sheet open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="bg-gradient-to-r from-violet-50 to-blue-50 -mx-6 -mt-6 p-6">
          <SheetTitle className="font-light">Reclamo</SheetTitle>
        </SheetHeader>
        {r && (
          <div className="space-y-5 mt-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-[10px] uppercase text-muted-foreground">Tipo</div><div>{r.tipo_reclamo}</div></div>
              <div><div className="text-[10px] uppercase text-muted-foreground">Estatus</div><Badge className={estatusReclamoColor(r.estatus)}>{r.estatus.replace("_", " ")}</Badge></div>
              <div className="col-span-2"><div className="text-[10px] uppercase text-muted-foreground">Descripción</div><div className="text-sm">{r.descripcion || "—"}</div></div>
            </div>

            <div className="flex flex-wrap gap-2">
              {ESTATUS_FLOW.filter((e) => e !== r.estatus).map((e) => (
                <Button key={e} size="sm" variant="outline" onClick={() => cambiarEstatus(e)}>{e.replace("_", " ")}</Button>
              ))}
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">SKUs afectados</div>
              <div className="border rounded overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40"><TableRow>{["Código","Producto","Cant.","Tipo"].map((h) => <TableHead key={h} className="text-xs uppercase">{h}</TableHead>)}</TableRow></TableHeader>
                  <TableBody>
                    {data?.lineas.map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono text-xs">{l.codigo_producto}</TableCell>
                        <TableCell className="text-xs max-w-[160px] truncate">{l.nombre_producto || "—"}</TableCell>
                        <TableCell className="text-right">{l.cantidad_afectada}</TableCell>
                        <TableCell className="text-xs">{l.tipo_problema || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Archivos</div>
              <div className="space-y-1 text-sm">
                {data?.archivos.map((a: any) => <div key={a.id} className="border rounded p-2 text-xs">{a.nombre_archivo}</div>)}
                {!data?.archivos.length && <div className="text-xs text-muted-foreground">Sin archivos</div>}
              </div>
            </div>

            <div>
              <Label className="text-xs uppercase">Resolución</Label>
              <Textarea value={resolucion} onChange={(e) => setResolucion(e.target.value)} rows={3} />
              <Button size="sm" className="mt-2" onClick={guardarResolucion}>Guardar resolución</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}