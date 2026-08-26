import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DictationTextarea } from "@/components/ui/DictationTextarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Loader2,
  Eye,
  Send,
  Upload,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Building2,
  Clock,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/formatters";
import { EnviarConfirmacionPagoDialog } from "@/components/cobranza/EnviarConfirmacionPagoDialog";
import { buildAutorizacionPrecioEmailFlow } from "@/lib/autorizacionPrecioFlow";
import {
  normalizeDatosCliente,
  type DatosClienteAutorizacion,
} from "@/lib/autorizacionDatosCliente";
import { AutorizacionDatosClienteBlock } from "@/components/documents/AutorizacionDatosClienteBlock";
import { CompanyFormDialog, type CompanyData } from "@/components/CompanyFormDialog";


const BUCKET = "autorizacion-precios";

const money = (v: number | null | undefined) =>
  v === null || v === undefined
    ? "—"
    : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(v));

const numFmt = (v: any) => new Intl.NumberFormat("es-MX").format(Number(v || 0));

export default function AutorizacionPrecioCard({
  row,
  ejecutivo,
  onRefetch,
  isHighlighted,
  defaultOpen = true,
  embedded = false,
  onDeleted,
}: {
  row: any;
  ejecutivo?: string | null;
  onRefetch: () => void;
  isHighlighted?: boolean;
  defaultOpen?: boolean;
  embedded?: boolean;
  onDeleted?: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(defaultOpen);
  const [flash, setFlash] = useState(false);
  const companyRef = row.documentos?.companies || {};
  const datosIniciales = () =>
    row.datos_cliente_snapshot && Object.keys(row.datos_cliente_snapshot).length > 0
      ? normalizeDatosCliente(row.datos_cliente_snapshot)
      : normalizeDatosCliente(companyRef);
  const [justificacion, setJustificacion] = useState<string>(row.justificacion || "");
  const [datos, setDatos] = useState<DatosClienteAutorizacion>(datosIniciales);

  const [savingDatos, setSavingDatos] = useState(false);
  const [savingDatosPerfil, setSavingDatosPerfil] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [flow, setFlow] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [companyEditData, setCompanyEditData] = useState<CompanyData | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(false);

  useEffect(() => {
    if (isHighlighted) {
      setOpen(true);
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 2500);
      return () => clearTimeout(t);
    }
  }, [isHighlighted]);

  useEffect(() => {
    setJustificacion(row.justificacion || "");
  }, [row.id, row.justificacion]);

  const [numeroFactura, setNumeroFactura] = useState<string>(row.documentos?.numero_factura || "");
  const [savingFactura, setSavingFactura] = useState(false);

  useEffect(() => {
    setNumeroFactura(row.documentos?.numero_factura || "");
  }, [row.id, row.documentos?.numero_factura]);

  const guardarNumeroFactura = async () => {
    if (!row.documento_id) return;
    setSavingFactura(true);
    try {
      const { error } = await (supabase as any)
        .from("documentos")
        .update({ numero_factura: numeroFactura.trim() || null })
        .eq("id", row.documento_id);
      if (error) throw error;
      toast.success("Número de factura guardado");
      onRefetch();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "No se pudo guardar el número de factura");
    } finally {
      setSavingFactura(false);
    }
  };

  // ---- Resultado de la autorización (respuesta de Galper) ----
  const [margenTexto, setMargenTexto] = useState<string>(row.margen_reportado_texto || "");
  const [savingMargen, setSavingMargen] = useState(false);
  const [resultado, setResultado] = useState<"si" | "no" | "nc">(
    row.autorizado === true ? "si" : row.autorizado === false ? "no" : "nc"
  );
  const [autorizadoPor, setAutorizadoPor] = useState<string>(row.autorizado_por_texto || "");
  const [motivo, setMotivo] = useState<string>(row.motivo || "");
  const [savingResultado, setSavingResultado] = useState(false);
  const [editandoResultado, setEditandoResultado] = useState(false);
  const [posponiendo, setPosponiendo] = useState(false);

  useEffect(() => {
    setMargenTexto(row.margen_reportado_texto || "");
    setResultado(row.autorizado === true ? "si" : row.autorizado === false ? "no" : "nc");
    setAutorizadoPor(row.autorizado_por_texto || "");
    setMotivo(row.motivo || "");
    setEditandoResultado(false);
  }, [row.id, row.margen_reportado_texto, row.autorizado, row.autorizado_por_texto, row.motivo]);

  const resultadoCerrado =
    (row.estatus === "autorizado" || row.estatus === "rechazado") && !editandoResultado;

  const guardarMargen = async () => {
    setSavingMargen(true);
    try {
      const { error } = await (supabase as any)
        .from("documento_autorizaciones_precio")
        .update({
          margen_reportado_texto: margenTexto.trim() || null,
          margen_respondido_por: user?.email ?? null,
          margen_respondido_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (error) throw error;
      toast.success("Margen reportado guardado");
      onRefetch();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "No se pudo guardar el margen");
    } finally {
      setSavingMargen(false);
    }
  };

  const guardarResultado = async (override?: { resultado: "si" | "no" | "nc"; autorizadoPor?: string }) => {
    setSavingResultado(true);
    try {
      const res = override?.resultado ?? resultado;
      const quien = override?.autorizadoPor ?? autorizadoPor;
      const autorizado = res === "si" ? true : res === "no" ? false : null;
      const nuevoEstatus =
        resultado === "si" ? "autorizado" : resultado === "no" ? "rechazado" : "indeterminado";
      const { error } = await (supabase as any)
        .from("documento_autorizaciones_precio")
        .update({
          autorizado,
          autorizado_por_texto: autorizadoPor.trim() || null,
          motivo: motivo.trim() || null,
          autorizacion_respondido_at: new Date().toISOString(),
          estatus: nuevoEstatus,
        })
        .eq("id", row.id);
      if (error) throw error;

      if (autorizado === true && row.documento_id) {
        const { error: docErr } = await (supabase as any)
          .from("documentos")
          .update({ estatus_pedido: "precio_autorizado" })
          .eq("id", row.documento_id);
        if (docErr) throw docErr;
      }

      toast.success("Resultado de la autorización guardado");
      setEditandoResultado(false);
      queryClient.invalidateQueries({ queryKey: ["documentos"] });
      queryClient.invalidateQueries({ queryKey: ["documento", row.documento_id] });
      queryClient.invalidateQueries({ queryKey: ["pedido-autorizacion-precio", row.documento_id] });
      onRefetch();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "No se pudo guardar el resultado");
    } finally {
      setSavingResultado(false);
    }
  };

  const enviarMasTarde = async () => {
    setPosponiendo(true);
    try {
      if ((justificacion || "") !== (row.justificacion || "")) {
        await guardar();
      }
      const { error } = await (supabase as any)
        .from("documento_autorizaciones_precio")
        .update({ pospuesto: true, pospuesto_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) throw error;
      toast.success("Guardado, puedes enviarlo cuando quieras.");
      onRefetch();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "No se pudo posponer el envío");
    } finally {
      setPosponiendo(false);
    }
  };



  useEffect(() => {
    setDatos(datosIniciales());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id, row.datos_cliente_snapshot, companyRef.id]);



  const editable = row.estatus === "pendiente_revision";
  const doc = row.documentos || {};
  const company = doc.companies || {};
  const snapshot: any[] = Array.isArray(row.costo_margen_snapshot) ? row.costo_margen_snapshot : [];
  const hist = row.historico_snapshot || {};
  const meses: any[] = Array.isArray(hist.mesesRaw) ? hist.mesesRaw.slice(-6) : [];

  const { data: evidencias, refetch: refetchEvidencias } = useQuery({
    queryKey: ["autorizacion-evidencias", row.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("documento_autorizacion_evidencias")
        .select("id, storage_path, nombre_archivo")
        .eq("autorizacion_id", row.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const cambio = useMemo(
    () => (justificacion || "") !== (row.justificacion || ""),
    [justificacion, row.justificacion]
  );

  const guardar = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("documento_autorizaciones_precio")
        .update({ justificacion })
        .eq("id", row.id);
      if (error) throw error;
      toast.success("Justificación del documento actualizada");
      onRefetch();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const guardarEnPerfil = async () => {
    if (!company.id) return;
    setSavingPerfil(true);
    try {
      const { error } = await (supabase as any)
        .from("companies")
        .update({ justificacion_precio_default: justificacion || null })
        .eq("id", company.id);
      if (error) throw error;
      toast.success("Justificación de Precio guardada en el perfil del cliente");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "No se pudo guardar en el perfil del cliente");
    } finally {
      setSavingPerfil(false);
    }
  };

  const guardarDatos = async () => {
    setSavingDatos(true);
    try {
      const { error } = await (supabase as any)
        .from("documento_autorizaciones_precio")
        .update({ datos_cliente_snapshot: datos })
        .eq("id", row.id);
      if (error) throw error;
      toast.success("Clasificación y facturación actualizadas en este documento");
      onRefetch();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "No se pudo guardar");
    } finally {
      setSavingDatos(false);
    }
  };

  const guardarDatosEnPerfil = async () => {
    if (!company.id) return;
    setSavingDatosPerfil(true);
    try {
      const { error } = await (supabase as any)
        .from("companies")
        .update({
          industrias: datos.industrias || [],
          tipo_destino_lubricante: datos.tipo_destino_lubricante || null,
          lista_precios: datos.lista_precios || null,
          limite_credito: datos.limite_credito ?? 0,
          tipo_pago: datos.tipo_pago || null,
          forma_pago: datos.forma_pago || null,
          metodo_pago: datos.metodo_pago || null,
          uso_cfdi: datos.uso_cfdi || null,
        })
        .eq("id", company.id);
      if (error) throw error;
      toast.success("Datos guardados en el perfil del cliente");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "No se pudo guardar en el perfil del cliente");
    } finally {
      setSavingDatosPerfil(false);
    }
  };



  const verArchivo = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    if (error || !data?.signedUrl) {
      toast.error("No se pudo abrir el archivo");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const abrirCliente = async () => {
    if (!company.id) return;
    setLoadingCompany(true);
    try {
      const { data, error } = await (supabase as any)
        .from("companies")
        .select("*")
        .eq("id", company.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("No se encontró la empresa");
        return;
      }
      setCompanyEditData((data ?? null) as CompanyData);
      setCompanyDialogOpen(true);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "No se pudo cargar la empresa");
    } finally {
      setLoadingCompany(false);
    }
  };

  const subir = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const path = `${row.documento_id}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
        if (upErr) throw upErr;
        const { error: insErr } = await (supabase as any)
          .from("documento_autorizacion_evidencias")
          .insert({
            autorizacion_id: row.id,
            storage_path: path,
            nombre_archivo: file.name,
            subido_por: user?.id ?? null,
          });
        if (insErr) throw insErr;
      }
      toast.success("Evidencia cargada");
      refetchEvidencias();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "No se pudo subir la evidencia");
    } finally {
      setUploading(false);
    }
  };

  const abrirEnvio = async () => {
    setPreparing(true);
    try {
      const f = await buildAutorizacionPrecioEmailFlow(row.id);
      setFlow(f);
      setPreviewOpen(true);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "No se pudo preparar el correo");
    } finally {
      setPreparing(false);
    }
  };

  const marcarEnviado = async () => {
    try {
      const { error } = await (supabase as any)
        .from("documento_autorizaciones_precio")
        .update({
          estatus: "enviado",
          enviado_por: user?.id ?? null,
          enviado_at: new Date().toISOString(),
          asunto_enviado: flow?.subjectOverride ?? null,
        })
        .eq("id", row.id);
      if (error) throw error;
      toast.success("Correo enviado, pedido en espera de respuesta");
      onRefetch();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "No se pudo actualizar el estatus");
    }
  };

  const eliminarAutorizacion = async () => {
    setDeleting(true);
    try {
      const evidenciaPaths = (evidencias || [])
        .map((ev: any) => ev.storage_path)
        .filter(Boolean);

      if (evidenciaPaths.length > 0) {
        const { error: storageError } = await supabase.storage.from(BUCKET).remove(evidenciaPaths);
        if (storageError) console.warn("No se pudieron eliminar algunos archivos de evidencia:", storageError);
      }

      const { error: evidenciasError } = await (supabase as any)
        .from("documento_autorizacion_evidencias")
        .delete()
        .eq("autorizacion_id", row.id);
      if (evidenciasError) throw evidenciasError;

      const { error: autorizacionError } = await (supabase as any)
        .from("documento_autorizaciones_precio")
        .delete()
        .eq("id", row.id);
      if (autorizacionError) throw autorizacionError;

      if (row.documento_id) {
        const { error: documentoError } = await (supabase as any)
          .from("documentos")
          .update({ estatus_pedido: "confirmado_cliente" })
          .eq("id", row.documento_id)
          .eq("tipo_documento", "pedido");
        if (documentoError) throw documentoError;
      }

      toast.success("Autorización eliminada; el pedido volvió a Confirmado Cliente");
      setDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: ["documentos"] });
      queryClient.invalidateQueries({ queryKey: ["documento", row.documento_id] });
      queryClient.invalidateQueries({ queryKey: ["pedido-autorizacion-precio", row.documento_id] });
      queryClient.invalidateQueries({ queryKey: ["autorizacion-precio-dialog", row.documento_id] });
      onRefetch();
      onDeleted?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "No se pudo eliminar la autorización");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card
      id={row.id}
      className={[
        flash ? "ring-2 ring-blue-400 ring-offset-2 transition-all duration-300" : "",
        embedded ? "border-0 shadow-none" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <CollapsibleTrigger asChild>
                <Button size="icon" variant="ghost" className="h-6 w-6 mt-0.5" title={open ? "Colapsar" : "Expandir"}>
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <div>
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <CollapsibleTrigger asChild>
                    <button type="button" className="text-left hover:underline">
                      {company.name || "Sin cliente"}
                    </button>
                  </CollapsibleTrigger>
                  {company.id && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={abrirCliente}
                      disabled={loadingCompany}
                      title="Ver / editar cliente"
                    >
                      {loadingCompany ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ExternalLink className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{company.razon_social || "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Pedido {doc.numero_pedido || "—"} · {doc.fecha_documento ? formatDate(doc.fecha_documento) : "—"} ·{" "}
                  Ejecutivo: {ejecutivo || "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Ronda {row.ronda}</Badge>
              {row.estatus === "pendiente_revision" ? (
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Por revisar</Badge>
              ) : (
                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Enviado</Badge>
              )}
              {row.pospuesto && (
                <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pospuesto</Badge>
              )}

            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-6 pt-6">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Número de Factura
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={numeroFactura}
                  onChange={(e) => setNumeroFactura(e.target.value)}
                  placeholder="Ej. A-12345"
                  className="h-8 max-w-[220px] font-mono text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={guardarNumeroFactura}
                  disabled={savingFactura || (numeroFactura || "") === (doc.numero_factura || "")}
                >
                  {savingFactura && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                  Guardar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground font-light">
                Lo captura Atención a Clientes. Se guarda en el documento y se conserva cuando el pedido se
                convierte en factura.
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Productos</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Precio venta</TableHead>
                    <TableHead className="text-right">Costo (CRM)</TableHead>
                    <TableHead className="text-right">Margen % (CRM)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshot.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{l.codigo || "—"}</TableCell>
                      <TableCell className="text-sm">{l.descripcion || "—"}</TableCell>
                      <TableCell className="text-right">{numFmt(l.cantidad)}</TableCell>
                      <TableCell className="text-right">{money(l.precio_unitario)}</TableCell>
                      <TableCell className="text-right">
                        {l.costo === null || l.costo === undefined ? "—" : money(l.costo)}
                      </TableCell>
                      <TableCell className="text-right">
                        {l.margen_porcentaje === null || l.margen_porcentaje === undefined
                          ? "—"
                          : `${l.margen_porcentaje}%`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Histórico</p>
              {meses.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Sin historial de facturación</p>
              ) : (
                <ul className="text-sm space-y-0.5">
                  {meses.map((m: any) => (
                    <li key={m.mes}>
                      {(() => {
                        const [y, mm] = String(m.mes).split("-");
                        const d = new Date(Number(y), Number(mm) - 1, 1);
                        return `${d.toLocaleString("es-MX", { month: "long" }).toUpperCase()} ${y}`;
                      })()}
                      : {numFmt(m.unidades)} unidades
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Acumulado desde {hist.fechaDesde || "—"}: {numFmt(hist.acumuladoUnidades)} · Promedio mensual:{" "}
                {numFmt(hist.promedioMensual)}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Justificación de Precio</p>
              <DictationTextarea
                value={justificacion}
                onChange={(v) => setJustificacion(v)}
                rows={6}
                disabled={!editable}
                className="font-light"
                placeholder="Justificación de Precio del cliente (se precarga desde el perfil de la empresa)"
              />
              {editable && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={guardar} disabled={!cambio || saving}>
                    {saving && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                    Guardar en este documento
                  </Button>
                  {company.id && (
                    <Button size="sm" variant="secondary" onClick={guardarEnPerfil} disabled={savingPerfil}>
                      {savingPerfil ? (
                        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      ) : (
                        <Building2 className="h-3 w-3 mr-2" />
                      )}
                      Guardar en el perfil del cliente
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3 border-t pt-4">
              <AutorizacionDatosClienteBlock
                value={datos}
                onChange={setDatos}
                disabled={!editable}
              />
              {editable && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={guardarDatos} disabled={savingDatos}>
                    {savingDatos && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                    Guardar solo en este documento
                  </Button>
                  {company.id && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={guardarDatosEnPerfil}
                      disabled={savingDatosPerfil}
                    >
                      {savingDatosPerfil ? (
                        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      ) : (
                        <Building2 className="h-3 w-3 mr-2" />
                      )}
                      Guardar en el perfil del cliente
                    </Button>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Estos datos se envían en el correo de autorización. Guárdalos solo en el documento o
                también en el perfil del cliente para futuros pedidos.
              </p>
            </div>


            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Evidencia</p>
              {(evidencias || []).length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Sin evidencia adjunta</p>
              ) : (
                <ul className="space-y-1">
                  {(evidencias || []).map((ev: any) => (
                    <li key={ev.id} className="flex items-center gap-2 text-sm">
                      <span className="truncate max-w-[280px]">{ev.nombre_archivo}</span>
                      <Button size="sm" variant="ghost" onClick={() => verArchivo(ev.storage_path)}>
                        <Eye className="h-3 w-3 mr-1" /> Ver
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {editable && (
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    multiple
                    disabled={uploading}
                    onChange={(e) => {
                      subir(e.target.files);
                      e.target.value = "";
                    }}
                    className="max-w-sm"
                  />
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Resultado de la autorización
              </p>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Margen reportado
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={margenTexto}
                    onChange={(e) => setMargenTexto(e.target.value)}
                    placeholder="Ej. 16%"
                    className="h-8 max-w-[160px] text-sm"
                  />
                  <Button size="sm" variant="outline" onClick={guardarMargen} disabled={savingMargen}>
                    {savingMargen && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                    Guardar margen
                  </Button>
                  {row.margen_respondido_por && (
                    <span className="text-xs text-muted-foreground font-light">
                      Registrado por {row.margen_respondido_por}
                    </span>
                  )}
                </div>
              </div>

              {resultadoCerrado ? (
                <div className="space-y-1 text-sm font-light">
                  <p>
                    <span className="text-muted-foreground">Resultado:</span>{" "}
                    {row.autorizado === true ? "Autorizado" : "Rechazado"}
                    {row.autorizado_por_texto ? ` por ${row.autorizado_por_texto}` : ""}
                  </p>
                  {row.motivo && (
                    <p>
                      <span className="text-muted-foreground">Motivo:</span> {row.motivo}
                    </p>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setEditandoResultado(true)}>
                    Editar
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      ¿Se autorizó el precio?
                    </Label>
                    <RadioGroup
                      value={resultado}
                      onValueChange={(v) => setResultado(v as "si" | "no" | "nc")}
                      className="flex flex-wrap gap-4"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="si" id={`res-si-${row.id}`} />
                        <Label htmlFor={`res-si-${row.id}`} className="font-light">Sí</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="no" id={`res-no-${row.id}`} />
                        <Label htmlFor={`res-no-${row.id}`} className="font-light">No</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="nc" id={`res-nc-${row.id}`} />
                        <Label htmlFor={`res-nc-${row.id}`} className="font-light">No está claro</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Autorizado/rechazado por
                    </Label>
                    <Input
                      value={autorizadoPor}
                      onChange={(e) => setAutorizadoPor(e.target.value)}
                      placeholder="Ej. José Tostado"
                      className="h-8 max-w-[280px] text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Motivo {resultado === "no" ? "" : "(opcional)"}
                    </Label>
                    <Textarea
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      rows={3}
                      className="text-sm font-light"
                      placeholder="Motivo de la decisión"
                    />
                  </div>

                  <Button size="sm" onClick={guardarResultado} disabled={savingResultado}>
                    {savingResultado && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                    Guardar resultado
                  </Button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Trash2 className="h-3 w-3 mr-2" />}
                Eliminar autorización
              </Button>
              {editable && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" onClick={enviarMasTarde} disabled={posponiendo || saving}>
                    {posponiendo ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Clock className="h-4 w-4 mr-2" />}
                    Enviar más tarde
                  </Button>
                  <Button onClick={abrirEnvio} disabled={preparing}>
                    {preparing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Enviar
                  </Button>
                </div>
              )}

            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta autorización?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará esta solicitud y sus evidencias. El documento regresará a Confirmado Cliente para poder reiniciar el proceso desde el pedido o desde la cotización.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                eliminarAutorizacion();
              }}
            >
              {deleting ? "Eliminando..." : "Eliminar y reiniciar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {flow && (
        <EnviarConfirmacionPagoDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          pagoId={row.id}
          empresa={company.name || ""}
          fechaPago={doc.fecha_documento || ""}
          montoTotal=""
          moneda=""
          documentos={[]}
          comprobantes={flow.comprobantes}
          defaultEmails={flow.defaultEmails}
          blockedEmails={[]}
          previouslySentEmails={flow.previouslySentEmails}
          templateName={flow.templateName}
          subjectOverride={flow.subjectOverride}
          htmlOverride={flow.htmlOverride}
          ccEmails={flow.cc}
          bccEmails={flow?.bcc}
          fromAddress={flow?.fromAddress}
          title={flow.title}
          description={flow.description}
          onSent={marcarEnviado}
        />
      )}

      <CompanyFormDialog
        open={companyDialogOpen}
        onOpenChange={(open) => {
          setCompanyDialogOpen(open);
          if (!open) {
            setCompanyEditData(null);
            onRefetch();
          }
        }}
        editData={companyEditData}
      />
    </Card>
  );
}
