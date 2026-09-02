import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Lock, Upload, FileText, Loader2, Link2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const db = supabase as any;

/* ------------------------------------------------------------------ */
/* Parseo CFDI                                                         */
/* ------------------------------------------------------------------ */

export interface CfdiChevronParsed {
  folioFiscal: string;
  serie: string | null;
  folio: string | null;
  tipoComprobante: "I" | "E" | "P" | null;
  fecha: string | null;
  rfcEmisor: string | null;
  nombreEmisor: string | null;
  subtotal: number | null;
  total: number | null;
  numeroPedidoProveedor: string | null;
  numeroOrdenCliente: string | null;
  uuidRelacionado: string | null;
}

export function parseCfdiChevron(xmlText: string): CfdiChevronParsed | null {
  const uuidMatch = xmlText.match(/<tfd:TimbreFiscalDigital[^>]*\sUUID="([0-9a-fA-F-]{36})"/);
  if (!uuidMatch) return null;
  const attr = (name: string) => {
    const m = xmlText.match(new RegExp(`<cfdi:Comprobante\\b[^>]*\\s${name}="([^"]*)"`));
    return m ? m[1] : null;
  };
  const tipo = attr("TipoDeComprobante") as "I" | "E" | "P" | null;
  const emisorTagMatch = xmlText.match(/<cfdi:Emisor\b[^>]*\/>/);
  const emisorTag = emisorTagMatch ? emisorTagMatch[0] : "";
  const emisorAttr = (name: string) => {
    const m = emisorTag.match(new RegExp(`\\s${name}="([^"]*)"`));
    return m ? m[1] : null;
  };
  const campoAddenda = (name: string) => {
    const m = xmlText.match(new RegExp(`<ecfd:campoString name="${name}">([^<]*)</ecfd:campoString>`));
    return m ? m[1] : null;
  };
  const cfdiRelacionadoMatch = xmlText.match(/<cfdi:CfdiRelacionado\s+UUID="([0-9a-fA-F-]{36})"/);
  const doctoRelacionadoMatch = xmlText.match(/\sIdDocumento="([0-9a-fA-F-]{36})"/);

  return {
    folioFiscal: uuidMatch[1],
    serie: attr("Serie"),
    folio: attr("Folio"),
    tipoComprobante: tipo,
    fecha: attr("Fecha"),
    rfcEmisor: emisorAttr("Rfc"),
    nombreEmisor: emisorAttr("Nombre"),
    subtotal: attr("SubTotal") ? Number(attr("SubTotal")) : null,
    total: attr("Total") ? Number(attr("Total")) : null,
    numeroPedidoProveedor: tipo === "I" ? campoAddenda("pNumeroPedido") : null,
    numeroOrdenCliente: tipo === "I" ? campoAddenda("pOrdenCliente") : null,
    uuidRelacionado:
      tipo === "E"
        ? cfdiRelacionadoMatch?.[1] ?? null
        : tipo === "P"
        ? doctoRelacionadoMatch?.[1] ?? null
        : null,
  };
}

/* ------------------------------------------------------------------ */
/* Cruce automático                                                    */
/* ------------------------------------------------------------------ */

async function intentarCruceAutomatico(registro: {
  id: string;
  tipo_comprobante: string;
  numero_pedido_proveedor: string | null;
  uuid_relacionado: string | null;
}) {
  if (registro.tipo_comprobante === "I") {
    if (!registro.numero_pedido_proveedor) return;
    const { data: pedido } = await db
      .from("inv_pedidos")
      .select("id, factura_recibida_id")
      .eq("numero_orden_proveedor", registro.numero_pedido_proveedor)
      .maybeSingle();
    if (pedido && !pedido.factura_recibida_id) {
      await db
        .from("chevron_facturas_recibidas")
        .update({ pedido_id: pedido.id, estatus_match: "automatico", procesado_at: new Date().toISOString() })
        .eq("id", registro.id);
      await db
        .from("inv_pedidos")
        .update({ factura_recibida_id: registro.id, fecha_facturado: new Date().toISOString().slice(0, 10) })
        .eq("id", pedido.id);
    }
  } else {
    if (!registro.uuid_relacionado) return;
    const { data: facturaRelacionada } = await db
      .from("chevron_facturas_recibidas")
      .select("id")
      .eq("folio_fiscal", registro.uuid_relacionado)
      .eq("tipo_comprobante", "I")
      .maybeSingle();
    if (facturaRelacionada) {
      await db
        .from("chevron_facturas_recibidas")
        .update({
          factura_relacionada_id: facturaRelacionada.id,
          estatus_match: "automatico",
          procesado_at: new Date().toISOString(),
        })
        .eq("id", registro.id);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

const money = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const fechaFmt = (f: string | null) => (f ? new Date(f).toLocaleDateString("es-MX") : "—");

const baseName = (name: string) => name.replace(/\.[^.]+$/, "").toLowerCase();

type FilaResultado = {
  key: string;
  nombre: string;
  estado: "pendiente" | "procesando" | "importado" | "duplicado" | "error";
  mensaje?: string;
  tipo?: string | null;
};

async function abrirPdf(path: string | null) {
  if (!path) {
    toast.error("Este comprobante no tiene PDF");
    return;
  }
  const { data, error } = await supabase.storage.from("chevron-facturas").createSignedUrl(path, 300);
  if (error || !data?.signedUrl) {
    toast.error("No se pudo generar el enlace del PDF");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function ChevronFacturasRecibidas() {
  const { hasRole, user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState("importar");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [resultados, setResultados] = useState<FilaResultado[]>([]);
  const [filtroFacturas, setFiltroFacturas] = useState("");
  const [empDialog, setEmpDialog] = useState<{ id: string; folio: string } | null>(null);
  const [empBusqueda, setEmpBusqueda] = useState("");

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["chevron_facturas_recibidas"],
    queryFn: async () => {
      const { data, error } = await db
        .from("chevron_facturas_recibidas")
        .select(
          "id, folio_fiscal, serie, folio, tipo_comprobante, fecha, total, subtotal, pedido_id, factura_relacionada_id, uuid_relacionado, estatus_match, pdf_storage_path, numero_pedido_proveedor"
        )
        .order("fecha", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const pedidoIds = useMemo(
    () => Array.from(new Set(registros.map((r) => r.pedido_id).filter(Boolean))) as string[],
    [registros]
  );

  const { data: pedidos = [] } = useQuery({
    queryKey: ["chevron_pedidos_ref", pedidoIds],
    enabled: pedidoIds.length > 0,
    queryFn: async () => {
      const { data, error } = await db.from("inv_pedidos").select("id, numero_po_interno").in("id", pedidoIds);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const pedidoMap = useMemo(() => {
    const m = new Map<string, string>();
    pedidos.forEach((p) => m.set(p.id, p.numero_po_interno));
    return m;
  }, [pedidos]);

  const facturas = useMemo(() => registros.filter((r) => r.tipo_comprobante === "I"), [registros]);
  const movimientos = useMemo(
    () => registros.filter((r) => r.tipo_comprobante === "E" || r.tipo_comprobante === "P"),
    [registros]
  );

  const totalesPorFactura = useMemo(() => {
    const m = new Map<string, { pagado: number; notas: number }>();
    movimientos.forEach((r) => {
      if (!r.factura_relacionada_id) return;
      const cur = m.get(r.factura_relacionada_id) || { pagado: 0, notas: 0 };
      if (r.tipo_comprobante === "P") cur.pagado += Number(r.total || 0);
      else cur.notas += Number(r.total || 0);
      m.set(r.factura_relacionada_id, cur);
    });
    return m;
  }, [movimientos]);

  const facturasFiltradas = useMemo(() => {
    const q = filtroFacturas.trim().toLowerCase();
    if (!q) return facturas;
    return facturas.filter((f) =>
      [f.serie, f.folio, f.folio_fiscal, f.numero_pedido_proveedor]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(q))
    );
  }, [facturas, filtroFacturas]);

  /* ---------------- Importación ---------------- */

  const procesarArchivos = async (list: FileList | File[] | null) => {
    if (!list) return;
    const archivos = Array.from(list).filter((f) => /\.(pdf|xml)$/i.test(f.name));
    if (!archivos.length) {
      toast.error("Selecciona archivos PDF o XML");
      return;
    }

    const grupos = new Map<string, { xml?: File; pdf?: File }>();
    archivos.forEach((f) => {
      const key = baseName(f.name);
      const g = grupos.get(key) || {};
      if (f.name.toLowerCase().endsWith(".xml")) g.xml = f;
      else g.pdf = f;
      grupos.set(key, g);
    });

    setLoading(true);
    setProgreso(0);
    const filas: FilaResultado[] = Array.from(grupos.entries()).map(([key, g]) => ({
      key,
      nombre: g.xml?.name || g.pdf?.name || key,
      estado: "pendiente",
    }));
    setResultados(filas);
    const upd = (key: string, patch: Partial<FilaResultado>) =>
      setResultados((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

    // Pre-parse para detectar duplicados en lote
    const parsed = new Map<string, CfdiChevronParsed>();
    for (const [key, g] of grupos) {
      if (!g.xml) {
        upd(key, { estado: "error", mensaje: "sin XML, no se puede procesar" });
        continue;
      }
      try {
        const text = await g.xml.text();
        const p = parseCfdiChevron(text);
        if (!p || !p.tipoComprobante) {
          upd(key, { estado: "error", mensaje: "XML no reconocible como CFDI de Chevron" });
          continue;
        }
        parsed.set(key, p);
      } catch {
        upd(key, { estado: "error", mensaje: "No se pudo leer el XML" });
      }
    }

    const uuids = Array.from(parsed.values()).map((p) => p.folioFiscal);
    let existentes = new Set<string>();
    if (uuids.length) {
      const { data } = await db.from("chevron_facturas_recibidas").select("folio_fiscal").in("folio_fiscal", uuids);
      existentes = new Set((data || []).map((d: any) => d.folio_fiscal));
    }

    let importadasI = 0,
      importadasE = 0,
      importadasP = 0,
      cruzados = 0,
      duplicados = 0,
      errores = filas.filter((f) => f.estado === "error").length;

    let hechos = 0;
    const totalGrupos = grupos.size;

    for (const [key, g] of grupos) {
      const p = parsed.get(key);
      hechos++;
      setProgreso(Math.round((hechos / totalGrupos) * 100));
      if (!p) continue;

      if (existentes.has(p.folioFiscal)) {
        duplicados++;
        upd(key, { estado: "duplicado", mensaje: "ya importado", tipo: p.tipoComprobante });
        continue;
      }

      upd(key, { estado: "procesando", tipo: p.tipoComprobante });
      try {
        const xmlText = await g.xml!.text();
        const xmlPath = `${p.tipoComprobante}/${p.folioFiscal}.xml`;
        const upXml = await supabase.storage
          .from("chevron-facturas")
          .upload(xmlPath, g.xml!, { contentType: "application/xml", upsert: true });
        if (upXml.error) throw new Error(upXml.error.message);

        let pdfPath: string | null = null;
        if (g.pdf) {
          pdfPath = `${p.tipoComprobante}/${p.folioFiscal}.pdf`;
          const upPdf = await supabase.storage
            .from("chevron-facturas")
            .upload(pdfPath, g.pdf, { contentType: "application/pdf", upsert: true });
          if (upPdf.error) throw new Error(upPdf.error.message);
        }

        const { data: inserted, error: insErr } = await db
          .from("chevron_facturas_recibidas")
          .insert({
            folio_fiscal: p.folioFiscal,
            serie: p.serie,
            folio: p.folio,
            tipo_comprobante: p.tipoComprobante,
            fecha: p.fecha,
            rfc_emisor: p.rfcEmisor,
            nombre_emisor: p.nombreEmisor,
            subtotal: p.subtotal,
            total: p.total,
            numero_pedido_proveedor: p.numeroPedidoProveedor,
            numero_orden_cliente: p.numeroOrdenCliente,
            uuid_relacionado: p.uuidRelacionado,
            xml_storage_path: xmlPath,
            pdf_storage_path: pdfPath,
            xml_raw: xmlText,
            origen: "manual",
            nombre_archivo_origen: g.xml!.name,
            creado_por: user?.id ?? null,
          })
          .select("id, tipo_comprobante, numero_pedido_proveedor, uuid_relacionado, folio_fiscal")
          .single();
        if (insErr) throw new Error(insErr.message);

        await intentarCruceAutomatico(inserted);

        // Reintento de E/P huérfanos que apuntan a esta factura
        if (inserted.tipo_comprobante === "I") {
          const { data: pendientes } = await db
            .from("chevron_facturas_recibidas")
            .select("id, tipo_comprobante, numero_pedido_proveedor, uuid_relacionado")
            .eq("uuid_relacionado", inserted.folio_fiscal)
            .eq("estatus_match", "sin_match");
          for (const pend of pendientes || []) await intentarCruceAutomatico(pend);
        }

        const { data: check } = await db
          .from("chevron_facturas_recibidas")
          .select("estatus_match")
          .eq("id", inserted.id)
          .maybeSingle();
        if (check?.estatus_match === "automatico") cruzados++;

        if (p.tipoComprobante === "I") importadasI++;
        else if (p.tipoComprobante === "E") importadasE++;
        else importadasP++;

        upd(key, {
          estado: "importado",
          tipo: p.tipoComprobante,
          mensaje: g.pdf ? undefined : "sin PDF",
        });
      } catch (e: any) {
        errores++;
        upd(key, { estado: "error", mensaje: e?.message || "Error desconocido" });
      }
    }

    setProgreso(100);
    setLoading(false);
    if (inputRef.current) inputRef.current.value = "";
    qc.invalidateQueries({ queryKey: ["chevron_facturas_recibidas"] });

    const resumen = `${importadasI} facturas, ${importadasE} notas de crédito, ${importadasP} pagos importados · ${cruzados} cruzados automáticamente · ${duplicados} ya existían · ${errores} con error`;
    if (errores && !(importadasI + importadasE + importadasP)) toast.error(resumen);
    else toast.success(resumen);
  };

  const emparejarManual = async (facturaId: string) => {
    if (!empDialog) return;
    const { error } = await db
      .from("chevron_facturas_recibidas")
      .update({
        factura_relacionada_id: facturaId,
        estatus_match: "manual",
        procesado_at: new Date().toISOString(),
        procesado_por: user?.id ?? null,
      })
      .eq("id", empDialog.id);
    if (error) {
      toast.error("No se pudo emparejar: " + error.message);
      return;
    }
    toast.success("Comprobante emparejado");
    setEmpDialog(null);
    setEmpBusqueda("");
    qc.invalidateQueries({ queryKey: ["chevron_facturas_recibidas"] });
  };

  if (!hasRole("master" as any)) {
    return (
      <div className="p-6 flex justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-10 flex flex-col items-center text-center gap-3">
            <Lock className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-light text-muted-foreground">No tienes permiso para ver esta sección.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const facturasParaEmparejar = facturas.filter((f) => {
    const q = empBusqueda.trim().toLowerCase();
    if (!q) return true;
    return [f.serie, f.folio, f.folio_fiscal].filter(Boolean).some((v: string) => String(v).toLowerCase().includes(q));
  });

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-light tracking-tight">Facturas Chevron</h1>
        <p className="text-sm text-muted-foreground font-light">
          Cruce automático de facturas, pagos y notas de crédito contra pedidos de compra.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="importar">Importar</TabsTrigger>
          <TabsTrigger value="facturas">Facturas ({facturas.length})</TabsTrigger>
          <TabsTrigger value="movimientos">Pagos y Notas de Crédito ({movimientos.length})</TabsTrigger>
        </TabsList>

        {/* ---------------- Importar ---------------- */}
        <TabsContent value="importar" className="space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  if (!loading) procesarArchivos(e.dataTransfer.files);
                }}
                onClick={() => !loading && inputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition ${
                  dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:bg-muted/30"
                }`}
              >
                <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-light">
                  Arrastra aquí los archivos PDF y XML de Chevron, o haz clic para seleccionarlos
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Cada comprobante debe incluir su XML; el PDF es opcional
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept=".pdf,.xml"
                  className="hidden"
                  onChange={(e) => procesarArchivos(e.target.files)}
                />
              </div>

              {loading && (
                <div className="space-y-2">
                  <Progress value={progreso} />
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" /> Procesando… {progreso}%
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {resultados.length > 0 && (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gradient-to-r from-violet-50 to-blue-50">
                    <TableRow>
                      {["Archivo", "Tipo", "Estado"].map((h) => (
                        <TableHead key={h} className="uppercase tracking-wide text-xs font-medium">
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultados.map((r, i) => (
                      <TableRow key={r.key} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                        <TableCell className="text-xs font-light flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          {r.nombre}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.tipo === "I" ? "Factura" : r.tipo === "E" ? "Nota de Crédito" : r.tipo === "P" ? "Pago" : "—"}
                        </TableCell>
                        <TableCell>
                          {r.estado === "importado" && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Importado{r.mensaje ? ` · ${r.mensaje}` : ""}
                            </Badge>
                          )}
                          {r.estado === "duplicado" && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                              Ya importado
                            </Badge>
                          )}
                          {r.estado === "error" && (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              Error: {r.mensaje}
                            </Badge>
                          )}
                          {r.estado === "procesando" && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Procesando…
                            </Badge>
                          )}
                          {r.estado === "pendiente" && <Badge variant="outline">En cola</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ---------------- Facturas ---------------- */}
        <TabsContent value="facturas" className="space-y-3">
          <Input
            placeholder="Buscar por folio, UUID o pedido…"
            value={filtroFacturas}
            onChange={(e) => setFiltroFacturas(e.target.value)}
            className="max-w-sm"
          />
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-gradient-to-r from-violet-50 to-blue-50">
                  <TableRow>
                    {["Folio", "Fecha", "Pedido interno", "Total", "Pagado", "Notas de Crédito", "Saldo", "Cruce", ""].map(
                      (h, i) => (
                        <TableHead key={i} className="uppercase tracking-wide text-xs font-medium">
                          {h}
                        </TableHead>
                      )
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-sm text-muted-foreground">
                        Cargando…
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && facturasFiltradas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-sm text-muted-foreground font-light">
                        Sin facturas importadas
                      </TableCell>
                    </TableRow>
                  )}
                  {facturasFiltradas.map((f, i) => {
                    const t = totalesPorFactura.get(f.id) || { pagado: 0, notas: 0 };
                    const saldo = Number(f.total || 0) - t.pagado - t.notas;
                    return (
                      <TableRow key={f.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                        <TableCell className="text-xs font-mono">
                          {[f.serie, f.folio].filter(Boolean).join("-") || f.folio_fiscal.slice(0, 8)}
                        </TableCell>
                        <TableCell className="text-xs">{fechaFmt(f.fecha)}</TableCell>
                        <TableCell className="text-xs font-mono">
                          {f.pedido_id ? pedidoMap.get(f.pedido_id) || "—" : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{money(Number(f.total))}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{money(t.pagado)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{money(t.notas)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums font-medium">{money(saldo)}</TableCell>
                        <TableCell>
                          {f.pedido_id ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Vinculada
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                              Sin pedido
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!f.pdf_storage_path}
                            onClick={() => abrirPdf(f.pdf_storage_path)}
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-1" />
                            PDF
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Pagos y NC ---------------- */}
        <TabsContent value="movimientos">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-gradient-to-r from-violet-50 to-blue-50">
                  <TableRow>
                    {["Tipo", "Folio", "Fecha", "Total", "Factura relacionada", ""].map((h, i) => (
                      <TableHead key={i} className="uppercase tracking-wide text-xs font-medium">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimientos.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground font-light">
                        Sin pagos ni notas de crédito
                      </TableCell>
                    </TableRow>
                  )}
                  {movimientos.map((m, i) => {
                    const rel = m.factura_relacionada_id ? facturas.find((f) => f.id === m.factura_relacionada_id) : null;
                    return (
                      <TableRow key={m.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              m.tipo_comprobante === "P"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-violet-50 text-violet-700 border-violet-200"
                            }
                          >
                            {m.tipo_comprobante === "P" ? "Pago" : "Nota de Crédito"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {[m.serie, m.folio].filter(Boolean).join("-") || m.folio_fiscal.slice(0, 8)}
                        </TableCell>
                        <TableCell className="text-xs">{fechaFmt(m.fecha)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{money(Number(m.total))}</TableCell>
                        <TableCell>
                          {rel ? (
                            <button
                              className="text-xs font-mono text-blue-700 hover:underline"
                              onClick={() => {
                                setFiltroFacturas(rel.folio_fiscal);
                                setTab("facturas");
                              }}
                            >
                              {[rel.serie, rel.folio].filter(Boolean).join("-") || rel.folio_fiscal.slice(0, 8)}
                            </button>
                          ) : (
                            <div className="space-y-0.5">
                              <p className="text-[11px] font-mono text-muted-foreground">{m.uuid_relacionado || "—"}</p>
                              <p className="text-[11px] text-muted-foreground font-light">aún no importada</p>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="space-x-1 whitespace-nowrap">
                          {!rel && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setEmpDialog({
                                  id: m.id,
                                  folio: [m.serie, m.folio].filter(Boolean).join("-") || m.folio_fiscal.slice(0, 8),
                                })
                              }
                            >
                              <Link2 className="h-3.5 w-3.5 mr-1" />
                              Emparejar manual
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!m.pdf_storage_path}
                            onClick={() => abrirPdf(m.pdf_storage_path)}
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-1" />
                            PDF
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!empDialog} onOpenChange={(o) => !o && setEmpDialog(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 p-5">
            <DialogTitle className="text-base font-light">Emparejar {empDialog?.folio} con una factura</DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-3">
            <Input
              placeholder="Buscar factura por folio o UUID…"
              value={empBusqueda}
              onChange={(e) => setEmpBusqueda(e.target.value)}
            />
            <div className="max-h-72 overflow-y-auto divide-y rounded-md border">
              {facturasParaEmparejar.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground font-light text-center">Sin resultados</p>
              )}
              {facturasParaEmparejar.map((f) => (
                <button
                  key={f.id}
                  className="w-full text-left p-3 hover:bg-blue-50/40 transition"
                  onClick={() => emparejarManual(f.id)}
                >
                  <p className="text-sm font-mono">
                    {[f.serie, f.folio].filter(Boolean).join("-") || f.folio_fiscal.slice(0, 8)}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-mono">{f.folio_fiscal}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {fechaFmt(f.fecha)} · {money(Number(f.total))}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
