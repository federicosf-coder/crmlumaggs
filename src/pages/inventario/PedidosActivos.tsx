import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList, Package, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ALMACEN_LABELS } from "@/hooks/useInventario";
import { usePedidos, estatusPedidoColor, ESTATUS_PEDIDO_LABEL } from "@/hooks/usePedidosInventario";
import PedidoDetailSheet from "@/components/inventario/PedidoDetailSheet";

type Pedido = {
  id: string;
  numero_po_interno: string | null;
  numero_orden_proveedor: string | null;
  almacen_destino: string | null;
  fecha_pedido: string | null;
  fecha_entrega_estimada: string | null;
  total_tarimas: number | null;
  total_monto: number | null;
  moneda: string | null;
  estatus: string | null;
  proveedor: string | null;
};

const TABS = [
  { key: "chevron", label: "Chevron", value: "chevron" },
  { key: "phillips66", label: "Phillips 66", value: "phillips66" },
  { key: "gonher", label: "Gonher", value: "gonher" },
];

export default function PedidosActivos() {
  const { data: pedidos = [], isLoading } = usePedidos();
  const [tab, setTab] = useState("chevron");
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const l = await (supabase as any).from("inv_pedido_lineas").delete().eq("pedido_id", deleteId);
      if (l.error) throw l.error;
      const a = await (supabase as any).from("inv_pedido_archivos").delete().eq("pedido_id", deleteId);
      if (a.error) throw a.error;
      const p = await (supabase as any).from("inv_pedidos").delete().eq("id", deleteId);
      if (p.error) throw p.error;
      toast.success("Pedido eliminado");
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ["inv_pedidos"] });
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar");
    } finally { setDeleting(false); }
  };

  const totalTarimasAbiertas = useMemo(() => {
    return pedidos.reduce((acc: number, p: Pedido) => {
      if (p.estatus === "recibido" || p.estatus === "cancelado") return acc;
      return acc + (p.total_tarimas || 0);
    }, 0);
  }, [pedidos]);

  const byProveedor = useMemo(() => {
    const map: Record<string, Pedido[]> = { chevron: [], phillips66: [], gonher: [] };
    for (const p of pedidos) {
      const key = p.proveedor || "chevron";
      if (!map[key]) map[key] = [];
      map[key].push(p);
    }
    // Cada grupo ya viene ordenado por fecha_pedido descendente desde usePedidos
    return map;
  }, [pedidos]);

  const formatMonto = (p: Pedido) => {
    const monto = Number(p.total_monto || 0);
    const moneda = p.moneda || "MXN";
    return `${monto.toLocaleString("es-MX", { minimumFractionDigits: 2 })} ${moneda}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-light flex items-center gap-2 tracking-tight">
            <ClipboardList className="h-6 w-6" /> Pedidos Activos
          </h1>
          <p className="text-xs text-muted-foreground font-light mt-1">
            Pedidos subidos vía PDF desde "Subir Pedidos"
          </p>
        </div>
        <Badge variant="outline" className="text-sm px-3 py-1">
          <Package className="h-4 w-4 mr-2" />
          Total tarimas abiertas:
          <span className="font-semibold ml-1">{totalTarimasAbiertas}</span>
        </Badge>
      </div>

      {isLoading && <div className="text-muted-foreground text-sm">Cargando…</div>}

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.value} className="gap-2">
              {t.label}
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {byProveedor[t.value]?.length || 0}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => {
          const rows = byProveedor[t.value] || [];
          return (
            <TabsContent key={t.key} value={t.value} className="space-y-4">
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-gradient-to-r from-violet-50 to-blue-50">
                      <TableRow>
                        <TableHead className="uppercase tracking-wide text-xs font-medium">PO interno</TableHead>
                        <TableHead className="uppercase tracking-wide text-xs font-medium">N° Orden</TableHead>
                        <TableHead className="uppercase tracking-wide text-xs font-medium">Almacén destino</TableHead>
                        <TableHead className="uppercase tracking-wide text-xs font-medium">Fecha pedido</TableHead>
                        <TableHead className="uppercase tracking-wide text-xs font-medium">Fecha entrega estimada</TableHead>
                        <TableHead className="uppercase tracking-wide text-xs font-medium text-right">Total tarimas</TableHead>
                        <TableHead className="uppercase tracking-wide text-xs font-medium text-right">Monto</TableHead>
                        <TableHead className="uppercase tracking-wide text-xs font-medium">Estatus</TableHead>
                        <TableHead className="uppercase tracking-wide text-xs font-medium text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                            No hay pedidos de {t.label}.
                          </TableCell>
                        </TableRow>
                      )}
                      {rows.map((p, idx) => (
                        <TableRow
                          key={p.id}
                          className={`cursor-pointer ${idx % 2 === 0 ? "bg-background" : "bg-muted/20"} hover:bg-blue-50/40`}
                          onClick={() => setOpenId(p.id)}
                        >
                          <TableCell className="font-mono text-xs">{p.numero_po_interno || "—"}</TableCell>
                          <TableCell className="text-sm">{p.numero_orden_proveedor || "—"}</TableCell>
                          <TableCell className="text-sm">{ALMACEN_LABELS[p.almacen_destino || ""] || p.almacen_destino || "—"}</TableCell>
                          <TableCell className="text-sm">{p.fecha_pedido || "—"}</TableCell>
                          <TableCell className="text-sm">{p.fecha_entrega_estimada || "—"}</TableCell>
                          <TableCell className="text-sm text-right">{p.total_tarimas ?? 0}</TableCell>
                          <TableCell className="text-sm text-right tabular-nums">{formatMonto(p)}</TableCell>
                          <TableCell>
                            <Badge className={estatusPedidoColor(p.estatus)}>
                              {ESTATUS_PEDIDO_LABEL[p.estatus || ""] || p.estatus || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => { e.stopPropagation(); setDeleteId(p.id); }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      <PedidoDetailSheet id={openId} onClose={() => setOpenId(null)} onDelete={(id) => setDeleteId(id)} />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán también sus líneas y archivos asociados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={(e) => { e.preventDefault(); confirmDelete(); }}>
              {deleting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
