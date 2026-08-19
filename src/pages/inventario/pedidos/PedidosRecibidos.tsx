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

      <RecepcionDialog open={open} onOpenChange={setOpen} pedidoId={params.get("pedido")} />
    </div>
  );
}
