import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Convierte un string de fecha proveniente de la BD o de un input en un Date
 * local correcto:
 *  - "YYYY-MM-DD"        → medianoche LOCAL (evita mostrar el día anterior)
 *  - "YYYY-MM-DDTHH:mm"  → hora LOCAL (sin desplazamiento a UTC)
 *  - ISO con zona horaria → tal cual
 */
export function parseLocalDate(date: string | Date | null | undefined): Date {
  if (date instanceof Date) return date;
  if (!date) return new Date(NaN);
  const s = String(date).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [, y, mo, d, hh, mi, ss] = m;
    return new Date(Number(y), Number(mo) - 1, Number(d), Number(hh ?? 0), Number(mi ?? 0), Number(ss ?? 0));
  }
  return new Date(s);
}

/**
 * Convierte el valor de un <input type="date"|"datetime-local"> (hora local)
 * a un ISO string con la zona horaria correcta para guardar en columnas
 * `timestamptz`. Sin esto, Postgres interpreta la hora como UTC (desfase de horas).
 */
export function localInputToIso(value?: string | null): string | null {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  // Ya trae zona horaria explícita
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(s)) return s;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s);
  const d = parseLocalDate(s);
  if (Number.isNaN(d.getTime())) return null;
  // Para fechas sin hora usamos mediodía local: evita saltos de día por zona horaria
  if (dateOnly) d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

export function formatRelativeDate(date: string | Date): string {
  return formatDistanceToNow(parseLocalDate(date), { addSuffix: true, locale: es });
}

export function formatDate(date: string | Date): string {
  return format(parseLocalDate(date), "d MMM yyyy", { locale: es });
}


/**
 * Formato "Abril 2026" a partir de un string YYYY-MM o de una fecha.
 */
export function formatMonthYear(input: string | Date | null | undefined): string {
  if (!input) return "";
  let d: Date;
  if (typeof input === "string" && /^\d{4}-\d{2}$/.test(input)) {
    const [y, m] = input.split("-").map(Number);
    d = new Date(y, m - 1, 1);
  } else {
    d = new Date(input as any);
  }
  if (Number.isNaN(d.getTime())) return "";
  const s = format(d, "LLLL yyyy", { locale: es });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Devuelve el último día del mes (YYYY-MM-DD) dado un string YYYY-MM.
 */
export function lastDayOfMonth(mesYYYYMM: string | null | undefined): string | null {
  if (!mesYYYYMM || !/^\d{4}-\d{2}$/.test(mesYYYYMM)) return null;
  const [y, m] = mesYYYYMM.split("-").map(Number);
  const last = new Date(y, m, 0); // day 0 of next month = last day of current
  const yyyy = last.getFullYear();
  const mm = String(last.getMonth() + 1).padStart(2, "0");
  const dd = String(last.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
