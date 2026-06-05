import { Badge } from "@/components/ui/badge";

/**
 * Badge unificado para `estado_cobranza` (mismos colores/labels que el módulo de Cobranza).
 * No recalcula nada: solo presenta el valor recibido.
 */
const LABEL: Record<string, string> = {
  pendiente: "Vigente",
  vigente: "Vigente",
  parcial: "Parcial",
  pagada: "Pagada",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

const CLASS: Record<string, string> = {
  pendiente: "bg-blue-500 text-white hover:bg-blue-500/90 border-transparent",
  vigente: "bg-blue-500 text-white hover:bg-blue-500/90 border-transparent",
  parcial: "bg-amber-500 text-white hover:bg-amber-500/90 border-transparent",
  pagada: "bg-green-600 text-white hover:bg-green-600/90 border-transparent",
  vencida: "bg-red-600 text-white hover:bg-red-600/90 border-transparent",
  cancelada: "bg-gray-400 text-white hover:bg-gray-400/90 border-transparent",
};

export function EstadoCobranzaBadge({ value }: { value: string | null | undefined }) {
  const key = (value || "vigente").toLowerCase();
  return <Badge className={CLASS[key] || CLASS.vigente}>{LABEL[key] || "Vigente"}</Badge>;
}