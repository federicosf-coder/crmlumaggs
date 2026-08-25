import { Link } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatters";
import { Clock, Send, CheckCircle2, XCircle, HelpCircle, FileCheck2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { buildAutorizacionPrecioDraft, buildAutorizacionPrecioEmailFlow } from "@/lib/autorizacionPrecioFlow";
import { EnviarConfirmacionPagoDialog } from "@/components/cobranza/EnviarConfirmacionPagoDialog";
import AutorizacionPrecioDialog from "./AutorizacionPrecioDialog";
import { useQueryClient } from "@tanstack/react-query";

interface AutorizacionFila {
  id: string;
  estatus: string;
  enviado_at: string | null;
  autorizado: boolean | null;
  autorizado_por_texto: string | null;
  motivo: string | null;
  margen_reportado_texto: string | null;
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; label: string; border: string; bg: string; text: string; iconColor: string }> = {
  pendiente_revision: {
    icon: Clock,
    label: "Autorización de precio lista para enviar — está esperando revisión de Atención a Clientes.",
    border: "border-amber-300",
    bg: "bg-amber-50",
    text: "text-amber-900",
    iconColor: "text-amber-600",
  },
  enviado: {
    icon: Send,
    label: "",
    border: "border-blue-300",
    bg: "bg-blue-50",
    text: "text-blue-900",
    iconColor: "text-blue-600",
  },
  autorizado: {
    icon: CheckCircle2,
    label: "",
    border: "border-emerald-300",
    bg: "bg-emerald-50",
    text: "text-emerald-900",
    iconColor: "text-emerald-600",
  },
  rechazado: {
    icon: XCircle,
    label: "",
    border: "border-red-300",
    bg: "bg-red-50",
    text: "text-red-900",
    iconColor: "text-red-600",
  },
  indeterminado: {
    icon: HelpCircle,
    label: "Llegó una respuesta pero no fue clara — revisa el hilo manualmente.",
    border: "border-slate-300",
    bg: "bg-slate-50",
    text: "text-slate-900",
    iconColor: "text-slate-600",
  },
};

export default function PedidoAccionesPanel({
  documentoId,
  onSolicitada,
}: {
  documentoId: string;
  onSolicitada?: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [creando, setCreando] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFlow, setPreviewFlow] = useState<any>(null);
  const [preparing, setPreparing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const { data: fila, refetch } = useQuery({
    queryKey: ["pedido-autorizacion-precio", documentoId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("documento_autorizaciones_precio")
        .select("id, estatus, enviado_at, autorizado, autorizado_por_texto, motivo, margen_reportado_texto")
        .eq("documento_id", documentoId)
        .order("ronda", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as AutorizacionFila | null;
    },
    enabled: !!documentoId,
  });

  const abrirEnvio = async (filaId: string) => {
    setPreparing(true);
    try {
      const f = await buildAutorizacionPrecioEmailFlow(filaId);
      setPreviewFlow(f);
      setPreviewOpen(true);
    } catch (e: any) {
      toast.error(e.message || "No se pudo preparar el correo");
    } finally {
      setPreparing(false);
    }
  };

  const marcarEnviado = async (filaId: string) => {
    try {
      const { error } = await (supabase as any)
        .from("documento_autorizaciones_precio")
        .update({
          estatus: "enviado",
          enviado_por: user?.id ?? null,
          enviado_at: new Date().toISOString(),
          asunto_enviado: previewFlow?.subjectOverride ?? null,
        })
        .eq("id", filaId);
      if (error) throw error;
      toast.success("Correo enviado, pedido en espera de respuesta");
      qc.invalidateQueries({ queryKey: ["pedido-autorizacion-precio", documentoId] });
    } catch (e: any) {
      toast.error(e.message || "No se pudo actualizar el estatus");
    }
  };

  const solicitarAutorizacion = async () => {
    setCreando(true);
    try {
      await buildAutorizacionPrecioDraft(documentoId, user?.id ?? null);
      await (supabase as any)
        .from("documentos")
        .update({ estatus_pedido: "espera_autorizacion_precio" })
        .eq("id", documentoId);
      await refetch();
      toast.success("Autorización de precio creada");
      onSolicitada?.();
    } catch (err: any) {
      toast.error(`No se pudo crear la autorización: ${err.message}`);
    } finally {
      setCreando(false);
    }
  };

  if (!fila) {
    return (
      <Card className="mb-4 border border-slate-300 bg-slate-50">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />
            <p className="text-sm font-medium text-slate-900">
              Este pedido no tiene autorización de precio. Puedes solicitarla ahora.
            </p>
          </div>
          <Button size="sm" onClick={solicitarAutorizacion} disabled={creando} className="shrink-0 self-start sm:self-center">
            {creando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Solicitar autorización de precio
          </Button>
        </CardContent>
      </Card>
    );
  }

  const config = STATUS_CONFIG[fila.estatus] || STATUS_CONFIG.indeterminado;
  const Icon = config.icon;

  let mensaje = config.label;
  if (fila.estatus === "enviado") {
    const fecha = fila.enviado_at ? formatDate(fila.enviado_at) : "—";
    mensaje = `Autorización de precio enviada el ${fecha} — esperando respuesta de Galper (Lizbeth / José Tostado).`;
  } else if (fila.estatus === "autorizado") {
    mensaje = `Precio autorizado${fila.autorizado_por_texto ? " por " + fila.autorizado_por_texto : ""}.`;
  } else if (fila.estatus === "rechazado") {
    mensaje = `Precio rechazado${fila.motivo ? ": " + fila.motivo : ""}. Puede reabrirse desde Atención a Clientes.`;
  }

  return (
    <Card className={`mb-4 border ${config.border} ${config.bg}`}>
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
        {fila.estatus === "pendiente_revision" ? (
          <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <FileCheck2 className="mr-2 h-4 w-4" />
              Abrir formulario de autorización
            </Button>
            <Button size="sm" variant="ghost" asChild className="text-xs">
              <Link to={`/autorizacion-precios?id=${fila.id}`} target="_self">
                Ver en Autorización de Precios
              </Link>
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" asChild className="shrink-0 self-start sm:self-center">
            <Link to={`/autorizacion-precios?id=${fila.id}`} target="_self">
              Ver detalle
            </Link>
          </Button>
        )}
        <div className="flex items-start gap-3">
          <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${config.iconColor}`} />
          <div>
            <p className={`text-sm font-medium ${config.text}`}>{mensaje}</p>
            {fila.margen_reportado_texto && (
              <p className="mt-1 text-xs text-muted-foreground">{fila.margen_reportado_texto}</p>
            )}
          </div>
        </div>
      </CardContent>

      <AutorizacionPrecioDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) {
            refetch();
            qc.invalidateQueries({ queryKey: ["pedido-autorizacion-precio", documentoId] });
          }
        }}
        documentoId={documentoId}
      />

      {previewFlow && (
        <EnviarConfirmacionPagoDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          pagoId={fila.id}
          empresa=""
          fechaPago=""
          montoTotal=""
          moneda=""
          documentos={[]}
          comprobantes={previewFlow.comprobantes}
          defaultEmails={previewFlow.defaultEmails}
          blockedEmails={[]}
          previouslySentEmails={previewFlow.previouslySentEmails}
          templateName={previewFlow.templateName}
          subjectOverride={previewFlow.subjectOverride}
          htmlOverride={previewFlow.htmlOverride}
          ccEmails={previewFlow.cc}
          bccEmails={previewFlow?.bcc}
          fromAddress={previewFlow?.fromAddress}
          title={previewFlow.title}
          description={previewFlow.description}
          onSent={() => marcarEnviado(fila.id)}
        />
      )}
    </Card>
  );
}
