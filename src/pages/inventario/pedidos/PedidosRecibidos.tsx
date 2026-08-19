import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { useRecepciones } from "@/hooks/usePedidosInventario";
import RecepcionDialog from "@/components/inventario/RecepcionDialog";

export default function PedidosRecibidos() {
  const { data: recepciones = [] } = useRecepciones();
  const [open, setOpen] = useState(false);
  const [params] = useSearchParams();

  useEffect(() => { if (params.get("pedido")) setOpen(true); }, [params]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Registrar recepción</Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-gradient-to-r from-violet-50 to-blue-50">
              <TableRow>
                {["Fecha","Pedido PO","Almacén","SKUs pedidos","Completos","Diferencias","¿Reclamo?"].map((h) =>
                  <TableHead key={h} className="uppercase tracking-wide text-xs font-medium">{h}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {recepciones.map((r, i) => (
                <TableRow key={r.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                  <TableCell className="text-xs">{r.fecha_recepcion}</TableCell>
                  <TableCell className="font-mono text-xs">{r.inv_pedidos?.numero_po_interno || "—"}</TableCell>
                  <TableCell>{r.almacen_recepcion}</TableCell>
                  <TableCell className="text-right">{r.total_skus_pedidos ?? 0}</TableCell>
                  <TableCell className="text-right">{r.total_skus_recibidos_completos ?? 0}</TableCell>
                  <TableCell className="text-right">{r.total_skus_con_diferencia ?? 0}</TableCell>
                  <TableCell>{r.tiene_reclamo ? <Badge variant="destructive">Sí</Badge> : <Badge variant="outline">No</Badge>}</TableCell>
                </TableRow>
              ))}
              {recepciones.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Sin recepciones</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NuevaRecepcionDialog open={open} onOpenChange={setOpen} pedidoIdInicial={params.get("pedido")} />
    </div>
  );
}

function NuevaRecepcionDialog({ open, onOpenChange, pedidoIdInicial }: any) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: pedidos = [] } = usePedidos();
  const [pedidoId, setPedidoId] = useState<string>(pedidoIdInicial || "");
  const [lineas, setLineas] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [alertOpen, setAlertOpen] = useState<{ recepcionId: string; pedidoId: string } | null>(null);

  const elegibles = pedidos.filter((p) => ["en_transito", "confirmado_proveedor"].includes(p.estatus));
  const pedido = pedidos.find((p) => p.id === pedidoId);

  useEffect(() => {
    if (!pedidoId) { setLineas([]); return; }
    (async () => {
      const { data } = await (supabase as any).from("inv_pedido_lineas").select("*").eq("pedido_id", pedidoId);
      setLineas((data || []).map((l: any) => ({ ...l, recibido: l.cantidad_solicitada, tipo: "completo" })));
    })();
  }, [pedidoId]);

  useEffect(() => { if (pedidoIdInicial) setPedidoId(pedidoIdInicial); }, [pedidoIdInicial]);

  const onSave = async () => {
    if (!pedido) return;
    setSaving(true);
    try {
      const diffs = lineas.map((l) => ({ ...l, diferencia: Number(l.recibido) - Number(l.cantidad_solicitada) }));
      const completos = diffs.filter((d) => d.diferencia === 0).length;
      const conDif = diffs.filter((d) => d.diferencia !== 0).length;
      const { data: rec, error } = await (supabase as any).from("inv_recepciones").insert({
        pedido_id: pedido.id, almacen_recepcion: pedido.almacen_destino,
        fecha_recepcion: new Date().toISOString().slice(0, 10),
        recibido_por: user?.id ?? null, total_skus_pedidos: lineas.length,
        total_skus_recibidos_completos: completos, total_skus_con_diferencia: conDif,
        tiene_reclamo: false,
      }).select().single();
      if (error) throw error;
      await (supabase as any).from("inv_recepcion_lineas").insert(diffs.map((d) => ({
        recepcion_id: rec.id, pedido_linea_id: d.id, codigo_producto: d.codigo_producto,
        nombre_producto: d.nombre_producto, cantidad_pedida: d.cantidad_solicitada,
        cantidad_recibida: Number(d.recibido), diferencia: d.diferencia, tipo_diferencia: d.tipo,
      })));
      const nuevoEstatus = conDif === 0 ? "cerrado" : "recibido_parcial";
      await (supabase as any).from("inv_pedidos").update({ estatus: nuevoEstatus, fecha_entrega_real: new Date().toISOString().slice(0, 10) }).eq("id", pedido.id);
      toast.success("Recepción registrada");
      qc.invalidateQueries();
      if (conDif > 0) setAlertOpen({ recepcionId: rec.id, pedidoId: pedido.id });
      else onOpenChange(false);
    } catch (e: any) { toast.error(e?.message || "Error"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 -mx-6 -mt-6 p-6 rounded-t-lg">
            <DialogTitle className="font-light">Registrar recepción</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Select value={pedidoId} onValueChange={setPedidoId}>
              <SelectTrigger><SelectValue placeholder="Selecciona un pedido" /></SelectTrigger>
              <SelectContent>
                {elegibles.map((p) => <SelectItem key={p.id} value={p.id}>{p.numero_po_interno} — {p.almacen_destino}</SelectItem>)}
              </SelectContent>
            </Select>
            {lineas.length > 0 && (
              <div className="border rounded overflow-x-auto max-h-[400px]">
                <Table>
                  <TableHeader className="bg-muted/40 sticky top-0">
                    <TableRow>{["Código","Producto","Pedido","Recibido","Dif.","Tipo"].map((h) => <TableHead key={h} className="text-xs uppercase">{h}</TableHead>)}</TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineas.map((l, idx) => {
                      const dif = Number(l.recibido) - Number(l.cantidad_solicitada);
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="font-mono text-xs">{l.codigo_producto}</TableCell>
                          <TableCell className="text-xs max-w-[180px] truncate">{l.nombre_producto || "—"}</TableCell>
                          <TableCell className="text-right">{l.cantidad_solicitada}</TableCell>
                          <TableCell><Input type="number" value={l.recibido} className="w-24 h-8" onChange={(e) => {
                            const c = [...lineas]; c[idx] = { ...c[idx], recibido: e.target.value }; setLineas(c);
                          }} /></TableCell>
                          <TableCell className={`text-right text-xs ${dif < 0 ? "text-red-600 font-semibold" : dif > 0 ? "text-amber-600" : ""}`}>{dif}</TableCell>
                          <TableCell>
                            <Select value={l.tipo} onValueChange={(v) => { const c = [...lineas]; c[idx] = { ...c[idx], tipo: v }; setLineas(c); }}>
                              <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>{TIPO_DIF.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter className="bg-muted/30 -mx-6 -mb-6 p-4 rounded-b-lg">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={onSave} disabled={saving || !pedidoId}>{saving ? "Guardando..." : "Guardar recepción"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!alertOpen} onOpenChange={() => setAlertOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Diferencias detectadas</AlertDialogTitle>
            <AlertDialogDescription>Se detectaron SKUs con diferencias. ¿Deseas generar un reclamo?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setAlertOpen(null); onOpenChange(false); }}>No</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              const a = alertOpen!; setAlertOpen(null); onOpenChange(false);
              navigate(`/inventario/pedidos/reclamos?recepcion=${a.recepcionId}&pedido=${a.pedidoId}`);
            }}>Sí, crear reclamo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}