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
  deal_id?: string | null;
  result?: "generado" | "enviado" | "copiado" | "error";
  title?: string;
}) {
  const { template_id, type, user_id, final_message, company_id, contact_id, deal_id, result = "generado", title } = opts;
  await (supabase as any).from("crm_activities").insert({
    user_id,
    type: type === "email" ? "email" : "whatsapp",
    title: title || `${type === "email" ? "Email" : "WhatsApp"} con plantilla`,
    description: `[${result}] ${final_message.slice(0, 500)}`,
    company_id: company_id ?? null,
    contact_id: contact_id ?? null,
    deal_id: deal_id ?? null,
    template_id,
  });
}