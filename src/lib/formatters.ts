import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatRelativeDate(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), "d MMM yyyy", { locale: es });
}
