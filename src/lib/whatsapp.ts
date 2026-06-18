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

/**
 * Normaliza un teléfono al formato que requiere wa.me:
 *   [código de país][número local a 10 dígitos sin separadores]
 *
 * Reglas:
 *  - 10 dígitos → se asume México: 52 + 10 dígitos.
 *  - 11 dígitos que inician con "1" → US/CA, se deja tal cual (1 + 10).
 *  - 12 dígitos que inician con "52" → MX correcto, se deja tal cual.
 *  - 13 dígitos que inician con "521" → MX con prefijo móvil legado, se quita
 *    el "1" intermedio → 52 + 10 dígitos (formato que wa.me/WhatsApp Web acepta).
 *  - Cualquier otro número con código de país (≥11 dígitos) se deja como está.
 */
export function normalizePhoneForWhatsApp(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // MX legado: 521 + 10 dígitos → quitar el "1"
  if (digits.length === 13 && digits.startsWith("521")) {
    return `52${digits.slice(3)}`;
  }
  // MX correcto: 52 + 10 dígitos
  if (digits.length === 12 && digits.startsWith("52")) {
    return digits;
  }
  // US/CA: 1 + 10 dígitos
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits;
  }
  // Cualquier otro con código de país plausible
  if (digits.length >= 11) return digits;
  // 10 dígitos: asumir México
  if (digits.length === 10) return `52${digits}`;
  return digits;
}

/** Replace {{var}} occurrences. Missing vars become "[var]" placeholder. */
export function renderTemplate(template: string, vars: WhatsAppVariables): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key) => {
    const v = vars[key as keyof WhatsAppVariables];
    return v != null && v !== "" ? String(v) : `[${key}]`;
  });
}

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|iemobile|blackberry|opera mini/i.test(navigator.userAgent);
}

/** Construye un enlace público de WhatsApp sin apuntar directo a web.whatsapp.com. */
export function buildWaMeLink(phone: string, message: string): string {
  const text = encodeURIComponent(message);
  // Evitamos web.whatsapp.com porque en el preview y algunos navegadores se bloquea
  // al abrirlo en otra pestaña. api.whatsapp.com muestra el puente oficial y deja
  // continuar hacia app/desktop/web sin cargar web.whatsapp.com como primer destino.
  return `https://api.whatsapp.com/send?phone=${encodeURIComponent(phone)}&text=${text}&type=phone_number&app_absent=0`;
}

/** Open WhatsApp Web/App in a new tab. */
export function openWhatsApp(phone: string, message: string) {
  window.open(buildWaMeLink(phone, message), "_blank", "noopener,noreferrer");
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
  const { error } = await supabase.from("crm_activities").insert(payload as never);
  // No bloquear el envío si falla el registro: solo log + warning.
  if (error) {
    console.warn("[whatsapp] log activity failed (no se bloquea el envío)", error);
  }
}
