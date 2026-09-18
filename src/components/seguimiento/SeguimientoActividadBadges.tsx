import { Badge } from "@/components/ui/badge";
import { CalendarClock, CheckCircle2 } from "lucide-react";

interface Props {
  diasUltimaActividad: number | null | undefined;
  actividadesTotal: number | null | undefined;
  proximaTareaFecha: string | null | undefined;
}

function formatShortDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

/**
 * Badges de seguimiento junto al pill de estatus.
 * No altera el cálculo del estatus: solo lee columnas ya calculadas
 * (dias_ultima_actividad, actividades_total, proxima_tarea_fecha).
 */
export function SeguimientoActividadBadges({ diasUltimaActividad, actividadesTotal, proximaTareaFecha }: Props) {
  const gestionado = (actividadesTotal ?? 0) > 0 || diasUltimaActividad != null;

  const tareaVencida = (() => {
    if (!proximaTareaFecha) return false;
    const d = new Date(proximaTareaFecha);
    if (Number.isNaN(d.getTime())) return false;
    const hoy = new Date();
    const startHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const startDia = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return startDia < startHoy;
  })();

  if (!gestionado && !proximaTareaFecha) return null;

  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {gestionado && (
        <Badge
          variant="outline"
          className="text-[10px] font-normal px-1.5 py-0 h-4 gap-0.5 border-emerald-200 bg-emerald-50/70 text-emerald-700 whitespace-nowrap"
        >
          <CheckCircle2 className="h-2.5 w-2.5" />
          {diasUltimaActividad == null
            ? "Gestionado"
            : diasUltimaActividad === 0
            ? "Gestionado hoy"
            : `Gestionado hace ${diasUltimaActividad}d`}
        </Badge>
      )}
      {proximaTareaFecha && (
        <Badge
          variant="outline"
          className={`text-[10px] font-normal px-1.5 py-0 h-4 gap-0.5 whitespace-nowrap ${
            tareaVencida
              ? "border-amber-300 bg-amber-50 text-amber-800"
              : "border-sky-200 bg-sky-50/70 text-sky-700"
          }`}
        >
          <CalendarClock className="h-2.5 w-2.5" />
          Próxima: {formatShortDate(proximaTareaFecha)}
        </Badge>
      )}
    </span>
  );
}
