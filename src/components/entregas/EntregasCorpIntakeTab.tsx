import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, FileText, Image as ImageIcon, Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/formatters";

type IntakeRow = {
  id: string;
  canal: string | null;
  remitente_email: string | null;
  asunto_email: string | null;
  storage_path: string | null;
  mime_type: string | null;
  email_html_storage_path: string | null;
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

function IntakeCard({ row, onChanged }: { row: IntakeRow; onChanged: () => void }) {
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [emailPreviewHtml, setEmailPreviewHtml] = useState<string | null>(null);
  const [loadingEmailPreview, setLoadingEmailPreview] = useState(false);
  const [descartando, setDescartando] = useState(false);
  const emailIframeRef = useRef<HTMLIFrameElement>(null);

  const lineas: EntregaLinea[] = Array.isArray(row.entregas_extraidas) ? row.entregas_extraidas : [];
  const esImagen = (row.mime_type || "").startsWith("image/");

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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineas.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{l.codigo || "—"}</TableCell>
                    <TableCell>{l.nombre_producto || "—"}</TableCell>
                    <TableCell>{l.fecha || "—"}</TableCell>
                    <TableCell className="text-right">{l.cantidad ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">Sin productos/fechas detectados</p>
          )}

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
          "id, canal, remitente_email, asunto_email, storage_path, mime_type, email_html_storage_path, cliente_detectado, lugar_entrega_detectado, numero_pedido_detectado, entregas_extraidas, extraccion_error, created_at"
        )
        .eq("estatus", "pendiente")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as IntakeRow[];
    },
  });

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
        <IntakeCard key={row.id} row={row} onChanged={() => refetch()} />
      ))}
    </div>
  );
}
