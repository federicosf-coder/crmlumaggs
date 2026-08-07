import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Truck, Upload, Loader2, Download, FileText, Mail, RefreshCw, Ban } from "lucide-react";
import { toast } from "sonner";

const CLIENTES = ["Hyundai", "Kenworth", "Mecánica Tek", "Otro"];
const BUCKET = "entregas-corporativas";

type Entrega = {
  id: string;
  cliente: string;
  codigo_producto: string;
  nombre_producto: string | null;
  cantidad: number;
  fecha_programada: string;
  estatus: string;
  pdf_entrega_path: string | null;
  evidencia_firmada_path: string | null;
  factura_referencia: string | null;
  notificado_at: string | null;
};

type Calendario = {
  id: string;
  cliente: string;
  nombre_archivo: string;
  storage_path: string;
  created_at: string;
  subido_por: string | null;
};

type ExtraidaRow = { codigo: string; nombre_producto?: string; fecha: string; cantidad: number };

function estatusBadge(e: string) {
  const map: Record<string, string> = {
    programada: "bg-blue-100 text-blue-700 border-blue-200",
    entregada: "bg-green-100 text-green-700 border-green-200",
    cancelada: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <Badge variant="outline" className={`text-[10px] font-medium capitalize ${map[e] || "bg-muted"}`}>
      {e}
    </Badge>
  );
}

async function openSigned(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
  if (error || !data?.signedUrl) {
    toast.error("No se pudo generar el enlace del archivo");
    return;
  }
  window.open(data.signedUrl, "_blank");
}

/* ---------------------------------- Calendarios --------------------------------- */

function CalendariosTab({ onImported }: { onImported: () => void }) {
  const [clienteSel, setClienteSel] = useState<string>("Hyundai");
  const [clienteOtro, setClienteOtro] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ExtraidaRow[]>([]);
  const [resumen, setResumen] = useState<{ nuevas: number; actualizadas: number } | null>(null);
  const [calendarios, setCalendarios] = useState<Calendario[]>([]);
  const [perfiles, setPerfiles] = useState<Record<string, string>>({});

  const cliente = clienteSel === "Otro" ? clienteOtro.trim() : clienteSel;

  const loadCalendarios = async () => {
    const { data } = await (supabase as any)
      .from("entregas_corporativas_calendarios")
      .select("id, cliente, nombre_archivo, storage_path, created_at, subido_por")
      .order("created_at", { ascending: false })
      .limit(50);
    const rows = (data ?? []) as Calendario[];
    setCalendarios(rows);
    const ids = [...new Set(rows.map((r) => r.subido_por).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: profs } = await (supabase as any).from("profiles").select("id, full_name, email").in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { map[p.id] = p.full_name || p.email || "—"; });
      setPerfiles(map);
    }
  };

  useEffect(() => { loadCalendarios(); }, []);

  const handleSubir = async () => {
    if (!cliente) return toast.error("Selecciona o escribe el cliente");
    if (!file) return toast.error("Selecciona un archivo");

    setLoading(true);
    setPreview([]);
    setResumen(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;

      const path = `${cliente}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
      if (upErr) throw upErr;

      const { data: cal, error: calErr } = await (supabase as any)
        .from("entregas_corporativas_calendarios")
        .insert({ cliente, nombre_archivo: file.name, storage_path: path, subido_por: uid })
        .select("id")
        .single();
      if (calErr) throw calErr;

      const { data: res, error: fnErr } = await supabase.functions.invoke("entregas-corporativas-extract", {
        body: { cliente, file_path: path },
      });
      if (fnErr) throw fnErr;
      if ((res as any)?.error) throw new Error((res as any).error);

      const entregas: ExtraidaRow[] = ((res as any)?.extracted?.entregas ?? []).filter(
        (e: ExtraidaRow) => e?.codigo && e?.fecha && Number(e.cantidad) > 0,
      );
      setPreview(entregas);

      if (!entregas.length) {
        toast.warning("No se detectaron entregas en el archivo");
      } else {
        // Detectar cuáles ya existían
        const { data: existentes } = await (supabase as any)
          .from("entregas_corporativas")
          .select("codigo_producto, fecha_programada")
          .eq("cliente", cliente)
          .in("codigo_producto", [...new Set(entregas.map((e) => String(e.codigo)))]);
        const existSet = new Set(
          (existentes ?? []).map((r: any) => `${r.codigo_producto}|${r.fecha_programada}`),
        );

        const payload = entregas.map((e) => ({
          cliente,
          codigo_producto: String(e.codigo),
          nombre_producto: e.nombre_producto ?? null,
          cantidad: Number(e.cantidad),
          fecha_programada: e.fecha,
          calendario_id: cal.id,
          creado_por: uid,
        }));

        const { error: upsertErr } = await (supabase as any)
          .from("entregas_corporativas")
          .upsert(payload, { onConflict: "cliente,codigo_producto,fecha_programada" });
        if (upsertErr) throw upsertErr;

        const actualizadas = entregas.filter((e) => existSet.has(`${e.codigo}|${e.fecha}`)).length;
        setResumen({ nuevas: entregas.length - actualizadas, actualizadas });
        toast.success(`${entregas.length - actualizadas} nuevas, ${actualizadas} actualizadas`);
      }

      await (supabase as any)
        .from("entregas_corporativas_calendarios")
        .update({ datos_extraidos: (res as any)?.extracted ?? null })
        .eq("id", cal.id);

      setFile(null);
      await loadCalendarios();
      onImported();
    } catch (e: any) {
      toast.error(e?.message || "Error al procesar el calendario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="bg-gradient-to-r from-violet-50 to-blue-50 border-b">
          <CardTitle className="text-sm uppercase tracking-wide font-medium flex items-center gap-2">
            <Upload className="h-4 w-4" /> Subir calendario de entregas
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</Label>
              <Select value={clienteSel} onValueChange={setClienteSel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLIENTES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              {clienteSel === "Otro" && (
                <Input
                  className="mt-2"
                  placeholder="Nombre del cliente"
                  value={clienteOtro}
                  onChange={(e) => setClienteOtro(e.target.value)}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Archivo</Label>
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleSubir} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Subir y Extraer
              </Button>
            </div>
          </div>

          {resumen && (
            <p className="text-sm font-light">
              <span className="font-medium text-green-700">{resumen.nuevas} nuevas</span>,{" "}
              <span className="font-medium text-blue-700">{resumen.actualizadas} actualizadas</span>
            </p>
          )}

          {preview.length > 0 && (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-violet-50 to-blue-50">
                    <TableHead className="uppercase text-[10px] tracking-wide">Código</TableHead>
                    <TableHead className="uppercase text-[10px] tracking-wide">Producto</TableHead>
                    <TableHead className="uppercase text-[10px] tracking-wide">Fecha</TableHead>
                    <TableHead className="uppercase text-[10px] tracking-wide text-right">Cantidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((r, i) => (
                    <TableRow key={`${r.codigo}-${r.fecha}-${i}`} className={i % 2 ? "bg-muted/30" : ""}>
                      <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                      <TableCell className="text-sm font-light">{r.nombre_producto || "—"}</TableCell>
                      <TableCell className="text-sm">{r.fecha}</TableCell>
                      <TableCell className="text-sm text-right">{r.cantidad}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="bg-gradient-to-r from-violet-50 to-blue-50 border-b">
          <CardTitle className="text-sm uppercase tracking-wide font-medium">Calendarios subidos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="uppercase text-[10px] tracking-wide">Cliente</TableHead>
                <TableHead className="uppercase text-[10px] tracking-wide">Archivo</TableHead>
                <TableHead className="uppercase text-[10px] tracking-wide">Fecha</TableHead>
                <TableHead className="uppercase text-[10px] tracking-wide">Subido por</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {calendarios.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Sin calendarios</TableCell></TableRow>
              )}
              {calendarios.map((c, i) => (
                <TableRow key={c.id} className={i % 2 ? "bg-muted/30" : ""}>
                  <TableCell className="text-sm">{c.cliente}</TableCell>
                  <TableCell className="text-sm font-light">{c.nombre_archivo}</TableCell>
                  <TableCell className="text-sm">{new Date(c.created_at).toLocaleDateString("es-MX")}</TableCell>
                  <TableCell className="text-sm font-light">{c.subido_por ? perfiles[c.subido_por] || "—" : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openSigned(c.storage_path)}>
                      <FileText className="h-3.5 w-3.5 mr-1" /> Ver archivo
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------ Entregas programadas ----------------------------- */

function EntregasTab({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(false);
  const [fCliente, setFCliente] = useState("todos");
  const [fEstatus, setFEstatus] = useState("todas");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [grupos, setGrupos] = useState<{ id: string; nombre: string }[]>([]);
  const [facturaDialog, setFacturaDialog] = useState<Entrega | null>(null);
  const [facturaVal, setFacturaVal] = useState("");
  const [notifDialog, setNotifDialog] = useState<Entrega | null>(null);
  const [grupoSel, setGrupoSel] = useState("");
  const [cancelar, setCancelar] = useState<Entrega | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = (supabase as any)
      .from("entregas_corporativas")
      .select("id, cliente, codigo_producto, nombre_producto, cantidad, fecha_programada, estatus, pdf_entrega_path, evidencia_firmada_path, factura_referencia, notificado_at")
      .order("fecha_programada", { ascending: true });
    if (fCliente !== "todos") q = q.eq("cliente", fCliente);
    if (fEstatus !== "todas") q = q.eq("estatus", fEstatus);
    if (desde) q = q.gte("fecha_programada", desde);
    if (hasta) q = q.lte("fecha_programada", hasta);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data ?? []) as Entrega[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [fCliente, fEstatus, desde, hasta, refreshKey]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("email_groups").select("id, nombre").eq("is_active", true).order("nombre");
      setGrupos((data ?? []) as any);
    })();
  }, []);

  const subirEvidencia = async (row: Entrega, file: File) => {
    setBusy(true);
    try {
      const path = `${row.cliente}/evidencias/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
      if (upErr) throw upErr;
      const { error } = await (supabase as any)
        .from("entregas_corporativas").update({ evidencia_firmada_path: path }).eq("id", row.id);
      if (error) throw error;
      toast.success("Evidencia subida");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Error al subir evidencia");
    } finally { setBusy(false); }
  };

  const guardarFactura = async () => {
    if (!facturaDialog) return;
    setBusy(true);
    const { error } = await (supabase as any)
      .from("entregas_corporativas")
      .update({ factura_referencia: facturaVal.trim() || null })
      .eq("id", facturaDialog.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Factura de referencia guardada");
    setFacturaDialog(null);
    load();
  };

  const notificar = async () => {
    if (!notifDialog || !grupoSel) return;
    setBusy(true);
    try {
      const { data: miembros } = await (supabase as any)
        .from("email_group_members").select("email").eq("group_id", grupoSel);
      const correos = (miembros ?? []).map((m: any) => m.email).filter(Boolean);
      if (!correos.length) throw new Error("El grupo seleccionado no tiene correos");

      const r = notifDialog;
      const asunto = `Entrega Corporativa — ${r.cliente} — ${r.codigo_producto} — ${r.fecha_programada}`;
      const cuerpo = [
        `Cliente: ${r.cliente}`,
        `Producto: ${r.nombre_producto || "—"}`,
        `Código: ${r.codigo_producto}`,
        `Cantidad: ${r.cantidad}`,
        `Fecha programada: ${r.fecha_programada}`,
        `Factura de referencia: ${r.factura_referencia || "—"}`,
      ].join("\n");

      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("entregas_corporativas").update({
        estatus: "entregada",
        notificado_at: new Date().toISOString(),
        notificado_por: userData?.user?.id ?? null,
      }).eq("id", r.id);
      if (error) throw error;

      window.location.href =
        `mailto:${correos.join(",")}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;

      toast.success("Entrega marcada como entregada");
      setNotifDialog(null);
      setGrupoSel("");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Error al notificar");
    } finally { setBusy(false); }
  };

  const doCancelar = async () => {
    if (!cancelar) return;
    const { error } = await (supabase as any)
      .from("entregas_corporativas").update({ estatus: "cancelada" }).eq("id", cancelar.id);
    if (error) return toast.error(error.message);
    toast.success("Entrega cancelada");
    setCancelar(null);
    load();
  };

  const exportar = () => {
    const data = rows.map((r) => ({
      Cliente: r.cliente,
      Código: r.codigo_producto,
      Producto: r.nombre_producto || "",
      Cantidad: Number(r.cantidad),
      "Fecha Programada": r.fecha_programada,
      Estatus: r.estatus,
      "Factura Referencia": r.factura_referencia || "",
      "Notificado": r.notificado_at ? new Date(r.notificado_at).toLocaleString("es-MX") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Entregas");
    XLSX.writeFile(wb, `entregas_corporativas_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const total = useMemo(() => rows.length, [rows]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 grid gap-3 md:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</Label>
            <Select value={fCliente} onValueChange={setFCliente}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {CLIENTES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Estatus</Label>
            <Select value={fEstatus} onValueChange={setFEstatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="programada">Programada</SelectItem>
                <SelectItem value="entregada">Entregada</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Desde</Label>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Hasta</Label>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" onClick={exportar} disabled={!rows.length}>
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="bg-gradient-to-r from-violet-50 to-blue-50 border-b">
          <CardTitle className="text-sm uppercase tracking-wide font-medium">Entregas ({total})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="uppercase text-[10px] tracking-wide">Cliente</TableHead>
                <TableHead className="uppercase text-[10px] tracking-wide">Código</TableHead>
                <TableHead className="uppercase text-[10px] tracking-wide">Producto</TableHead>
                <TableHead className="uppercase text-[10px] tracking-wide text-right">Cantidad</TableHead>
                <TableHead className="uppercase text-[10px] tracking-wide">Fecha Programada</TableHead>
                <TableHead className="uppercase text-[10px] tracking-wide">Estatus</TableHead>
                <TableHead className="uppercase text-[10px] tracking-wide">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">Sin entregas</TableCell></TableRow>
              )}
              {rows.map((r, i) => (
                <TableRow key={r.id} className={`${i % 2 ? "bg-muted/30" : ""} hover:bg-blue-50/40`}>
                  <TableCell className="text-sm">{r.cliente}</TableCell>
                  <TableCell className="font-mono text-xs">{r.codigo_producto}</TableCell>
                  <TableCell className="text-sm font-light">{r.nombre_producto || "—"}</TableCell>
                  <TableCell className="text-sm text-right">{Number(r.cantidad)}</TableCell>
                  <TableCell className="text-sm">{r.fecha_programada}</TableCell>
                  <TableCell>{estatusBadge(r.estatus)}</TableCell>
                  <TableCell>
                    {r.estatus === "programada" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex">
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) subirEvidencia(r, f);
                              e.target.value = "";
                            }}
                          />
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border cursor-pointer hover:bg-muted ${r.evidencia_firmada_path ? "text-green-700 border-green-200" : "text-muted-foreground"}`}>
                            <Upload className="h-3 w-3" />
                            {r.evidencia_firmada_path ? "Evidencia ✓" : "Subir evidencia firmada"}
                          </span>
                        </label>
                        <Button
                          variant="outline" size="sm" className="text-xs h-7"
                          onClick={() => { setFacturaDialog(r); setFacturaVal(r.factura_referencia || ""); }}
                        >
                          {r.factura_referencia ? `Factura: ${r.factura_referencia}` : "Capturar factura"}
                        </Button>
                        <Button
                          size="sm" className="text-xs h-7"
                          disabled={!r.evidencia_firmada_path || !r.factura_referencia || busy}
                          onClick={() => { setNotifDialog(r); setGrupoSel(""); }}
                        >
                          <Mail className="h-3 w-3 mr-1" /> Notificar y Marcar Entregada
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="text-xs h-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setCancelar(r)}
                        >
                          <Ban className="h-3 w-3 mr-1" /> Cancelar
                        </Button>
                      </div>
                    ) : r.estatus === "entregada" ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-light">
                        <span>Notificada: {r.notificado_at ? new Date(r.notificado_at).toLocaleString("es-MX") : "—"}</span>
                        <span>· Factura: {r.factura_referencia || "—"}</span>
                        {r.evidencia_firmada_path && (
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => openSigned(r.evidencia_firmada_path!)}>
                            <FileText className="h-3 w-3 mr-1" /> Evidencia
                          </Button>
                        )}
                        {r.pdf_entrega_path && (
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => openSigned(r.pdf_entrega_path!)}>
                            <FileText className="h-3 w-3 mr-1" /> PDF
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Factura de referencia */}
      <Dialog open={!!facturaDialog} onOpenChange={(o) => !o && setFacturaDialog(null)}>
        <DialogContent>
          <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 -m-6 mb-0 p-6 rounded-t-lg border-b">
            <DialogTitle className="text-base">Factura de referencia</DialogTitle>
            <DialogDescription className="font-light">
              {facturaDialog?.codigo_producto} · {facturaDialog?.fecha_programada}
            </DialogDescription>
          </DialogHeader>
          <div className="pt-6 space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Número de factura</Label>
            <Input value={facturaVal} onChange={(e) => setFacturaVal(e.target.value)} placeholder="Ej. A-12345" />
          </div>
          <DialogFooter className="bg-muted/40 -m-6 mt-0 p-4 rounded-b-lg">
            <Button variant="outline" onClick={() => setFacturaDialog(null)}>Cancelar</Button>
            <Button onClick={guardarFactura} disabled={busy}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notificar */}
      <Dialog open={!!notifDialog} onOpenChange={(o) => !o && setNotifDialog(null)}>
        <DialogContent>
          <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 -m-6 mb-0 p-6 rounded-t-lg border-b">
            <DialogTitle className="text-base">Notificar entrega</DialogTitle>
            <DialogDescription className="font-light">
              Se abrirá tu cliente de correo y la entrega quedará marcada como entregada.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-6 space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Grupo de correo</Label>
            <Select value={grupoSel} onValueChange={setGrupoSel}>
              <SelectTrigger><SelectValue placeholder="Selecciona un grupo" /></SelectTrigger>
              <SelectContent>
                {grupos.map((g) => <SelectItem key={g.id} value={g.id}>{g.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="bg-muted/40 -m-6 mt-0 p-4 rounded-b-lg">
            <Button variant="outline" onClick={() => setNotifDialog(null)}>Cancelar</Button>
            <Button onClick={notificar} disabled={!grupoSel || busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
              Enviar y marcar entregada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cancelar} onOpenChange={(o) => !o && setCancelar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar esta entrega?</AlertDialogTitle>
            <AlertDialogDescription className="font-light">
              {cancelar?.codigo_producto} · {cancelar?.fecha_programada}. Esta acción cambia el estatus a cancelada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={doCancelar}>Cancelar entrega</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------------------------------- Página --------------------------------- */

export default function EntregasCorporativas() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Truck className="h-6 w-6" /> Entregas Corporativas
        </h1>
        <p className="text-sm text-muted-foreground font-light">
          Calendarios de clientes corporativos y seguimiento de entregas programadas.
        </p>
      </div>

      <Tabs defaultValue="calendarios">
        <TabsList>
          <TabsTrigger value="calendarios">Calendarios</TabsTrigger>
          <TabsTrigger value="entregas">Entregas Programadas</TabsTrigger>
        </TabsList>
        <TabsContent value="calendarios" className="mt-4">
          <CalendariosTab onImported={() => setRefreshKey((k) => k + 1)} />
        </TabsContent>
        <TabsContent value="entregas" className="mt-4">
          <EntregasTab refreshKey={refreshKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
}