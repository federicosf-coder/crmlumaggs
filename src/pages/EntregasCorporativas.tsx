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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Truck, Upload, Loader2, Download, FileText, Mail, RefreshCw, Ban, MapPin, Plus, Pencil, Eye, Trash2, ChevronsUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { ProductoSelector, fetchProductosCatalogo } from "@/components/entregas/ProductoSelector";
import EntregasCorpIntakeTab from "@/components/entregas/EntregasCorpIntakeTab";
import { EnviarConfirmacionPagoDialog } from "@/components/cobranza/EnviarConfirmacionPagoDialog";
import { buildEntregaEmailFlow, type EntregaEmailFlow } from "@/lib/entregaEmailFlow";
import { useQuery } from "@tanstack/react-query";

export const CLIENTES = ["Hyundai", "Kenworth", "Mecánica Tek", "Otro"];
export const BUCKET = "entregas-corporativas";

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
  numero_pedido: string | null;
  estatus: string;
  ubicacion_id: string | null;
  lugar_entrega_texto: string | null;
  pdf_entrega_path: string | null;
  evidencia_firmada_path: string | null;
  factura_referencia: string | null;
  notificado_at: string | null;
  ubicacion?: Ubicacion | null;
  calendario_id?: string | null;
  calendario?: { id: string; nombre_archivo: string; storage_path: string } | null;
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

function normalizarEmparejamiento(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function palabrasEmparejamiento(s: string) {
  return normalizarEmparejamiento(s)
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

export function emparejarUbicacion(lugarEntrega: string, ubicaciones: Ubicacion[]): Ubicacion | null {
  const target = normalizarEmparejamiento(lugarEntrega);
  if (!target) return null;
  const targetWords = palabrasEmparejamiento(lugarEntrega);

  let best: { ubicacion: Ubicacion; rank: number; score: number } | null = null;

  for (const u of ubicaciones) {
    const nombre = normalizarEmparejamiento(u.nombre);
    const direccion = normalizarEmparejamiento(u.direccion || "");

    // Coincidencia exacta
    if (nombre === target || direccion === target) {
      return u;
    }

    // Contención en cualquier dirección contra nombre o dirección
    const contiene =
      nombre.includes(target) ||
      target.includes(nombre) ||
      (direccion && (direccion.includes(target) || target.includes(direccion)));

    // Coincidencia por palabras clave
    const combinado = `${nombre} ${direccion}`.trim();
    const combinadoWords = palabrasEmparejamiento(combinado);
    const score = targetWords.length
      ? targetWords.filter((w) => combinadoWords.includes(w)).length / targetWords.length
      : 0;

    if (contiene) {
      if (!best || best.rank < 2 || (best.rank === 2 && score > best.score)) {
        best = { ubicacion: u, rank: 2, score };
      }
    } else if (score >= 0.6) {
      if (!best || best.rank < 1 || (best.rank === 1 && score > best.score)) {
        best = { ubicacion: u, rank: 1, score };
      }
    }
  }

  return best?.ubicacion ?? null;
}

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function estatusBadge(e: string) {
  const map: Record<string, string> = {
    programada: "bg-blue-200 text-blue-800 border-blue-300",
    entregada: "bg-emerald-200 text-emerald-800 border-emerald-300",
    cancelada: "bg-slate-300 text-slate-800 border-slate-400",
  };
  return (
    <Badge variant="outline" className={`text-xs font-semibold capitalize ${map[e] || "bg-muted text-foreground"}`}>
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

export async function fetchUbicaciones(cliente?: string) {
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
              <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">Cliente</TableHead>
              <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">Nombre</TableHead>
              <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">Dirección</TableHead>
              <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">Instrucciones</TableHead>
              <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">Activo</TableHead>
              <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">Sin ubicaciones</TableCell></TableRow>
            )}
            {rows.map((u, i) => (
              <TableRow key={u.id} className="odd:bg-muted/30 hover:bg-blue-50/40">
                <TableCell className="text-sm py-2.5">{u.cliente}</TableCell>
                <TableCell className="text-sm font-medium py-2.5">
                  <div className="flex items-center gap-2">
                    {u.nombre}
                    {u.lat != null && u.lng != null && (
                      <a href={mapsUrl(u.lat, u.lng)} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> Ver en Google Maps
                      </a>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm py-2.5">{u.direccion || "—"}</TableCell>
                <TableCell className="text-sm max-w-[280px] truncate py-2.5">{u.instrucciones || "—"}</TableCell>
                <TableCell className="py-2.5">
                  <Badge variant="outline" className={`text-xs font-semibold ${u.activo ? "bg-emerald-200 text-emerald-800 border-emerald-300" : "bg-slate-300 text-slate-800 border-slate-400"}`}>
                    {u.activo ? "Sí" : "No"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right py-2.5">
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
  const [delCal, setDelCal] = useState<{ cal: Calendario; count: number } | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const pedirEliminarCalendario = async (c: Calendario) => {
    const { count } = await (supabase as any)
      .from("entregas_corporativas")
      .select("id", { count: "exact", head: true })
      .eq("calendario_id", c.id);
    setDelCal({ cal: c, count: count ?? 0 });
  };

  const eliminarCalendario = async () => {
    if (!delCal) return;
    setDelBusy(true);
    try {
      const { data: ents } = await (supabase as any)
        .from("entregas_corporativas").select("id").eq("calendario_id", delCal.cal.id);
      const ids = ((ents ?? []) as { id: string }[]).map((e) => e.id);
      if (ids.length) {
        const { error: e1 } = await (supabase as any)
          .from("entregas_corporativas_lineas").delete().in("entrega_id", ids);
        if (e1) throw e1;
        const { error: e2 } = await (supabase as any)
          .from("entregas_corporativas").delete().in("id", ids);
        if (e2) throw e2;
      }
      const { error: e3 } = await (supabase as any)
        .from("entregas_corporativas_calendarios").delete().eq("id", delCal.cal.id);
      if (e3) throw e3;
      toast.success("Calendario eliminado");
      setDelCal(null);
      await loadCalendarios();
      onImported();
    } catch (err: any) {
      toast.error(err.message ?? "No se pudo eliminar");
    } finally { setDelBusy(false); }
  };

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
      const numeroPedido: string | null = extracted?.numero_pedido ?? null;
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

      // --- Validar productos contra el catálogo ---
      try {
        const catalogo = await fetchProductosCatalogo();
        const mapCat = new Map(catalogo.map((p) => [p.codigo.trim().toUpperCase(), p.nombre]));
        entregas.forEach((e) => {
          const hit = mapCat.get(String(e.codigo).trim().toUpperCase());
          if (hit) e.nombre_producto = hit;
        });
      } catch { /* si falla el catálogo, se conserva el nombre extraído por la IA */ }

      // --- Resolver ubicación ---
      const ubicaciones = await fetchUbicaciones(cliente);
      let ubicacion: Ubicacion | null = null;
      if (cliente === "Kenworth") {
        ubicacion = ubicaciones[0] ?? null;
      } else if (lugarEntrega) {
        ubicacion = emparejarUbicacion(lugarEntrega, ubicaciones);
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
        let existente: any = null;
        if (numeroPedido) {
          // Con número de pedido: coincidencia exacta incluyendo ubicación/lugar;
          // si no existe, SIEMPRE se crea una entrega independiente.
          let q = (supabase as any)
            .from("entregas_corporativas")
            .select("id")
            .eq("cliente", cliente)
            .eq("fecha_programada", fecha)
            .eq("numero_pedido", numeroPedido);
          if (ubicacion) {
            q = q.eq("ubicacion_id", ubicacion.id);
          } else if (lugarTexto) {
            q = q.eq("lugar_entrega_texto", lugarTexto);
          } else {
            q = q.is("ubicacion_id", null);
          }
          const { data } = await q.maybeSingle();
          existente = data;
        } else {
          // Sin número de pedido: comportamiento previo (tabla única tipo Kenworth).
          let q = (supabase as any)
            .from("entregas_corporativas")
            .select("id")
            .eq("cliente", cliente)
            .eq("fecha_programada", fecha);
          q = ubicacion ? q.eq("ubicacion_id", ubicacion.id) : q.is("ubicacion_id", null);
          const { data } = await q.maybeSingle();
          existente = data;
        }

        let entregaId: string;
        if (existente?.id) {
          entregaId = existente.id;
          const upd: any = { calendario_id: cal.id, lugar_entrega_texto: lugarTexto };
          if (numeroPedido) upd.numero_pedido = numeroPedido;
          await (supabase as any)
            .from("entregas_corporativas")
            .update(upd)
            .eq("id", entregaId);
        } else {
          const { data: nueva, error: insErr } = await (supabase as any)
            .from("entregas_corporativas")
            .insert({
              cliente,
              ubicacion_id: ubicacion?.id ?? null,
              fecha_programada: fecha,
              numero_pedido: numeroPedido,
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
            <Upload className="h-4 w-4" /> Subir Pedidos de Clientes
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
                    <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">Archivo</TableHead>
                    <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {progreso.map((p, i) => (
                    <TableRow key={`${p.nombre}-${i}`} className="odd:bg-muted/30">
                      <TableCell className="text-sm py-2.5">{p.nombre}</TableCell>
                      <TableCell className="text-sm py-2.5">
                        {p.estado === "procesando" && <span className="text-blue-700 inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Procesando…</span>}
                        {p.estado === "listo" && <span className="text-green-700 font-medium">Listo ({p.detalle})</span>}
                        {p.estado === "error" && <span className="text-destructive font-medium">Error: {p.detalle}</span>}
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
                        <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">Código</TableHead>
                        <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">Producto</TableHead>
                        <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide text-right">Cantidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.productos.map((p, i) => (
                        <TableRow key={`${p.codigo}-${i}`} className="odd:bg-muted/30">
                          <TableCell className="font-mono text-sm font-medium py-2.5">{p.codigo}</TableCell>
                          <TableCell className="text-sm py-2.5">{p.nombre_producto || "—"}</TableCell>
                          <TableCell className="text-sm font-medium text-right py-2.5">{p.cantidad}</TableCell>
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
          <CardTitle className="text-sm uppercase tracking-wide font-medium">Pedidos Clientes Subidos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">Cliente</TableHead>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">Archivo</TableHead>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">Fecha</TableHead>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">Subido por</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {calendarios.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Sin calendarios</TableCell></TableRow>
              )}
              {calendarios.map((c, i) => (
                <TableRow key={c.id} className="odd:bg-muted/30">
                  <TableCell className="text-sm py-2.5">{c.cliente}</TableCell>
                  <TableCell className="text-sm py-2.5">{c.nombre_archivo}</TableCell>
                  <TableCell className="text-sm py-2.5">{new Date(c.created_at).toLocaleDateString("es-MX")}</TableCell>
                  <TableCell className="text-sm text-muted-foreground py-2.5">{c.subido_por ? perfiles[c.subido_por] || "—" : "—"}</TableCell>
                  <TableCell className="text-right py-2.5">
                    <Button variant="ghost" size="sm" onClick={() => openSigned(c.storage_path)}>
                      <FileText className="h-3.5 w-3.5 mr-1" /> Ver archivo
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => pedirEliminarCalendario(c)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!delCal} onOpenChange={(o) => !o && setDelCal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este calendario?</AlertDialogTitle>
            <AlertDialogDescription className="font-light">
              {delCal && delCal.count > 0
                ? `También se eliminarán las ${delCal.count} entregas que se generaron a partir de él, junto con sus líneas de producto. Esta acción no se puede deshacer.`
                : "No hay entregas asociadas a este calendario. Esta acción no se puede deshacer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); eliminarCalendario(); }}
              disabled={delBusy}
            >
              {delBusy ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFlow, setPreviewFlow] = useState<EntregaEmailFlow | null>(null);
  const [previewEntregaId, setPreviewEntregaId] = useState<string | null>(null);
  const [cancelar, setCancelar] = useState<Entrega | null>(null);
  const [eliminar, setEliminar] = useState<Entrega | null>(null);
  const [busy, setBusy] = useState(false);
  const [ubicClienteList, setUbicClienteList] = useState<Ubicacion[]>([]);
  const [ubicSel, setUbicSel] = useState("");
  const [nuevaUbicOpen, setNuevaUbicOpen] = useState(false);

  // Modo edición del detalle
  const [editMode, setEditMode] = useState(false);
  const [editPedido, setEditPedido] = useState("");
  const [editFecha, setEditFecha] = useState("");
  const [editCant, setEditCant] = useState<Record<string, string>>({});
  const [editCodigo, setEditCodigo] = useState<Record<string, { codigo: string; nombre: string }>>({});
  const [lineasQuitar, setLineasQuitar] = useState<string[]>([]);
  const [lineasNuevas, setLineasNuevas] = useState<{ codigo: string; nombre: string; cantidad: string }[]>([]);

  // Evidencias múltiples
  const [evidencias, setEvidencias] = useState<{ id: string; storage_path: string; nombre_archivo: string; created_at: string }[]>([]);

  // Captura manual
  const [manualOpen, setManualOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = (supabase as any)
      .from("entregas_corporativas")
      .select(
        "id, cliente, fecha_programada, numero_pedido, estatus, ubicacion_id, lugar_entrega_texto, pdf_entrega_path, evidencia_firmada_path, factura_referencia, notificado_at, calendario_id, ubicacion:entregas_corporativas_ubicaciones(id, cliente, nombre, direccion, lat, lng, instrucciones, activo), calendario:entregas_corporativas_calendarios(id, nombre_archivo, storage_path)",
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

  const cargarEvidencias = async (entregaId: string) => {
    const { data } = await (supabase as any)
      .from("entregas_corporativas_evidencias")
      .select("id, storage_path, nombre_archivo, created_at")
      .eq("entrega_id", entregaId)
      .order("created_at", { ascending: true });
    setEvidencias((data ?? []) as any);
  };

  const abrirDetalle = async (r: Entrega) => {
    setDetalle(r);
    setFacturaVal(r.factura_referencia || "");
    setUbicSel("");
    setEditMode(false);
    setLineasQuitar([]);
    setLineasNuevas([]);
    setEditPedido(r.numero_pedido || "");
    setEditFecha(r.fecha_programada || "");
    setEvidencias([]);
    cargarEvidencias(r.id);
    setUbicClienteList(await fetchUbicaciones(r.cliente));
  };

  const iniciarEdicion = () => {
    if (!detalle) return;
    setEditPedido(detalle.numero_pedido || "");
    setEditFecha(detalle.fecha_programada || "");
    setEditCant(Object.fromEntries((lineas[detalle.id] ?? []).map((l) => [l.id, String(Number(l.cantidad))])));
    setEditCodigo(Object.fromEntries((lineas[detalle.id] ?? []).map((l) => [l.id, { codigo: l.codigo_producto || "", nombre: l.nombre_producto || "" }])));
    setLineasQuitar([]);
    setLineasNuevas([]);
    setEditMode(true);
  };

  const cancelarEdicion = () => {
    setEditMode(false);
    setEditCant({});
    setEditCodigo({});
    setLineasQuitar([]);
    setLineasNuevas([]);
  };

  const guardarEdicion = async () => {
    if (!detalle) return;
    setBusy(true);
    try {
      const { error: eP } = await (supabase as any)
        .from("entregas_corporativas")
        .update({
          numero_pedido: editPedido.trim() || null,
          ...(editFecha ? { fecha_programada: editFecha } : {}),
        })
        .eq("id", detalle.id);
      if (eP) throw eP;

      for (const l of lineas[detalle.id] ?? []) {
        if (lineasQuitar.includes(l.id)) continue;
        const nueva = Number(editCant[l.id]);
        const patch: Record<string, any> = {};
        if (!Number.isNaN(nueva) && nueva !== Number(l.cantidad)) patch.cantidad = nueva;
        const nuevoProd = editCodigo[l.id];
        if (nuevoProd && nuevoProd.codigo && nuevoProd.codigo !== l.codigo_producto) {
          patch.codigo_producto = nuevoProd.codigo;
          patch.nombre_producto = nuevoProd.nombre || null;
        }
        if (Object.keys(patch).length) {
          const { error } = await (supabase as any)
            .from("entregas_corporativas_lineas").update(patch).eq("id", l.id);
          if (error) throw error;
        }
      }

      if (lineasQuitar.length) {
        const { error } = await (supabase as any)
          .from("entregas_corporativas_lineas").delete().in("id", lineasQuitar);
        if (error) throw error;
      }

      const nuevas = lineasNuevas
        .filter((n) => n.codigo.trim() || n.nombre.trim())
        .map((n) => ({
          entrega_id: detalle.id,
          codigo_producto: n.codigo.trim(),
          nombre_producto: n.nombre.trim() || null,
          cantidad: Number(n.cantidad) || 0,
        }));
      if (nuevas.length) {
        const { error } = await (supabase as any).from("entregas_corporativas_lineas").insert(nuevas);
        if (error) throw error;
      }

      toast.success("Cambios guardados");
      cancelarEdicion();
      await load();
    } catch (e: any) {
      toast.error(e?.message || "No se pudieron guardar los cambios");
    } finally { setBusy(false); }
  };

  const subirEvidencias = async (row: Entrega, files: File[]) => {
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      for (const file of files) {
        const path = `${row.cliente}/evidencias/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
        if (upErr) throw upErr;
        const { error } = await (supabase as any).from("entregas_corporativas_evidencias").insert({
          entrega_id: row.id,
          storage_path: path,
          nombre_archivo: file.name,
          subido_por: userData?.user?.id ?? null,
        });
        if (error) throw error;
      }
      toast.success(files.length > 1 ? "Evidencias subidas" : "Evidencia subida");
      await cargarEvidencias(row.id);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Error al subir evidencia");
    } finally { setBusy(false); }
  };

  const quitarEvidencia = async (id: string) => {
    if (!detalle) return;
    const { error } = await (supabase as any).from("entregas_corporativas_evidencias").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Evidencia eliminada");
    cargarEvidencias(detalle.id);
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

      const { data: userData } = await supabase.auth.getUser();
      const flow = await buildEntregaEmailFlow(detalle.id, userData?.user?.email || undefined);
      const merged = [...correos, ...(flow.defaultEmails || [])];
      const defaultEmails = Array.from(
        new Map(merged.map((e: string) => [e.toLowerCase(), e])).values()
      );

      setPreviewFlow({ ...flow, defaultEmails });
      setPreviewEntregaId(detalle.id);
      setNotifOpen(false);
      setPreviewOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "Error al notificar");
    } finally { setBusy(false); }
  };

  const onPreviewSent = async () => {
    if (!previewEntregaId) return;
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("entregas_corporativas").update({
        estatus: "entregada",
        notificado_at: new Date().toISOString(),
        notificado_por: userData?.user?.id ?? null,
      }).eq("id", previewEntregaId);
      if (error) throw error;
      toast.success("Entrega marcada como entregada");
      setGrupoSel("");
      setDetalle(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Error al marcar como entregada");
    }
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

  const doEliminar = async () => {
    if (!eliminar) return;
    setBusy(true);
    try {
      const { error: e1 } = await (supabase as any)
        .from("entregas_corporativas_lineas").delete().eq("entrega_id", eliminar.id);
      if (e1) throw e1;
      const { error: e2 } = await (supabase as any)
        .from("entregas_corporativas").delete().eq("id", eliminar.id);
      if (e2) throw e2;
      toast.success("Entrega eliminada");
      setEliminar(null);
      setDetalle(null);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "No se pudo eliminar");
    } finally { setBusy(false); }
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
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm uppercase tracking-wide font-medium">Entregas ({total})</CardTitle>
            <Button size="sm" className="h-8 text-xs" onClick={() => setManualOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Nueva Entrega Manual
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">Cliente</TableHead>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">Fecha</TableHead>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">N° Pedido</TableHead>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">Lugar de entrega</TableHead>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide text-center">N° de productos</TableHead>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">Estatus</TableHead>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">Sin entregas</TableCell></TableRow>
              )}
              {rows.map((r, i) => (
                <TableRow
                  key={r.id}
                  className="odd:bg-muted/30 hover:bg-blue-50/40 cursor-pointer"
                  onClick={() => abrirDetalle(r)}
                >
                  <TableCell className="text-sm py-2.5">{r.cliente}</TableCell>
                  <TableCell className="text-sm py-2.5">{r.fecha_programada}</TableCell>
                  <TableCell className="text-sm font-medium py-2.5">{r.numero_pedido || "—"}</TableCell>
                  <TableCell className="text-sm py-2.5">
                    <div className="flex items-center gap-2">
                      {r.ubicacion?.nombre ? (
                        <span className="font-medium">{r.ubicacion.nombre}</span>
                      ) : (
                        <span className="italic text-sm text-muted-foreground">
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
                  <TableCell className="text-center py-2.5">
                    <Badge variant="outline" className="text-xs font-semibold">{(lineas[r.id] ?? []).length}</Badge>
                  </TableCell>
                  <TableCell className="py-2.5">{estatusBadge(r.estatus)}</TableCell>
                  <TableCell className="text-right py-2.5">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); abrirDetalle(r); }}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> Ver detalle
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setEliminar(r); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
              {detalle?.numero_pedido && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">· Pedido {detalle.numero_pedido}</span>
              )}
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

              {detalle.calendario?.storage_path && (
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => openSigned(detalle.calendario!.storage_path)}
                  >
                    <FileText className="h-3.5 w-3.5 mr-1" /> Ver / Descargar PDF
                  </Button>
                  <span className="ml-2 text-[11px] text-muted-foreground font-light">
                    {detalle.calendario.nombre_archivo}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">N° Pedido</Label>
                    {editMode ? (
                      <Input className="h-8 w-52 text-sm" value={editPedido} onChange={(e) => setEditPedido(e.target.value)} placeholder="Sin número" />
                    ) : (
                      <p className="text-sm font-light">{detalle.numero_pedido || "—"}</p>
                    )}
                  </div>
                  {editMode && (
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Fecha de entrega solicitada</Label>
                      <Input type="date" className="h-8 w-48 text-sm" value={editFecha} onChange={(e) => setEditFecha(e.target.value)} />
                    </div>
                  )}
                </div>
                {editMode ? (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={cancelarEdicion} disabled={busy}>Cancelar</Button>
                    <Button size="sm" className="h-8 text-xs" onClick={guardarEdicion} disabled={busy}>
                      {busy && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Guardar cambios
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={iniciarEdicion}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                )}
              </div>

              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-violet-50 to-blue-50">
                      <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">Código</TableHead>
                      <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">Producto</TableHead>
                      <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide text-right">Cantidad</TableHead>
                      {editMode && <TableHead className="w-10" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalleLineas.length === 0 && !editMode && (
                      <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">Sin productos</TableCell></TableRow>
                    )}
                    {detalleLineas.filter((l) => !lineasQuitar.includes(l.id)).map((l, i) => (
                      <TableRow key={l.id} className="odd:bg-muted/30">
                        <TableCell className="font-mono text-sm font-medium py-2.5">
                          {editMode ? (
                            <ProductoSelector
                              codigo={editCodigo[l.id]?.codigo ?? l.codigo_producto}
                              onSelect={(p) => setEditCodigo((prev) => ({ ...prev, [l.id]: p }))}
                            />
                          ) : l.codigo_producto}
                        </TableCell>
                        <TableCell className="text-sm py-2.5">
                          {editMode ? (editCodigo[l.id]?.nombre ?? l.nombre_producto ?? "—") : (l.nombre_producto || "—")}
                        </TableCell>
                        <TableCell className="text-sm font-medium text-right py-2.5">
                          {editMode ? (
                            <Input
                              type="number"
                              className="h-8 w-24 text-sm text-right ml-auto"
                              value={editCant[l.id] ?? String(Number(l.cantidad))}
                              onChange={(e) => setEditCant((p) => ({ ...p, [l.id]: e.target.value }))}
                            />
                          ) : Number(l.cantidad)}
                        </TableCell>
                        {editMode && (
                          <TableCell className="py-2.5">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive"
                              onClick={() => setLineasQuitar((p) => [...p, l.id])}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {editMode && lineasNuevas.map((n, idx) => (
                      <TableRow key={`n-${idx}`} className="odd:bg-muted/30">
                        <TableCell className="py-2.5">
                          <ProductoSelector
                            codigo={n.codigo}
                            onSelect={(p) => setLineasNuevas((prev) => prev.map((x, i) => i === idx ? { ...x, codigo: p.codigo, nombre: p.nombre } : x))}
                          />
                        </TableCell>
                        <TableCell className="py-2.5">
                          <span className="text-sm">{n.nombre || <span className="text-muted-foreground">Selecciona un producto</span>}</span>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Input type="number" className="h-8 w-24 text-sm text-right ml-auto font-medium" value={n.cantidad}
                            onChange={(e) => setLineasNuevas((p) => p.map((x, i) => i === idx ? { ...x, cantidad: e.target.value } : x))} />
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive"
                            onClick={() => setLineasNuevas((p) => p.filter((_, i) => i !== idx))}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {editMode && (
                  <div className="p-2 border-t bg-muted/30">
                    <Button variant="outline" size="sm" className="h-7 text-xs"
                      onClick={() => setLineasNuevas((p) => [...p, { codigo: "", nombre: "", cantidad: "1" }])}>
                      <Plus className="h-3 w-3 mr-1" /> Agregar producto
                    </Button>
                  </div>
                )}
              </div>

              {detalle.estatus === "programada" ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Evidencias firmadas</Label>
                    {evidencias.length > 0 && (
                      <div className="rounded-md border divide-y">
                        {evidencias.map((ev) => (
                          <div key={ev.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                            <span className="text-xs font-light truncate">{ev.nombre_archivo}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openSigned(ev.storage_path)}>
                                <FileText className="h-3 w-3 mr-1" /> Ver
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => quitarEvidencia(ev.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <label className="inline-flex">
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => {
                          const fs = Array.from(e.target.files ?? []);
                          if (fs.length) subirEvidencias(detalle, fs);
                          e.target.value = "";
                        }}
                      />
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border cursor-pointer hover:bg-muted ${evidencias.length ? "text-green-700 border-green-200" : "text-muted-foreground"}`}>
                        <Upload className="h-3 w-3" />
                        {evidencias.length ? `Subir más evidencias (${evidencias.length})` : "Subir evidencias firmadas"}
                      </span>
                    </label>
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
                      disabled={evidencias.length === 0 || !detalle.factura_referencia || faltaUbicacion || busy}
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
                  {evidencias.map((ev) => (
                    <Button key={ev.id} variant="ghost" size="sm" className="h-6 text-xs" onClick={() => openSigned(ev.storage_path)}>
                      <FileText className="h-3 w-3 mr-1" /> {ev.nombre_archivo}
                    </Button>
                  ))}
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
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive mr-auto"
              onClick={() => detalle && setEliminar(detalle)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar entrega
            </Button>
            <Button variant="outline" onClick={() => setDetalle(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nueva entrega manual */}
      <NuevaEntregaManualDialog open={manualOpen} onOpenChange={setManualOpen} onSaved={load} />

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

      <EnviarConfirmacionPagoDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        pagoId={previewEntregaId || ""}
        empresa={detalle?.cliente || ""}
        fechaPago={detalle?.fecha_programada || ""}
        montoTotal=""
        moneda=""
        observaciones={undefined}
        documentos={[]}
        comprobantes={previewFlow?.comprobantes || []}
        registradoPor={undefined}
        defaultEmails={previewFlow?.defaultEmails || []}
        blockedEmails={[]}
        previouslySentEmails={previewFlow?.previouslySentEmails || []}
        templateName={previewFlow?.templateName}
        subjectOverride={previewFlow?.subjectOverride}
        htmlOverride={previewFlow?.htmlOverride}
        ccEmails={previewFlow?.cc}
        bccEmails={previewFlow?.bcc}
        replyTo={previewFlow?.replyTo}
        title={previewFlow?.title}
        description={previewFlow?.description}
        onSent={onPreviewSent}
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

      <AlertDialog open={!!eliminar} onOpenChange={(o) => !o && setEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta entrega?</AlertDialogTitle>
            <AlertDialogDescription className="font-light">
              Se borrarán también sus líneas de producto. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); doEliminar(); }} disabled={busy}>
              {busy ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
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

  const { data: intakePendientes = 0 } = useQuery({
    queryKey: ["entregas-corp-intake-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("entregas_corporativas_intake")
        .select("id", { count: "exact", head: true })
        .eq("estatus", "pendiente");
      if (error) throw error;
      return count || 0;
    },
  });

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
          <TabsTrigger value="calendarios">Subir Pedidos Clientes</TabsTrigger>
          <TabsTrigger value="correos-chevron" className="gap-2">
            Correos de Chevron
            {intakePendientes > 0 && <Badge variant="secondary">{intakePendientes}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="ubicaciones">Ubicaciones</TabsTrigger>
          <TabsTrigger value="entregas">Entregas Programadas</TabsTrigger>
          <TabsTrigger value="desglose">Desglose de Productos</TabsTrigger>
          <TabsTrigger value="resumen">Resumen por Producto</TabsTrigger>
          <TabsTrigger value="reportes">Reportes</TabsTrigger>
        </TabsList>
        <TabsContent value="calendarios" className="mt-4">
          <CalendariosTab onImported={() => setRefreshKey((k) => k + 1)} />
        </TabsContent>
        <TabsContent value="correos-chevron" className="mt-4">
          <EntregasCorpIntakeTab />
        </TabsContent>
        <TabsContent value="ubicaciones" className="mt-4">
          <UbicacionesTab refreshKey={ubicKey} onChanged={() => setRefreshKey((k) => k + 1)} />
        </TabsContent>
        <TabsContent value="entregas" className="mt-4">
          <EntregasTab refreshKey={refreshKey} onUbicacionesChanged={() => setUbicKey((k) => k + 1)} />
        </TabsContent>
        <TabsContent value="desglose" className="mt-4">
          <DesgloseProductosTab refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="resumen" className="mt-4">
          <ResumenPorProductoTab refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="reportes" className="mt-4">
          <ReportesTab refreshKey={refreshKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* --------------------------- Desglose de Productos --------------------------- */

type DesgloseRow = {
  key: string;
  codigo: string;
  nombre: string;
  cliente: string;
  ubicacion: string;
  fecha: string;
  numero_pedido: string | null;
  estatus: string;
  cantidad: number;
  stock_actual: number;
  por_llegar: number;
  stock_proyectado: number;
  tendremos: boolean;
  deficit: number;
};

type PedidoTransito = {
  codigo_producto: string;
  cantidad: number;
  fecha_entrega_estimada: string | null;
  numero_po: string;
};

function DesgloseProductosTab({ refreshKey }: { refreshKey: number }) {
  const [loading, setLoading] = useState(false);
  const [lineas, setLineas] = useState<any[]>([]);
  const [stock, setStock] = useState<Record<string, number>>({});
  const [transito, setTransito] = useState<PedidoTransito[]>([]);
  const [fCliente, setFCliente] = useState("todos");
  const [fEstatus, setFEstatus] = useState("programada");
  const [fStock, setFStock] = useState("todos");
  const [busq, setBusq] = useState("");
  const [sortKey, setSortKey] = useState<string>("fecha");
  const [sortAsc, setSortAsc] = useState(true);
  const [detallePorLlegar, setDetallePorLlegar] = useState<DesgloseRow | null>(null);
  const [creadas, setCreadas] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: lin }, { data: niv }, { data: pl }] = await Promise.all([
      (supabase as any)
        .from("entregas_corporativas_lineas")
        .select(
          "id, codigo_producto, nombre_producto, cantidad, entrega_id, entrega:entregas_corporativas(id, cliente, estatus, fecha_programada, numero_pedido, ubicacion_id, lugar_entrega_texto, ubicacion:entregas_corporativas_ubicaciones(nombre))",
        ),
      (supabase as any).from("inv_niveles_inventario").select("codigo_producto, stock_total"),
      (supabase as any)
        .from("inv_pedido_lineas")
        .select("codigo_producto, cantidad_confirmada, cantidad_solicitada, cantidad_recibida, pedido:inv_pedidos!inner(id, numero_po_interno, numero_orden_proveedor, fecha_entrega_estimada, estatus)"),
    ]);

    setLineas((lin ?? []).filter((l: any) => l.entrega));

    const smap: Record<string, number> = {};
    ((niv ?? []) as any[]).forEach((n) => {
      smap[n.codigo_producto] = (smap[n.codigo_producto] ?? 0) + Number(n.stock_total ?? 0);
    });
    setStock(smap);

    const tr: PedidoTransito[] = ((pl ?? []) as any[])
      .filter((l) => l.pedido && !["cerrado", "cancelado", "recibido"].includes(String(l.pedido.estatus)))
      .map((l) => ({
        codigo_producto: l.codigo_producto,
        cantidad: Math.max(0, Number(l.cantidad_confirmada ?? l.cantidad_solicitada ?? 0) - Number(l.cantidad_recibida ?? 0)),
        fecha_entrega_estimada: l.pedido.fecha_entrega_estimada ?? null,
        numero_po: l.pedido.numero_po_interno || l.pedido.numero_orden_proveedor || "—",
      }))
      .filter((t) => t.cantidad > 0);
    setTransito(tr);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [refreshKey]);

  const rows: DesgloseRow[] = useMemo(() => {
    // Demanda acumulada considera solo entregas 'programada'
    const programadas = lineas
      .filter((l) => l.entrega?.estatus === "programada")
      .map((l) => ({ codigo: l.codigo_producto, fecha: l.entrega.fecha_programada, cantidad: Number(l.cantidad ?? 0) }));

    const base = lineas.map((l) => {
      const e = l.entrega;
      const codigo = l.codigo_producto ?? "";
      const fecha = e.fecha_programada as string;
      const stock_actual = Number(stock[codigo] ?? 0);
      const por_llegar = transito
        .filter((t) => t.codigo_producto === codigo)
        .reduce((s, t) => s + t.cantidad, 0);
      const demanda = programadas
        .filter((p) => p.codigo === codigo && p.fecha <= fecha)
        .reduce((s, p) => s + p.cantidad, 0);
      const demanda_antes = programadas
        .filter((p) => p.codigo === codigo && p.fecha < fecha)
        .reduce((s, p) => s + p.cantidad, 0);
      const disponible = stock_actual + por_llegar - demanda;
      const por_llegar_a_tiempo = transito
        .filter((t) => t.codigo_producto === codigo && t.fecha_entrega_estimada && t.fecha_entrega_estimada <= fecha)
        .reduce((s, t) => s + t.cantidad, 0);
      const stock_proyectado = stock_actual + por_llegar_a_tiempo - demanda_antes;
      return {
        key: l.id,
        codigo,
        nombre: l.nombre_producto ?? "",
        cliente: e.cliente,
        ubicacion: e.ubicacion?.nombre || e.lugar_entrega_texto || "—",
        fecha,
        numero_pedido: e.numero_pedido ?? null,
        estatus: e.estatus,
        cantidad: Number(l.cantidad ?? 0),
        stock_actual,
        por_llegar,
        stock_proyectado,
        tendremos: disponible >= 0,
        deficit: disponible < 0 ? Math.abs(disponible) : 0,
      } as DesgloseRow;
    });

    base.sort((a, b) => (a.codigo === b.codigo ? a.fecha.localeCompare(b.fecha) : a.codigo.localeCompare(b.codigo)));

    const q = busq.trim().toLowerCase();
    const filtered = base.filter((r) => {
      if (fCliente !== "todos" && r.cliente !== fCliente) return false;
      if (fEstatus !== "todas" && r.estatus !== fEstatus) return false;
      if (fStock === "si" && !r.tendremos) return false;
      if (fStock === "no" && r.tendremos) return false;
      if (q && !(`${r.codigo} ${r.nombre}`.toLowerCase().includes(q))) return false;
      return true;
    });

    const dir = sortAsc ? 1 : -1;
    const val = (r: DesgloseRow) => {
      switch (sortKey) {
        case "codigo": return r.codigo;
        case "nombre": return r.nombre;
        case "cliente": return r.cliente;
        case "ubicacion": return r.ubicacion;
        case "cantidad": return r.cantidad;
        case "stock": return r.stock_actual;
        case "porllegar": return r.por_llegar;
        case "deficit": return r.deficit;
        default: return r.fecha;
      }
    };
    return [...filtered].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [lineas, stock, transito, fCliente, fEstatus, fStock, busq, sortKey, sortAsc]);

  const toggleSort = (k: string) => {
    if (sortKey === k) setSortAsc((v) => !v);
    else { setSortKey(k); setSortAsc(true); }
  };

  const crearSolicitud = async (r: DesgloseRow) => {
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("inv_solicitudes_extraordinarias").insert({
      codigo_producto: r.codigo,
      cantidad: r.deficit,
      tipo: "unica",
      motivo: `Déficit detectado para entrega corporativa ${r.cliente} — pedido ${r.numero_pedido || r.fecha}`,
      estatus: "pendiente",
      solicitado_por: auth.user?.id,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setCreadas((c) => [...c, r.key]);
    toast.success("Solicitud extraordinaria creada");
  };

  const detalleTransito = detallePorLlegar
    ? transito.filter((t) => t.codigo_producto === detallePorLlegar.codigo)
    : [];

  const Th = ({ k, children, className }: { k: string; children: React.ReactNode; className?: string }) => (
    <TableHead className={`cursor-pointer select-none uppercase text-xs text-slate-700 font-semibold tracking-wide ${className ?? ""}`} onClick={() => toggleSort(k)}>
      {children}{sortKey === k ? (sortAsc ? " ↑" : " ↓") : ""}
    </TableHead>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Desglose de Productos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="w-48">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</Label>
            <Select value={fCliente} onValueChange={setFCliente}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {CLIENTES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
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
          <div className="w-48">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">¿Tendremos Stock?</Label>
            <Select value={fStock} onValueChange={setFStock}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="si">Sí</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-64">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Buscar</Label>
            <Input value={busq} onChange={(e) => setBusq(e.target.value)} placeholder="Código o producto" />
          </div>
          <div className="flex items-end">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <Th k="codigo">Código</Th>
                <Th k="nombre">Producto</Th>
                <Th k="cliente">Cliente</Th>
                <Th k="ubicacion">Ubicación</Th>
                <Th k="fecha">Fecha Programada</Th>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">N° Pedido</TableHead>
                <Th k="cantidad" className="text-right">Cantidad</Th>
                <Th k="stock" className="text-right">Stock en Almacén</Th>
                <Th k="porllegar" className="text-right">Por Llegar</Th>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide text-right">Stock Proyectado</TableHead>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">¿Tendremos Stock?</TableHead>
                <Th k="deficit" className="text-right">Déficit</Th>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={13} className="text-center text-sm text-muted-foreground py-8">
                    {loading ? "Cargando…" : "Sin productos que mostrar"}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r, i) => (
                <TableRow key={r.key} className="odd:bg-muted/30">
                  <TableCell className="font-mono text-sm font-medium py-2.5">{r.codigo}</TableCell>
                  <TableCell className="text-sm py-2.5">{r.nombre}</TableCell>
                  <TableCell className="text-sm py-2.5">{r.cliente}</TableCell>
                  <TableCell className="text-sm py-2.5">{r.ubicacion}</TableCell>
                  <TableCell className="text-sm py-2.5">{r.fecha}</TableCell>
                  <TableCell className="text-sm py-2.5">{r.numero_pedido || "—"}</TableCell>
                  <TableCell className="text-right text-sm font-medium py-2.5">{r.cantidad}</TableCell>
                  <TableCell className="text-right text-sm font-medium py-2.5">{r.stock_actual}</TableCell>
                  <TableCell className="text-right text-sm py-2.5">
                    {r.por_llegar > 0 ? (
                      <button className="text-sm font-medium text-blue-700 underline underline-offset-2" onClick={() => setDetallePorLlegar(r)}>
                        {r.por_llegar}
                      </button>
                    ) : 0}
                  </TableCell>
                  <TableCell className={`text-right text-sm font-semibold py-2.5 ${r.stock_proyectado < 0 ? "text-red-700" : "text-emerald-700"}`}>
                    {r.stock_proyectado}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <Badge className={`text-xs font-semibold ${r.tendremos ? "bg-emerald-200 text-emerald-800 hover:bg-emerald-200" : "bg-red-200 text-red-800 hover:bg-red-200"}`}>
                      {r.tendremos ? "Sí" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold text-red-700 py-2.5">{r.tendremos ? "" : r.deficit}</TableCell>
                  <TableCell className="py-2.5">
                    {!r.tendremos && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || creadas.includes(r.key)}
                        onClick={() => crearSolicitud(r)}
                      >
                        {creadas.includes(r.key) ? "Solicitud creada" : "Crear Solicitud Extraordinaria"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={!!detallePorLlegar} onOpenChange={(o) => !o && setDetallePorLlegar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pedidos en camino — {detallePorLlegar?.codigo}</DialogTitle>
            <DialogDescription>
              Todos los pedidos abiertos (no cerrados ni cancelados) de este código.
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">N° PO</TableHead>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide text-right">Cantidad</TableHead>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">Fecha estimada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detalleTransito.map((t, i) => (
                <TableRow key={i} className="odd:bg-muted/30">
                  <TableCell className="text-sm font-medium py-2.5">{t.numero_po}</TableCell>
                  <TableCell className="text-right text-sm font-medium py-2.5">{t.cantidad}</TableCell>
                  <TableCell className="text-sm py-2.5">{t.fecha_entrega_estimada || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
/* --------------------------- Nueva entrega manual --------------------------- */

type ResumenRow = {
  codigo: string;
  nombre: string;
  demanda: number;
  stock_actual: number;
  por_llegar: number;
  disponible: number;
  alcanza: boolean;
  faltante: number;
};

function ResumenPorProductoTab({ refreshKey }: { refreshKey: number }) {
  const [loading, setLoading] = useState(false);
  const [lineas, setLineas] = useState<any[]>([]);
  const [stock, setStock] = useState<Record<string, number>>({});
  const [transito, setTransito] = useState<Record<string, number>>({});
  const [transitoDetalle, setTransitoDetalle] = useState<Record<string, PedidoTransito[]>>({});
  const [fAlcanza, setFAlcanza] = useState("todos");
  const [busq, setBusq] = useState("");
  const [detallePorLlegar, setDetallePorLlegar] = useState<ResumenRow | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: lin }, { data: niv }, { data: pl }] = await Promise.all([
      (supabase as any)
        .from("entregas_corporativas_lineas")
        .select("id, codigo_producto, nombre_producto, cantidad, entrega:entregas_corporativas(estatus)"),
      (supabase as any).from("inv_niveles_inventario").select("codigo_producto, stock_total"),
      (supabase as any)
        .from("inv_pedido_lineas")
        .select("codigo_producto, cantidad_confirmada, cantidad_solicitada, cantidad_recibida, pedido:inv_pedidos!inner(numero_po_interno, numero_orden_proveedor, fecha_entrega_estimada, estatus)"),
    ]);

    setLineas((lin ?? []).filter((l: any) => l.entrega?.estatus === "programada"));

    const smap: Record<string, number> = {};
    ((niv ?? []) as any[]).forEach((n) => {
      smap[n.codigo_producto] = (smap[n.codigo_producto] ?? 0) + Number(n.stock_total ?? 0);
    });
    setStock(smap);

    const tmap: Record<string, number> = {};
    const dmap: Record<string, PedidoTransito[]> = {};
    ((pl ?? []) as any[])
      .filter((l) => l.pedido && !["cerrado", "cancelado", "recibido"].includes(String(l.pedido.estatus)))
      .forEach((l) => {
        const cant = Math.max(0, Number(l.cantidad_confirmada ?? l.cantidad_solicitada ?? 0) - Number(l.cantidad_recibida ?? 0));
        if (cant <= 0) return;
        tmap[l.codigo_producto] = (tmap[l.codigo_producto] ?? 0) + cant;
        (dmap[l.codigo_producto] ??= []).push({
          codigo_producto: l.codigo_producto,
          cantidad: cant,
          fecha_entrega_estimada: l.pedido.fecha_entrega_estimada ?? null,
          numero_po: l.pedido.numero_po_interno || l.pedido.numero_orden_proveedor || "—",
        });
      });
    setTransito(tmap);
    setTransitoDetalle(dmap);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [refreshKey]);

  const rows: ResumenRow[] = useMemo(() => {
    const agg: Record<string, { nombre: string; demanda: number }> = {};
    lineas.forEach((l) => {
      const codigo = l.codigo_producto ?? "";
      if (!agg[codigo]) agg[codigo] = { nombre: l.nombre_producto ?? "", demanda: 0 };
      if (!agg[codigo].nombre && l.nombre_producto) agg[codigo].nombre = l.nombre_producto;
      agg[codigo].demanda += Number(l.cantidad ?? 0);
    });

    const base: ResumenRow[] = Object.entries(agg).map(([codigo, v]) => {
      const stock_actual = Number(stock[codigo] ?? 0);
      const por_llegar = Number(transito[codigo] ?? 0);
      const disponible = stock_actual + por_llegar - v.demanda;
      return {
        codigo,
        nombre: v.nombre,
        demanda: v.demanda,
        stock_actual,
        por_llegar,
        disponible,
        alcanza: disponible >= 0,
        faltante: disponible < 0 ? Math.abs(disponible) : 0,
      };
    });

    const q = busq.trim().toLowerCase();
    return base
      .filter((r) => {
        if (fAlcanza === "si" && !r.alcanza) return false;
        if (fAlcanza === "no" && r.alcanza) return false;
        if (q && !`${r.codigo} ${r.nombre}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => (b.faltante - a.faltante) || a.codigo.localeCompare(b.codigo));
  }, [lineas, stock, transito, fAlcanza, busq]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Resumen por Producto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="w-48">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">¿Nos Alcanza?</Label>
            <Select value={fAlcanza} onValueChange={setFAlcanza}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="si">Sí</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-64">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Buscar</Label>
            <Input value={busq} onChange={(e) => setBusq(e.target.value)} placeholder="Código o producto" />
          </div>
          <div className="flex items-end">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">Código</TableHead>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">Producto</TableHead>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide text-right">Demanda Total</TableHead>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide text-right">Stock Actual</TableHead>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide text-right">Por Llegar</TableHead>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide text-right">Disponible Proyectado</TableHead>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">¿Nos Alcanza?</TableHead>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide text-right">Faltante</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                    {loading ? "Cargando…" : "Sin productos que mostrar"}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.codigo} className="odd:bg-muted/30">
                  <TableCell className="font-mono text-sm font-medium py-2.5">{r.codigo}</TableCell>
                  <TableCell className="text-sm py-2.5">{r.nombre || "—"}</TableCell>
                  <TableCell className="text-right text-sm font-medium py-2.5">{r.demanda}</TableCell>
                  <TableCell className="text-right text-sm font-medium py-2.5">{r.stock_actual}</TableCell>
                  <TableCell className="text-right text-sm font-medium py-2.5">
                    {r.por_llegar > 0 ? (
                      <button
                        type="button"
                        className="text-blue-600 underline underline-offset-2 hover:text-blue-800"
                        onClick={() => setDetallePorLlegar(r)}
                      >
                        {r.por_llegar}
                      </button>
                    ) : (
                      r.por_llegar
                    )}
                  </TableCell>
                  <TableCell className={`text-right text-sm font-semibold py-2.5 ${r.alcanza ? "text-emerald-700" : "text-red-700"}`}>{r.disponible}</TableCell>
                  <TableCell className="py-2.5">
                    <Badge className={`text-xs font-semibold ${r.alcanza ? "bg-emerald-200 text-emerald-800 hover:bg-emerald-200" : "bg-red-200 text-red-800 hover:bg-red-200"}`}>
                      {r.alcanza ? "Sí" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold text-red-700 py-2.5">{r.faltante > 0 ? r.faltante : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={!!detallePorLlegar} onOpenChange={(o) => !o && setDetallePorLlegar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pedidos en camino — {detallePorLlegar?.codigo}</DialogTitle>
            <DialogDescription>
              Todos los pedidos abiertos (no cerrados ni cancelados) de este código.
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">N° PO</TableHead>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide text-right">Cantidad</TableHead>
                <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">Fecha estimada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(detallePorLlegar ? transitoDetalle[detallePorLlegar.codigo] ?? [] : []).map((t, i) => (
                <TableRow key={i} className="odd:bg-muted/30">
                  <TableCell className="text-sm font-medium py-2.5">{t.numero_po}</TableCell>
                  <TableCell className="text-right text-sm font-medium py-2.5">{t.cantidad}</TableCell>
                  <TableCell className="text-sm py-2.5">{t.fecha_entrega_estimada || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function NuevaEntregaManualDialog({
  open, onOpenChange, onSaved,
}: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [cliente, setCliente] = useState("");
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [ubicacionId, setUbicacionId] = useState("");
  const [fecha, setFecha] = useState("");
  const [numeroPedido, setNumeroPedido] = useState("");
  const [productos, setProductos] = useState<{ codigo: string; nombre: string; cantidad: string }[]>([
    { codigo: "", nombre: "", cantidad: "1" },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCliente("");
    setUbicaciones([]);
    setUbicacionId("");
    setFecha("");
    setNumeroPedido("");
    setProductos([{ codigo: "", nombre: "", cantidad: "1" }]);
  }, [open]);

  useEffect(() => {
    (async () => {
      if (!cliente) { setUbicaciones([]); return; }
      setUbicaciones(await fetchUbicaciones(cliente));
    })();
  }, [cliente]);

  const validos = productos.filter((p) => p.codigo.trim() || p.nombre.trim());
  const puedeGuardar = !!cliente && !!fecha && validos.length > 0 && !saving;

  const guardar = async () => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: ins, error } = await (supabase as any)
        .from("entregas_corporativas")
        .insert({
          cliente,
          ubicacion_id: ubicacionId || null,
          fecha_programada: fecha,
          numero_pedido: numeroPedido.trim() || null,
          estatus: "programada",
          creado_por: userData?.user?.id ?? null,
          calendario_id: null,
          lugar_entrega_texto: null,
        })
        .select("id")
        .single();
      if (error) throw error;

      const { error: eL } = await (supabase as any).from("entregas_corporativas_lineas").insert(
        validos.map((p) => ({
          entrega_id: ins.id,
          codigo_producto: p.codigo.trim(),
          nombre_producto: p.nombre.trim() || null,
          cantidad: Number(p.cantidad) || 0,
        })),
      );
      if (eL) throw eL;

      toast.success("Entrega creada");
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo crear la entrega");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 -m-6 mb-0 p-6 rounded-t-lg border-b">
          <DialogTitle className="text-base">Nueva entrega manual</DialogTitle>
          <DialogDescription className="font-light">
            Captura una entrega sin necesidad de subir un documento.
          </DialogDescription>
        </DialogHeader>

        <div className="pt-6 space-y-4 max-h-[65vh] overflow-y-auto">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</Label>
              <Select value={cliente} onValueChange={(v) => { setCliente(v); setUbicacionId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger>
                <SelectContent>
                  {CLIENTES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Ubicación (opcional)</Label>
              <Select value={ubicacionId} onValueChange={setUbicacionId} disabled={!cliente || !ubicaciones.length}>
                <SelectTrigger><SelectValue placeholder={cliente ? "Selecciona una ubicación" : "Elige un cliente primero"} /></SelectTrigger>
                <SelectContent>
                  {ubicaciones.map((u) => <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Fecha programada</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">N° Pedido (opcional)</Label>
              <Input value={numeroPedido} onChange={(e) => setNumeroPedido(e.target.value)} placeholder="Ej. 264057312" />
            </div>
          </div>

          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-violet-50 to-blue-50">
                  <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">Código</TableHead>
                  <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide">Nombre</TableHead>
                  <TableHead className="uppercase text-xs text-slate-700 font-semibold tracking-wide text-right">Cantidad</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {productos.map((p, idx) => (
                  <TableRow key={idx} className="odd:bg-muted/30">
                    <TableCell className="py-2.5">
                      <ProductoSelector
                        codigo={p.codigo}
                        onSelect={(sel) => setProductos((prev) => prev.map((x, i) => i === idx ? { ...x, codigo: sel.codigo, nombre: sel.nombre } : x))}
                      />
                    </TableCell>
                    <TableCell className="py-2.5">
                      <span className="text-sm">{p.nombre || <span className="text-muted-foreground">Selecciona un producto</span>}</span>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Input type="number" className="h-8 w-24 text-sm text-right ml-auto font-medium" value={p.cantidad}
                        onChange={(e) => setProductos((prev) => prev.map((x, i) => i === idx ? { ...x, cantidad: e.target.value } : x))} />
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive"
                        disabled={productos.length === 1}
                        onClick={() => setProductos((prev) => prev.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-2 border-t bg-muted/30">
              <Button variant="outline" size="sm" className="h-7 text-xs"
                onClick={() => setProductos((prev) => [...prev, { codigo: "", nombre: "", cantidad: "1" }])}>
                <Plus className="h-3 w-3 mr-1" /> Agregar producto
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="bg-muted/40 -m-6 mt-0 p-4 rounded-b-lg">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={!puedeGuardar}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Crear entrega
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------- Reportes --------------------------- */

const mxn = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n || 0);

type ReporteLinea = {
  id: string;
  codigo: string;
  nombre: string;
  cliente: string;
  fecha: string;
  cantidad: number;
  costo_unitario: number | null;
  importe: number;
};

function MultiSelectFilter({
  label, options, selected, onChange, searchable,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  searchable?: boolean;
}) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const visibles = term ? options.filter((o) => o.label.toLowerCase().includes(term)) : options;
  const resumen = selected.length === options.length
    ? "Todos"
    : selected.length === 0 ? "Ninguno" : `${selected.length} seleccionados`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between font-normal">
          <span className="truncate">{resumen}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <div className="p-2 border-b space-y-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs flex-1"
              onClick={() => onChange(options.map((o) => o.value))}>Todos</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs flex-1"
              onClick={() => onChange([])}>Ninguno</Button>
          </div>
          {searchable && (
            <Input className="h-8 text-sm" placeholder="Buscar código o nombre…" value={q}
              onChange={(e) => setQ(e.target.value)} />
          )}
        </div>
        <div className="max-h-64 overflow-y-auto p-2 space-y-1">
          {visibles.length === 0 && (
            <p className="text-xs text-muted-foreground py-2 text-center">Sin resultados</p>
          )}
          {visibles.map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
              <Checkbox
                checked={selected.includes(o.value)}
                onCheckedChange={(c) =>
                  onChange(c ? [...selected, o.value] : selected.filter((v) => v !== o.value))
                }
              />
              <span className="truncate">{o.label}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ReportesTab({ refreshKey }: { refreshKey: number }) {
  const [loading, setLoading] = useState(false);
  const [lineas, setLineas] = useState<ReporteLinea[]>([]);
  const [fClientes, setFClientes] = useState<string[]>(CLIENTES);
  const [fProductos, setFProductos] = useState<string[]>([]);
  const [prodInit, setProdInit] = useState(false);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [periodo, setPeriodo] = useState<"futuro" | "pasado" | "todo">("futuro");

  const [sortProd, setSortProd] = useState<{ k: string; asc: boolean }>({ k: "importe", asc: false });
  const [sortCli, setSortCli] = useState<{ k: string; asc: boolean }>({ k: "importe", asc: false });

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("entregas_corporativas_lineas")
      .select("id, codigo_producto, nombre_producto, cantidad, costo_unitario, entrega:entregas_corporativas(cliente, fecha_programada, estatus)");
    const rows: ReporteLinea[] = ((data ?? []) as any[])
      .filter((l) => l.entrega && l.entrega.estatus !== "cancelada")
      .map((l) => {
        const cantidad = Number(l.cantidad ?? 0);
        const costo = l.costo_unitario === null || l.costo_unitario === undefined ? null : Number(l.costo_unitario);
        return {
          id: l.id,
          codigo: l.codigo_producto ?? "",
          nombre: l.nombre_producto ?? "",
          cliente: l.entrega.cliente ?? "—",
          fecha: l.entrega.fecha_programada as string,
          cantidad,
          costo_unitario: costo,
          importe: cantidad * (costo ?? 0),
        };
      });
    setLineas(rows);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [refreshKey]);

  const productosOpts = useMemo(() => {
    const m = new Map<string, string>();
    lineas.forEach((l) => { if (l.codigo && !m.has(l.codigo)) m.set(l.codigo, `${l.codigo} — ${l.nombre}`); });
    return Array.from(m.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.value.localeCompare(b.value));
  }, [lineas]);

  useEffect(() => {
    if (!prodInit && productosOpts.length > 0) {
      setFProductos(productosOpts.map((o) => o.value));
      setProdInit(true);
    }
  }, [productosOpts, prodInit]);

  const filtradas = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    return lineas.filter((l) => {
      if (!fClientes.includes(l.cliente)) return false;
      if (prodInit && !fProductos.includes(l.codigo)) return false;
      if (fechaDesde && l.fecha < fechaDesde) return false;
      if (fechaHasta && l.fecha > fechaHasta) return false;
      if (periodo === "futuro" && !(l.fecha >= hoy)) return false;
      if (periodo === "pasado" && !(l.fecha < hoy)) return false;
      return true;
    });
  }, [lineas, fClientes, fProductos, prodInit, fechaDesde, fechaHasta, periodo]);

  const porProducto = useMemo(() => {
    const m = new Map<string, { codigo: string; nombre: string; cantidad: number; importe: number; costo: number | null; sinCosto: boolean }>();
    filtradas.forEach((l) => {
      const cur = m.get(l.codigo) ?? { codigo: l.codigo, nombre: l.nombre, cantidad: 0, importe: 0, costo: l.costo_unitario, sinCosto: false };
      cur.cantidad += l.cantidad;
      cur.importe += l.importe;
      if (l.costo_unitario === null) cur.sinCosto = true;
      else if (cur.costo === null) cur.costo = l.costo_unitario;
      if (!cur.nombre && l.nombre) cur.nombre = l.nombre;
      m.set(l.codigo, cur);
    });
    const arr = Array.from(m.values());
    const dir = sortProd.asc ? 1 : -1;
    const val = (r: typeof arr[number]) => {
      switch (sortProd.k) {
        case "codigo": return r.codigo;
        case "nombre": return r.nombre;
        case "cantidad": return r.cantidad;
        case "costo": return r.costo ?? 0;
        default: return r.importe;
      }
    };
    return arr.sort((a, b) => {
      const va = val(a), vb = val(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [filtradas, sortProd]);

  const porCliente = useMemo(() => {
    const m = new Map<string, { cliente: string; cantidad: number; importe: number }>();
    filtradas.forEach((l) => {
      const cur = m.get(l.cliente) ?? { cliente: l.cliente, cantidad: 0, importe: 0 };
      cur.cantidad += l.cantidad;
      cur.importe += l.importe;
      m.set(l.cliente, cur);
    });
    const arr = Array.from(m.values());
    const dir = sortCli.asc ? 1 : -1;
    const val = (r: typeof arr[number]) => {
      switch (sortCli.k) {
        case "cliente": return r.cliente;
        case "cantidad": return r.cantidad;
        default: return r.importe;
      }
    };
    return arr.sort((a, b) => {
      const va = val(a), vb = val(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [filtradas, sortCli]);

  const totalProdCant = porProducto.reduce((s, r) => s + r.cantidad, 0);
  const totalProdImp = porProducto.reduce((s, r) => s + r.importe, 0);
  const totalCliCant = porCliente.reduce((s, r) => s + r.cantidad, 0);
  const totalCliImp = porCliente.reduce((s, r) => s + r.importe, 0);

  const ThProd = ({ k, children, className }: { k: string; children: React.ReactNode; className?: string }) => (
    <TableHead
      className={`cursor-pointer select-none uppercase text-xs text-slate-700 font-semibold tracking-wide ${className ?? ""}`}
      onClick={() => setSortProd((s) => (s.k === k ? { k, asc: !s.asc } : { k, asc: true }))}
    >
      {children}{sortProd.k === k ? (sortProd.asc ? " ↑" : " ↓") : ""}
    </TableHead>
  );

  const ThCli = ({ k, children, className }: { k: string; children: React.ReactNode; className?: string }) => (
    <TableHead
      className={`cursor-pointer select-none uppercase text-xs text-slate-700 font-semibold tracking-wide ${className ?? ""}`}
      onClick={() => setSortCli((s) => (s.k === k ? { k, asc: !s.asc } : { k, asc: true }))}
    >
      {children}{sortCli.k === k ? (sortCli.asc ? " ↑" : " ↓") : ""}
    </TableHead>
  );

  const exportarProductos = () => {
    const data = porProducto.map((r) => ({
      "Código": r.codigo,
      Producto: r.nombre,
      "Cantidad Total": r.cantidad,
      "Costo Unitario": r.costo ?? 0,
      "Importe Total": r.importe,
    }));
    data.push({ "Código": "TOTAL", Producto: "", "Cantidad Total": totalProdCant, "Costo Unitario": 0, "Importe Total": totalProdImp } as any);
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Por Producto");
    XLSX.writeFile(wb, `reporte_entregas_producto_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportarClientes = () => {
    const data = porCliente.map((r) => ({
      Cliente: r.cliente,
      "Cantidad Total": r.cantidad,
      "Importe Total": r.importe,
    }));
    data.push({ Cliente: "TOTAL", "Cantidad Total": totalCliCant, "Importe Total": totalCliImp });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Por Cliente");
    XLSX.writeFile(wb, `reporte_entregas_cliente_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3">
            <div className="w-56">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</Label>
              <MultiSelectFilter
                label="Cliente"
                options={CLIENTES.map((c) => ({ value: c, label: c }))}
                selected={fClientes}
                onChange={setFClientes}
              />
            </div>
            <div className="w-64">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Producto</Label>
              <MultiSelectFilter
                label="Producto"
                options={productosOpts}
                selected={fProductos}
                onChange={setFProductos}
                searchable
              />
            </div>
            <div className="w-44">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Fecha desde</Label>
              <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
            </div>
            <div className="w-44">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Fecha hasta</Label>
              <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
            </div>
            <div className="w-56">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Periodo</Label>
              <ToggleGroup
                type="single"
                value={periodo}
                onValueChange={(v) => v && setPeriodo(v as any)}
                className="justify-start border rounded-md p-0.5"
              >
                <ToggleGroupItem value="futuro" className="h-8 px-3 text-xs">Futuro</ToggleGroupItem>
                <ToggleGroupItem value="pasado" className="h-8 px-3 text-xs">Pasado</ToggleGroupItem>
                <ToggleGroupItem value="todo" className="h-8 px-3 text-xs">Todo</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="flex items-end">
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium">Desglose por Producto</CardTitle>
          <Button variant="outline" size="sm" onClick={exportarProductos}>
            <Download className="h-4 w-4 mr-1.5" /> Exportar Excel
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-violet-50 to-blue-50">
                  <ThProd k="codigo">Código</ThProd>
                  <ThProd k="nombre">Producto</ThProd>
                  <ThProd k="cantidad" className="text-right">Cantidad Total</ThProd>
                  <ThProd k="costo" className="text-right">Costo Unitario</ThProd>
                  <ThProd k="importe" className="text-right">Importe Total</ThProd>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porProducto.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                      {loading ? "Cargando…" : "Sin productos que mostrar"}
                    </TableCell>
                  </TableRow>
                )}
                {porProducto.map((r) => (
                  <TableRow key={r.codigo} className="odd:bg-muted/30">
                    <TableCell className="font-mono text-sm font-medium py-2.5">{r.codigo}</TableCell>
                    <TableCell className="text-sm py-2.5">
                      <span className="mr-2">{r.nombre}</span>
                      {r.sinCosto && (
                        <Badge className="text-xs font-semibold bg-amber-200 text-amber-900 hover:bg-amber-200">Sin costo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium py-2.5">{r.cantidad}</TableCell>
                    <TableCell className="text-right text-sm py-2.5">{mxn(r.costo ?? 0)}</TableCell>
                    <TableCell className="text-right text-sm font-medium py-2.5">{mxn(r.importe)}</TableCell>
                  </TableRow>
                ))}
                {porProducto.length > 0 && (
                  <TableRow className="bg-muted/60">
                    <TableCell className="text-sm font-bold py-2.5">TOTAL</TableCell>
                    <TableCell />
                    <TableCell className="text-right text-sm font-bold py-2.5">{totalProdCant}</TableCell>
                    <TableCell />
                    <TableCell className="text-right text-sm font-bold py-2.5">{mxn(totalProdImp)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium">Desglose por Cliente</CardTitle>
          <Button variant="outline" size="sm" onClick={exportarClientes}>
            <Download className="h-4 w-4 mr-1.5" /> Exportar Excel
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-violet-50 to-blue-50">
                  <ThCli k="cliente">Cliente</ThCli>
                  <ThCli k="cantidad" className="text-right">Cantidad Total</ThCli>
                  <ThCli k="importe" className="text-right">Importe Total</ThCli>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porCliente.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">
                      {loading ? "Cargando…" : "Sin datos que mostrar"}
                    </TableCell>
                  </TableRow>
                )}
                {porCliente.map((r) => (
                  <TableRow key={r.cliente} className="odd:bg-muted/30">
                    <TableCell className="text-sm py-2.5">{r.cliente}</TableCell>
                    <TableCell className="text-right text-sm font-medium py-2.5">{r.cantidad}</TableCell>
                    <TableCell className="text-right text-sm font-medium py-2.5">{mxn(r.importe)}</TableCell>
                  </TableRow>
                ))}
                {porCliente.length > 0 && (
                  <TableRow className="bg-muted/60">
                    <TableCell className="text-sm font-bold py-2.5">TOTAL</TableCell>
                    <TableCell className="text-right text-sm font-bold py-2.5">{totalCliCant}</TableCell>
                    <TableCell className="text-right text-sm font-bold py-2.5">{mxn(totalCliImp)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
