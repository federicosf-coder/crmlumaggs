import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, BadgeDollarSign, Eye, Send, Upload, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/formatters";
import { EnviarConfirmacionPagoDialog } from "@/components/cobranza/EnviarConfirmacionPagoDialog";
import { buildAutorizacionPrecioEmailFlow } from "@/lib/autorizacionPrecioFlow";
import { CompanyFormDialog, type CompanyData } from "@/components/CompanyFormDialog";

const BUCKET = "autorizacion-precios";

const money = (v: number | null | undefined) =>
  v === null || v === undefined
    ? "—"
    : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(v));

const numFmt = (v: any) => new Intl.NumberFormat("es-MX").format(Number(v || 0));

type Autorizacion = any;

export default function AutorizacionPrecios() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["autorizaciones-precio"],
    queryFn: async () => {
      const { data: rows, error } = await (supabase as any)
        .from("documento_autorizaciones_precio")
        .select(
          "id, documento_id, ronda, estatus, justificacion, costo_margen_snapshot, historico_snapshot, created_at, enviado_at, documentos(id, numero_pedido, fecha_documento, ejecutivo_venta_id, companies(id, name, razon_social))"
        )
        .in("estatus", ["pendiente_revision", "enviado"])
        .order("created_at", { ascending: true });
      if (error) throw error;

      const ids = Array.from(
        new Set((rows || []).map((r: any) => r.documentos?.ejecutivo_venta_id).filter(Boolean))
      );
      let mapa: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await (supabase as any)
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", ids);
        mapa = Object.fromEntries((profs || []).map((p: any) => [p.user_id, p.full_name]));
      }
      return { rows: (rows || []) as Autorizacion[], ejecutivos: mapa };
    },
  });

  const rows = data?.rows || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <BadgeDollarSign className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Autorización de Precios</h1>
          <p className="text-sm text-muted-foreground">
            Revisa, documenta y envía las solicitudes de autorización de precio.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay pedidos pendientes de autorización de precio.
          </CardContent>
        </Card>
      ) : (
        rows.map((row) => (
          <AutorizacionCard
            key={row.id}
            row={row}
            ejecutivo={row.documentos?.ejecutivo_venta_id ? data?.ejecutivos?.[row.documentos.ejecutivo_venta_id] : null}
            onRefetch={refetch}
          />
        ))
      )}
    </div>
  );
}

function AutorizacionCard({
  row,
  ejecutivo,
  onRefetch,
}: {
  row: Autorizacion;
  ejecutivo?: string | null;
  onRefetch: () => void;
}) {
  const { user } = useAuth();
  const [justificacion, setJustificacion] = useState<string>(row.justificacion || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [flow, setFlow] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [companyEditData, setCompanyEditData] = useState<CompanyData | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(false);

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

  const cambio = useMemo(() => (justificacion || "") !== (row.justificacion || ""), [justificacion, row.justificacion]);

  const guardar = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("documento_autorizaciones_precio")
        .update({ justificacion })
        .eq("id", row.id);
      if (error) throw error;

      if (company.id) {
        const { data: comp } = await (supabase as any)
          .from("companies")
          .select("justificacion_precio_default")
          .eq("id", company.id)
          .maybeSingle();
        const defaultJust = (comp?.justificacion_precio_default as string | null) ?? "";
        if ((justificacion || "") !== defaultJust) {
          const sync = window.confirm(
            "¿También quieres actualizar la justificación guardada en el perfil de este cliente para futuros pedidos?"
          );
          if (sync) {
            const { error: updErr } = await (supabase as any)
              .from("companies")
              .update({ justificacion_precio_default: justificacion || null })
              .eq("id", company.id);
            if (updErr) throw updErr;
            toast.success("Justificación del perfil actualizada");
          }
        }
      }

      toast.success("Justificación actualizada");
      onRefetch();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "No se pudo guardar");
    } finally {
      setSaving(false);
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

  return (
    <Card>
      <CardHeader className="bg-gradient-to-r from-violet-50 to-blue-50 border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-medium">{company.name || "Sin cliente"}</CardTitle>
            <p className="text-xs text-muted-foreground">{company.razon_social || "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Pedido {doc.numero_pedido || "—"} · {doc.fecha_documento ? formatDate(doc.fecha_documento) : "—"} ·{" "}
              Ejecutivo: {ejecutivo || "—"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Ronda {row.ronda}</Badge>
            {row.estatus === "pendiente_revision" ? (
              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Por revisar</Badge>
            ) : (
              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Enviado</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
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
                  <TableCell className="text-right">{l.costo === null || l.costo === undefined ? "—" : money(l.costo)}</TableCell>
                  <TableCell className="text-right">
                    {l.margen_porcentaje === null || l.margen_porcentaje === undefined ? "—" : `${l.margen_porcentaje}%`}
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
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Justificación</p>
          <Textarea
            value={justificacion}
            onChange={(e) => setJustificacion(e.target.value)}
            rows={6}
            disabled={!editable}
            className="font-light"
          />
          {editable && (
            <Button size="sm" variant="outline" onClick={guardar} disabled={!cambio || saving}>
              {saving && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
              Guardar cambios
            </Button>
          )}
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

        {editable && (
          <div className="flex justify-end border-t pt-4">
            <Button onClick={abrirEnvio} disabled={preparing}>
              {preparing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar
            </Button>
          </div>
        )}
      </CardContent>

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
          title={flow.title}
          description={flow.description}
          onSent={marcarEnviado}
        />
      )}
    </Card>
  );
}
