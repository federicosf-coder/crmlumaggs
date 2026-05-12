import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(b: unknown, s: number) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const FALLBACK_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")
      ?? Deno.env.get("WHATSAPP_PHONE_NUMBER_ID_2");
    if (!TOKEN) return json({ error: "Missing WHATSAPP_ACCESS_TOKEN" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: "No autenticado" }, 401);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id);
    if (!(roles ?? []).some((r) => r.role === "admin" || r.role === "manager"))
      return json({ error: "Solo admin/manager" }, 403);

    const { campaign_id } = await req.json().catch(() => ({}));
    if (!campaign_id) return json({ error: "campaign_id requerido" }, 400);

    const { data: campaign } = await admin.from("whatsapp_campaigns").select("*").eq("id", campaign_id).maybeSingle();
    if (!campaign) return json({ error: "Campaña no encontrada" }, 404);
    if (campaign.status === "completed") return json({ ok: true, message: "Ya completada" }, 200);

    // Honrar programación: no enviar antes de la fecha programada
    if (campaign.scheduled_at) {
      const due = new Date(campaign.scheduled_at).getTime();
      if (due > Date.now()) {
        return json({ ok: true, message: "Campaña programada para el futuro", scheduled_at: campaign.scheduled_at }, 200);
      }
    }

    // Resolver línea (phone_number_id) a usar para esta campaña.
    let activePhoneId: string | null = campaign.business_phone_number_id ?? null;
    if (!activePhoneId) {
      const { data: defaultAcct } = await admin
        .from("whatsapp_accounts")
        .select("business_phone_number_id")
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      activePhoneId = defaultAcct?.business_phone_number_id ?? FALLBACK_PHONE_ID ?? null;
    }
    if (!activePhoneId) {
      return json({ error: "No hay business_phone_number_id configurado para la campaña" }, 500);
    }

    // Validar que la plantilla esté APPROVED antes de enviar.
    const { data: tplRow } = await admin
      .from("whatsapp_templates")
      .select("status, header_type, variable_map")
      .eq("name", campaign.template_name)
      .eq("language", campaign.template_language || "es_MX")
      .maybeSingle();
    if (!tplRow) return json({ error: "Plantilla no encontrada" }, 404);
    if (tplRow.status !== "APPROVED") {
      await admin.from("whatsapp_campaigns")
        .update({ status: "failed", finished_at: new Date().toISOString() })
        .eq("id", campaign_id);
      return json({ error: `La plantilla no está aprobada (estatus actual: ${tplRow.status}). No se enviará la campaña.` }, 400);
    }
    const variableMap: string[] = Array.isArray(tplRow.variable_map) ? (tplRow.variable_map as string[]) : [];
    const headerType: string = tplRow.header_type ?? "NONE";
    const headerImageUrl: string | null = campaign.header_image_url ?? null;
    const headerVideoUrl: string | null = (campaign as any).header_video_url ?? null;
    if (headerType === "IMAGE" && !headerImageUrl) {
      return json({ error: "La plantilla requiere una imagen de encabezado y la campaña no la tiene." }, 400);
    }
    if (headerType === "VIDEO" && !headerVideoUrl) {
      return json({ error: "La plantilla requiere un video de encabezado y la campaña no la tiene." }, 400);
    }
    const tplVariables: Record<string, string> =
      (campaign.template_variables as Record<string, string> | null) ?? {};

    await admin
      .from("whatsapp_campaigns")
      .update({ status: "running", started_at: campaign.started_at ?? new Date().toISOString() })
      .eq("id", campaign_id);

    const { data: pending } = await admin
      .from("whatsapp_campaign_recipients")
      .select("*")
      .eq("campaign_id", campaign_id)
      .eq("status", "pending")
      .limit(500);

    let sent = 0,
      failed = 0;
    for (const r of pending ?? []) {
      try {
        // Construir components: header IMAGE + body con variables (si hay)
        const components: Record<string, unknown>[] = [];
        if (headerType === "IMAGE" && headerImageUrl) {
          components.push({
            type: "header",
            parameters: [{ type: "image", image: { link: headerImageUrl } }],
          });
        }
        if (headerType === "VIDEO" && headerVideoUrl) {
          components.push({
            type: "header",
            parameters: [{ type: "video", video: { link: headerVideoUrl } }],
          });
        }
        if (variableMap.length > 0) {
          components.push({
            type: "body",
            parameters: variableMap.map((k) => ({
              type: "text",
              text: String(tplVariables[k] ?? ""),
            })),
          });
        }
        const tplPayload: Record<string, unknown> = {
          name: campaign.template_name,
          language: { code: campaign.template_language || "es_MX" },
        };
        if (components.length > 0) tplPayload.components = components;

        const res = await fetch(`https://graph.facebook.com/v21.0/${activePhoneId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: r.wa_phone,
            type: "template",
            template: tplPayload,
          }),
        });
        const d = await res.json().catch(() => ({}));
        const ok = res.ok && !d?.error;
        const waId = d?.messages?.[0]?.id ?? null;
        await admin
          .from("whatsapp_campaign_recipients")
          .update({
            status: ok ? "sent" : "failed",
            wa_message_id: waId,
            error_message: ok ? null : JSON.stringify(d?.error ?? d).slice(0, 500),
            sent_at: new Date().toISOString(),
          })
          .eq("id", r.id);
        if (ok) sent++;
        else failed++;
      } catch (e) {
        failed++;
        await admin
          .from("whatsapp_campaign_recipients")
          .update({ status: "failed", error_message: String(e).slice(0, 500), sent_at: new Date().toISOString() })
          .eq("id", r.id);
      }
      await sleep(300); // throttle
    }

    const { count: stillPending } = await admin
      .from("whatsapp_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaign_id)
      .eq("status", "pending");

    const finalStatus = (stillPending ?? 0) > 0 ? "running" : "completed";
    await admin
      .from("whatsapp_campaigns")
      .update({
        sent_count: (campaign.sent_count ?? 0) + sent,
        failed_count: (campaign.failed_count ?? 0) + failed,
        status: finalStatus,
        finished_at: finalStatus === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", campaign_id);

    return json({ ok: true, sent, failed, remaining: stillPending ?? 0 }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Error" }, 500);
  }
});
