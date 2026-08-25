import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatters";
import { Clock, Send, CheckCircle2, XCircle, HelpCircle } from "lucide-react";

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

export default function PedidoAccionesPanel({ documentoId }: { documentoId: string }) {
  const { data: fila } = useQuery({
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

  if (!fila) return null;

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
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${config.iconColor}`} />
          <div>
            <p className={`text-sm font-medium ${config.text}`}>{mensaje}</p>
            {fila.margen_reportado_texto && (
              <p className="mt-1 text-xs text-muted-foreground">{fila.margen_reportado_texto}</p>
            )}
          </div>
        </div>
        <Button size="sm" variant="outline" asChild className="shrink-0 self-start sm:self-center">
          <Link to={`/autorizacion-precios?id=${fila.id}`} target="_self">
            {fila.estatus === "pendiente_revision" ? "Ver en Autorización de Precios" : "Ver detalle"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
