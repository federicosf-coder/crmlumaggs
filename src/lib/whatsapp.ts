// WhatsApp helpers: phone normalization, template rendering, wa.me link, log activity.
import { supabase } from "@/integrations/supabase/client";

export type WhatsAppTemplateType =
  | "seguimiento_cotizacion" | "recompra" | "expansion" | "prospecto" | "cobranza" | "entrega" | "general";

export interface WhatsAppMessageTemplate {
  id: string;
  nombre: string;
  tipo: WhatsAppTemplateType;
  mensaje: string;
  meta_template_id: string | null;
  activo: boolean;
  orden: number;
}

export interface WhatsAppVariables {
  contacto_nombre?: string | null;
  empresa_nombre?: string | null;
  empresa_vendedora?: string | null;
  producto_categoria?: string | null;
  folio_cotizacion?: string | null;
  total_cotizacion?: string | null;
  fecha_vencimiento?: string | null;
  ejecutivo_nombre?: string | null;
}

/** Strip non-digits, ensure +52 default for MX 10-digit numbers. */
export function normalizePhoneForWhatsApp(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // already includes country code (>= 11 digits), use as-is
  if (digits.length >= 11) return digits;
  // 10-digit MX number, prepend 52
  if (digits.length === 10) return `52${digits}`;
  return digits;
}

/** Replace {{var}} occurrences. Missing vars become "[var]" placeholder. */
export function renderTemplate(template: string, vars: WhatsAppVariables): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key) => {
    const v = (vars as any)[key];
    return v != null && v !== "" ? String(v) : `[${key}]`;
  });
}

export function buildWaMeLink(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/** Open WhatsApp Web/App in a new tab. */
export function openWhatsApp(phone: string, message: string) {
  window.open(buildWaMeLink(phone, message), "_blank", "noopener");
}

/** Copy message to clipboard. */
export async function copyMessage(message: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(message);
    return true;
  } catch {
    return false;
  }
}

/** Log a WhatsApp activity into crm_activities (reuses existing table). */
export async function logWhatsAppActivity(params: {
  user_id: string;
  message: string;
  company_id?: string | null;
  contact_id?: string | null;
  result?: "enviado" | "respondido" | "sin_respuesta" | "pendiente";
  title?: string;
  /** id del documento (cotización/pedido/factura) si aplica */
  documento_id?: string | null;
  /** teléfono destinatario en formato internacional sin '+' */
  destinatario_phone?: string | null;
  /** texto | plantilla | media | otro */
  message_type?: string | null;
  /** "api" cuando se envía por whatsapp-send-message; "wa_me" cuando se abre wa.me */
  channel?: "api" | "wa_me" | null;
  /** id del mensaje devuelto por Meta */
  wa_message_id?: string | null;
  /** id de la conversación de WhatsApp si existe */
  wa_conversation_id?: string | null;
}) {
  // Para envíos por wa.me solo guardamos metadata mínima (sin el texto completo).
  const isWaMe = params.channel === "wa_me";
  const description = isWaMe
    ? `Mensaje ${params.message_type ?? "texto"} enviado por WhatsApp (wa.me) a ${params.destinatario_phone ?? "—"}`
    : params.message;
  const payload: Record<string, unknown> = {
    user_id: params.user_id,
    type: "whatsapp",
    title: params.title || `WhatsApp · ${params.result || "enviado"}`,
    description,
    company_id: params.company_id ?? null,
    contact_id: params.contact_id ?? null,
    documento_id: params.documento_id ?? null,
    destinatario_phone: params.destinatario_phone ?? null,
    message_type: params.message_type ?? "texto",
    channel: params.channel ?? null,
    wa_message_id: params.wa_message_id ?? null,
    wa_conversation_id: params.wa_conversation_id ?? null,
  };
  const { error } = await supabase.from("crm_activities").insert(payload as any);
  // No bloquear el envío si falla el registro: solo log + warning.
  if (error) {
    console.warn("[whatsapp] log activity failed (no se bloquea el envío)", error);
  }
}
