import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Link2 } from "lucide-react";
import { parseLineasChevron } from "./chevronCfdiLineas";

const money = (v: number | null | undefined) =>
  v == null ? "—" : Number(v).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const qty = (v: number) => v.toLocaleString("es-MX", { maximumFractionDigits: 2 });

interface Props {
  factura: any | null;
  pedidoLabel: string | null;
  onClose: () => void;
  onVincular: () => void;
  onPdf: (path: string | null) => void;
}

export function ChevronFacturaDetalleDialog({ factura, pedidoLabel, onClose, onVincular, onPdf }: Props) {
  const { data: xml, isLoading } = useQuery({
    queryKey: ["chevron_factura_xml", factura?.id],
    enabled: !!factura?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("chevron_facturas_recibidas")
        .select("xml_raw")
        .eq("id", factura.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.xml_raw as string) || null;
    },
  });
  const lineas = parseLineasChevron(xml);
  const folio = factura ? [factura.serie, factura.folio].filter(Boolean).join("-") || factura.folio_fiscal.slice(0, 8) : "";

  const Dato = ({ l, v }: { l: string; v: React.ReactNode }) => (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{l}</p>
      <p className="text-xs font-light mt-0.5">{v}</p>
    </div>
  );

  return (
    <Dialog open={!!factura} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 p-5 border-b border-border/40">
          <DialogTitle className="text-xl font-light tracking-tight flex items-center gap-2 flex-wrap">
            Factura {folio}
            {factura?.pedido_id ? (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Vinculada</Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Sin pedido</Badge>
            )}
          </DialogTitle>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{factura?.folio_fiscal}</p>
        </DialogHeader>
        {factura && (
          <div className="p-5 space-y-4 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Dato l="Fecha" v={factura.fecha ? new Date(factura.fecha).toLocaleDateString("es-MX") : "—"} />
              <Dato l="Subtotal" v={money(factura.subtotal)} />
              <Dato l="Total" v={money(factura.total)} />
              <Dato l="Pedido Chevron (XML)" v={factura.numero_pedido_proveedor || "—"} />
              <Dato l="Pedido interno" v={pedidoLabel || "—"} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-violet-200 bg-gradient-to-r from-violet-50 to-blue-50 text-violet-700 hover:from-violet-100 hover:to-blue-100 text-[10px] font-semibold uppercase tracking-widest"
                onClick={onVincular}
              >
                <Link2 className="h-3.5 w-3.5 mr-1.5" />
                {factura.pedido_id ? "Cambiar pedido" : "Vincular a pedido"}
              </Button>
              <Button size="sm" variant="ghost" disabled={!factura.pdf_storage_path} onClick={() => onPdf(factura.pdf_storage_path)}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />Ver PDF
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Cargando…</TableCell></TableRow>
                )}
                {!isLoading && lineas.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin partidas en el XML</TableCell></TableRow>
                )}
                {lineas.map((l) => (
                  <TableRow key={l.linea}>
                    <TableCell className="font-mono text-xs">{l.codigo || "—"}</TableCell>
                    <TableCell>{l.descripcion}</TableCell>
                    <TableCell className="text-xs">{l.unidad || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{qty(l.cantidad)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(l.precio)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(l.importe)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
