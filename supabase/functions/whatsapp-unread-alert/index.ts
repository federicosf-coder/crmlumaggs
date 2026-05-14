// Monitor WhatsApp conversations with unread inbound messages and dispatch
// a Meta-approved alert template to the configured admin phone when the
// configured wait time elapses without anyone reading/replying.
//
// Designed to be invoked by pg_cron every minute. Uses the service-role key
// so it does not require a user JWT.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d]/g, "");
  if (!digits) return null;
  // Si viene de 10 dígitos (formato MX local), anteponer 52
  if (digits.length === 10) return `52${digits}`;
  return digits;
}

function sanitizeName(raw: string | null | undefined): string {
  if (!raw) return "Nuevo Prospecto";
  // Remove characters not allowed by WhatsApp template params (newlines, tabs, 4+ spaces)
  let name = String(raw)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\p{L}\p{N}\s.\-']/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!name) return "Nuevo Prospecto";
  if (name.length > 60) name = name.slice(0, 60).trim();
  return name;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    // Identificador de número de teléfono fijo desde el cual se envían las alertas
    const senderPhoneId = "498690943338066";

    if (!TOKEN || !senderPhoneId) {
      return json({ error: "Missing WhatsApp credentials" }, 500);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: settings } = await admin
      .from("whatsapp_settings")
      .select("notification_delay_minutes, unassigned_strategy, admin_phone, alert_template_name, alert_template_language")
      .eq("id", 1)
      .maybeSingle();

    if (!settings) return json({ ok: true, skipped: "no_settings" });
    if (settings.unassigned_strategy !== "notify_admin") {
      return json({ ok: true, skipped: "strategy_disabled" });
    }
    const adminPhone = normalizePhone(settings.admin_phone);
    const tplName = settings.alert_template_name as string | null;
    const tplLang = (settings.alert_template_language as string | null) || "es_MX";
    const delayMin = Number(settings.notification_delay_minutes ?? 5);

    if (!adminPhone || !tplName) {
      return json({ ok: true, skipped: "missing_admin_or_template" });
    }

    const cutoff = new Date(Date.now() - delayMin * 60_000).toISOString();

    // Conversations with unread inbound activity older than the threshold,
    // for which we have NOT already alerted about this same inbound batch.
    const { data: pending, error: pendErr } = await admin
      .from("whatsapp_conversations")
      .select("id, wa_phone, wa_profile_name, contact_id, last_inbound_at, unread_alert_sent_at, unread_count")
      .gt("unread_count", 0)
      .lte("last_inbound_at", cutoff)
      .limit(50);

    if (pendErr) return json({ error: pendErr.message }, 500);

    const toFire = (pending ?? []).filter(
      (c: any) =>
        !c.unread_alert_sent_at ||
        new Date(c.unread_alert_sent_at).getTime() < new Date(c.last_inbound_at).getTime(),
    );

    let sent = 0;
    const errors: string[] = [];

    for (const conv of toFire) {
      try {
        // Resolve display name: contact -> wa_profile_name -> "Nuevo Prospecto"
        let displayName: string | null = null;
        if (conv.contact_id) {
          const { data: contact } = await admin
            .from("contacts")
            .select("first_name, last_name")
            .eq("id", conv.contact_id)
            .maybeSingle();
          if (contact) {
            const full = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();
            if (full) displayName = full;
          }
        }
        if (!displayName && conv.wa_profile_name) {
          displayName = conv.wa_profile_name;
        }
        const cleanName = sanitizeName(displayName);

        const res = await fetch(
          `https://graph.facebook.com/v21.0/${senderPhoneId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: adminPhone,
              type: "template",
              template: {
                name: tplName,
                language: { code: tplLang },
                components: [
                  {
                    type: "body",
                    parameters: [{ type: "text", text: cleanName }],
                  },
                ],
              },
            }),
          },
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          errors.push(`conv ${conv.id}: ${JSON.stringify(body)}`);
          continue;
        }
        await admin
          .from("whatsapp_conversations")
          .update({ unread_alert_sent_at: new Date().toISOString() })
          .eq("id", conv.id);
        sent += 1;
      } catch (e) {
        errors.push(`conv ${conv.id}: ${(e as Error).message}`);
      }
    }

    return json({ ok: true, evaluated: pending?.length ?? 0, sent, errors });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});