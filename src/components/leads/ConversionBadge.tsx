import { Badge } from "@/components/ui/badge";
import { ESTADO_COMERCIAL_LABEL, type EstadoComercial } from "@/hooks/useLeadConversion";

const CLS: Record<EstadoComercial | "cliente", string> = {
  prospecto: "bg-slate-100 text-slate-700 border-slate-200",
  convertido: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cliente_previo: "bg-sky-100 text-sky-800 border-sky-200",
  desconocido: "bg-amber-50 text-amber-800 border-amber-200",
  cliente: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export function ConversionBadge({ estado, title }: { estado: EstadoComercial | "cliente"; title?: string }) {
  return (
    <Badge variant="outline" className={`text-[10px] font-normal ${CLS[estado]}`} title={title ?? "Conversión a nivel empresa"}>
      {estado === "cliente" ? "Cliente" : ESTADO_COMERCIAL_LABEL[estado]}
    </Badge>
  );
}
