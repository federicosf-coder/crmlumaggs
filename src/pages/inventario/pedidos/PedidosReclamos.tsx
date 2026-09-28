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

function NuevoReclamoDialog({ open, onOpenChange, recepcionId, pedidoId }: any) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [pedidoSel, setPedidoSel] = useState<string>("");
  const [pedidoData, setPedidoData] = useState<any>(null);
  const [lineasPedido, setLineasPedido] = useState<any[]>([]);
  const [facturas, setFacturas] = useState<any[]>([]);
  const [facturaSel, setFacturaSel] = useState<string>("");
  const [noPedidoFactura, setNoPedidoFactura] = useState("");
  const [fechaReclamo, setFechaReclamo] = useState(hoyISO());
  const [fechaRecepcion, setFechaRecepcion] = useState(hoyISO());
  const [remitenteNombre, setRemitenteNombre] = useState("");
  const [remitenteEmail, setRemitenteEmail] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [lineas, setLineas] = useState<any[]>([]);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setRemitenteNombre(profile.full_name || "");
      setRemitenteEmail(profile.email || user?.email || "");
    }
  }, [profile, user]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: peds } = await (supabase as any).from("inv_pedidos")
        .select("id, numero_po_interno, numero_orden_proveedor, empresa_vendedora, fecha_pedido, estatus, factura_recibida_id")
        .in("estatus", ["recibido", "cerrado", "recibido_parcial"])
        .order("fecha_pedido", { ascending: false });
      setPedidos(peds || []);
      const { data: fact } = await (supabase as any).from("chevron_facturas_recibidas")
        .select("id, folio, serie, fecha, total, numero_pedido_proveedor, pedido_id")
        .eq("tipo_comprobante", "I")
        .order("folio", { ascending: false });
      setFacturas(fact || []);
      if (pedidoId) setPedidoSel(pedidoId);
    })();
  }, [open, pedidoId]);

  useEffect(() => {
    if (!pedidoSel) { setPedidoData(null); setLineasPedido([]); setLineas([]); return; }
    (async () => {
      const { data: p } = await (supabase as any).from("inv_pedidos").select("*").eq("id", pedidoSel).single();
      setPedidoData(p);
      const { data: lns } = await (supabase as any).from("inv_pedido_lineas")
        .select("codigo_producto, nombre_producto, presentacion, cantidad_solicitada")
        .eq("pedido_id", pedidoSel).order("codigo_producto");
      setLineasPedido(lns || []);
      setLineas([]);
      setNoPedidoFactura(p?.numero_orden_proveedor || p?.numero_po_interno || "");
      if (recepcionId) {
        const { data: rec } = await (supabase as any).from("inv_recepciones").select("fecha_recepcion").eq("id", recepcionId).maybeSingle();
        if (rec?.fecha_recepcion) setFechaRecepcion(rec.fecha_recepcion);
      }
      if (p?.factura_recibida_id) setFacturaSel(p.factura_recibida_id);
    })();
  }, [pedidoSel, recepcionId]);

  const addLinea = (codigo: string) => {
    const l = lineasPedido.find((x) => x.codigo_producto === codigo);
    if (!l || lineas.some((x) => x.codigo_producto === codigo)) return;
    setLineas([...lineas, {
      codigo_producto: l.codigo_producto,
      descripcion: l.nombre_producto || "",
      empaque: l.presentacion || "",
      tipo_producto: l.presentacion?.toLowerCase().includes("tambor") || l.presentacion?.toLowerCase().includes("granel") ? "Granel" : "Empacado",
      tipo_aviso: "Faltante",
      tipo_aviso_otro: "",
      cantidad_solicitada: Number(l.cantidad_solicitada || 0),
      cantidad_recibida: Number(l.cantidad_solicitada || 0),
      diferencia: 0,
      unidad: l.presentacion?.toLowerCase().includes("tambor") ? "Litros" : "Piezas",
      unidad_otro: "",
    }]);
  };

  const updLinea = (idx: number, field: string, value: any) => {
    const c = [...lineas];
    c[idx] = { ...c[idx], [field]: value };
    setLineas(c);
  };

  const onSave = async () => {
    if (!pedidoSel) { toast.error("Selecciona el pedido"); return; }
    if (!lineas.length) { toast.error("Agrega al menos un producto a reclamar"); return; }
    if (lineas.some((l) => !l.diferencia || Number(l.diferencia) === 0)) { toast.error("La diferencia es obligatoria en cada producto"); return; }
    if (!remitenteNombre || !remitenteEmail) { toast.error("Captura nombre y correo de quien envía"); return; }
    setSaving(true);
    try {
      const { data: rec, error } = await (supabase as any).from("inv_reclamos").insert({
        pedido_id: pedidoSel,
        recepcion_id: recepcionId || null,
        empresa_vendedora: pedidoData?.empresa_vendedora || "lumaggs",
        tipo_reclamo: lineas[0]?.tipo_aviso === "Dañado" ? "dañado" : lineas[0]?.tipo_aviso === "Faltante" ? "faltante" : "otro",
        cliente_nombre: "LUMAGGS",
        no_pedido_factura: noPedidoFactura || null,
        factura_recibida_id: facturaSel || null,
        fecha_reclamo: fechaReclamo,
        fecha_recepcion: fechaRecepcion,
        remitente_nombre: remitenteNombre,
        remitente_email: remitenteEmail,
        descripcion,
        estatus: "borrador",
        total_skus_afectados: lineas.length,
        creado_por: user?.id ?? null,
      }).select().single();
      if (error) throw error;

      await (supabase as any).from("inv_reclamo_lineas").insert(lineas.map((l) => ({
        reclamo_id: rec.id,
        codigo_producto: l.codigo_producto,
        nombre_producto: l.descripcion,
        descripcion: l.descripcion_problema || "",
        tipo_producto: l.tipo_producto === "otro" ? l.tipo_producto_otro || "otro" : l.tipo_producto,
        empaque: l.empaque,
        tipo_aviso: l.tipo_aviso === "otro" ? l.tipo_aviso_otro || "otro" : l.tipo_aviso.toLowerCase(),
        cantidad_solicitada: l.cantidad_solicitada,
        cantidad_recibida: l.cantidad_recibida,
        cantidad_afectada: Math.abs(Number(l.diferencia) || 0),
        diferencia: Number(l.diferencia),
        unidad: l.unidad === "otro" ? l.unidad_otro || "Piezas" : l.unidad,
      })));

      if (facturaSel) {
        await (supabase as any).from("inv_pedidos").update({ factura_recibida_id: facturaSel }).eq("id", pedidoSel);
        await (supabase as any).from("chevron_facturas_recibidas").update({ pedido_id: pedidoSel, estatus_match: "manual" }).eq("id", facturaSel);
      }

      for (const f of archivos) {
        const path = `${rec.id}/${Date.now()}_${f.name}`;
        const { error: uErr } = await supabase.storage.from("inventario-reclamos").upload(path, f);
        if (!uErr) await (supabase as any).from("inv_reclamo_archivos").insert({
          reclamo_id: rec.id, nombre_archivo: f.name, url_archivo: path,
          tipo_archivo: f.type, usuario_carga: user?.id ?? null,
        });
      }

      toast.success("Reclamo creado");
      qc.invalidateQueries({ queryKey: ["inv_reclamos"] });
      onOpenChange(false);
      setLineas([]); setArchivos([]); setDescripcion(""); setFacturaSel(""); setPedidoSel("");
    } catch (e: any) { toast.error(e?.message); }
    finally { setSaving(false); }
  };

  const labelCls = "text-[10px] uppercase tracking-wide text-muted-foreground";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 -mx-6 -mt-6 p-6 rounded-t-lg">
          <DialogTitle className="font-light">Aviso de Reclamo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="col-span-2 md:col-span-1">
              <Label className={labelCls}>Pedido recibido</Label>
              <Select value={pedidoSel} onValueChange={setPedidoSel}>
                <SelectTrigger><SelectValue placeholder="Selecciona pedido" /></SelectTrigger>
                <SelectContent>
                  {pedidos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.numero_po_interno} · {fmtFecha(p.fecha_pedido)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className={labelCls}>Nombre de cliente</Label>
              <Input value="LUMAGGS" readOnly disabled className="bg-muted" />
            </div>
            <div>
              <Label className={labelCls}>No. Pedido en Factura</Label>
              <Input value={noPedidoFactura} onChange={(e) => setNoPedidoFactura(e.target.value)} placeholder="Automático del pedido" />
            </div>
            <div className="col-span-2 md:col-span-1">
              <Label className={labelCls}>Factura</Label>
              <Select value={facturaSel || undefined} onValueChange={setFacturaSel}>
                <SelectTrigger><SelectValue placeholder="Selecciona factura" /></SelectTrigger>
                <SelectContent className="max-h-[260px]">
                  {facturas.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      Folio {f.folio} · {fmtFecha(f.fecha)} · {fmtMoney(f.total)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">Se liga de manera definitiva al pedido.</p>
            </div>
            <div>
              <Label className={labelCls}>Fecha de reclamo</Label>
              <Input type="date" value={fechaReclamo} onChange={(e) => setFechaReclamo(e.target.value)} />
            </div>
            <div>
              <Label className={labelCls}>Fecha de recepción del pedido</Label>
              <Input type="date" value={fechaRecepcion} onChange={(e) => setFechaRecepcion(e.target.value)} />
            </div>
            <div>
              <Label className={labelCls}>Enviado por (nombre)</Label>
              <Input value={remitenteNombre} onChange={(e) => setRemitenteNombre(e.target.value)} />
            </div>
            <div>
              <Label className={labelCls}>Correo del remitente</Label>
              <Input value={remitenteEmail} onChange={(e) => setRemitenteEmail(e.target.value)} />
            </div>
            <div className="col-span-2 md:col-span-3">
              <Label className={labelCls}>Descripción general</Label>
              <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs uppercase tracking-wide">Productos a reclamar</Label>
              <Select onValueChange={(v) => { addLinea(v); }} value="">
                <SelectTrigger className="w-[280px] h-8"><SelectValue placeholder="+ Agregar producto del pedido" /></SelectTrigger>
                <SelectContent className="max-h-[260px]">
                  {lineasPedido.filter((l) => !lineas.some((x) => x.codigo_producto === l.codigo_producto)).map((l) => (
                    <SelectItem key={l.codigo_producto} value={l.codigo_producto}>
                      {l.codigo_producto} · {l.nombre_producto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {lineas.length > 0 && (
              <div className="border rounded overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>{["Tipo prod.", "Código", "Descripción", "Empaque", "Tipo aviso", "Cant. solicitada", "Cant. recibida", "Diferencia", "Unidad", ""].map((h) =>
                      <TableHead key={h} className="text-[10px] uppercase">{h}</TableHead>)}</TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineas.map((l, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Select value={l.tipo_producto} onValueChange={(v) => updLinea(idx, "tipo_producto", v)}>
                            <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Empacado">Empacado</SelectItem>
                              <SelectItem value="Granel">Granel</SelectItem>
                              <SelectItem value="otro">Otro…</SelectItem>
                            </SelectContent>
                          </Select>
                          {l.tipo_producto === "otro" && <Input className="h-7 mt-1 w-24" value={l.tipo_producto_otro || ""} onChange={(e) => updLinea(idx, "tipo_producto_otro", e.target.value)} />}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{l.codigo_producto}</TableCell>
                        <TableCell className="text-xs max-w-[160px] truncate" title={l.descripcion}>{l.descripcion}</TableCell>
                        <TableCell className="text-xs">{l.empaque || "—"}</TableCell>
                        <TableCell>
                          <Select value={l.tipo_aviso} onValueChange={(v) => updLinea(idx, "tipo_aviso", v)}>
                            <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Faltante">Faltante</SelectItem>
                              <SelectItem value="Dañado">Dañado</SelectItem>
                              <SelectItem value="otro">Otro…</SelectItem>
                            </SelectContent>
                          </Select>
                          {l.tipo_aviso === "otro" && <Input className="h-7 mt-1 w-24" value={l.tipo_aviso_otro || ""} onChange={(e) => updLinea(idx, "tipo_aviso_otro", e.target.value)} />}
                        </TableCell>
                        <TableCell><Input type="number" value={l.cantidad_solicitada} className="w-20 h-8" onChange={(e) => updLinea(idx, "cantidad_solicitada", e.target.value)} /></TableCell>
                        <TableCell><Input type="number" value={l.cantidad_recibida} className="w-20 h-8" onChange={(e) => updLinea(idx, "cantidad_recibida", e.target.value)} /></TableCell>
                        <TableCell><Input type="number" value={l.diferencia} className={`w-20 h-8 ${!l.diferencia || Number(l.diferencia) === 0 ? "border-red-300" : ""}`} onChange={(e) => updLinea(idx, "diferencia", e.target.value)} /></TableCell>
                        <TableCell>
                          <Select value={l.unidad} onValueChange={(v) => updLinea(idx, "unidad", v)}>
                            <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Litros">Litros</SelectItem>
                              <SelectItem value="Piezas">Piezas</SelectItem>
                              <SelectItem value="otro">Otro…</SelectItem>
                            </SelectContent>
                          </Select>
                          {l.unidad === "otro" && <Input className="h-7 mt-1 w-24" value={l.unidad_otro || ""} onChange={(e) => updLinea(idx, "unidad_otro", e.target.value)} />}
                        </TableCell>
                        <TableCell><Button variant="ghost" size="sm" onClick={() => setLineas(lineas.filter((_, i) => i !== idx))}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div>
            <Label className={labelCls}>Fotos y documentos de respaldo</Label>
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
