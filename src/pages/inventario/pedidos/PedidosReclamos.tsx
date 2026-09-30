import { Fragment, useEffect, useState } from "react";
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

function diasDesde(d?: string | null) {
  if (!d) return null;
  const iso = d.length === 10 ? `${d}T00:00:00` : d;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function esperaColor(dias: number) {
  if (dias >= 7) return "bg-red-100 text-red-800";
  if (dias >= 3) return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

/** Celda con captura rápida del ID que proporciona Chevron */
function IdReclamoCell({ reclamo }: { reclamo: any }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [valor, setValor] = useState(reclamo.id_reclamo_proveedor || "");
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    const v = valor.trim();
    setSaving(true);
    const { error } = await (supabase as any).from("inv_reclamos").update({
      id_reclamo_proveedor: v || null,
      id_reclamo_fecha: v ? new Date().toISOString() : null,
    }).eq("id", reclamo.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(v ? "ID de reclamo guardado" : "ID de reclamo eliminado");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["inv_reclamos"] });
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Input
          autoFocus
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") guardar();
            if (e.key === "Escape") { setValor(reclamo.id_reclamo_proveedor || ""); setEditing(false); }
          }}
          placeholder="ID de Chevron"
          className="h-7 w-[130px] text-xs font-mono"
        />
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={saving} onClick={guardar}>
          {saving ? "..." : "OK"}
        </Button>
      </div>
    );
  }

  if (reclamo.id_reclamo_proveedor) {
    return (
      <button
        className="font-mono text-xs underline decoration-dotted underline-offset-2 hover:text-primary"
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        title="Editar ID de reclamo"
      >
        {reclamo.id_reclamo_proveedor}
      </button>
    );
  }

  const enviado = reclamo.fecha_envio;
  const dias = diasDesde(enviado);
  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setEditing(true)}>
        <Plus className="h-3 w-3 mr-1" />Capturar ID
      </Button>
      {enviado && dias !== null && (
        <Badge className={`${esperaColor(dias)} text-[10px]`}>
          {dias === 0 ? "Hoy" : `${dias} día${dias === 1 ? "" : "s"}`}
        </Badge>
      )}
    </div>
  );
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
  const [soloSinId, setSoloSinId] = useState(false);

  useEffect(() => { if (params.get("recepcion")) setOpen(true); }, [params]);

  const filtered = reclamos.filter((r: any) => {
    if (empresa !== "todas" && r.empresa_vendedora !== empresa) return false;
    if (estatus !== "todos" && r.estatus !== estatus) return false;
    if (soloSinId && (r.id_reclamo_proveedor || !r.fecha_envio)) return false;
    return true;
  });

  const pendientesId = reclamos.filter((r: any) => r.fecha_envio && !r.id_reclamo_proveedor).length;

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
              <TableRow>{["Pedido", "Factura", "Cliente", "No. Pedido Factura", "ID Reclamo", "Fecha Reclamo", "SKUs", "Estatus", "Enviado"].map((h) =>
                <TableHead key={h} className="uppercase tracking-wide text-xs font-medium">{h}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r, i) => (
                <TableRow key={r.id} className={`cursor-pointer ${i % 2 === 0 ? "" : "bg-muted/20"}`} onClick={() => setDetailId(r.id)}>
                  <TableCell className="font-mono text-xs">{r.inv_pedidos?.numero_po_interno || "—"}</TableCell>
                  <TableCell className="text-xs">{r.chevron_facturas_recibidas?.folio ? `Folio ${r.chevron_facturas_recibidas.folio}` : "—"}</TableCell>
                  <TableCell className="text-xs font-medium">{r.cliente_nombre || "LUMAGGS"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.no_pedido_factura || "—"}</TableCell>
                  <TableCell><IdReclamoCell reclamo={r} /></TableCell>
                  <TableCell className="text-xs">{fmtFecha(r.fecha_reclamo)}</TableCell>
                  <TableCell className="text-right">{r.total_skus_afectados ?? 0}</TableCell>
                  <TableCell>
                    <Badge className={estatusReclamoColor(r.estatus)}>{ESTATUS_LABEL[r.estatus] || r.estatus}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{r.fecha_envio ? fmtFechaHora(r.fecha_envio) : "—"}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sin reclamos</TableCell></TableRow>
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
      detalle_reclamacion: "",
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
        detalle_reclamacion: l.detalle_reclamacion || "",
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
                      <Fragment key={idx}>
                      <TableRow>
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
                      <TableRow>
                        <TableCell colSpan={10} className="bg-muted/30 p-2">
                          <Label className={labelCls}>Detalle de la reclamación</Label>
                          <Textarea
                            className="mt-1 bg-background"
                            rows={3}
                            placeholder="Describe qué tiene el producto y por qué se reclama (daño, falta, condiciones del empaque, etc.)"
                            value={l.detalle_reclamacion || ""}
                            onChange={(e) => updLinea(idx, "detalle_reclamacion", e.target.value)}
                          />
                        </TableCell>
                      </TableRow>
                      </Fragment>
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

function ReclamoDetailSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [data, setData] = useState<any>(null);
  const [resolucion, setResolucion] = useState("");
  const [notas, setNotas] = useState<any[]>([]);
  const [notaCreditoId, setNotaCreditoId] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: rec } = await (supabase as any).from("inv_reclamos")
        .select("*, inv_pedidos(numero_po_interno), chevron_facturas_recibidas(folio, fecha, total)")
        .eq("id", id).single();
      const { data: lin } = await (supabase as any).from("inv_reclamo_lineas").select("*").eq("reclamo_id", id);
      const { data: arc } = await (supabase as any).from("inv_reclamo_archivos").select("*").eq("reclamo_id", id);
      const { data: seg } = await (supabase as any).from("inv_reclamo_seguimiento").select("*").eq("reclamo_id", id).order("created_at", { ascending: false });
      const { data: ncs } = await (supabase as any).from("chevron_facturas_recibidas")
        .select("id, folio, fecha, total").eq("tipo_comprobante", "E").order("folio", { ascending: false });
      setData({ reclamo: rec, lineas: lin || [], archivos: arc || [], notas: ncs || [] });
      setNotas(seg || []);
      setResolucion(rec?.resolucion || "");
      setNotaCreditoId(rec?.nota_credito_id || "");
    })();
  }, [id]);

  if (!id) return null;
  const r = data?.reclamo;

  const cambiarEstatus = async (nuevo: string) => {
    if (nuevo === "aceptado" && !notaCreditoId && !r?.nota_credito_id) {
      toast.error("Selecciona la nota de crédito antes de marcar como Aceptado");
      return;
    }
    const update: any = { estatus: nuevo };
    if (nuevo === "aceptado" && notaCreditoId) {
      const nc = data.notas.find((n: any) => n.id === notaCreditoId);
      update.nota_credito_id = notaCreditoId;
      update.nota_credito_folio = nc?.folio || null;
      update.nota_credito_monto = nc?.total || null;
    }
    if (nuevo === "rechazado") update.fecha_resolucion = hoyISO();
    const { error } = await (supabase as any).from("inv_reclamos").update(update).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Estatus actualizado");
    qc.invalidateQueries({ queryKey: ["inv_reclamos"] });
    setData({ ...data, reclamo: { ...r, ...update } });
  };

  const guardarNotaCredito = async () => {
    if (!notaCreditoId) { toast.error("Selecciona una nota de crédito"); return; }
    const nc = data.notas.find((n: any) => n.id === notaCreditoId);
    const { error } = await (supabase as any).from("inv_reclamos").update({
      nota_credito_id: notaCreditoId, nota_credito_folio: nc?.folio || null, nota_credito_monto: nc?.total || null,
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Nota de crédito guardada");
    setData({ ...data, reclamo: { ...r, nota_credito_id: notaCreditoId, nota_credito_folio: nc?.folio, nota_credito_monto: nc?.total } });
  };

  const guardarResolucion = async () => {
    await (supabase as any).from("inv_reclamos").update({ resolucion }).eq("id", id);
    toast.success("Resolución guardada");
  };

  const buildEmailHtml = () => {
    const filas = (data?.lineas || []).map((l: any) => `
      <tr>
        <td style="padding:6px 10px;border:1px solid #ddd">${esc(l.tipo_producto)}</td>
        <td style="padding:6px 10px;border:1px solid #ddd">${esc(l.codigo_producto)}</td>
        <td style="padding:6px 10px;border:1px solid #ddd">${esc(l.nombre_producto)}</td>
        <td style="padding:6px 10px;border:1px solid #ddd">${esc(l.empaque)}</td>
        <td style="padding:6px 10px;border:1px solid #ddd">${esc(l.tipo_aviso)}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:right">${l.cantidad_solicitada ?? ""}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:right">${l.cantidad_recibida ?? ""}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:right"><b>${l.diferencia ?? ""}</b> ${esc(l.unidad || "")}</td>
      </tr>
      <tr>
        <td colspan="8" style="padding:6px 10px;border:1px solid #ddd;background:#fafafa">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#888">Detalle de la reclamación</div>
          <div style="font-size:12px;white-space:pre-wrap">${esc(l.detalle_reclamacion || "—")}</div>
        </td>
      </tr>`).join("");
    const archivosTxt = (data?.archivos || []).map((a: any) => `• ${esc(a.nombre_archivo)}`).join("<br/>") || "—";
    return `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:760px">
        <h2 style="font-weight:300;color:#3b3b3b;margin:0 0 4px">Aviso de Reclamo</h2>
        <p style="color:#777;font-size:12px;margin:0 0 14px">LUMAGGS · Enviado por ${esc(r.remitente_nombre)} (${esc(r.remitente_email)})</p>
        <table style="border-collapse:collapse;font-size:13px;margin-bottom:16px">
          <tr><td style="padding:4px 12px 4px 0;color:#888">No. Pedido (PO interno)</td><td><b>${esc(r.inv_pedidos?.numero_po_interno)}</b></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#888">No. Pedido en Factura</td><td><b>${esc(r.no_pedido_factura)}</b></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#888">Factura</td><td>${r.chevron_facturas_recibidas?.folio ? `Folio ${esc(r.chevron_facturas_recibidas.folio)}` : "—"}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#888">Fecha de reclamo</td><td>${fmtFecha(r.fecha_reclamo)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#888">Fecha de recepción del pedido</td><td>${fmtFecha(r.fecha_recepcion)}</td></tr>
        </table>
        ${r.descripcion ? `<p style="font-size:13px;color:#555">${esc(r.descripcion)}</p>` : ""}
        <table style="border-collapse:collapse;font-size:12px;width:100%">
          <thead>
            <tr style="background:#f3f0fa">
              <th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Tipo prod.</th>
              <th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Código</th>
              <th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Descripción</th>
              <th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Empaque</th>
              <th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Tipo aviso</th>
              <th style="padding:6px 10px;border:1px solid #ddd;text-align:right">Cant. sol.</th>
              <th style="padding:6px 10px;border:1px solid #ddd;text-align:right">Cant. rec.</th>
              <th style="padding:6px 10px;border:1px solid #ddd;text-align:right">Diferencia</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
        <p style="font-size:12px;color:#555;margin-top:14px"><b>Respaldo adjunto en el portal:</b><br/>${archivosTxt}</p>
      </div>`;
  };

  const enviarAlProveedor = async () => {
    setEnviando(true);
    const asunto = `Aviso de Reclamo PROBID · ${r.no_pedido_factura || r.inv_pedidos?.numero_po_interno || ""} · ${fmtFecha(r.fecha_reclamo)}`;
    const destinatarios = [PROVEEDOR_EMAIL];
    const cc = [r.remitente_email].filter(Boolean);
    let estatusEnvio = "enviado";
    let errorMensaje: string | null = null;
    try {
      const { error: fnError } = await supabase.functions.invoke("send-email", {
        body: { from: RECLAMOS_FROM, to: destinatarios, cc, subject: asunto, html: buildEmailHtml() },
      });
      if (fnError) throw new Error(typeof fnError === "string" ? fnError : fnError.message || "Error al enviar");
    } catch (e: any) {
      estatusEnvio = "error";
      errorMensaje = e?.message || "Error desconocido";
      toast.error(`No se pudo enviar el correo: ${errorMensaje}`);
    }
    await (supabase as any).from("inv_reclamo_seguimiento").insert({
      reclamo_id: id, tipo: "envio", from_email: RECLAMOS_FROM_EMAIL,
      destinatarios, cc, asunto, cuerpo: buildEmailHtml(),
      estatus_envio: estatusEnvio, error_mensaje: errorMensaje, creado_por: (await supabase.auth.getUser()).data.user?.id ?? null,
    });
    if (estatusEnvio === "enviado") {
      const update: any = { estatus: "enviado", fecha_envio: new Date().toISOString() };
      await (supabase as any).from("inv_reclamos").update(update).eq("id", id);
      setData({ ...data, reclamo: { ...r, ...update } });
      toast.success("Correo enviado al proveedor");
      qc.invalidateQueries({ queryKey: ["inv_reclamos"] });
    }
    const { data: seg } = await (supabase as any).from("inv_reclamo_seguimiento").select("*").eq("reclamo_id", id).order("created_at", { ascending: false });
    setNotas(seg || []);
    setEnviando(false);
  };

  const labelCls = "text-[10px] uppercase tracking-wide text-muted-foreground";

  return (
    <Sheet open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="bg-gradient-to-r from-violet-50 to-blue-50 -mx-6 -mt-6 p-6">
          <SheetTitle className="font-light">Aviso de Reclamo</SheetTitle>
        </SheetHeader>
        {r && (
          <div className="space-y-5 mt-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className={labelCls}>Cliente</div><div>{r.cliente_nombre || "LUMAGGS"}</div></div>
              <div><div className={labelCls}>Pedido</div><div className="font-mono text-xs">{r.inv_pedidos?.numero_po_interno || "—"}</div></div>
              <div><div className={labelCls}>No. Pedido en Factura</div><div className="font-mono text-xs">{r.no_pedido_factura || "—"}</div></div>
              <div><div className={labelCls}>Factura</div><div className="text-xs">{r.chevron_facturas_recibidas?.folio ? `Folio ${r.chevron_facturas_recibidas.folio}` : "—"}</div></div>
              <div><div className={labelCls}>Fecha de reclamo</div><div>{fmtFecha(r.fecha_reclamo)}</div></div>
              <div><div className={labelCls}>Fecha de recepción</div><div>{fmtFecha(r.fecha_recepcion)}</div></div>
              <div><div className={labelCls}>Enviado por</div><div className="text-xs">{r.remitente_nombre || "—"}<br/><span className="text-muted-foreground">{r.remitente_email || ""}</span></div></div>
              <div><div className={labelCls}>Estatus</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={estatusReclamoColor(r.estatus)}>{ESTATUS_LABEL[r.estatus] || r.estatus}</Badge>
                  {r.estatus === "enviado" && r.fecha_envio && <span className="text-[10px] text-muted-foreground">{fmtFecha(r.fecha_envio)}</span>}
                </div>
              </div>
              {r.descripcion && <div className="col-span-2"><div className={labelCls}>Descripción</div><div className="text-sm">{r.descripcion}</div></div>}
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <Button size="sm" onClick={enviarAlProveedor} disabled={enviando}>
                <Mail className="h-3.5 w-3.5 mr-1.5" />{enviando ? "Enviando..." : "Enviar al proveedor"}
              </Button>
              {ESTATUS_FLOW.filter((e) => e !== r.estatus && e !== "borrador").map((e) => (
                <Button key={e} size="sm" variant="outline" onClick={() => cambiarEstatus(e)}>{ESTATUS_LABEL[e]}</Button>
              ))}
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Productos reclamados</div>
              <div className="border rounded overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40"><TableRow>{["Tipo", "Código", "Descripción", "Empaque", "Aviso", "Sol.", "Rec.", "Dif.", "Unidad"].map((h) => <TableHead key={h} className="text-[10px] uppercase">{h}</TableHead>)}</TableRow></TableHeader>
                  <TableBody>
                    {data?.lineas.map((l: any) => (
                      <Fragment key={l.id}>
                      <TableRow>
                        <TableCell className="text-xs">{l.tipo_producto || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{l.codigo_producto}</TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate" title={l.nombre_producto || ""}>{l.nombre_producto || "—"}</TableCell>
                        <TableCell className="text-xs">{l.empaque || "—"}</TableCell>
                        <TableCell className="text-xs">{l.tipo_aviso || "—"}</TableCell>
                        <TableCell className="text-right text-xs">{l.cantidad_solicitada ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs">{l.cantidad_recibida ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs font-medium">{l.diferencia ?? "—"}</TableCell>
                        <TableCell className="text-xs">{l.unidad || "—"}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={9} className="bg-muted/30">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Detalle de la reclamación</div>
                          <div className="text-xs whitespace-pre-wrap mt-0.5">{l.detalle_reclamacion || "—"}</div>
                        </TableCell>
                      </TableRow>
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Nota de crédito (obligatoria al aceptar)</div>
              <div className="flex gap-2 items-center">
                <Select value={notaCreditoId || undefined} onValueChange={setNotaCreditoId}>
                  <SelectTrigger className="w-[320px]"><SelectValue placeholder={r.nota_credito_folio ? `Folio ${r.nota_credito_folio}` : "Selecciona nota de crédito"} /></SelectTrigger>
                  <SelectContent className="max-h-[220px]">
                    {data?.notas.map((n: any) => (
                      <SelectItem key={n.id} value={n.id}>Folio {n.folio} · {fmtFecha(n.fecha)} · {fmtMoney(n.total)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={guardarNotaCredito}>Guardar</Button>
              </div>
              {r.nota_credito_folio && <p className="text-[10px] text-muted-foreground mt-1">Registrada: Folio {r.nota_credito_folio} · {fmtMoney(r.nota_credito_monto)}</p>}
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Archivos de respaldo</div>
              <div className="space-y-1 text-sm">
                {data?.archivos.map((a: any) => (
                  <div key={a.id} className="border rounded p-2 text-xs flex items-center gap-2"><FileText className="h-3.5 w-3.5" />{a.nombre_archivo}</div>
                ))}
                {!data?.archivos.length && <div className="text-xs text-muted-foreground">Sin archivos</div>}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Seguimiento de correos (reclamos@correo.lumaggs.com.mx)</div>
              <div className="space-y-2">
                {notas.map((s: any) => (
                  <div key={s.id} className="border rounded p-2 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{s.asunto}</span>
                      <Badge variant="outline" className={s.estatus_envio === "enviado" ? "text-green-700" : "text-red-700"}>{s.estatus_envio}</Badge>
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      {fmtFechaHora(s.created_at)} · Para: {(s.destinatarios || []).join(", ")}{s.cc?.length ? ` · CC: ${s.cc.join(", ")}` : ""}
                    </div>
                    {s.error_mensaje && <div className="text-red-600 mt-0.5">{s.error_mensaje}</div>}
                  </div>
                ))}
                {!notas.length && <div className="text-xs text-muted-foreground">Sin envíos registrados</div>}
              </div>
            </div>

            <div>
              <Label className={labelCls}>Resolución</Label>
              <Textarea value={resolucion} onChange={(e) => setResolucion(e.target.value)} rows={3} />
              <Button size="sm" className="mt-2" onClick={guardarResolucion}>Guardar resolución</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
