import { processLead, type LeadSource } from "./lead-processing.ts";

const GRAPH = "https://graph.facebook.com/v21.0";

/** Aplana field_data de Meta y aplica el mapeo configurado en la integracion. */
function flattenFieldData(fieldData: any[], fieldMap: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fieldData ?? []) {
    const key = String(f?.name ?? "").trim();
    if (!key) continue;
    const value = Array.isArray(f?.values) ? f.values.join(", ") : f?.values;
    out[key] = value;
    const mapped = fieldMap?.[key];
    if (mapped) out[mapped] = value;
  }
  return out;
}

export async function processLeadgen(
  admin: any,
  args: { pageId: string; formId: string; leadgenId: string; rawValue?: unknown },
) {
  const { pageId, formId, leadgenId } = args;
  const logEvent = async (fields: Record<string, unknown>) => {
    const { error } = await admin.from("lead_integration_events").upsert(
      { leadgen_id: leadgenId, page_id: pageId, form_id: formId, payload: args.rawValue ?? null, ...fields },
      { onConflict: "leadgen_id" },
    );
    if (error) console.error("no se pudo registrar el evento:", error);
  };

  // Ruteo generico: page_id + form_id -> integracion
  let formQuery = admin
    .from("lead_integration_forms")
    .select("*, lead_integrations(*)")
    .eq("page_id", pageId)
    .eq("is_active", true)
    .limit(1);
  if (formId) formQuery = formQuery.eq("form_id", formId);
  const { data: formRows } = await formQuery;
  const formRow: any = formRows?.[0];
  const integration: any = formRow?.lead_integrations;

  if (!formRow || !integration || !integration.is_active) {
    await logEvent({ resultado: "sin_integracion", error: "Formulario o integración no configurada/activa" });
    return { ok: false as const, error: "sin_integracion" };
  }

  const { data: page } = await admin
    .from("lead_integration_pages")
    .select("page_access_token")
    .eq("integration_id", integration.id)
    .eq("page_id", pageId)
    .maybeSingle();

  const token = page?.page_access_token || Deno.env.get("FB_USER_ACCESS_TOKEN") || Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  if (!token) {
    await logEvent({ integration_id: integration.id, resultado: "error", error: "Sin token de página" });
    return { ok: false as const, error: "sin_token" };
  }

  const fields = "field_data,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,platform";
  const resp = await fetch(`${GRAPH}/${leadgenId}?fields=${fields}&access_token=${encodeURIComponent(token)}`);
  const detail = await resp.json().catch(() => null);
  if (!resp.ok || !detail) {
    await logEvent({
      integration_id: integration.id,
      resultado: "error",
      error: `Graph API ${resp.status}: ${JSON.stringify(detail)?.slice(0, 500)}`,
    });
    return { ok: false as const, error: "graph_error" };
  }

  const flat = flattenFieldData(detail.field_data ?? [], (formRow.field_map ?? {}) as Record<string, string>);
  const body: Record<string, unknown> = {
    ...flat,
    utm_source: "facebook",
    utm_medium: detail.platform ? String(detail.platform) : "paid",
    utm_campaign: detail.campaign_name ?? detail.campaign_id ?? null,
    utm_content: detail.ad_name ?? detail.ad_id ?? null,
    utm_term: formRow.form_name ?? formId,
    page_url: `https://facebook.com/${pageId}`,
    referrer: "facebook_lead_ads",
  };

  const { data: source } = await admin
    .from("lead_sources")
    .select("*")
    .eq("id", integration.source_id)
    .maybeSingle();

  if (!source) {
    await logEvent({ integration_id: integration.id, resultado: "error", error: "Integración sin fuente de prospectos" });
    return { ok: false as const, error: "sin_fuente" };
  }

  const result = await processLead(admin, source as LeadSource, body, {
    referrer: "facebook_lead_ads",
    automationId: integration.automation_id,
  });

  if (!result.ok) {
    await logEvent({ integration_id: integration.id, resultado: "error", error: result.error });
    return result;
  }

  await logEvent({
    integration_id: integration.id,
    resultado: result.duplicated ? "duplicado" : "procesado",
    lead_id: result.lead_id,
    payload: detail,
  });
  return result;
}