import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Trash2, Pencil, Plus, PackageCheck } from "lucide-react";
import RecepcionDialog from "@/components/inventario/RecepcionDialog";
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
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [savingFecha, setSavingFecha] = useState(false);
  const [editandoPedido, setEditandoPedido] = useState(false);
  const [formPedido, setFormPedido] = useState<any>({});
  const [savingPedido, setSavingPedido] = useState(false);
  const [lineaEditando, setLineaEditando] = useState<{ id: string; campo: string } | null>(null);
  const [recepcionOpen, setRecepcionOpen] = useState(false);

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
    if (next === "recibido" || next === "recibido_parcial" || p.estatus === "en_transito") {
      setRecepcionOpen(true);
      return;
    }
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

  const invalidarTodo = () => {
    if (!p) return;
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
  };

  const iniciarEdicionPedido = () => {
    if (!p) return;
    setFormPedido({
      numero_po_interno: p.numero_po_interno || "",
      numero_orden_proveedor: p.numero_orden_proveedor || "",
      empresa_vendedora: p.empresa_vendedora || "",
      almacen_destino: p.almacen_destino || "",
      proveedor: p.proveedor || "",
      fuente: p.fuente || "",
      total_monto: p.total_monto ?? "",
      moneda: p.moneda || "",
      total_tarimas: p.total_tarimas ?? "",
    });
    setEditandoPedido(true);
  };

  const guardarEdicionPedido = async () => {
    if (!p) return;
    setSavingPedido(true);
    try {
      const payload: any = {
        numero_po_interno: formPedido.numero_po_interno || null,
        numero_orden_proveedor: formPedido.numero_orden_proveedor || null,
        empresa_vendedora: formPedido.empresa_vendedora || null,
        almacen_destino: formPedido.almacen_destino || null,
        proveedor: formPedido.proveedor || null,
        fuente: formPedido.fuente || null,
        moneda: formPedido.moneda || null,
        total_monto: formPedido.total_monto === "" || formPedido.total_monto === null ? null : Number(formPedido.total_monto),
        total_tarimas: formPedido.total_tarimas === "" || formPedido.total_tarimas === null ? null : Number(formPedido.total_tarimas),
      };
      const { error } = await (supabase as any).from("inv_pedidos").update(payload).eq("id", p.id);
      if (error) throw error;
      toast.success("Pedido actualizado");
      invalidarTodo();
      refetch();
      setEditandoPedido(false);
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar el pedido");
    } finally {
      setSavingPedido(false);
    }
  };

  const guardarLinea = async (lineaId: string, campo: string, valor: any) => {
    try {
      const { error } = await (supabase as any).from("inv_pedido_lineas").update({ [campo]: valor }).eq("id", lineaId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["inv_pedido", p?.id] });
      refetch();
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar la línea");
    } finally {
      setLineaEditando(null);
    }
  };

  const agregarLinea = async () => {
    if (!p) return;
    const { error } = await (supabase as any).from("inv_pedido_lineas").insert({
      pedido_id: p.id, codigo_producto: "", cantidad_solicitada: 0, estatus_linea: "pendiente",
    });
    if (error) { toast.error(error.message || "Error al agregar línea"); return; }
    toast.success("Línea agregada");
    qc.invalidateQueries({ queryKey: ["inv_pedido", p.id] });
    refetch();
  };

  const eliminarLinea = async (lineaId: string) => {
    const { error } = await (supabase as any).from("inv_pedido_lineas").delete().eq("id", lineaId);
    if (error) { toast.error(error.message || "Error al eliminar línea"); return; }
    toast.success("Línea eliminada");
    qc.invalidateQueries({ queryKey: ["inv_pedido", p?.id] });
    refetch();
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
        tipo_archivo: "confirmacion_proveedor", usuario_carga: user?.id ?? null,
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
      await aplicarExtraccion(extractedData);
    } catch (e: any) { toast.error(e?.message || "Error extrayendo"); }
    finally { setExtracting(null); }
  };

  const aplicarExtraccion = async (d: any) => {
    if (!p || !d) return;
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
              {editandoPedido ? (
                <>
                  <EditField label="N° PO interno">
                    <Input className="h-8 text-sm" value={formPedido.numero_po_interno ?? ""} onChange={(e) => setFormPedido({ ...formPedido, numero_po_interno: e.target.value })} />
                  </EditField>
                  <EditField label="N° Orden proveedor">
                    <Input className="h-8 text-sm" value={formPedido.numero_orden_proveedor ?? ""} onChange={(e) => setFormPedido({ ...formPedido, numero_orden_proveedor: e.target.value })} />
                  </EditField>
                  <EditField label="Empresa">
                    <SelectField value={formPedido.empresa_vendedora} onChange={(v) => setFormPedido({ ...formPedido, empresa_vendedora: v })}
                      options={[{ v: "lumaggs", l: "Lumaggs (Chevron)" }, { v: "galsa", l: "Galsa (Phillips 66)" }]} />
                  </EditField>
                  <EditField label="Almacén destino">
                    <SelectField value={formPedido.almacen_destino} onChange={(v) => setFormPedido({ ...formPedido, almacen_destino: v })}
                      options={[{ v: "1001", l: "1001" }, { v: "1002", l: "1002" }]} />
                  </EditField>
                  <EditField label="Proveedor">
                    <SelectField value={formPedido.proveedor} onChange={(v) => setFormPedido({ ...formPedido, proveedor: v })}
                      options={[{ v: "chevron", l: "Chevron" }, { v: "phillips66", l: "Phillips 66" }]} />
                  </EditField>
                  <EditField label="Fuente">
                    <SelectField value={formPedido.fuente} onChange={(v) => setFormPedido({ ...formPedido, fuente: v })}
                      options={[{ v: "usa", l: "USA" }, { v: "cedis", l: "CEDIS" }]} />
                  </EditField>
                  <EditField label="Total tarimas">
                    <Input type="number" className="h-8 text-sm" value={formPedido.total_tarimas ?? ""} onChange={(e) => setFormPedido({ ...formPedido, total_tarimas: e.target.value })} />
                  </EditField>
                  <EditField label="Monto">
                    <Input type="number" className="h-8 text-sm" value={formPedido.total_monto ?? ""} onChange={(e) => setFormPedido({ ...formPedido, total_monto: e.target.value })} />
                  </EditField>
                  <EditField label="Moneda">
                    <SelectField value={formPedido.moneda} onChange={(v) => setFormPedido({ ...formPedido, moneda: v })}
                      options={[{ v: "MXN", l: "MXN" }, { v: "USD", l: "USD" }]} />
                  </EditField>
                </>
              ) : (
                <>
                  <Field label="Empresa" value={p.empresa_vendedora === "lumaggs" ? "Lumaggs (Chevron)" : "Galsa (Phillips 66)"} />
                  <Field label="Almacén destino" value={p.almacen_destino} />
                  <Field label="Fuente" value={p.fuente || "—"} />
                  <Field label="Proveedor" value={p.proveedor} />
                  <Field label="N° Orden proveedor" value={p.numero_orden_proveedor || "—"} />
                  <Field label="Total tarimas" value={p.total_tarimas ?? 0} />
                  <Field label="Monto" value={p.total_monto ? `${Number(p.total_monto).toLocaleString("es-MX", { minimumFractionDigits: 2 })} ${p.moneda || ""}` : "—"} />
                </>
              )}
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
            {editandoPedido && (
              <div className="flex gap-2">
                <Button size="sm" onClick={guardarEdicionPedido} disabled={savingPedido}>{savingPedido ? "Guardando..." : "Guardar cambios"}</Button>
                <Button size="sm" variant="outline" onClick={() => setEditandoPedido(false)}>Cancelar</Button>
              </div>
            )}
            {nextEstatus(p.estatus) && (
              <Button onClick={onAdvance} className="w-full">{nextEstatusLabel(p.estatus)}</Button>
            )}
            <Button variant="outline" className="w-full" onClick={() => setRecepcionOpen(true)}>
              <PackageCheck className="h-4 w-4 mr-1.5" />Registrar recepción (cantidades recibidas)
            </Button>
            <RecepcionDialog open={recepcionOpen} onOpenChange={setRecepcionOpen} pedidoId={p.id} lockPedido />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={iniciarEdicionPedido} disabled={editandoPedido}>
                <Pencil className="h-4 w-4 mr-1.5" />Editar pedido
              </Button>
              <Button variant="outline" className="flex-1 text-destructive" onClick={() => onDelete(p.id)}>
                <Trash2 className="h-4 w-4 mr-1.5" />Eliminar pedido
              </Button>
            </div>

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
                      <span><Upload className="h-3.5 w-3.5 mr-1.5" />{uploading ? "Subiendo..." : extracting ? "Extrayendo..." : "Actualizar pedido con PDF"}</span>
                    </Button>
                  </label>
                  </div>
                </div>
              ) : (
              <>
              <div className="flex items-center gap-2 mb-3">
                <label className="inline-block">
                  <input type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadActualizado(f); }} />
                  <Button asChild variant="outline" size="sm" disabled={uploading}><span><Upload className="h-3.5 w-3.5 mr-1.5" />{uploading ? "Subiendo..." : "Subir PDF del proveedor"}</span></Button>
                </label>
              </div>
              <div className="text-xs text-muted-foreground">Sin archivos</div>
              </>
              )}
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Líneas del pedido</div>
              <div className="border rounded overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      {["Código","Producto","Cant.","Unidad","P. unit.","Total","Status",""].map((h, i) => <TableHead key={h || `acc-${i}`} className="text-xs uppercase">{h}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineas.map((l: any) => {
                      const cell = (campo: string, valor: any, opts?: { type?: string; className?: string; mono?: boolean }) => {
                        const editing = lineaEditando?.id === l.id && lineaEditando?.campo === campo;
                        if (editing) {
                          return (
                            <Input
                              autoFocus
                              type={opts?.type || "text"}
                              defaultValue={valor ?? ""}
                              className="h-7 text-xs"
                              onBlur={(e) => {
                                const raw = e.target.value;
                                const next = opts?.type === "number" ? (raw === "" ? null : Number(raw)) : (raw === "" ? null : raw);
                                if (String(next ?? "") === String(valor ?? "")) { setLineaEditando(null); return; }
                                guardarLinea(l.id, campo, next);
                              }}
                            />
                          );
                        }
                        return (
                          <span className="cursor-pointer" onClick={() => setLineaEditando({ id: l.id, campo })}>
                            {valor === null || valor === undefined || valor === "" ? "—" : valor}
                          </span>
                        );
                      };
                      const editingStatus = lineaEditando?.id === l.id && lineaEditando?.campo === "estatus_linea";
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="font-mono text-xs">{cell("codigo_producto", l.codigo_producto)}</TableCell>
                          <TableCell className="text-xs max-w-[160px] truncate">{cell("nombre_producto", l.nombre_producto)}</TableCell>
                          <TableCell className="text-right">{cell("cantidad_solicitada", l.cantidad_solicitada, { type: "number" })}</TableCell>
                          <TableCell className="text-xs">{cell("unidad_pedido", l.unidad_pedido)}</TableCell>
                          <TableCell className="text-right text-xs">{cell("precio_unitario", l.precio_unitario, { type: "number" })}</TableCell>
                          <TableCell className="text-right text-xs">{cell("precio_neto", l.precio_neto, { type: "number" })}</TableCell>
                          <TableCell className="text-xs">
                            {editingStatus ? (
                              <Select value={l.estatus_linea || "pendiente"} onValueChange={(v) => guardarLinea(l.id, "estatus_linea", v)}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {["pendiente","confirmada","recibida_completa","recibida_parcial","faltante","cancelada"].map((s) => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="cursor-pointer" onClick={() => setLineaEditando({ id: l.id, campo: "estatus_linea" })}>{l.estatus_linea || "—"}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => eliminarLinea(l.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <Button size="sm" variant="outline" className="mt-2" onClick={agregarLinea}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />Agregar línea
              </Button>
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

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}

function SelectField({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
