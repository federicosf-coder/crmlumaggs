import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import {
  Truck, Upload, Loader2, Download, FileText, Mail, RefreshCw, Ban, MapPin, Plus, Pencil, Eye,
} from "lucide-react";
import { toast } from "sonner";

const CLIENTES = ["Hyundai", "Kenworth", "Mecánica Tek", "Otro"];
const BUCKET = "entregas-corporativas";

type Ubicacion = {
  id: string;
  cliente: string;
  nombre: string;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
  instrucciones: string | null;
  activo: boolean;
};

type Linea = {
  id: string;
  entrega_id: string;
  codigo_producto: string;
  nombre_producto: string | null;
  cantidad: number;
};

type Entrega = {
  id: string;
  cliente: string;
  fecha_programada: string;
  estatus: string;
  ubicacion_id: string | null;
  lugar_entrega_texto: string | null;
  pdf_entrega_path: string | null;
  evidencia_firmada_path: string | null;
  factura_referencia: string | null;
  notificado_at: string | null;
  ubicacion?: Ubicacion | null;
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

type PreviewGrupo = {
  fecha: string;
  ubicacion: Ubicacion | null;
  lugarTexto: string | null;
  productos: ExtraidaRow[];
};

function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

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

async function fetchUbicaciones(cliente?: string) {
  let q = (supabase as any)
    .from("entregas_corporativas_ubicaciones")
    .select("id, cliente, nombre, direccion, lat, lng, instrucciones, activo")
    .order("cliente")
    .order("nombre");
  if (cliente) q = q.eq("cliente", cliente);
  const { data } = await q;
  return (data ?? []) as Ubicacion[];
}

/* ---------------------------------- Ubicaciones --------------------------------- */

function UbicacionDialog({
  open, onOpenChange, initial, defaultCliente, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: Ubicacion | null;
  defaultCliente?: string;
  onSaved: (u: Ubicacion) => void;
}) {
  const [clienteSel, setClienteSel] = useState("Hyundai");
  const [clienteOtro, setClienteOtro] = useState("");
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [instrucciones, setInstrucciones] = useState("");
  const [activo, setActivo] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const c = initial?.cliente || defaultCliente || "Hyundai";
    const known = CLIENTES.includes(c) && c !== "Otro";
    setClienteSel(known ? c : "Otro");
    setClienteOtro(known ? "" : c);
    setNombre(initial?.nombre ?? "");
    setDireccion(initial?.direccion ?? "");
    setLat(initial?.lat != null ? String(initial.lat) : "");
    setLng(initial?.lng != null ? String(initial.lng) : "");
    setInstrucciones(initial?.instrucciones ?? "");
    setActivo(initial?.activo ?? true);
  }, [open, initial, defaultCliente]);

  const cliente = clienteSel === "Otro" ? clienteOtro.trim() : clienteSel;

  const guardar = async () => {
    if (!cliente) return toast.error("Selecciona o escribe el cliente");
    if (!nombre.trim()) return toast.error("Escribe el nombre del lugar");
    setBusy(true);
    const payload = {
      cliente,
      nombre: nombre.trim(),
      direccion: direccion.trim() || null,
      lat: lat.trim() ? Number(lat) : null,
      lng: lng.trim() ? Number(lng) : null,
      instrucciones: instrucciones.trim() || null,
      activo,
    };
    const q = initial
      ? (supabase as any).from("entregas_corporativas_ubicaciones").update(payload).eq("id", initial.id).select().single()
      : (supabase as any).from("entregas_corporativas_ubicaciones").insert(payload).select().single();
    const { data, error } = await q;
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(initial ? "Ubicación actualizada" : "Ubicación creada");
    onSaved(data as Ubicacion);
    onOpenChange(false);
  };

  const latN = Number(lat), lngN = Number(lng);
  const hasCoords = lat.trim() !== "" && lng.trim() !== "" && !isNaN(latN) && !isNaN(lngN);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 -m-6 mb-0 p-6 rounded-t-lg border-b">
          <DialogTitle className="text-base">{initial ? "Editar ubicación" : "Nueva ubicación"}</DialogTitle>
          <DialogDescription className="font-light">
            Lugares de entrega del cliente (planta, yarda, almacén, etc.).
          </DialogDescription>
        </DialogHeader>
        <div className="pt-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</Label>
            <Select value={clienteSel} onValueChange={setClienteSel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CLIENTES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            {clienteSel === "Otro" && (
              <Input className="mt-2" placeholder="Nombre del cliente" value={clienteOtro} onChange={(e) => setClienteOtro(e.target.value)} />
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nombre</Label>
            <Input placeholder='Ej. "Planta Norte"' value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Dirección</Label>
            <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Latitud</Label>
              <Input type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Longitud</Label>
              <Input type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} />
            </div>
          </div>
          {hasCoords && (
            <a
              href={mapsUrl(latN, lngN)} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <MapPin className="h-3 w-3" /> Ver en Google Maps
            </a>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Instrucciones</Label>
            <Textarea rows={3} value={instrucciones} onChange={(e) => setInstrucciones(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={activo} onCheckedChange={setActivo} />
            <span className="text-sm font-light">Activo</span>
          </div>
        </div>
        <DialogFooter className="bg-muted/40 -m-6 mt-0 p-4 rounded-b-lg">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UbicacionesTab({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const [rows, setRows] = useState<Ubicacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [editing, setEditing] = useState<Ubicacion | null>(null);

  const load = async () => {
    setLoading(true);
    setRows(await fetchUbicaciones());
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [refreshKey]);

  return (
    <Card>
      <CardHeader className="bg-gradient-to-r from-violet-50 to-blue-50 border-b flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm uppercase tracking-wide font-medium flex items-center gap-2">
          <MapPin className="h-4 w-4" /> Ubicaciones de entrega ({rows.length})
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setDlgOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nueva
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="uppercase text-[10px] tracking-wide">Cliente</TableHead>
              <TableHead className="uppercase text-[10px] tracking-wide">Nombre</TableHead>
              <TableHead className="uppercase text-[10px] tracking-wide">Dirección</TableHead>
              <TableHead className="uppercase text-[10px] tracking-wide">Instrucciones</TableHead>
              <TableHead className="uppercase text-[10px] tracking-wide">Activo</TableHead>
              <TableHead className="uppercase text-[10px] tracking-wide text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">Sin ubicaciones</TableCell></TableRow>
            )}
            {rows.map((u, i) => (
              <TableRow key={u.id} className={`${i % 2 ? "bg-muted/30" : ""} hover:bg-blue-50/40`}>
                <TableCell className="text-sm">{u.cliente}</TableCell>
                <TableCell className="text-sm font-medium">
                  <div className="flex items-center gap-2">
                    {u.nombre}
                    {u.lat != null && u.lng != null && (
                      <a href={mapsUrl(u.lat, u.lng)} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> Ver en Google Maps
                      </a>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm font-light">{u.direccion || "—"}</TableCell>
                <TableCell className="text-sm font-light max-w-[280px] truncate">{u.instrucciones || "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] ${u.activo ? "bg-green-100 text-green-700 border-green-200" : "bg-slate-100 text-slate-600"}`}>
                    {u.activo ? "Sí" : "No"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(u); setDlgOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <UbicacionDialog
        open={dlgOpen}
        onOpenChange={setDlgOpen}
        initial={editing}
        onSaved={() => { load(); onChanged(); }}
      />
    </Card>
  );
}

/* ---------------------------------- Calendarios --------------------------------- */

function CalendariosTab({ onImported }: { onImported: () => void }) {
  const [clienteSel, setClienteSel] = useState<string>("Hyundai");
  const [clienteOtro, setClienteOtro] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [progreso, setProgreso] = useState<{ nombre: string; estado: "procesando" | "listo" | "error"; detalle?: string }[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewGrupo[]>([]);
  const [resumen, setResumen] = useState<{ entregas: number; nuevas: number; actualizadas: number } | null>(null);
  const [calendarios, setCalendarios] = useState<Calendario[]>([]);
  const [perfiles, setPerfiles] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

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

  const procesarArchivo = async (
    file: File,
    uid: string | null,
  ): Promise<{ entregas: number; nuevas: number; actualizadas: number; grupos: PreviewGrupo[] }> => {
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

      const extracted = (res as any)?.extracted ?? {};
      const lugarEntrega: string | null = extracted?.lugar_entrega ?? null;
      const entregas: ExtraidaRow[] = (extracted?.entregas ?? []).filter(
        (e: ExtraidaRow) => e?.codigo && e?.fecha && Number(e.cantidad) > 0,
      );

      await (supabase as any)
        .from("entregas_corporativas_calendarios")
        .update({ datos_extraidos: extracted ?? null })
        .eq("id", cal.id);

      if (!entregas.length) {
        return { entregas: 0, nuevas: 0, actualizadas: 0, grupos: [] };
      }

      // --- Resolver ubicación ---
      const ubicaciones = await fetchUbicaciones(cliente);
      let ubicacion: Ubicacion | null = null;
      if (cliente === "Kenworth") {
        ubicacion = ubicaciones[0] ?? null;
      } else if (lugarEntrega) {
        const target = norm(lugarEntrega);
        ubicacion =
          ubicaciones.find((u) => {
            const n = norm(u.nombre);
            return n === target || n.includes(target) || target.includes(n);
          }) ?? null;
      }
      const lugarTexto = ubicacion ? null : (lugarEntrega || null);

      // --- Agrupar por fecha ---
      const porFecha = new Map<string, ExtraidaRow[]>();
      entregas.forEach((e) => {
        const arr = porFecha.get(e.fecha) ?? [];
        arr.push(e);
        porFecha.set(e.fecha, arr);
      });

      let lineasNuevas = 0;
      let lineasActualizadas = 0;

      for (const [fecha, productos] of [...porFecha.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        // Buscar cabecera existente
        let q = (supabase as any)
          .from("entregas_corporativas")
          .select("id")
          .eq("cliente", cliente)
          .eq("fecha_programada", fecha);
        q = ubicacion ? q.eq("ubicacion_id", ubicacion.id) : q.is("ubicacion_id", null);
        const { data: existente } = await q.maybeSingle();

        let entregaId: string;
        if (existente?.id) {
          entregaId = existente.id;
          await (supabase as any)
            .from("entregas_corporativas")
            .update({ calendario_id: cal.id, lugar_entrega_texto: lugarTexto })
            .eq("id", entregaId);
        } else {
          const { data: nueva, error: insErr } = await (supabase as any)
            .from("entregas_corporativas")
            .insert({
              cliente,
              ubicacion_id: ubicacion?.id ?? null,
              fecha_programada: fecha,
              lugar_entrega_texto: lugarTexto,
              calendario_id: cal.id,
              creado_por: uid,
              estatus: "programada",
            })
            .select("id")
            .single();
          if (insErr) throw insErr;
          entregaId = nueva.id;
        }

        // Líneas
        const { data: lineasExist } = await (supabase as any)
          .from("entregas_corporativas_lineas")
          .select("id, codigo_producto")
          .eq("entrega_id", entregaId);
        const mapLineas = new Map<string, string>(
          (lineasExist ?? []).map((l: any) => [String(l.codigo_producto), l.id]),
        );

        for (const p of productos) {
          const codigo = String(p.codigo);
          const existId = mapLineas.get(codigo);
          if (existId) {
            const { error } = await (supabase as any)
              .from("entregas_corporativas_lineas")
              .update({ cantidad: Number(p.cantidad), nombre_producto: p.nombre_producto ?? null })
              .eq("id", existId);
            if (error) throw error;
            lineasActualizadas++;
          } else {
            const { error } = await (supabase as any)
              .from("entregas_corporativas_lineas")
              .insert({
                entrega_id: entregaId,
                codigo_producto: codigo,
                nombre_producto: p.nombre_producto ?? null,
                cantidad: Number(p.cantidad),
              });
            if (error) throw error;
            lineasNuevas++;
          }
        }
      }

      return {
        entregas: porFecha.size,
        nuevas: lineasNuevas,
        actualizadas: lineasActualizadas,
        grupos: [...porFecha.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([fecha, productos]) => ({ fecha, ubicacion, lugarTexto: lugarEntrega, productos })),
      };
  };

  const handleSubir = async () => {
    if (!cliente) return toast.error("Selecciona o escribe el cliente");
    if (!files.length) return toast.error("Selecciona al menos un archivo");

    setLoading(true);
    setPreview([]);
    setResumen(null);
    setProgreso(files.map((f) => ({ nombre: f.name, estado: "procesando" as const })));

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id ?? null;

    let totEntregas = 0, totNuevas = 0, totAct = 0, fallidos = 0;
    const gruposTodos: PreviewGrupo[] = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const r = await procesarArchivo(files[i], uid);
        totEntregas += r.entregas;
        totNuevas += r.nuevas;
        totAct += r.actualizadas;
        gruposTodos.push(...r.grupos);
        setProgreso((prev) => prev.map((p, idx) => idx === i
          ? { ...p, estado: "listo", detalle: `${r.entregas} entregas, ${r.nuevas + r.actualizadas} líneas` }
          : p));
      } catch (e: any) {
        fallidos++;
        setProgreso((prev) => prev.map((p, idx) => idx === i
          ? { ...p, estado: "error", detalle: e?.message || "Error desconocido" }
          : p));
      }
    }

    setPreview(gruposTodos);
    setResumen({ entregas: totEntregas, nuevas: totNuevas, actualizadas: totAct });
    if (fallidos && !totEntregas) toast.error(`${fallidos} archivo(s) con error`);
    else toast.success(`${totEntregas} entregas, ${totNuevas} líneas nuevas, ${totAct} actualizadas${fallidos ? ` · ${fallidos} con error` : ""}`);

    setFiles([]);
    if (inputRef.current) inputRef.current.value = "";
    await loadCalendarios();
    onImported();
    setLoading(false);
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
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
                 onDrop={(e) => {
                   e.preventDefault();
                   setDragOver(false);
                   const list = Array.from(e.dataTransfer.files ?? []);
                   if (list.length) setFiles((prev) => [...prev, ...list]);
                 }}
                className={`cursor-pointer rounded-md border-2 border-dashed px-4 py-4 text-center transition-colors ${
                  dragOver ? "border-blue-400 bg-blue-50/60" : "border-muted-foreground/25 hover:bg-muted/40"
                }`}
              >
                <Upload className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs font-light text-muted-foreground">
                  Arrastra los archivos aquí o haz clic para seleccionar (PDF, PNG, JPG). Puedes subir varios a la vez.
                </p>
                {files.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {files.map((f, i) => <p key={`${f.name}-${i}`} className="text-xs font-medium">{f.name}</p>)}
                  </div>
                )}
              </div>
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? []);
                  if (list.length) setFiles((prev) => [...prev, ...list]);
                }}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleSubir} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Subir y Extraer
              </Button>
            </div>
          </div>

          {progreso.length > 0 && (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="uppercase text-[10px] tracking-wide">Archivo</TableHead>
                    <TableHead className="uppercase text-[10px] tracking-wide">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {progreso.map((p, i) => (
                    <TableRow key={`${p.nombre}-${i}`} className={i % 2 ? "bg-muted/30" : ""}>
                      <TableCell className="text-sm font-light">{p.nombre}</TableCell>
                      <TableCell className="text-sm">
                        {p.estado === "procesando" && <span className="text-blue-700 inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Procesando…</span>}
                        {p.estado === "listo" && <span className="text-green-700">Listo ({p.detalle})</span>}
                        {p.estado === "error" && <span className="text-destructive">Error: {p.detalle}</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {resumen && (
            <p className="text-sm font-light">
              <span className="font-medium">{resumen.entregas} entregas (día+lugar)</span>,{" "}
              <span className="font-medium text-green-700">{resumen.nuevas} líneas de producto nuevas</span>,{" "}
              <span className="font-medium text-blue-700">{resumen.actualizadas} actualizadas</span>
            </p>
          )}

          {preview.length > 0 && (
            <div className="space-y-3">
              {preview.map((g, gi) => (
                <div key={`${g.fecha}-${gi}`} className="border rounded-md overflow-hidden">
                  <div className="px-4 py-2 bg-gradient-to-r from-violet-50 to-blue-50 border-b">
                    <p className="text-sm font-medium">{g.fecha}</p>
                    {g.ubicacion ? (
                      <p className="text-xs font-light text-muted-foreground">{g.ubicacion.nombre}</p>
                    ) : (
                      <p className="text-xs font-light text-amber-600">
                        Sin ubicación asignada — se guardará como texto libre: {g.lugarTexto || "—"}
                      </p>
                    )}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="uppercase text-[10px] tracking-wide">Código</TableHead>
                        <TableHead className="uppercase text-[10px] tracking-wide">Producto</TableHead>
                        <TableHead className="uppercase text-[10px] tracking-wide text-right">Cantidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.productos.map((p, i) => (
                        <TableRow key={`${p.codigo}-${i}`} className={i % 2 ? "bg-muted/30" : ""}>
                          <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                          <TableCell className="text-sm font-light">{p.nombre_producto || "—"}</TableCell>
                          <TableCell className="text-sm text-right">{p.cantidad}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
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

function EntregasTab({ refreshKey, onUbicacionesChanged }: { refreshKey: number; onUbicacionesChanged: () => void }) {
  const [rows, setRows] = useState<Entrega[]>([]);
  const [lineas, setLineas] = useState<Record<string, Linea[]>>({});
  const [loading, setLoading] = useState(false);
  const [fCliente, setFCliente] = useState("todos");
  const [fEstatus, setFEstatus] = useState("todas");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [grupos, setGrupos] = useState<{ id: string; nombre: string }[]>([]);
  const [detalle, setDetalle] = useState<Entrega | null>(null);
  const [facturaVal, setFacturaVal] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [grupoSel, setGrupoSel] = useState("");
  const [cancelar, setCancelar] = useState<Entrega | null>(null);
  const [busy, setBusy] = useState(false);
  const [ubicClienteList, setUbicClienteList] = useState<Ubicacion[]>([]);
  const [ubicSel, setUbicSel] = useState("");
  const [nuevaUbicOpen, setNuevaUbicOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = (supabase as any)
      .from("entregas_corporativas")
      .select(
        "id, cliente, fecha_programada, estatus, ubicacion_id, lugar_entrega_texto, pdf_entrega_path, evidencia_firmada_path, factura_referencia, notificado_at, ubicacion:entregas_corporativas_ubicaciones(id, cliente, nombre, direccion, lat, lng, instrucciones, activo)",
      )
      .order("fecha_programada", { ascending: true });
    if (fCliente !== "todos") q = q.eq("cliente", fCliente);
    if (fEstatus !== "todas") q = q.eq("estatus", fEstatus);
    if (desde) q = q.gte("fecha_programada", desde);
    if (hasta) q = q.lte("fecha_programada", hasta);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    const list = (data ?? []) as Entrega[];
    setRows(list);

    if (list.length) {
      const { data: lin } = await (supabase as any)
        .from("entregas_corporativas_lineas")
        .select("id, entrega_id, codigo_producto, nombre_producto, cantidad")
        .in("entrega_id", list.map((r) => r.id));
      const map: Record<string, Linea[]> = {};
      ((lin ?? []) as Linea[]).forEach((l) => {
        (map[l.entrega_id] ||= []).push(l);
      });
      setLineas(map);
    } else {
      setLineas({});
    }
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

  // Mantener detalle sincronizado tras recargas
  useEffect(() => {
    if (!detalle) return;
    const fresh = rows.find((r) => r.id === detalle.id);
    if (fresh) setDetalle(fresh);
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrirDetalle = async (r: Entrega) => {
    setDetalle(r);
    setFacturaVal(r.factura_referencia || "");
    setUbicSel("");
    setUbicClienteList(await fetchUbicaciones(r.cliente));
  };

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
    if (!detalle) return;
    setBusy(true);
    const { error } = await (supabase as any)
      .from("entregas_corporativas")
      .update({ factura_referencia: facturaVal.trim() || null })
      .eq("id", detalle.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Factura de referencia guardada");
    load();
  };

  const asignarUbicacion = async (ubicacionId: string) => {
    if (!detalle) return;
    setBusy(true);
    const { error } = await (supabase as any)
      .from("entregas_corporativas")
      .update({ ubicacion_id: ubicacionId })
      .eq("id", detalle.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Ubicación asignada");
    await load();
  };

  const notificar = async () => {
    if (!detalle || !grupoSel) return;
    setBusy(true);
    try {
      const { data: miembros } = await (supabase as any)
        .from("email_group_members").select("email").eq("group_id", grupoSel);
      const correos = (miembros ?? []).map((m: any) => m.email).filter(Boolean);
      if (!correos.length) throw new Error("El grupo seleccionado no tiene correos");

      const r = detalle;
      const lugar = r.ubicacion?.nombre || r.lugar_entrega_texto || "—";
      const asunto = `Entrega Corporativa — ${r.cliente} — ${lugar} — ${r.fecha_programada}`;
      const productos = (lineas[r.id] ?? [])
        .map((l) => `• ${l.codigo_producto} ${l.nombre_producto || ""} — ${Number(l.cantidad)}`)
        .join("\n");
      const cuerpo = [
        `Cliente: ${r.cliente}`,
        `Lugar de entrega: ${lugar}`,
        r.ubicacion?.direccion ? `Dirección: ${r.ubicacion.direccion}` : null,
        `Fecha programada: ${r.fecha_programada}`,
        `Factura de referencia: ${r.factura_referencia || "—"}`,
        "",
        "Productos:",
        productos || "—",
      ].filter(Boolean).join("\n");

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
      setNotifOpen(false);
      setGrupoSel("");
      setDetalle(null);
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
    setDetalle(null);
    load();
  };

  const exportar = () => {
    const data: any[] = [];
    rows.forEach((r) => {
      const ls = lineas[r.id] ?? [];
      const base = {
        Cliente: r.cliente,
        "Fecha Programada": r.fecha_programada,
        "Lugar de entrega": r.ubicacion?.nombre || r.lugar_entrega_texto || "",
        Estatus: r.estatus,
        "Factura Referencia": r.factura_referencia || "",
        Notificado: r.notificado_at ? new Date(r.notificado_at).toLocaleString("es-MX") : "",
      };
      if (!ls.length) data.push({ ...base, Código: "", Producto: "", Cantidad: "" });
      ls.forEach((l) =>
        data.push({ ...base, Código: l.codigo_producto, Producto: l.nombre_producto || "", Cantidad: Number(l.cantidad) }),
      );
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Entregas");
    XLSX.writeFile(wb, `entregas_corporativas_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const total = useMemo(() => rows.length, [rows]);
  const detalleLineas = detalle ? lineas[detalle.id] ?? [] : [];
  const faltaUbicacion = !!detalle && !detalle.ubicacion_id;

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
                <TableHead className="uppercase text-[10px] tracking-wide">Fecha</TableHead>
                <TableHead className="uppercase text-[10px] tracking-wide">Lugar de entrega</TableHead>
                <TableHead className="uppercase text-[10px] tracking-wide text-center">N° de productos</TableHead>
                <TableHead className="uppercase text-[10px] tracking-wide">Estatus</TableHead>
                <TableHead className="uppercase text-[10px] tracking-wide text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">Sin entregas</TableCell></TableRow>
              )}
              {rows.map((r, i) => (
                <TableRow
                  key={r.id}
                  className={`${i % 2 ? "bg-muted/30" : ""} hover:bg-blue-50/40 cursor-pointer`}
                  onClick={() => abrirDetalle(r)}
                >
                  <TableCell className="text-sm">{r.cliente}</TableCell>
                  <TableCell className="text-sm">{r.fecha_programada}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-2">
                      {r.ubicacion?.nombre ? (
                        <span>{r.ubicacion.nombre}</span>
                      ) : (
                        <span className="italic font-light text-muted-foreground">
                          {r.lugar_entrega_texto || "Sin ubicación"}
                        </span>
                      )}
                      {r.ubicacion?.lat != null && r.ubicacion?.lng != null && (
                        <a
                          href={mapsUrl(r.ubicacion.lat, r.ubicacion.lng)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-[10px]">{(lineas[r.id] ?? []).length}</Badge>
                  </TableCell>
                  <TableCell>{estatusBadge(r.estatus)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); abrirDetalle(r); }}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> Ver detalle
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detalle de la entrega */}
      <Dialog open={!!detalle} onOpenChange={(o) => !o && setDetalle(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 -m-6 mb-0 p-6 rounded-t-lg border-b">
            <DialogTitle className="text-base">
              {detalle?.cliente} · {detalle?.fecha_programada}
            </DialogTitle>
            <DialogDescription className="font-light">
              {detalle?.ubicacion?.nombre || (
                <span className="italic">{detalle?.lugar_entrega_texto || "Sin ubicación asignada"}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          {detalle && (
            <div className="pt-6 space-y-5 max-h-[65vh] overflow-y-auto">
              {(detalle.ubicacion?.direccion || detalle.ubicacion?.instrucciones) && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-1">
                  {detalle.ubicacion?.direccion && (
                    <p className="text-sm font-light">
                      <span className="uppercase tracking-wide text-[10px] text-muted-foreground mr-2">Dirección</span>
                      {detalle.ubicacion.direccion}
                    </p>
                  )}
                  {detalle.ubicacion?.instrucciones && (
                    <p className="text-sm font-light whitespace-pre-wrap">
                      <span className="uppercase tracking-wide text-[10px] text-muted-foreground mr-2">Instrucciones</span>
                      {detalle.ubicacion.instrucciones}
                    </p>
                  )}
                  {detalle.ubicacion?.lat != null && detalle.ubicacion?.lng != null && (
                    <a
                      href={mapsUrl(detalle.ubicacion.lat, detalle.ubicacion.lng)}
                      target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <MapPin className="h-3 w-3" /> Ver en Google Maps
                    </a>
                  )}
                </div>
              )}

              {faltaUbicacion && (
                <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 space-y-2">
                  <p className="text-xs text-amber-700">
                    Esta entrega no tiene ubicación asignada
                    {detalle.lugar_entrega_texto ? ` (texto libre: "${detalle.lugar_entrega_texto}")` : ""}.
                    Asígnale una para poder notificar y marcarla como entregada.
                  </p>
                  <div className="flex items-center gap-2">
                    <Select value={ubicSel} onValueChange={(v) => { setUbicSel(v); asignarUbicacion(v); }}>
                      <SelectTrigger className="h-8 text-xs w-64"><SelectValue placeholder="Selecciona una ubicación" /></SelectTrigger>
                      <SelectContent>
                        {ubicClienteList.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setNuevaUbicOpen(true)}>
                      <Plus className="h-3 w-3 mr-1" /> Nueva ubicación
                    </Button>
                  </div>
                </div>
              )}

              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-violet-50 to-blue-50">
                      <TableHead className="uppercase text-[10px] tracking-wide">Código</TableHead>
                      <TableHead className="uppercase text-[10px] tracking-wide">Producto</TableHead>
                      <TableHead className="uppercase text-[10px] tracking-wide text-right">Cantidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalleLineas.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">Sin productos</TableCell></TableRow>
                    )}
                    {detalleLineas.map((l, i) => (
                      <TableRow key={l.id} className={i % 2 ? "bg-muted/30" : ""}>
                        <TableCell className="font-mono text-xs">{l.codigo_producto}</TableCell>
                        <TableCell className="text-sm font-light">{l.nombre_producto || "—"}</TableCell>
                        <TableCell className="text-sm text-right">{Number(l.cantidad)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {detalle.estatus === "programada" ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex">
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) subirEvidencia(detalle, f);
                          e.target.value = "";
                        }}
                      />
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border cursor-pointer hover:bg-muted ${detalle.evidencia_firmada_path ? "text-green-700 border-green-200" : "text-muted-foreground"}`}>
                        <Upload className="h-3 w-3" />
                        {detalle.evidencia_firmada_path ? "Evidencia ✓" : "Subir evidencia firmada"}
                      </span>
                    </label>
                    {detalle.evidencia_firmada_path && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openSigned(detalle.evidencia_firmada_path!)}>
                        <FileText className="h-3 w-3 mr-1" /> Ver evidencia
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Factura de referencia</Label>
                      <Input className="h-8 w-52 text-sm" value={facturaVal} onChange={(e) => setFacturaVal(e.target.value)} placeholder="Ej. A-12345" />
                    </div>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={guardarFactura} disabled={busy}>
                      Guardar factura
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm" className="text-xs h-8"
                      disabled={!detalle.evidencia_firmada_path || !detalle.factura_referencia || faltaUbicacion || busy}
                      onClick={() => { setGrupoSel(""); setNotifOpen(true); }}
                    >
                      <Mail className="h-3 w-3 mr-1" /> Notificar y Marcar Entregada
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="text-xs h-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setCancelar(detalle)}
                    >
                      <Ban className="h-3 w-3 mr-1" /> Cancelar entrega
                    </Button>
                  </div>
                  {faltaUbicacion && (
                    <p className="text-[11px] text-amber-600">Asigna una ubicación para habilitar la notificación.</p>
                  )}
                </div>
              ) : detalle.estatus === "entregada" ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-light">
                  <span>Notificada: {detalle.notificado_at ? new Date(detalle.notificado_at).toLocaleString("es-MX") : "—"}</span>
                  <span>· Factura: {detalle.factura_referencia || "—"}</span>
                  {detalle.evidencia_firmada_path && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => openSigned(detalle.evidencia_firmada_path!)}>
                      <FileText className="h-3 w-3 mr-1" /> Evidencia
                    </Button>
                  )}
                  {detalle.pdf_entrega_path && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => openSigned(detalle.pdf_entrega_path!)}>
                      <FileText className="h-3 w-3 mr-1" /> PDF
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Entrega cancelada.</p>
              )}
            </div>
          )}

          <DialogFooter className="bg-muted/40 -m-6 mt-0 p-4 rounded-b-lg">
            <Button variant="outline" onClick={() => setDetalle(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nueva ubicación rápida desde el detalle */}
      <UbicacionDialog
        open={nuevaUbicOpen}
        onOpenChange={setNuevaUbicOpen}
        initial={null}
        defaultCliente={detalle?.cliente}
        onSaved={async (u) => {
          setUbicClienteList(await fetchUbicaciones(u.cliente));
          onUbicacionesChanged();
          if (detalle && !detalle.ubicacion_id && u.cliente === detalle.cliente) {
            setUbicSel(u.id);
            await asignarUbicacion(u.id);
          }
        }}
      />

      {/* Notificar */}
      <Dialog open={notifOpen} onOpenChange={setNotifOpen}>
        <DialogContent>
          <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 -m-6 mb-0 p-6 rounded-t-lg border-b">
            <DialogTitle className="text-base">Notificar entrega</DialogTitle>
            <DialogDescription className="font-light">
              Se abrirá tu cliente de correo y la entrega completa del día quedará marcada como entregada.
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
            <Button variant="outline" onClick={() => setNotifOpen(false)}>Cancelar</Button>
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
              {cancelar?.cliente} · {cancelar?.fecha_programada}. Esta acción cambia el estatus a cancelada.
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
  const [ubicKey, setUbicKey] = useState(0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Truck className="h-6 w-6" /> Entregas Corporativas
        </h1>
        <p className="text-sm text-muted-foreground font-light">
          Calendarios de clientes corporativos, lugares de entrega y seguimiento de entregas programadas.
        </p>
      </div>

      <Tabs defaultValue="calendarios">
        <TabsList>
          <TabsTrigger value="calendarios">Calendarios</TabsTrigger>
          <TabsTrigger value="ubicaciones">Ubicaciones</TabsTrigger>
          <TabsTrigger value="entregas">Entregas Programadas</TabsTrigger>
        </TabsList>
        <TabsContent value="calendarios" className="mt-4">
          <CalendariosTab onImported={() => setRefreshKey((k) => k + 1)} />
        </TabsContent>
        <TabsContent value="ubicaciones" className="mt-4">
          <UbicacionesTab refreshKey={ubicKey} onChanged={() => setRefreshKey((k) => k + 1)} />
        </TabsContent>
        <TabsContent value="entregas" className="mt-4">
          <EntregasTab refreshKey={refreshKey} onUbicacionesChanged={() => setUbicKey((k) => k + 1)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}