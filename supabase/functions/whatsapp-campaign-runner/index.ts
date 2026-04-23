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
    const PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    if (!TOKEN || !PHONE_ID) return json({ error: "Missing WhatsApp credentials" }, 500);

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
        const res = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: r.wa_phone,
            type: "template",
            template: { name: campaign.template_name, language: { code: campaign.template_language || "es_MX" } },
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
