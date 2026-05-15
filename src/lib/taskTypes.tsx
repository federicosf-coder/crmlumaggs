import { Phone, Mail, CalendarCheck, Car, MessageCircle, Banknote, RefreshCw, FileText } from "lucide-react";

export type TaskTypeKey =
  | "call" | "email" | "meeting" | "field_visit"
  | "whatsapp" | "cobranza" | "follow_up" | "note";

export interface TaskTypeMeta {
  key: TaskTypeKey;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  /** Clases para botones/badges no seleccionados (suaves) */
  soft: string;
  /** Clases para estado seleccionado (saturado) */
  active: string;
  /** Color del icono cuando se muestra suelto */
  iconColor: string;
}

export const TASK_TYPES: TaskTypeMeta[] = [
  { key: "call",        label: "Llamada",     Icon: Phone,
    soft:   "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
    active: "bg-blue-600 text-white border-blue-600 hover:bg-blue-600",
    iconColor: "text-blue-600" },
  { key: "email",       label: "Email",       Icon: Mail,
    soft:   "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100",
    active: "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-600",
    iconColor: "text-indigo-600" },
  { key: "meeting",     label: "Reunión",     Icon: CalendarCheck,
    soft:   "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
    active: "bg-purple-600 text-white border-purple-600 hover:bg-purple-600",
    iconColor: "text-purple-600" },
  { key: "field_visit", label: "Visita",      Icon: Car,
    soft:   "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
    active: "bg-orange-600 text-white border-orange-600 hover:bg-orange-600",
    iconColor: "text-orange-600" },
  { key: "whatsapp",    label: "WhatsApp",    Icon: MessageCircle,
    soft:   "bg-green-50 text-green-700 border-green-200 hover:bg-green-100",
    active: "bg-green-600 text-white border-green-600 hover:bg-green-600",
    iconColor: "text-green-600" },
  { key: "cobranza",    label: "Cobranza",    Icon: Banknote,
    soft:   "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
    active: "bg-amber-600 text-white border-amber-600 hover:bg-amber-600",
    iconColor: "text-amber-600" },
  { key: "follow_up",   label: "Seguimiento", Icon: RefreshCw,
    soft:   "bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100",
    active: "bg-cyan-600 text-white border-cyan-600 hover:bg-cyan-600",
    iconColor: "text-cyan-600" },
  { key: "note",        label: "Nota",        Icon: FileText,
    soft:   "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200",
    active: "bg-slate-700 text-white border-slate-700 hover:bg-slate-700",
    iconColor: "text-slate-600" },
];

export const TASK_TYPE_META: Record<TaskTypeKey, TaskTypeMeta> = TASK_TYPES.reduce((acc, t) => {
  acc[t.key] = t;
  return acc;
}, {} as Record<TaskTypeKey, TaskTypeMeta>);

export const TASK_TYPE_LABEL: Record<TaskTypeKey, string> = TASK_TYPES.reduce((acc, t) => {
  acc[t.key] = t.label;
  return acc;
}, {} as Record<TaskTypeKey, string>);