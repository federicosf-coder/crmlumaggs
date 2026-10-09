import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Printer, Mail, Settings2, Upload, Trash2, FileText, AlertTriangle, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { buildDevolucionPdf, POLITICA_DEVOLUCION_DEFAULT } from "@/lib/generateDevolucionPdf";

const db = supabase as any;

export const ESTADOS: Record<string, string> = {
  solicitada: "Solicitada",
  en_revision: "En revisión",
  autorizada: "Autorizada",
  rechazada: "Rechazada",
  resuelta: "Resuelta",
};
export const RESOLUCIONES: Record<string, string> = {
  nota_credito: "Nota de crédito",
  reembolso: "Reembolso",
  cambio_producto: "Cambio de producto",
};
const ESTADO_COLOR: Record<string, string> = {
  solicitada: "bg-blue-50 text-blue-700 border-blue-200",
  en_revision: "bg-amber-50 text-amber-700 border-amber-200",
  autorizada: "bg-violet-50 text-violet-700 border-violet-200",
  rechazada: "bg-red-50 text-red-700 border-red-200",
  resuelta: "bg-emerald-50 text-emerald-700 border-emerald-200",
};
const fmtDate = (d?: string | null) => (d ? new Date(d.slice(0, 10) + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const sectionLabel = "text-[10px] font-semibold uppercase tracking-widest text-muted-foreground";

function useMotivos(all = false) {
  return useQuery({
    queryKey: ["devolucion_motivos", all],
    queryFn: async () => {
      let q = db.from("devolucion_motivos").select("*").order("orden").order("nombre");
      if (!all) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as { id: string; nombre: string; orden: number; is_active: boolean }[];
    },
  });
}

// --------------------------------------------------------------------------
// PDF helpers
// --------------------------------------------------------------------------
async function buildPdfFor(devId: string) {
  const { data: dev, error } = await db
    .from("devoluciones")
    .select("*, devolucion_motivos(nombre), documentos(numero_factura, empresa_vendedora, ejecutivo_venta_id, contacto_id, companies(name, razon_social, rfc)), devolucion_lineas(cantidad, cantidad_facturada, lote, productos:producto_id(codigo, nombre_producto))")
    .eq("id", devId)
    .single();
  if (error) throw error;
  const { data: motivos } = await db.from("devolucion_motivos").select("nombre").eq("is_active", true).order("orden");
  const { data: ejecutivos } = await db.rpc("list_ejecutivos_activos");
  const ej = (ejecutivos || []).find((e: any) => e.user_id === dev.documentos?.ejecutivo_venta_id);
  const comp = dev.documentos?.companies || {};
  const pdf = buildDevolucionPdf({
    folio: dev.folio,
    marca: dev.documentos?.empresa_vendedora === "galsa_phillips66" ? "galsa" : "lumaggs",
    cliente: comp.razon_social || comp.name || "",
    rfc: comp.rfc,
    factura: dev.documentos?.numero_factura || "",
    fechaVenta: dev.fecha_venta,
    fechaSolicitud: dev.fecha_solicitud,
    ejecutivo: ej?.full_name,
    motivos: (motivos || []).map((m: any) => m.nombre),
    motivoSeleccionado: dev.devolucion_motivos?.nombre,
    lineas: (dev.devolucion_lineas || []).map((l: any) => ({
      codigo: l.productos?.codigo || "",
      descripcion: l.productos?.nombre_producto || "",
      facturada: l.cantidad_facturada,
      devolver: l.cantidad,
      lote: l.lote,
    })),
    politica: POLITICA_DEVOLUCION_DEFAULT,
  });
  return { pdf, dev };
}

async function imprimir(devId: string) {
  try {
    const { pdf, dev } = await buildPdfFor(devId);
    pdf.autoPrint();
    const url = pdf.output("bloburl");
    const w = window.open(url as any, "_blank");
    if (!w) pdf.save(`${dev.folio}.pdf`);
  } catch (e: any) {
    toast.error(e.message || "No se pudo generar el PDF");
  }
}

// --------------------------------------------------------------------------
// Página
// --------------------------------------------------------------------------
export default function Devoluciones() {
  const [params, setParams] = useSearchParams();
  const { hasAnyRole } = useAuth() as any;
  const canAdmin = hasAnyRole?.(["admin", "manager"]) ?? false;
  const [nuevaOpen, setNuevaOpen] = useState(!!params.get("factura"));
  const [detalleId, setDetalleId] = useState<string | null>(params.get("id"));
  const [motivosOpen, setMotivosOpen] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [q, setQ] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["devoluciones"],
    queryFn: async () => {
      const { data, error } = await db
        .from("devoluciones")
        .select("id, folio, fecha_venta, fecha_solicitud, estado, resolucion_tipo, plazo_excedido, motivo_otro, devolucion_motivos(nombre), documentos(numero_factura, companies(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtradas = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r: any) =>
      (filtroEstado === "todos" || r.estado === filtroEstado) &&
      (!s || [r.folio, r.documentos?.numero_factura, r.documentos?.companies?.name].some((x) => (x || "").toLowerCase().includes(s))),
    );
  }, [rows, q, filtroEstado]);

  return (
    <div className="container mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Undo2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-light tracking-tight">Devoluciones</h1>
            <p className="text-sm font-light text-muted-foreground">Solicitudes de devolución de producto ligadas a una factura.</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canAdmin && (
            <Button variant="outline" onClick={() => setMotivosOpen(true)}><Settings2 className="h-4 w-4 mr-1.5" />Motivos</Button>
          )}
          <Button onClick={() => setNuevaOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Nueva devolución</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Buscar folio, factura o cliente..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {Object.entries(ESTADOS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Factura</TableHead>
                <TableHead>Fecha de venta</TableHead>
                <TableHead>Fecha de solicitud</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Resolución</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Cargando...</TableCell></TableRow>}
              {!isLoading && filtradas.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">No hay devoluciones.</TableCell></TableRow>}
              {filtradas.map((r: any) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setDetalleId(r.id)}>
                  <TableCell className="font-mono text-xs">{r.folio}</TableCell>
                  <TableCell>{r.documentos?.companies?.name || "—"}</TableCell>
                  <TableCell>{r.documentos?.numero_factura || "—"}</TableCell>
                  <TableCell>{fmtDate(r.fecha_venta)}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">{fmtDate(r.fecha_solicitud)}
                      {r.plazo_excedido && <span title="Fuera de plazo (más de 15 días)"><AlertTriangle className="h-3.5 w-3.5 text-amber-600" /></span>}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{r.devolucion_motivos?.nombre || r.motivo_otro || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className={ESTADO_COLOR[r.estado]}>{ESTADOS[r.estado]}</Badge></TableCell>
                  <TableCell className="text-xs">{r.resolucion_tipo ? RESOLUCIONES[r.resolucion_tipo] : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NuevaDevolucionDialog
        open={nuevaOpen}
        facturaInicial={params.get("factura")}
        onOpenChange={(v) => { setNuevaOpen(v); if (!v && params.get("factura")) { params.delete("factura"); setParams(params, { replace: true }); } }}
        onCreated={(id) => setDetalleId(id)}
      />
      {detalleId && <DevolucionDetalleDialog id={detalleId} onClose={() => setDetalleId(null)} />}
      {motivosOpen && <MotivosDialog onClose={() => setMotivosOpen(false)} />}
    </div>
  );
}

// --------------------------------------------------------------------------
// Nueva devolución
// --------------------------------------------------------------------------
function NuevaDevolucionDialog({ open, onOpenChange, onCreated, facturaInicial }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: string) => void; facturaInicial: string | null }) {
  const qc = useQueryClient();
  const { data: motivos = [] } = useMotivos();
  const [busca, setBusca] = useState("");
  const [facturaId, setFacturaId] = useState<string | null>(facturaInicial);
  const [cant, setCant] = useState<Record<string, string>>({});
  const [lote, setLote] = useState<Record<string, string>>({});
  const [motivoId, setMotivoId] = useState("");
  const [motivoOtro, setMotivoOtro] = useState("");
  const [fechaSol, setFechaSol] = useState(new Date().toISOString().slice(0, 10));
  const [coment, setComent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setFacturaId(facturaInicial); setCant({}); setLote({}); setMotivoId(""); setMotivoOtro(""); setComent(""); setFiles([]); setBusca(""); } }, [open, facturaInicial]);

  const { data: facturas = [], isFetching } = useQuery({
    queryKey: ["dev-facturas-busca", busca],
    enabled: open && !facturaId && busca.trim().length >= 2,
    queryFn: async () => {
      const s = busca.trim();
      const { data: comps } = await db.from("companies").select("id").ilike("name", `%${s}%`).limit(50);
      const ids = (comps || []).map((c: any) => c.id);
      let qy = db.from("documentos").select("id, numero_factura, fecha_documento, total, companies(name)").eq("tipo_documento", "factura").eq("is_active", true).order("fecha_documento", { ascending: false }).limit(30);
      qy = ids.length ? qy.or(`numero_factura.ilike.%${s}%,empresa_id.in.(${ids.join(",")})`) : qy.ilike("numero_factura", `%${s}%`);
      const { data, error } = await qy;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: factura } = useQuery({
    queryKey: ["dev-factura", facturaId],
    enabled: !!facturaId,
    queryFn: async () => {
      const { data, error } = await db
        .from("documentos")
        .select("id, numero_factura, fecha_documento, companies(name), documento_productos(id, producto_id, cantidad, productos(codigo, nombre_producto))")
        .eq("id", facturaId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const guardar = async () => {
    if (!factura) return toast.error("Selecciona la factura");
    if (!motivoId) return toast.error("Selecciona el motivo");
    if (motivoId === "otro" && !motivoOtro.trim()) return toast.error("Describe el motivo");
    const lineas = (factura.documento_productos || [])
      .filter((p: any) => Number(cant[p.id]) > 0)
      .map((p: any) => ({ p, c: Number(cant[p.id]) }));
    if (lineas.length === 0) return toast.error("Indica al menos un producto y cantidad a devolver");
    const exceso = lineas.find((l: any) => l.c > Number(l.p.cantidad));
    if (exceso) return toast.error("La cantidad a devolver no puede ser mayor a la facturada");
    setSaving(true);
    try {
      const { data: dev, error } = await db.from("devoluciones").insert({
        documento_id: factura.id,
        motivo_id: motivoId === "otro" ? null : motivoId,
        motivo_otro: motivoId === "otro" ? motivoOtro.trim() : null,
        fecha_solicitud: fechaSol,
        comentarios: coment || null,
      }).select("id, folio").single();
      if (error) throw error;
      const { error: le } = await db.from("devolucion_lineas").insert(lineas.map((l: any) => ({
        devolucion_id: dev.id, documento_producto_id: l.p.id, producto_id: l.p.producto_id,
        cantidad_facturada: l.p.cantidad, cantidad: l.c, lote: lote[l.p.id] || null,
      })));
      if (le) throw le;
      await subirArchivos(dev.id, files, "evidencia");
      toast.success(`Devolución ${dev.folio} creada`);
      qc.invalidateQueries({ queryKey: ["devoluciones"] });
      onOpenChange(false);
      onCreated(dev.id);
    } catch (e: any) {
      toast.error(e.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="bg-gradient-to-br from-violet-50 to-blue-50 px-6 py-4 border-b">
          <DialogTitle className="text-base font-semibold tracking-tight">Nueva solicitud de devolución</DialogTitle>
          <DialogDescription className="text-xs">Ligada a una factura. Después podrás imprimir el formato para que el cliente lo llene y firme.</DialogDescription>
        </DialogHeader>
        <div className="px-6 py-5 space-y-5 font-light max-h-[65vh] overflow-y-auto">
          <div className="space-y-1.5">
            <p className={sectionLabel}>Venta (factura)</p>
            {factura ? (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">{factura.numero_factura} · {factura.companies?.name}</p>
                  <p className="text-xs text-muted-foreground">Vendida el {fmtDate(factura.fecha_documento)}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setFacturaId(null)}>Cambiar</Button>
              </div>
            ) : (
              <>
                <Input placeholder="Escribe número de factura o cliente..." value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus />
                {isFetching && <p className="text-xs text-muted-foreground">Buscando...</p>}
                <div className="max-h-48 overflow-y-auto divide-y rounded-md border empty:hidden">
                  {facturas.map((f: any) => (
                    <button key={f.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50/40" onClick={() => setFacturaId(f.id)}>
                      <span className="font-medium">{f.numero_factura}</span> · {f.companies?.name} <span className="text-xs text-muted-foreground">· {fmtDate(f.fecha_documento)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {factura && (
            <div className="space-y-1.5">
              <p className={sectionLabel}>Productos a devolver</p>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Producto</TableHead><TableHead className="w-24">Facturado</TableHead><TableHead className="w-28">A devolver</TableHead><TableHead className="w-32">Lote</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {(factura.documento_productos || []).map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs"><span className="font-mono">{p.productos?.codigo}</span> {p.productos?.nombre_producto}</TableCell>
                      <TableCell className="text-center">{Number(p.cantidad)}</TableCell>
                      <TableCell><Input type="number" min={0} max={Number(p.cantidad)} value={cant[p.id] || ""} onChange={(e) => setCant({ ...cant, [p.id]: e.target.value })} className="h-8" /></TableCell>
                      <TableCell><Input value={lote[p.id] || ""} onChange={(e) => setLote({ ...lote, [p.id]: e.target.value })} className="h-8" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={sectionLabel}>Motivo *</Label>
              <Select value={motivoId} onValueChange={setMotivoId}>
                <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                <SelectContent>
                  {motivos.map((m) => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}
                  <SelectItem value="otro">Otro…</SelectItem>
                </SelectContent>
              </Select>
              {motivoId === "otro" && <Input placeholder="Describe el motivo" value={motivoOtro} onChange={(e) => setMotivoOtro(e.target.value)} />}
            </div>
            <div className="space-y-1.5">
              <Label className={sectionLabel}>Fecha de solicitud</Label>
              <Input type="date" value={fechaSol} onChange={(e) => setFechaSol(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className={sectionLabel}>Comentarios</Label>
            <Textarea rows={3} value={coment} onChange={(e) => setComent(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className={sectionLabel}>Evidencias (fotos y PDFs)</Label>
            <Input type="file" multiple accept="image/*,application/pdf" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
            {files.length > 0 && <p className="text-xs text-muted-foreground">{files.length} archivo(s) seleccionado(s)</p>}
          </div>
        </div>
        <DialogFooter className="bg-muted/40 px-6 py-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={guardar} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Crear devolución</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function subirArchivos(devId: string, files: File[], tipo: string) {
  for (const f of files) {
    const path = `${devId}/${Date.now()}-${f.name.replace(/[^A-Za-z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("devoluciones").upload(path, f, { contentType: f.type });
    if (error) { toast.error(`No se pudo subir ${f.name}`); continue; }
    await db.from("devolucion_archivos").insert({ devolucion_id: devId, storage_path: path, nombre_archivo: f.name, mime_type: f.type, tipo });
  }
}

async function crearReclamoDesdeDevolucion(devId: string) {
  const { data: ex } = await db.from("inv_reclamos").select("id").eq("devolucion_id", devId).maybeSingle();
  if (ex) return ex.id as string;
  const { data: d, error } = await db
    .from("devoluciones")
    .select("*, devolucion_motivos(nombre), documentos(numero_factura, empresa_vendedora, companies(name)), devolucion_lineas(cantidad, cantidad_facturada, lote, productos:producto_id(codigo, nombre_producto)), devolucion_archivos(storage_path, nombre_archivo, mime_type, tipo)")
    .eq("id", devId).single();
  if (error) throw error;
  const motivo = d.devolucion_motivos?.nombre || d.motivo_otro || "";
  const danado = /da[ñn]/i.test(motivo);
  const { data: auth } = await supabase.auth.getUser();
  const { data: rec, error: re } = await db.from("inv_reclamos").insert({
    devolucion_id: devId,
    pedido_id: null,
    empresa_vendedora: d.documentos?.empresa_vendedora === "galsa_phillips66" ? "galsa" : "lumaggs",
    tipo_reclamo: danado ? "dañado" : "otro",
    cliente_nombre: d.documentos?.companies?.name || "CLIENTE",
    no_pedido_factura: d.documentos?.numero_factura || null,
    fecha_reclamo: new Date().toISOString().slice(0, 10),
    fecha_recepcion: d.fecha_solicitud,
    descripcion: `Devolución de cliente ${d.folio} autorizada por gerencia. Motivo: ${motivo}.${d.comentarios ? " " + d.comentarios : ""}`,
    estatus: "borrador",
    total_skus_afectados: (d.devolucion_lineas || []).length,
    creado_por: auth.user?.id ?? null,
  }).select("id").single();
  if (re) throw re;
  if ((d.devolucion_lineas || []).length) {
    await db.from("inv_reclamo_lineas").insert(d.devolucion_lineas.map((l: any) => ({
      reclamo_id: rec.id,
      codigo_producto: l.productos?.codigo || "S/C",
      nombre_producto: l.productos?.nombre_producto || null,
      descripcion: motivo,
      tipo_aviso: danado ? "Dañado" : "Otro",
      cantidad_afectada: l.cantidad,
      cantidad_solicitada: l.cantidad_facturada,
      detalle_reclamacion: `${d.folio}${l.lote ? " · Lote " + l.lote : ""}`,
    })));
  }
  for (const a of d.devolucion_archivos || []) {
    const { data: blob } = await supabase.storage.from("devoluciones").download(a.storage_path);
    if (!blob) continue;
    const path = `${rec.id}/${Date.now()}_${(a.nombre_archivo || "archivo").replace(/[^A-Za-z0-9._-]/g, "_")}`;
    const { error: uErr } = await supabase.storage.from("inventario-reclamos").upload(path, blob, { contentType: a.mime_type || undefined });
    if (!uErr) await db.from("inv_reclamo_archivos").insert({ reclamo_id: rec.id, nombre_archivo: a.nombre_archivo || "archivo", url_archivo: path, tipo_archivo: a.mime_type, usuario_carga: auth.user?.id ?? null });
  }
  return rec.id as string;
}

// --------------------------------------------------------------------------
// Detalle
// --------------------------------------------------------------------------
function DevolucionDetalleDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { hasAnyRole } = useAuth() as any;
  const esGerencia = hasAnyRole?.(["admin", "manager"]) ?? false;
  const { data: dev, refetch } = useQuery({
    queryKey: ["devolucion", id],
    queryFn: async () => {
      const { data, error } = await db
        .from("devoluciones")
        .select("*, devolucion_motivos(nombre), documentos(id, numero_factura, contacto_id, companies(name), contacts:contacto_id(email, first_name, last_name)), devolucion_lineas(id, cantidad, cantidad_facturada, lote, productos:producto_id(codigo, nombre_producto)), devolucion_archivos(id, storage_path, nombre_archivo, mime_type, tipo), inv_reclamos(id, estatus)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const [form, setForm] = useState<any>({});
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!dev) return;
    setForm({
      estado: dev.estado, resolucion_tipo: dev.resolucion_tipo || "", resolucion_ref: dev.resolucion_ref || "",
      resolucion_monto: dev.resolucion_monto ?? "", resolucion_fecha: dev.resolucion_fecha || "", resolucion_notas: dev.resolucion_notas || "",
      recoleccion_responsable: dev.recoleccion_responsable || "", recoleccion_fecha: dev.recoleccion_fecha || "", recibido_almacen: dev.recibido_almacen,
    });
    setEmail(dev.documentos?.contacts?.email || "");
    (async () => {
      const out: Record<string, string> = {};
      for (const a of dev.devolucion_archivos || []) {
        const { data } = await supabase.storage.from("devoluciones").createSignedUrl(a.storage_path, 3600);
        if (data?.signedUrl) out[a.id] = data.signedUrl;
      }
      setUrls(out);
    })();
  }, [dev]);

  const guardar = async () => {
    if (form.estado === "resuelta" && !form.resolucion_tipo) return toast.error("Indica qué se hizo con la venta (resolución)");
    setSaving(true);
    const { error } = await db.from("devoluciones").update({
      estado: form.estado, resolucion_tipo: form.resolucion_tipo || null, resolucion_ref: form.resolucion_ref || null,
      resolucion_monto: form.resolucion_monto === "" ? null : Number(form.resolucion_monto), resolucion_fecha: form.resolucion_fecha || null,
      resolucion_notas: form.resolucion_notas || null, recoleccion_responsable: form.recoleccion_responsable || null,
      recoleccion_fecha: form.recoleccion_fecha || null, recibido_almacen: !!form.recibido_almacen,
    }).eq("id", id);
    if (error) { setSaving(false); return toast.error(error.message); }
    if (["autorizada", "resuelta"].includes(form.estado) && dev.estado !== form.estado && !dev.inv_reclamos?.length) {
      try { await crearReclamoDesdeDevolucion(id); toast.success("Se generó el reclamo en Pedidos → Reclamos"); }
      catch (e: any) { toast.error("Devolución guardada, pero no se pudo crear el reclamo: " + (e.message || "")); }
    }
    setSaving(false);
    toast.success("Devolución actualizada");
    qc.invalidateQueries({ queryKey: ["devoluciones"] });
    refetch();
  };

  const enviarCorreo = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return toast.error("Correo inválido");
    setSending(true);
    try {
      const { pdf, dev: d } = await buildPdfFor(id);
      const path = `${id}/formato-${d.folio}.pdf`;
      await supabase.storage.from("devoluciones").upload(path, pdf.output("blob"), { contentType: "application/pdf", upsert: true });
      const { data: s } = await supabase.storage.from("devoluciones").createSignedUrl(path, 60 * 60 * 24 * 14);
      const link = s?.signedUrl;
      if (!link) throw new Error("No se pudo generar la liga del PDF");
      const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;line-height:1.55">
Estimado cliente:<br/><br/>Le enviamos el formato de <b>Solicitud de Devolución ${d.folio}</b> correspondiente a la factura <b>${d.documentos?.numero_factura || ""}</b>.<br/><br/>
Por favor <b>imprímalo, llénelo a mano con pluma y fírmelo</b>. Entréguelo junto con el producto o envíelo escaneado respondiendo este correo.<br/><br/>
<a href="${link}" target="_blank" rel="noopener">Descargar formato (PDF)</a><br/><br/>La liga es válida por 14 días.<br/><br/>Saludos cordiales.</div>`;
      const subject = `Solicitud de devolución ${d.folio} – formato para firmar`;
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: { templateName: "raw-html", recipientEmail: email.trim(), idempotencyKey: `devolucion-${id}-${Date.now()}`, subjectOverride: subject, htmlOverride: html, to: [email.trim()], templateData: { __subject: subject, __html: html } },
      });
      if (error) throw error;
      toast.success("Formato enviado por correo");
    } catch (e: any) {
      toast.error(e.message || "No se pudo enviar");
    } finally {
      setSending(false);
    }
  };

  const borrarArchivo = async (a: any) => {
    if (!confirm("¿Eliminar archivo?")) return;
    await supabase.storage.from("devoluciones").remove([a.storage_path]);
    await db.from("devolucion_archivos").delete().eq("id", a.id);
    refetch();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="bg-gradient-to-br from-violet-50 to-blue-50 px-6 py-4 border-b">
          <DialogTitle className="text-base font-semibold tracking-tight flex items-center gap-2">
            Devolución {dev?.folio} {dev && <Badge variant="outline" className={ESTADO_COLOR[dev.estado]}>{ESTADOS[dev.estado]}</Badge>}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {dev?.documentos?.companies?.name} · Factura{" "}
            {dev?.documentos?.id && <Link to={`/documents/${dev.documentos.id}`} className="text-primary underline">{dev.documentos.numero_factura}</Link>}
          </DialogDescription>
        </DialogHeader>
        {!dev ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="px-6 py-5 space-y-5 font-light max-h-[65vh] overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><p className={sectionLabel}>Fecha de venta</p><p>{fmtDate(dev.fecha_venta)}</p></div>
              <div><p className={sectionLabel}>Fecha de solicitud</p><p>{fmtDate(dev.fecha_solicitud)}</p>{dev.plazo_excedido && <p className="text-[11px] text-amber-700">Fuera de plazo (más de 15 días)</p>}</div>
              <div className="col-span-2"><p className={sectionLabel}>Motivo</p><p>{dev.devolucion_motivos?.nombre || dev.motivo_otro}</p></div>
            </div>
            {dev.comentarios && <p className="text-sm text-muted-foreground whitespace-pre-line">{dev.comentarios}</p>}

            <Table>
              <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Facturado</TableHead><TableHead>A devolver</TableHead><TableHead>Lote</TableHead></TableRow></TableHeader>
              <TableBody>
                {(dev.devolucion_lineas || []).map((l: any) => (
                  <TableRow key={l.id}><TableCell className="text-xs"><span className="font-mono">{l.productos?.codigo}</span> {l.productos?.nombre_producto}</TableCell><TableCell>{Number(l.cantidad_facturada ?? 0)}</TableCell><TableCell>{Number(l.cantidad)}</TableCell><TableCell>{l.lote || "—"}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="space-y-2">
              <p className={sectionLabel}>Evidencias y formato firmado</p>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {(dev.devolucion_archivos || []).map((a: any) => (
                  <div key={a.id} className="relative rounded-md border overflow-hidden group">
                    {(a.mime_type || "").startsWith("image/") && urls[a.id] ? (
                      <a href={urls[a.id]} target="_blank" rel="noopener noreferrer"><img src={urls[a.id]} alt={a.nombre_archivo} className="h-24 w-full object-cover" /></a>
                    ) : (
                      <a href={urls[a.id]} target="_blank" rel="noopener noreferrer" className="h-24 flex flex-col items-center justify-center gap-1 bg-muted/30 text-xs"><FileText className="h-6 w-6 text-muted-foreground" />PDF</a>
                    )}
                    <p className="text-[10px] px-1 truncate">{a.tipo === "formato_firmado" ? "Formato firmado" : a.nombre_archivo}</p>
                    <button className="absolute top-1 right-1 hidden group-hover:block bg-background/90 rounded p-0.5" onClick={() => borrarArchivo(a)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex"><input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={async (e) => { await subirArchivos(id, Array.from(e.target.files || []), "evidencia"); refetch(); }} />
                  <span className="inline-flex items-center text-xs border rounded-md px-3 py-1.5 cursor-pointer hover:bg-muted"><Upload className="h-3.5 w-3.5 mr-1.5" />Subir evidencias</span></label>
                <label className="inline-flex"><input type="file" accept="image/*,application/pdf" className="hidden" onChange={async (e) => { await subirArchivos(id, Array.from(e.target.files || []), "formato_firmado"); refetch(); }} />
                  <span className="inline-flex items-center text-xs border rounded-md px-3 py-1.5 cursor-pointer hover:bg-muted"><Upload className="h-3.5 w-3.5 mr-1.5" />Subir formato firmado</span></label>
              </div>
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={sectionLabel}>Seguimiento y resolución</p>
                {dev.inv_reclamos?.length ? (
                  <Link to="/inventario/pedidos?tab=reclamos" className="text-xs text-primary underline">Reclamo generado en Pedidos → Reclamos</Link>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Al autorizar gerencia se crea el reclamo en Pedidos.</span>
                )}
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">Estado</Label>
                  <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(ESTADOS).map(([k, v]) => <SelectItem key={k} value={k} disabled={!esGerencia && (k === "autorizada" || k === "rechazada")}>{v}{!esGerencia && (k === "autorizada" || k === "rechazada") ? " (gerencia)" : ""}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1.5"><Label className="text-xs">Qué se hizo con la venta</Label>
                  <Select value={form.resolucion_tipo || "none"} onValueChange={(v) => setForm({ ...form, resolucion_tipo: v === "none" ? "" : v })}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Sin definir</SelectItem>{Object.entries(RESOLUCIONES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1.5"><Label className="text-xs">Folio NC / reembolso / pedido</Label><Input value={form.resolucion_ref || ""} onChange={(e) => setForm({ ...form, resolucion_ref: e.target.value })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Monto</Label><Input type="number" value={form.resolucion_monto} onChange={(e) => setForm({ ...form, resolucion_monto: e.target.value })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Fecha de resolución</Label><Input type="date" value={form.resolucion_fecha || ""} onChange={(e) => setForm({ ...form, resolucion_fecha: e.target.value })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Recolecta</Label><Input value={form.recoleccion_responsable || ""} onChange={(e) => setForm({ ...form, recoleccion_responsable: e.target.value })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Fecha de recolección</Label><Input type="date" value={form.recoleccion_fecha || ""} onChange={(e) => setForm({ ...form, recoleccion_fecha: e.target.value })} /></div>
                <label className="flex items-center gap-2 text-sm pt-6"><Checkbox checked={!!form.recibido_almacen} onCheckedChange={(v) => setForm({ ...form, recibido_almacen: !!v })} />Recibido en almacén</label>
              </div>
              <Textarea rows={2} placeholder="Notas de la resolución" value={form.resolucion_notas || ""} onChange={(e) => setForm({ ...form, resolucion_notas: e.target.value })} />
            </div>

            <div className="space-y-1.5 border-t pt-4">
              <p className={sectionLabel}>Enviar formato al cliente</p>
              <div className="flex gap-2">
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@cliente.com" />
                <Button variant="outline" onClick={enviarCorreo} disabled={sending}>{sending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Mail className="h-4 w-4 mr-1.5" />}Enviar</Button>
              </div>
            </div>
          </div>
        )}
        <DialogFooter className="bg-muted/40 px-6 py-3 border-t">
          <Button variant="outline" onClick={() => imprimir(id)}><Printer className="h-4 w-4 mr-1.5" />Imprimir formato</Button>
          <Button onClick={guardar} disabled={saving || !dev}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------------------
// Catálogo de motivos
// --------------------------------------------------------------------------
function MotivosDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: motivos = [], refetch } = useMotivos(true);
  const [nuevo, setNuevo] = useState("");
  const done = () => { refetch(); qc.invalidateQueries({ queryKey: ["devolucion_motivos"] }); };
  const upd = async (mid: string, patch: any) => { const { error } = await db.from("devolucion_motivos").update(patch).eq("id", mid); if (error) toast.error(error.message); done(); };
  const add = async () => {
    if (!nuevo.trim()) return;
    const { error } = await db.from("devolucion_motivos").insert({ nombre: nuevo.trim(), orden: motivos.length + 1 });
    if (error) return toast.error(error.message);
    setNuevo(""); done();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="bg-gradient-to-br from-violet-50 to-blue-50 px-6 py-4 border-b">
          <DialogTitle className="text-base font-semibold tracking-tight">Motivos de devolución</DialogTitle>
          <DialogDescription className="text-xs">Edita la lista que aparece al crear una devolución y en el formato impreso.</DialogDescription>
        </DialogHeader>
        <div className="px-6 py-5 space-y-2 max-h-[60vh] overflow-y-auto">
          {motivos.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <Input type="number" className="w-16 h-8" defaultValue={m.orden} onBlur={(e) => Number(e.target.value) !== m.orden && upd(m.id, { orden: Number(e.target.value) })} />
              <Input className="h-8" defaultValue={m.nombre} onBlur={(e) => e.target.value.trim() && e.target.value !== m.nombre && upd(m.id, { nombre: e.target.value.trim() })} />
              <label className="flex items-center gap-1 text-xs whitespace-nowrap"><Checkbox checked={m.is_active} onCheckedChange={(v) => upd(m.id, { is_active: !!v })} />Activo</label>
            </div>
          ))}
          <div className="flex gap-2 pt-2 border-t">
            <Input placeholder="Nuevo motivo" value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
            <Button onClick={add}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
        <DialogFooter className="bg-muted/40 px-6 py-3 border-t"><Button variant="outline" onClick={onClose}>Cerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------------------
// Aviso dentro de la factura
// --------------------------------------------------------------------------
export function DevolucionesFacturaAviso({ documentoId }: { documentoId: string }) {
  const { data = [] } = useQuery({
    queryKey: ["devoluciones-factura", documentoId],
    queryFn: async () => {
      const { data } = await db.from("devoluciones").select("id, folio, estado").eq("documento_id", documentoId);
      return data || [];
    },
  });
  return (
    <Card>
      <CardContent className="py-3 flex flex-wrap items-center gap-2 text-sm">
        <Undo2 className="h-4 w-4 text-muted-foreground" />
        {data.length === 0 ? <span className="text-muted-foreground font-light">Sin devoluciones</span> : (
          data.map((d: any) => (
            <Link key={d.id} to={`/devoluciones?id=${d.id}`}><Badge variant="outline" className={ESTADO_COLOR[d.estado]}>Tiene devolución {d.folio} · {ESTADOS[d.estado]}</Badge></Link>
          ))
        )}
        <Button asChild size="sm" variant="ghost" className="ml-auto"><Link to={`/devoluciones?factura=${documentoId}`}><Plus className="h-3.5 w-3.5 mr-1" />Solicitar devolución</Link></Button>
      </CardContent>
    </Card>
  );
}
