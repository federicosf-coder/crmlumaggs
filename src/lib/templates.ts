import { supabase } from "@/integrations/supabase/client";

export type TemplateType = "email" | "whatsapp";
export type TemplateCategory =
  | "seguimiento_cotizacion"
  | "recompra"
  | "expansion"
  | "prospecto"
  | "cobranza"
  | "entrega"
  | "pago"
  | "credito"
  | "general";

export interface Template {
  id: string;
  name: string;
  type: TemplateType;
  category: TemplateCategory;
  subject: string | null;
  body: string;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  to_emails?: EmailRecipientItem[];
  cc_emails?: EmailRecipientItem[];
  bcc_emails?: EmailRecipientItem[];
  reply_to?: string | null;
}

export type EmailRecipientItem =
  | { type: "email"; value: string; label?: string }
  | { type: "group"; value: string; label?: string };

/** Expand a list of recipient items (emails + groups) to a deduped array of email addresses. */
export async function resolveEmailRecipients(items: EmailRecipientItem[] | null | undefined): Promise<string[]> {
  if (!items || items.length === 0) return [];
  const direct = items.filter((i) => i.type === "email").map((i) => i.value.trim()).filter(Boolean);
  const groupIds = items.filter((i) => i.type === "group").map((i) => i.value).filter(Boolean);
  let groupEmails: string[] = [];
  if (groupIds.length > 0) {
    const { data } = await (supabase as any)
      .from("email_group_members")
      .select("email,group_id")
      .in("group_id", groupIds);
    groupEmails = (data || []).map((r: any) => (r.email || "").trim()).filter(Boolean);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of [...direct, ...groupEmails]) {
    const k = e.toLowerCase();
    if (!seen.has(k) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      seen.add(k);
      out.push(e);
    }
  }
  return out;
}

export interface TemplatePlaceholder {
  id: string;
  key: string;
  label: string;
  description: string | null;
  applies_to: "email" | "whatsapp" | "ambos";
  is_active: boolean;
  sort_order: number;
  example_value: string | null;
}

export interface TemplateAttachment {
  id: string;
  template_id: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string | null;
  created_at: string;
}

export const ALLOWED_ATTACHMENT_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB

export const TEMPLATE_ATTACHMENTS_BUCKET = "template-attachments";

export function getAttachmentPublicUrl(path: string): string {
  const { data } = supabase.storage.from(TEMPLATE_ATTACHMENTS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

export async function listTemplateAttachments(templateId: string): Promise<TemplateAttachment[]> {
  const { data, error } = await (supabase as any)
    .from("template_attachments")
    .select("*")
    .eq("template_id", templateId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as TemplateAttachment[];
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatBytes(b: number): string {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Construye un bloque HTML "📎 Documentos adjuntos" con enlaces de descarga
 * a los adjuntos de la plantilla, y un bloque equivalente en texto plano
 * para WhatsApp / fallback. El email transaccional no soporta adjuntos reales,
 * por lo que los anexamos como enlaces firmados (bucket público).
 */
export async function buildTemplateAttachmentsBlock(
  templateId: string | null | undefined
): Promise<{ html: string; text: string; items: TemplateAttachment[] }> {
  if (!templateId) return { html: "", text: "", items: [] };
  let items: TemplateAttachment[] = [];
  try {
    items = await listTemplateAttachments(templateId);
  } catch (e) {
    console.warn("[templates] No se pudieron cargar adjuntos", e);
    return { html: "", text: "", items: [] };
  }
  if (items.length === 0) return { html: "", text: "", items: [] };

  const html =
    `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-family:Arial,sans-serif;font-size:14px;color:#333">
      <div style="font-weight:600;margin-bottom:10px;color:#111">📎 Documentos adjuntos</div>
      <ul style="padding-left:18px;margin:0">
        ${items
          .map((a) => {
            const url = getAttachmentPublicUrl(a.file_path);
            const label = escapeHtml(a.file_name);
            const meta = escapeHtml(
              [a.mime_type.split("/").pop()?.toUpperCase(), formatBytes(a.file_size)].filter(Boolean).join(" · ")
            );
            return `<li style="margin:4px 0"><a href="${url}" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:underline">${label}</a>${meta ? ` <span style="color:#6b7280;font-size:12px">(${meta})</span>` : ""}</li>`;
          })
          .join("")}
      </ul>
    </div>`;

  const text =
    "\n\n📎 Documentos adjuntos:\n" +
    items.map((a) => `• ${a.file_name}: ${getAttachmentPublicUrl(a.file_path)}`).join("\n");

  return { html, text, items };
}

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  seguimiento_cotizacion: "Seguimiento de cotización",
  recompra: "Recompra",
  expansion: "Expansión",
  prospecto: "Prospecto",
  cobranza: "Cobranza",
  entrega: "Entrega",
  pago: "Pago",
  credito: "Crédito",
  general: "General",
};

/** Replace {placeholder} tokens with values from a record. Missing keys stay literal. */
export function renderTemplate(body: string, vars: Record<string, string | number | null | undefined>): string {
  if (!body) return "";
  return body.replace(/\{([a-z0-9_]+)\}/gi, (m, key) => {
    const v = vars[key];
    return v === undefined || v === null ? m : String(v);
  });
}

/** Returns the placeholder keys present in a template body. */
export function extractPlaceholders(body: string): string[] {
  const out = new Set<string>();
  const re = /\{([a-z0-9_]+)\}/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) out.add(m[1].toLowerCase());
  return [...out];
}

/** Returns placeholder keys in body that are NOT in the catalog. */
export function unknownPlaceholders(body: string, catalog: TemplatePlaceholder[]): string[] {
  const known = new Set(catalog.map(p => p.key.replace(/[{}]/g, "").toLowerCase()));
  return extractPlaceholders(body).filter(k => !known.has(k));
}

export async function logTemplateUsage(opts: {
  template_id: string;
  type: TemplateType;
  user_id: string;
  final_message: string;
  company_id?: string | null;
  contact_id?: string | null;
  result?: "generado" | "enviado" | "copiado" | "error";
  title?: string;
}) {
  const { template_id, type, user_id, final_message, company_id, contact_id, result = "generado", title } = opts;
  await (supabase as any).from("crm_activities").insert({
    user_id,
    type: type === "email" ? "email" : "whatsapp",
    title: title || `${type === "email" ? "Email" : "WhatsApp"} con plantilla`,
    description: `[${result}] ${final_message.slice(0, 500)}`,
    company_id: company_id ?? null,
    contact_id: contact_id ?? null,
    template_id,
  });
}