import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, FileText, Image as ImageIcon, Mail, PackagePlus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/formatters";
import { CLIENTES, fetchUbicaciones, emparejarUbicacion } from "@/pages/EntregasCorporativas";
import { fetchProductosCatalogo } from "@/components/entregas/ProductoSelector";

function normalizarCliente(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function tituloCase(s: string) {
  return s
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

type IntakeRow = {
  id: string;
  canal: string | null;
  remitente_email: string | null;
  asunto_email: string | null;
  storage_path: string | null;
  mime_type: string | null;
  email_html_storage_path: string | null;
  resend_email_id: string | null;
  cliente_detectado: string | null;
  lugar_entrega_detectado: string | null;
  numero_pedido_detectado: string | null;
  entregas_extraidas: any;
  extraccion_error: string | null;
  created_at: string;
};

type EntregaLinea = {
  codigo?: string | null;
  nombre_producto?: string | null;
  fecha?: string | null;
  cantidad?: number | string | null;
};

const LIBRE = "__libre__";

function nombreArchivo(storagePath: string | null) {
  if (!storagePath) return "(solo texto del correo)";
  const last = storagePath.split("/").pop() || storagePath;
  const sinUuid = last.length > 37 ? last.slice(37) : last;
  return sinUuid || last;
}

function IntakeCard({ row, hermanas, onChanged }: { row: IntakeRow; hermanas: IntakeRow[]; onChanged: () => void }) {
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [emailPreviewHtml, setEmailPreviewHtml] = useState<string | null>(null);
  const [loadingEmailPreview, setLoadingEmailPreview] = useState(false);
  const [descartando, setDescartando] = useState(false);
  const [descartandoHermana, setDescartandoHermana] = useState<string | null>(null);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emailIframeRef = useRef<HTMLIFrameElement>(null);


  const detectado = row.cliente_detectado?.trim() || "";
  const match = detectado
    ? CLIENTES.filter((c) => c !== "Otro").find((c) => normalizarCliente(c) === normalizarCliente(detectado))
    : undefined;
  const [clienteSel, setClienteSel] = useState<string>(match ? match : detectado ? "Otro" : "");
  const [clienteOtro, setClienteOtro] = useState<string>(match ? "" : detectado);
  const [creando, setCreando] = useState(false);
  const [ubicaciones, setUbicaciones] = useState<any[]>([]);
  const [ubicacionSel, setUbicacionSel] = useState<string>(LIBRE);
  const [lugarLibre, setLugarLibre] = useState<string>(row.lugar_entrega_detectado || "");

  const cliente = clienteSel === "Otro" ? clienteOtro.trim() : clienteSel;

  useEffect(() => {
    let cancelado = false;
    if (!cliente) {
      setUbicaciones([]);
      setUbicacionSel(LIBRE);
      return;
    }
    fetchUbicaciones(cliente).then((list) => {
      if (cancelado) return;
      setUbicaciones(list);
      if (cliente === "Kenworth" && list.length > 0) {
        setUbicacionSel(list[0].id);
        return;
      }
      if (row.lugar_entrega_detectado) {
        const hit = emparejarUbicacion(row.lugar_entrega_detectado, list);
        setUbicacionSel(hit ? hit.id : LIBRE);
      } else {
        setUbicacionSel(LIBRE);
      }
    });
    return () => { cancelado = true; };
  }, [cliente, row.lugar_entrega_detectado]);

  const lineasOriginales: EntregaLinea[] = Array.isArray(row.entregas_extraidas) ? row.entregas_extraidas : [];
  const [lineas, setLineas] = useState<EntregaLinea[]>(lineasOriginales);
  const [editando, setEditando] = useState(false);
  const [guardandoLineas, setGuardandoLineas] = useState(false);
  const esImagen = (row.mime_type || "").startsWith("image/");

  const actualizarLinea = (i: number, campo: keyof EntregaLinea, valor: string) => {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)));
  };

  const eliminarLinea = (i: number) => setLineas((prev) => prev.filter((_, idx) => idx !== i));

  const guardarLineas = async () => {
    setGuardandoLineas(true);
    try {
      const limpias = lineas.map((l) => ({
        codigo: l.codigo?.toString().trim() || null,
        nombre_producto: l.nombre_producto?.toString().trim() || null,
        fecha: l.fecha?.toString().trim() || null,
        cantidad: l.cantidad === "" || l.cantidad == null ? null : Number(l.cantidad),
      }));
      const { error } = await (supabase as any)
        .from("entregas_corporativas_intake")
        .update({ entregas_extraidas: limpias })
        .eq("id", row.id);
      if (error) throw error;
      setLineas(limpias);
      setEditando(false);
      toast.success("Detalle de productos actualizado");
      onChanged();
    } catch (e: any) {
      toast.error("No se pudo guardar: " + (e.message || "Error"));
    } finally {
      setGuardandoLineas(false);
    }
  };


  const handleVerHermana = async (h: IntakeRow) => {
    if (!h.storage_path) return;
    const { data, error } = await supabase.storage
      .from("entregas-corporativas")
      .createSignedUrl(h.storage_path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("No se pudo generar la liga del archivo");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };


  const handleCrearEntregas = async () => {
    if (!cliente || lineas.length === 0) return;
    setCreando(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id ?? null;

      const entregas = lineas
        .filter((e) => e?.codigo && e?.fecha && Number(e.cantidad) > 0)
        .map((e) => ({ ...e })) as Required<EntregaLinea>[];
      if (!entregas.length) throw new Error("No hay líneas válidas para crear entregas");

      // Validar productos contra el catálogo
      try {
        const catalogo = await fetchProductosCatalogo();
        const mapCat = new Map(catalogo.map((p) => [p.codigo.trim().toUpperCase(), p.nombre]));
        entregas.forEach((e) => {
          const hit = mapCat.get(String(e.codigo).trim().toUpperCase());
          if (hit) e.nombre_producto = hit;
        });
      } catch { /* conserva el nombre extraído por la IA */ }

      // Ubicación seleccionada por el usuario
      let ubicacion: any = ubicacionSel !== LIBRE ? (ubicaciones.find((u) => u.id === ubicacionSel) ?? null) : null;
      let lugarTexto: string | null = null;
      if (!ubicacion && lugarLibre.trim()) {
        const listaFresca = await fetchUbicaciones(cliente);
        const reintento = emparejarUbicacion(lugarLibre.trim(), listaFresca);
        if (reintento) {
          ubicacion = reintento;
        } else {
          const formateada = tituloCase(lugarLibre.trim());
          const { data: nuevaUbic, error: ubicErr } = await supabase
            .from("entregas_corporativas_ubicaciones")
            .insert({ cliente, nombre: formateada, direccion: formateada, activo: true })
            .select("id, cliente, nombre, direccion, lat, lng, instrucciones, activo")
            .single();
          if (ubicErr) throw ubicErr;
          ubicacion = nuevaUbic;
        }
      }
      const numeroPedido = row.numero_pedido_detectado || null;

      // Agrupar por fecha
      const porFecha = new Map<string, Required<EntregaLinea>[]>();
      entregas.forEach((e) => {
        const f = String(e.fecha);
        const arr = porFecha.get(f) ?? [];
        arr.push(e);
        porFecha.set(f, arr);
      });

      let lineasNuevas = 0;
      let lineasActualizadas = 0;

      for (const [fecha, productos] of [...porFecha.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        let existente: any = null;
        if (numeroPedido) {
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
          const upd: any = { calendario_id: null, lugar_entrega_texto: lugarTexto };
          if (numeroPedido) upd.numero_pedido = numeroPedido;
          await (supabase as any).from("entregas_corporativas").update(upd).eq("id", entregaId);
        } else {
          const { data: nueva, error: insErr } = await (supabase as any)
            .from("entregas_corporativas")
            .insert({
              cliente,
              ubicacion_id: ubicacion?.id ?? null,
              fecha_programada: fecha,
              numero_pedido: numeroPedido,
              lugar_entrega_texto: lugarTexto,
              calendario_id: null,
              creado_por: uid,
              estatus: "programada",
            })
            .select("id")
            .single();
          if (insErr) throw insErr;
          entregaId = nueva.id;
        }

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

      const { error: updErr } = await (supabase as any)
        .from("entregas_corporativas_intake")
        .update({ estatus: "procesado", procesado_at: new Date().toISOString(), procesado_por: uid })
        .eq("id", row.id);
      if (updErr) throw updErr;

      toast.success(
        `${porFecha.size} entregas creadas/actualizadas, ${lineasNuevas + lineasActualizadas} líneas`,
      );
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "No se pudieron crear las entregas");
    } finally {
      setCreando(false);
    }
  };


  const handleVerArchivo = async () => {
    if (!row.storage_path) return;
    const { data, error } = await supabase.storage
      .from("entregas-corporativas")
      .createSignedUrl(row.storage_path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("No se pudo generar la liga del archivo");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleVerCorreo = async () => {
    if (!row.email_html_storage_path) return;
    setLoadingEmailPreview(true);
    try {
      const { data, error } = await supabase.storage
        .from("entregas-corporativas")
        .createSignedUrl(row.email_html_storage_path, 3600);
      if (error || !data?.signedUrl) {
        toast.error("No se pudo generar la liga del correo");
        return;
      }
      const res = await fetch(data.signedUrl);
      if (!res.ok) {
        toast.error("No se pudo cargar el contenido del correo");
        return;
      }
      setEmailPreviewHtml(await res.text());
      setEmailPreviewOpen(true);
    } catch (e: any) {
      toast.error(e.message || "Error al abrir el correo");
    } finally {
      setLoadingEmailPreview(false);
    }
  };

  const handleDescartar = async () => {
    if (!confirm("¿Descartar este correo? Ya no aparecerá en la lista de pendientes.")) return;
    setDescartando(true);
    const { error } = await supabase
      .from("entregas_corporativas_intake")
      .update({ estatus: "descartado" })
      .eq("id", row.id);
    setDescartando(false);
    if (error) {
      toast.error(error.message || "No se pudo descartar");
      return;
    }
    toast.success("Correo descartado");
    onChanged();
  };

  const handleDescartarHermana = async (h: IntakeRow) => {
    if (!confirm(`¿Eliminar el archivo "${nombreArchivo(h.storage_path)}" de esta bandeja?`)) return;
    setDescartandoHermana(h.id);
    const { error } = await supabase
      .from("entregas_corporativas_intake")
      .update({ estatus: "descartado" })
      .eq("id", h.id);
    setDescartandoHermana(null);
    if (error) {
      toast.error(error.message || "No se pudo eliminar el archivo");
      return;
    }
    toast.success("Archivo eliminado");
    onChanged();
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">{formatDate(row.created_at)}</span>
              <Badge variant="secondary" className="gap-1">
                <Mail className="h-3 w-3" /> Correo
              </Badge>
              <span className="text-sm font-medium">{row.remitente_email || "Remitente desconocido"}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDescartar}
              disabled={descartando}
              className="gap-1 text-muted-foreground"
            >
              <Trash2 className="h-4 w-4" /> Descartar
            </Button>
          </div>
          <p className="text-sm font-light">{row.asunto_email || "(sin asunto)"}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {row.extraccion_error && lineas.length === 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>La IA no pudo leer este correo/adjunto</AlertTitle>
              <AlertDescription className="break-words">{row.extraccion_error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {row.cliente_detectado ? (
              <span>
                <span className="text-muted-foreground">Cliente detectado:</span>{" "}
                <span className="font-medium">{row.cliente_detectado}</span>
              </span>
            ) : (
              <span className="text-amber-600">Cliente no detectado — revisar manualmente</span>
            )}
            {row.lugar_entrega_detectado && (
              <span>
                <span className="text-muted-foreground">Lugar:</span> {row.lugar_entrega_detectado}
              </span>
            )}
            {row.numero_pedido_detectado && (
              <span>
                <span className="text-muted-foreground">N° Pedido:</span> {row.numero_pedido_detectado}
              </span>
            )}
          </div>

          {lineas.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-end gap-2">
                {editando ? (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      disabled={guardandoLineas}
                      onClick={() => { setLineas(lineasOriginales); setEditando(false); }}
                    >
                      Cancelar
                    </Button>
                    <Button size="sm" className="h-7 text-xs" disabled={guardandoLineas} onClick={guardarLineas}>
                      {guardandoLineas ? "Guardando..." : "Guardar detalle"}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setEditando(true)}>
                    <Pencil className="h-3 w-3" /> Editar detalle
                  </Button>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    {editando && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineas.map((l, i) => (
                    <TableRow key={i}>
                      {editando ? (
                        <>
                          <TableCell>
                            <Input
                              className="h-8 font-mono text-xs"
                              value={l.codigo ?? ""}
                              onChange={(e) => actualizarLinea(i, "codigo", e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 text-sm"
                              value={l.nombre_producto ?? ""}
                              onChange={(e) => actualizarLinea(i, "nombre_producto", e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              className="h-8 w-36 text-sm"
                              value={(l.fecha ?? "").toString().slice(0, 10)}
                              onChange={(e) => actualizarLinea(i, "fecha", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="any"
                              className="h-8 w-24 text-right text-sm"
                              value={l.cantidad ?? ""}
                              onChange={(e) => actualizarLinea(i, "cantidad", e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => eliminarLinea(i)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="font-mono text-xs">{l.codigo || "—"}</TableCell>
                          <TableCell>{l.nombre_producto || "—"}</TableCell>
                          <TableCell>{l.fecha || "—"}</TableCell>
                          <TableCell className="text-right">{l.cantidad ?? "—"}</TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {editando && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setLineas((prev) => [...prev, { codigo: "", nombre_producto: "", fecha: "", cantidad: "" }])}
                >
                  + Agregar línea
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin productos/fechas detectados</p>
          )}


          <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-3">
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</Label>
              <Select value={clienteSel} onValueChange={setClienteSel}>
                <SelectTrigger className="h-8 w-56 text-sm">
                  <SelectValue placeholder="Selecciona cliente" />
                </SelectTrigger>
                <SelectContent>
                  {CLIENTES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {clienteSel === "Otro" && (
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nombre del cliente</Label>
                <Input
                  value={clienteOtro}
                  onChange={(e) => setClienteOtro(e.target.value)}
                  placeholder="Escribe el cliente"
                  className="h-8 w-56 text-sm"
                />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Lugar de entrega</Label>
              <Select value={ubicacionSel} onValueChange={setUbicacionSel}>
                <SelectTrigger className="h-8 w-56 text-sm">
                  <SelectValue placeholder="Selecciona lugar" />
                </SelectTrigger>
                <SelectContent>
                  {ubicaciones.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                  ))}
                  <SelectItem value={LIBRE}>+ Nueva ubicación (con este texto)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {ubicacionSel === LIBRE && (
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Lugar (texto)</Label>
                <Input
                  value={lugarLibre}
                  onChange={(e) => setLugarLibre(e.target.value)}
                  placeholder="Nombre o dirección de la nueva ubicación"
                  className="h-8 w-56 text-sm"
                />
              </div>
            )}
            <Button
              size="sm"
              onClick={handleCrearEntregas}
              disabled={creando || !cliente || lineas.length === 0}
              className="gap-1"
            >
              <PackagePlus className="h-4 w-4" />
              {creando ? "Creando..." : "Crear entregas"}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">

            {row.storage_path && (
              <Button variant="outline" size="sm" onClick={handleVerArchivo} className="gap-1">
                {esImagen ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                Ver archivo
              </Button>
            )}
            {row.email_html_storage_path && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleVerCorreo}
                disabled={loadingEmailPreview}
                className="gap-1"
              >
                <Mail className="h-4 w-4" />
                {loadingEmailPreview ? "Cargando..." : "Ver correo completo"}
              </Button>
            )}
          </div>

          {hermanas.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Otros archivos de este correo:</p>
              <div className="flex flex-wrap gap-2">
                {hermanas.map((h) => {
                  const nombre = nombreArchivo(h.storage_path);
                  const img = /\.(png|jpe?g|gif|webp|heic)$/i.test(nombre);
                  return (
                    <div key={h.id} className="flex items-center rounded-md border">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!h.storage_path}
                        onClick={() => handleVerHermana(h)}
                        className="h-7 gap-1 rounded-r-none text-xs"
                      >
                        {img ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                        {nombre}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Eliminar archivo"
                        disabled={descartandoHermana === h.id}
                        onClick={() => handleDescartarHermana(h)}
                        className="h-7 w-7 rounded-l-none border-l"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={emailPreviewOpen} onOpenChange={setEmailPreviewOpen}>
        <DialogContent className="max-w-4xl h-[85vh] p-0 flex flex-col">
          <div className="flex items-center justify-between border-b p-3">
            <span className="text-sm font-medium">Correo original</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => emailIframeRef.current?.contentWindow?.print()}
            >
              Imprimir
            </Button>
          </div>
          <iframe
            ref={emailIframeRef}
            srcDoc={emailPreviewHtml || ""}
            className="w-full flex-1 border-0"
            sandbox="allow-same-origin"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function EntregasCorpIntakeTab() {
  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["entregas-corp-intake-pendientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entregas_corporativas_intake")
        .select(
          "id, canal, remitente_email, asunto_email, storage_path, mime_type, email_html_storage_path, resend_email_id, cliente_detectado, lugar_entrega_detectado, numero_pedido_detectado, entregas_extraidas, extraccion_error, created_at"
        )
        .eq("estatus", "pendiente")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as IntakeRow[];
    },
  });

  const porEmail = useMemo(() => {
    const m = new Map<string, IntakeRow[]>();
    rows.forEach((r) => {
      if (!r.resend_email_id) return;
      const arr = m.get(r.resend_email_id) ?? [];
      arr.push(r);
      m.set(r.resend_email_id, arr);
    });
    return m;
  }, [rows]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando correos...</p>;
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No hay correos de Chevron pendientes de revisar.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <IntakeCard
          key={row.id}
          row={row}
          hermanas={
            row.resend_email_id
              ? (porEmail.get(row.resend_email_id) ?? []).filter((h) => h.id !== row.id)
              : []
          }
          onChanged={() => refetch()}
        />
      ))}

    </div>
  );
}
