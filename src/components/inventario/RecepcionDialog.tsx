import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { usePedidos } from "@/hooks/usePedidosInventario";

const TIPO_DIF = ["completo", "faltante", "sobrante", "danado", "incorrecto"];
const ESTATUS_ELEGIBLES = ["elaborado", "en_transito", "confirmado_proveedor", "enviado", "recibido_parcial"];

export default function RecepcionDialog({
  open,
  onOpenChange,
  pedidoId: pedidoIdProp,
  lockPedido = false,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pedidoId?: string | null;
  lockPedido?: boolean;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: pedidos = [] } = usePedidos();
  const [pedidoId, setPedidoId] = useState<string>(pedidoIdProp || "");
  const [lineas, setLineas] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [alertOpen, setAlertOpen] = useState<{ recepcionId: string; pedidoId: string } | null>(null);

  const elegibles = pedidos.filter((p: any) => ESTATUS_ELEGIBLES.includes(p.estatus));
  const pedido = pedidos.find((p: any) => p.id === pedidoId);

  useEffect(() => { if (pedidoIdProp) setPedidoId(pedidoIdProp); }, [pedidoIdProp]);

  useEffect(() => {
    if (!pedidoId || !open) { setLineas([]); return; }
    (async () => {
      const { data } = await (supabase as any).from("inv_pedido_lineas").select("*").eq("pedido_id", pedidoId).order("created_at");
      setLineas((data || []).map((l: any) => ({
        ...l,
        recibido: l.cantidad_recibida ?? l.cantidad_solicitada ?? 0,
        tipo: "completo",
      })));
    })();
  }, [pedidoId, open]);

  const setLinea = (idx: number, patch: any) => {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const onSave = async () => {
    if (!pedido) return;
    setSaving(true);
    try {
      const diffs = lineas.map((l) => ({ ...l, diferencia: Number(l.recibido || 0) - Number(l.cantidad_solicitada || 0) }));
      const completos = diffs.filter((d) => d.diferencia === 0).length;
      const conDif = diffs.filter((d) => d.diferencia !== 0).length;

      const { data: rec, error } = await (supabase as any).from("inv_recepciones").insert({
        pedido_id: pedido.id,
        almacen_recepcion: pedido.almacen_destino,
        fecha_recepcion: new Date().toISOString().slice(0, 10),
        recibido_por: user?.id ?? null,
        total_skus_pedidos: lineas.length,
        total_skus_recibidos_completos: completos,
        total_skus_con_diferencia: conDif,
        tiene_reclamo: false,
      }).select().single();
      if (error) throw error;

      const { error: le } = await (supabase as any).from("inv_recepcion_lineas").insert(diffs.map((d) => ({
        recepcion_id: rec.id,
        pedido_linea_id: d.id,
        codigo_producto: d.codigo_producto,
        nombre_producto: d.nombre_producto,
        cantidad_pedida: d.cantidad_solicitada,
        cantidad_recibida: Number(d.recibido || 0),
        diferencia: d.diferencia,
        tipo_diferencia: d.tipo,
      })));
      if (le) throw le;

      // Guardar cantidad recibida y estatus en las líneas del pedido
      for (const d of diffs) {
        await (supabase as any).from("inv_pedido_lineas").update({
          cantidad_recibida: Number(d.recibido || 0),
          estatus_linea: d.diferencia === 0 ? "recibida_completa" : Number(d.recibido || 0) === 0 ? "faltante" : "recibida_parcial",
        }).eq("id", d.id);
      }

      const nuevoEstatus = conDif === 0 ? "recibido" : "recibido_parcial";
      await (supabase as any).from("inv_pedidos").update({
        estatus: nuevoEstatus,
        fecha_entrega_real: new Date().toISOString().slice(0, 10),
      }).eq("id", pedido.id);

      toast.success("Recepción registrada");
      qc.invalidateQueries();
      if (conDif > 0) setAlertOpen({ recepcionId: rec.id, pedidoId: pedido.id });
      else onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar la recepción");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 -mx-6 -mt-6 p-6 rounded-t-lg">
            <DialogTitle className="font-light">Registrar recepción</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {lockPedido ? (
              <div className="text-sm font-light">
                Pedido <span className="font-mono font-medium">{pedido?.numero_po_interno || "—"}</span>
                {pedido?.almacen_destino ? ` — Almacén ${pedido.almacen_destino}` : ""}
              </div>
            ) : (
              <Select value={pedidoId} onValueChange={setPedidoId}>
                <SelectTrigger><SelectValue placeholder="Selecciona un pedido" /></SelectTrigger>
                <SelectContent>
                  {elegibles.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.numero_po_interno} — {p.almacen_destino}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground font-light">
              Ajusta la cantidad recibida de cada producto. Por defecto viene la cantidad pedida.
            </p>
            {lineas.length > 0 && (
              <div className="border rounded overflow-x-auto max-h-[400px]">
                <Table>
                  <TableHeader className="bg-muted/40 sticky top-0">
                    <TableRow>{["Código","Producto","Pedido","Recibido","Dif.","Tipo"].map((h) => <TableHead key={h} className="text-xs uppercase">{h}</TableHead>)}</TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineas.map((l, idx) => {
                      const dif = Number(l.recibido || 0) - Number(l.cantidad_solicitada || 0);
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="font-mono text-xs">{l.codigo_producto}</TableCell>
                          <TableCell className="text-xs max-w-[180px] truncate">{l.nombre_producto || "—"}</TableCell>
                          <TableCell className="text-right">{l.cantidad_solicitada}</TableCell>
                          <TableCell>
                            <Input type="number" value={l.recibido} className="w-24 h-8"
                              onChange={(e) => setLinea(idx, { recibido: e.target.value, tipo: Number(e.target.value || 0) === Number(l.cantidad_solicitada || 0) ? "completo" : Number(e.target.value || 0) < Number(l.cantidad_solicitada || 0) ? "faltante" : "sobrante" })} />
                          </TableCell>
                          <TableCell className={`text-right text-xs ${dif < 0 ? "text-red-600 font-semibold" : dif > 0 ? "text-amber-600" : ""}`}>{dif}</TableCell>
                          <TableCell>
                            <Select value={l.tipo} onValueChange={(v) => setLinea(idx, { tipo: v })}>
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