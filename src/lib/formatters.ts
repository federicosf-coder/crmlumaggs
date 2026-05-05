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

export function formatRelativeDate(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });
}

export function formatDate(date: string | Date): string {
  // Parse YYYY-MM-DD as local date to avoid timezone shifts (e.g. UTC midnight → previous day).
  let d: Date;
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, day] = date.split("-").map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(date as any);
  }
  return format(d, "d MMM yyyy", { locale: es });
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
