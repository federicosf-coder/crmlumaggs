import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { usePedido, useUpdatePedidoEstatus, ESTATUS_PEDIDO_LABEL, estatusPedidoColor, nextEstatus, nextEstatusLabel } from "@/hooks/usePedidosInventario";

export default function PedidoDetailSheet({ id, onClose, onDelete }: { id: string | null; onClose: () => void; onDelete: (id: string) => void }) {
  const { data, refetch } = usePedido(id);
  const upd = useUpdatePedidoEstatus();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<{ archivoId: string; data: any } | null>(null);
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [savingFecha, setSavingFecha] = useState(false);

  useEffect(() => {
    setFechaEntrega(data?.pedido?.fecha_entrega_estimada || "");
  }, [data]);

  if (!id) return null;
  const p = data?.pedido;
  const lineas = data?.lineas || [];
  const archivos = data?.archivos || [];

  const onAdvance = async () => {
    if (!p) return;
    const next = nextEstatus(p.estatus);
    if (!next) return;
    if (p.estatus === "en_transito") { navigate(`/inventario/pedidos/recibidos?pedido=${p.id}`); return; }
    await upd.mutateAsync({ id: p.id, estatus: next });
    toast.success(`Estatus actualizado a ${ESTATUS_PEDIDO_LABEL[next]}`);
  };

  const guardarFechaEntrega = async () => {
    if (!p) return;
    setSavingFecha(true);
    try {
      const { error } = await (supabase as any).from("inv_pedidos").update({ fecha_entrega_estimada: fechaEntrega || null }).eq("id", p.id);
      if (error) throw error;
      toast.success("Fecha de entrega actualizada");
      qc.invalidateQueries({ queryKey: ["inv_pedido", p.id] });
      qc.invalidateQueries({ queryKey: ["inv_pedidos"] });
      // Recalcular vistas de inventario que dependen de la fecha estimada de llegada
      qc.invalidateQueries({ queryKey: ["inv_pedido_lineas_abiertos"] });
      qc.invalidateQueries({ queryKey: ["inv_pedido_lineas_abiertos_detalle"] });
      qc.invalidateQueries({ queryKey: ["inv_niveles_sugeridos"] });
      qc.invalidateQueries({ queryKey: ["inv_niveles_inventario"] });
      qc.invalidateQueries({ queryKey: ["inv_niveles_inventario_min"] });
      qc.invalidateQueries({ queryKey: ["inv_minmax"] });
      qc.invalidateQueries({ queryKey: ["entregas_corporativas_programadas"] });
      qc.invalidateQueries({ queryKey: ["dashred_configs"] });
      refetch();
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar la fecha");
    } finally {
      setSavingFecha(false);
    }
  };

  const onUpload = async (file: File) => {
    if (!p) return;
    setUploading(true);
    try {
      const path = `${p.id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("inventario-pedidos").upload(path, file);
      if (upErr) throw upErr;
      const { data: inserted, error: insErr } = await (supabase as any).from("inv_pedido_archivos").insert({
        pedido_id: p.id, nombre_archivo: file.name, url_archivo: path,
        tipo_archivo: file.type, usuario_carga: user?.id ?? null,
      }).select().single();
      if (insErr) throw insErr;
      toast.success("Archivo subido");
      qc.invalidateQueries({ queryKey: ["inv_pedido", p.id] });
      refetch();
      return inserted;
    } catch (e: any) { toast.error(e?.message || "Error al subir"); }
    finally { setUploading(false); }
  };

  const onUploadActualizado = async (file: File) => {
    const archivo = await onUpload(file);
    if (archivo) await onExtract(archivo);
  };

  const onExtract = async (archivo: any) => {
    if (!p) return;
    setExtracting(archivo.id);
    try {
      const { data: res, error } = await supabase.functions.invoke("inv-pedido-extract", {
        body: { proveedor: p.proveedor, file_path: archivo.url_archivo },
      });
      if (error) throw error;
      if ((res as any).error) throw new Error((res as any).error);
      const extractedData = (res as any).extracted;
      await (supabase as any).from("inv_pedido_archivos").update({
        extraido_por_ia: true, datos_extraidos: extractedData,
      }).eq("id", archivo.id);
      setExtracted({ archivoId: archivo.id, data: extractedData });
      toast.success("Extracción completada");
    } catch (e: any) { toast.error(e?.message || "Error extrayendo"); }
    finally { setExtracting(null); }
  };

  const aplicarExtraccion = async () => {
    if (!p || !extracted) return;
    const d = extracted.data;
    const update: any = {};
    if (d.numero_po) update.numero_po_interno = d.numero_po;
    if (d.numero_orden) update.numero_orden_proveedor = d.numero_orden;
    if (d.fecha_pedido) update.fecha_pedido = d.fecha_pedido;
    if (d.total_monto) update.total_monto = d.total_monto;
    if (d.moneda) update.moneda = d.moneda;

    // Cálculo de fecha_entrega_estimada según proveedor
    if (p.proveedor === "phillips66") {
      const base = d.fecha_pedido ? new Date(d.fecha_pedido) : new Date();
      base.setDate(base.getDate() + 28);
      update.fecha_entrega_estimada = base.toISOString().slice(0, 10);
    } else {
      // Chevron: lead time según tipo en el PO (IMP=32, NAL=14)
      const po = String(d.numero_po || p.numero_po_interno || "").toUpperCase();
      const dias = po.includes("IMP") ? 32 : po.includes("NAL") ? 14 : 14;
      const base = new Date();
      base.setDate(base.getDate() + dias);
      update.fecha_entrega_estimada = base.toISOString().slice(0, 10);
    }

    await (supabase as any).from("inv_pedidos").update(update).eq("id", p.id);

    if (Array.isArray(d.lineas) && d.lineas.length > 0) {
      const rows = d.lineas.map((l: any) => ({
        pedido_id: p.id,
        codigo_producto: l.codigo,
        nombre_producto: l.descripcion,
        cantidad_solicitada: l.cantidad,
        unidad_pedido: l.unidad,
        precio_unitario: l.precio_unitario,
        precio_neto: l.precio_neto,
        estatus_linea: String(l.estado || "").toLowerCase().includes("cancel") ? "cancelada" : "pendiente",
      }));
      const { error: linErr } = await (supabase as any)
        .from("inv_pedido_lineas")
        .upsert(rows, { onConflict: "pedido_id,codigo_producto" });
      if (linErr) { toast.error(linErr.message || "Error al guardar líneas"); }
    }

    toast.success("Datos aplicados");
    setExtracted(null);
    qc.invalidateQueries({ queryKey: ["inv_pedido", p.id] });
    qc.invalidateQueries({ queryKey: ["inv_pedidos"] });
    qc.invalidateQueries({ queryKey: ["inv_pedido_lineas_abiertos"] });
    qc.invalidateQueries({ queryKey: ["inv_pedido_lineas_abiertos_detalle"] });
    qc.invalidateQueries({ queryKey: ["inv_niveles_sugeridos"] });
    qc.invalidateQueries({ queryKey: ["inv_niveles_inventario"] });
    qc.invalidateQueries({ queryKey: ["inv_niveles_inventario_min"] });
    qc.invalidateQueries({ queryKey: ["inv_minmax"] });
    qc.invalidateQueries({ queryKey: ["entregas_corporativas_programadas"] });
    qc.invalidateQueries({ queryKey: ["dashred_configs"] });
    refetch();
  };

  return (
    <Dialog open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 -mx-6 -mt-6 p-6">
          <DialogTitle className="font-light">Pedido {p?.numero_po_interno || "—"}</DialogTitle>
        </DialogHeader>
        {p && (
          <div className="space-y-6 mt-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Empresa" value={p.empresa_vendedora === "lumaggs" ? "Lumaggs (Chevron)" : "Galsa (Phillips 66)"} />
              <Field label="Almacén destino" value={p.almacen_destino} />
              <Field label="Fuente" value={p.fuente || "—"} />
              <Field label="Proveedor" value={p.proveedor} />
              <Field label="N° Orden proveedor" value={p.numero_orden_proveedor || "—"} />
              <Field label="Total tarimas" value={p.total_tarimas ?? 0} />
              <Field label="Monto" value={p.total_monto ? `${Number(p.total_monto).toLocaleString("es-MX", { minimumFractionDigits: 2 })} ${p.moneda || ""}` : "—"} />
              <Field label="Estatus" value={<Badge className={estatusPedidoColor(p.estatus)}>{ESTATUS_PEDIDO_LABEL[p.estatus]}</Badge>} />
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Entrega estimada</div>
                <div className="flex items-center gap-2 mt-1">
                  <Input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} className="h-8 text-sm" />
                  <Button size="sm" className="h-8" disabled={savingFecha || fechaEntrega === (p.fecha_entrega_estimada || "")} onClick={guardarFechaEntrega}>
                    {savingFecha ? "Guardando..." : "Guardar"}
                  </Button>
                </div>
              </div>
            </div>
            {nextEstatus(p.estatus) && (
              <Button onClick={onAdvance} className="w-full">{nextEstatusLabel(p.estatus)}</Button>
            )}
            <Button variant="outline" className="w-full text-destructive" onClick={() => onDelete(p.id)}>
              <Trash2 className="h-4 w-4 mr-1.5" />Eliminar pedido
            </Button>

            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Archivos adjuntos</div>
              {archivos.length > 0 ? (
                <div className="border rounded p-3 text-sm space-y-2 bg-muted/20">
                  <div className="text-xs text-muted-foreground">
                    Este pedido se generó automáticamente desde: <span className="font-medium text-foreground">{archivos[0].nombre_archivo}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => verPdf(archivos[0].url_archivo)}>
                    <FileText className="h-3.5 w-3.5 mr-1.5" />Ver PDF
                  </Button>
                  <div>
                    <label className="inline-block">
                      <input type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadActualizado(f); e.currentTarget.value = ""; }} />
                      <Button asChild variant="outline" size="sm" disabled={uploading || !!extracting}>
                        <span><Upload className="h-3.5 w-3.5 mr-1.5" />{uploading ? "Subiendo..." : extracting ? "Extrayendo..." : "Subir PDF actualizado"}</span>
                      </Button>
                    </label>
                  </div>
                </div>
              ) : (
              <>
              <div className="flex items-center gap-2 mb-3">
                <label className="inline-block">
                  <input type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
                  <Button asChild variant="outline" size="sm" disabled={uploading}><span><Upload className="h-3.5 w-3.5 mr-1.5" />{uploading ? "Subiendo..." : "Subir PDF del proveedor"}</span></Button>
                </label>
              </div>
              <div className="text-xs text-muted-foreground">Sin archivos</div>
              </>
              )}
              {extracted && (
                <div className="mt-3 border rounded p-3 bg-violet-50/50">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Vista previa de extracción</div>
                  <pre className="text-[10px] max-h-48 overflow-auto bg-background border rounded p-2">{JSON.stringify(extracted.data, null, 2)}</pre>
                  <Button size="sm" className="mt-2" onClick={aplicarExtraccion}>Aplicar datos extraídos</Button>
                </div>
              )}
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Líneas del pedido</div>
              <div className="border rounded overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      {["Código","Producto","Cant.","Unidad","P. unit.","Total","Status"].map((h) => <TableHead key={h} className="text-xs uppercase">{h}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineas.map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono text-xs">{l.codigo_producto}</TableCell>
                        <TableCell className="text-xs max-w-[160px] truncate">{l.nombre_producto || "—"}</TableCell>
                        <TableCell className="text-right">{l.cantidad_solicitada}</TableCell>
                        <TableCell className="text-xs">{l.unidad_pedido || "—"}</TableCell>
                        <TableCell className="text-right text-xs">{l.precio_unitario ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs">{l.precio_neto ?? "—"}</TableCell>
                        <TableCell className="text-xs">{l.estatus_linea || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

async function deletePedido(id: string) {
  return _deletePedido(id);
}

async function verPdf(path: string) {
  const { data, error } = await supabase.storage.from("inventario-pedidos").createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) { toast.error("No se pudo abrir el PDF"); return; }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

async function _deletePedido(id: string) {
  const l = await (supabase as any).from("inv_pedido_lineas").delete().eq("pedido_id", id);
  if (l.error) throw l.error;
  const a = await (supabase as any).from("inv_pedido_archivos").delete().eq("pedido_id", id);
  if (a.error) throw a.error;
  const p = await (supabase as any).from("inv_pedidos").delete().eq("id", id);
  if (p.error) throw p.error;
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
