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
import { Plus, Upload, Trash2, Mail, FileText } from "lucide-react";
import { useReclamos } from "@/hooks/usePedidosInventario";

const ESTATUS_FLOW = ["borrador", "enviado", "aceptado", "rechazado", "en_aclaracion"];
const ESTATUS_LABEL: Record<string, string> = {
  borrador: "Borrador", enviado: "Enviado", aceptado: "Aceptado",
  rechazado: "Rechazado", en_aclaracion: "En Aclaración",
  abierto: "Abierto", enviado_proveedor: "Enviado a proveedor",
  en_revision: "En revisión", resuelto: "Resuelto", cerrado: "Cerrado",
};

const RECLAMOS_FROM = "Lumaggs Reclamos <reclamos@correo.lumaggs.com.mx>";
const RECLAMOS_FROM_EMAIL = "reclamos@correo.lumaggs.com.mx";
const PROVEEDOR_EMAIL = "cvxordensmexico@chevron.com";

function fmtFecha(d?: string | null) {
  if (!d) return "—";
  const iso = d.length === 10 ? `${d}T00:00:00` : d;
  return new Date(iso).toLocaleDateString("es-MX");
}
function fmtFechaHora(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}
function esc(s: any) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function hoyISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}
function fmtMoney(n?: number | null) {
  return `$${Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function estatusReclamoColor(e: string) {
  return {
    borrador: "bg-gray-100 text-gray-700", abierto: "bg-gray-100 text-gray-700",
    enviado: "bg-blue-100 text-blue-800", enviado_proveedor: "bg-blue-100 text-blue-800",
    aceptado: "bg-green-100 text-green-800", resuelto: "bg-green-100 text-green-800",
    rechazado: "bg-red-100 text-red-800",
    en_aclaracion: "bg-amber-100 text-amber-800", en_revision: "bg-amber-100 text-amber-800",
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
              <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estatus</SelectItem>
                {ESTATUS_FLOW.map((e) => <SelectItem key={e} value={e}>{ESTATUS_LABEL[e]}</SelectItem>)}
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
              <TableRow>{["Pedido", "Factura", "Cliente", "No. Pedido Factura", "Fecha Reclamo", "SKUs", "Estatus", "Enviado"].map((h) =>
                <TableHead key={h} className="uppercase tracking-wide text-xs font-medium">{h}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r, i) => (
                <TableRow key={r.id} className={`cursor-pointer ${i % 2 === 0 ? "" : "bg-muted/20"}`} onClick={() => setDetailId(r.id)}>
                  <TableCell className="font-mono text-xs">{r.inv_pedidos?.numero_po_interno || "—"}</TableCell>
                  <TableCell className="text-xs">{r.chevron_facturas_recibidas?.folio ? `Folio ${r.chevron_facturas_recibidas.folio}` : "—"}</TableCell>
                  <TableCell className="text-xs font-medium">{r.cliente_nombre || "LUMAGGS"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.no_pedido_factura || "—"}</TableCell>
                  <TableCell className="text-xs">{fmtFecha(r.fecha_reclamo)}</TableCell>
                  <TableCell className="text-right">{r.total_skus_afectados ?? 0}</TableCell>
                  <TableCell>
                    <Badge className={estatusReclamoColor(r.estatus)}>{ESTATUS_LABEL[r.estatus] || r.estatus}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{r.fecha_envio ? fmtFechaHora(r.fecha_envio) : "—"}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Sin reclamos</TableCell></TableRow>
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
