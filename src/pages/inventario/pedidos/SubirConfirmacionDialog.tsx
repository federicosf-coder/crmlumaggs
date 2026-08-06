import { useState } from "react";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

async function firstPageText(file: File): Promise<string> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    return (content.items as any[]).map((i) => i.str || "").join(" ");
  } catch {
    return "";
  }
}

export default function SubirConfirmacionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [proveedor, setProveedor] = useState<"Chevron" | "Phillips 66">("Chevron");
  const [fecha, setFecha] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => { setFile(null); setProveedor("Chevron"); setFecha(""); };

  const onFile = async (f: File | null) => {
    setFile(f);
    if (!f) return;
    const text = (await firstPageText(f)).toLowerCase();
    if (text.includes("business point") || text.includes("chevron")) setProveedor("Chevron");
    else if (text.includes("phillips") || text.includes("history orders")) setProveedor("Phillips 66");
    else setProveedor("Chevron");
  };

  const confirmar = async () => {
    if (!file) { toast.error("Selecciona un archivo PDF"); return; }
    if (!fecha) { toast.error("Indica la fecha de pedido"); return; }
    setLoading(true);
    try {
      const path = `nuevo/${Date.now()}_${file.name}`;
      const up = await supabase.storage.from("inventario-pedidos").upload(path, file, { contentType: "application/pdf" });
      if (up.error) throw new Error(up.error.message);

      const { data: res, error: fnErr } = await supabase.functions.invoke("inv-pedido-extract", {
        body: { proveedor: proveedor === "Chevron" ? "chevron" : "phillips66", file_path: path },
      });
      if (fnErr) throw new Error(fnErr.message);
      if ((res as any)?.error) throw new Error((res as any).error);

      const extracted = (res as any)?.extracted;
      if (!extracted) throw new Error("No se pudo extraer información del PDF");

      const empresa_vendedora = proveedor === "Chevron" ? "lumaggs" : "galsa";
      const proveedorKey = proveedor === "Chevron" ? "chevron" : "phillips66";

      const { data: existente } = await supabase
        .from("inv_pedidos")
        .select("id, estatus, almacen_destino")
        .eq("numero_po_interno", extracted.numero_po)
        .eq("empresa_vendedora", empresa_vendedora as any)
        .maybeSingle();

      let pedidoId: string;
      let creado = false;

      if (existente) {
        const nuevoEstatus = !existente.estatus || existente.estatus === "elaborado" ? "elaborado" : existente.estatus;
        const { error } = await supabase.from("inv_pedidos").update({
          numero_orden_proveedor: extracted.numero_orden,
          almacen_destino: extracted.almacen_destino ?? existente.almacen_destino,
          total_monto: extracted.total_monto,
          moneda: extracted.moneda ?? "MXN",
          fecha_pedido: fecha,
          estatus: nuevoEstatus,
        }).eq("id", existente.id);
        if (error) throw new Error(error.message);
        pedidoId = existente.id;
      } else {
        const { data: nuevo, error } = await supabase.from("inv_pedidos").insert({
          numero_po_interno: extracted.numero_po,
          numero_orden_proveedor: extracted.numero_orden,
          empresa_vendedora: empresa_vendedora as any,
          proveedor: proveedorKey,
          almacen_destino: extracted.almacen_destino,
          fuente: "USA",
          moneda: extracted.moneda ?? "MXN",
          total_monto: extracted.total_monto,
          estatus: "elaborado",
          fecha_pedido: fecha,
          generado_desde_sugeridos: false,
          creado_por: user?.id ?? null,
        }).select("id").single();
        if (error) throw new Error(error.message);
        pedidoId = nuevo.id;
        creado = true;
      }

      const lineas = Array.isArray(extracted.lineas) ? extracted.lineas : [];
      if (lineas.length) {
        const rows = lineas.map((l: any) => ({
          pedido_id: pedidoId,
          codigo_producto: l.codigo,
          nombre_producto: l.descripcion,
          cantidad_solicitada: l.cantidad,
          unidad_pedido: l.unidad,
          precio_unitario: l.precio_unitario,
          precio_neto: l.precio_neto,
          estatus_linea: String(l.estado || "").toLowerCase().includes("cancel") ? "cancelado" : "pendiente",
        }));
        const { error } = await supabase.from("inv_pedido_lineas").upsert(rows, { onConflict: "pedido_id,codigo_producto" });
        if (error) throw new Error(error.message);
      }

      await supabase.from("inv_pedido_archivos").insert({
        pedido_id: pedidoId,
        nombre_archivo: file.name,
        url_archivo: path,
        tipo_archivo: "application/pdf",
        extraido_por_ia: true,
        datos_extraidos: extracted,
        usuario_carga: user?.id ?? null,
      });

      toast.success(`Pedido ${extracted.numero_po} ${creado ? "creado" : "actualizado"} con ${lineas.length} líneas`);
      qc.invalidateQueries({ queryKey: ["inv_pedidos"] });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Error al procesar la confirmación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) { if (!v) reset(); onOpenChange(v); } }}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 p-5 border-b">
          <DialogTitle className="font-light">Subir confirmación de pedido (PDF)</DialogTitle>
        </DialogHeader>
        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <Label className="uppercase tracking-wide text-xs font-medium">Archivo PDF</Label>
            <Input type="file" accept=".pdf" disabled={loading} onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="space-y-2">
            <Label className="uppercase tracking-wide text-xs font-medium">Proveedor</Label>
            <Select value={proveedor} onValueChange={(v) => setProveedor(v as any)} disabled={loading}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Chevron">Chevron</SelectItem>
                <SelectItem value="Phillips 66">Phillips 66</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="uppercase tracking-wide text-xs font-medium">Fecha de pedido</Label>
            <Input type="date" value={fecha} disabled={loading} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="bg-muted/40 border-t p-4">
          <Button variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirmar} disabled={loading || !file || !fecha}>
            {loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Procesando...</>) : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
