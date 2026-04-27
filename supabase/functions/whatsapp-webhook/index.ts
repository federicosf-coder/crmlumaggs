import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const VERIFY_TOKEN = "LumaggsCRM2026";

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  return digits;
}

function isWithinBusinessHours(settings: any, now: Date): boolean {
  try {
    const bh = settings?.business_hours;
    if (!bh) return true;
    const tz = bh.timezone || "America/Mexico_City";
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const weekday = parts.find((p) => p.type === "weekday")?.value?.toLowerCase() ?? "";
    const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
    const cur = `${hour}:${minute}`;
    const day = bh[weekday];
    if (!day || !day.enabled) return false;
    return cur >= day.start && cur <= day.end;
  } catch {
    return true;
  }
}

function resolveCredentials(phoneNumberId: string | null | undefined) {
  const TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const PHONE_1 = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const PHONE_2 = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID_2");
  // Default to account 1 if no phone_number_id given
  let phoneId = PHONE_1 ?? null;
  if (phoneNumberId && PHONE_2 && phoneNumberId === PHONE_2) phoneId = PHONE_2;
  else if (phoneNumberId && PHONE_1 && phoneNumberId === PHONE_1) phoneId = PHONE_1;
  return { TOKEN, phoneId };
}

async function sendWhatsAppText(toPhone: string, text: string, businessPhoneId?: string | null) {
  const { TOKEN, phoneId } = resolveCredentials(businessPhoneId);
  if (!TOKEN || !phoneId) return { ok: false, error: "Missing WhatsApp credentials" };
  const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toPhone,
      type: "text",
      text: { body: text },
    }),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data };
}

async function sendWhatsAppTemplate(toPhone: string, name: string, language: string, businessPhoneId?: string | null) {
  const { TOKEN, phoneId } = resolveCredentials(businessPhoneId);
  if (!TOKEN || !phoneId) return { ok: false, error: "Missing WhatsApp credentials" };
  const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toPhone,
      type: "template",
      template: { name, language: { code: language } },
    }),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // GET: webhook verification handshake from Meta
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  // POST: incoming message events
  if (req.method === "POST") {
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(SUPABASE_URL, SERVICE_KEY);

      const body = await req.json().catch(() => ({}));
      console.log("WhatsApp webhook payload:", JSON.stringify(body));

      // Load settings & rules once per webhook hit
      const [{ data: settingsRow }, { data: rulesRows }] = await Promise.all([
        admin.from("whatsapp_settings").select("*").eq("id", 1).maybeSingle(),
        admin
          .from("whatsapp_keyword_rules")
          .select("*")
          .eq("is_active", true)
          .order("priority", { ascending: false }),
      ]);
      const settings = settingsRow ?? {};
      const rules = rulesRows ?? [];

      let inserted = 0;
      const entries = Array.isArray(body?.entry) ? body.entry : [];
      for (const entry of entries) {
        const changes = Array.isArray(entry?.changes) ? entry.changes : [];
        for (const change of changes) {
          const value = change?.value ?? {};
          // Capture which business phone line this webhook event is for
          const businessPhoneId = value?.metadata?.phone_number_id ?? null;
          const contactsArr = Array.isArray(value?.contacts) ? value.contacts : [];
          const profileNameByWa: Record<string, string> = {};
          for (const c of contactsArr) {
            const wa = normalizePhone(c?.wa_id);
            if (wa && c?.profile?.name) profileNameByWa[wa] = c.profile.name;
          }

          const messages = Array.isArray(value?.messages) ? value.messages : [];
          for (const msg of messages) {
            const fromPhone = normalizePhone(msg?.from);
            if (!fromPhone) continue;

            const text =
              msg?.text?.body ??
              msg?.button?.text ??
              msg?.interactive?.button_reply?.title ??
              msg?.interactive?.list_reply?.title ??
              (msg?.type ? `[${msg.type}]` : null);

            const profileName = profileNameByWa[fromPhone] ?? null;

            // Try to match contact by whatsapp_phone, then phone, then mobile
            const { data: contactMatch } = await admin
              .from("contacts")
              .select("id")
              .or(
                `whatsapp_phone.eq.${fromPhone},phone.eq.${fromPhone},mobile.eq.${fromPhone}`,
              )
              .limit(1)
              .maybeSingle();
            const contactId = contactMatch?.id ?? null;

            // Upsert conversation — scoped to (wa_phone, business_phone_number_id)
            // so that the same person chatting with two different lines (Maggs vs
            // Chevron) keeps two independent threads.
            const nowIso = new Date().toISOString();
            let convQuery = admin
              .from("whatsapp_conversations")
              .select("id, unread_count, contact_id")
              .eq("wa_phone", fromPhone);
            convQuery = businessPhoneId
              ? convQuery.eq("business_phone_number_id", businessPhoneId)
              : convQuery.is("business_phone_number_id", null);
            const { data: existingConv } = await convQuery.maybeSingle();

            let conversationId: string;
            if (existingConv) {
              conversationId = existingConv.id;
              await admin
                .from("whatsapp_conversations")
                .update({
                  contact_id: existingConv.contact_id ?? contactId,
                  wa_profile_name: profileName ?? undefined,
                  last_inbound_at: nowIso,
                  last_message_preview: (text ?? "").slice(0, 120),
                  unread_count: (existingConv.unread_count ?? 0) + 1,
                  status: "open",
                  business_phone_number_id: businessPhoneId ?? undefined,
                })
                .eq("id", conversationId);
            } else {
              const { data: newConv } = await admin
                .from("whatsapp_conversations")
                .insert({
                  wa_phone: fromPhone,
                  contact_id: contactId,
                  wa_profile_name: profileName,
                  last_inbound_at: nowIso,
                  last_message_preview: (text ?? "").slice(0, 120),
                  unread_count: 1,
                  business_phone_number_id: businessPhoneId,
                })
                .select("id")
                .single();
              conversationId = newConv!.id;
            }

            const { error: insErr } = await admin.from("whatsapp_messages").insert({
              wa_id: msg?.id ?? null,
              sender_phone: fromPhone,
              message_body: text,
              direction: "inbound",
              status: "received",
              contact_id: contactId,
              conversation_id: conversationId,
              wa_profile_name: profileName,
              media_type: msg?.type ?? null,
              business_phone_number_id: businessPhoneId,
            });
            if (insErr) console.error("Insert message error:", insErr);
            else inserted++;

            // ===== Bot keyword matching =====
            const lower = (text ?? "").toLowerCase();
            if (settings?.bot_enabled && lower) {
              for (const r of rules) {
                const kw = String(r.keyword ?? "").toLowerCase();
                if (!kw) continue;
                const matched =
                  r.match_type === "exact"
                    ? lower.trim() === kw
                    : r.match_type === "starts_with"
                      ? lower.trim().startsWith(kw)
                      : lower.includes(kw);
                if (!matched) continue;
                if (r.reply_template_name) {
                  await sendWhatsAppTemplate(
                    fromPhone,
                    r.reply_template_name,
                    r.reply_template_language || "es_MX",
                    businessPhoneId,
                  );
                } else if (r.reply_text) {
                  await sendWhatsAppText(fromPhone, r.reply_text, businessPhoneId);
                }
                await admin.from("whatsapp_messages").insert({
                  sender_phone: fromPhone,
                  message_body: r.reply_text ?? `[template: ${r.reply_template_name}]`,
                  direction: "outbound",
                  status: "sent",
                  conversation_id: conversationId,
                  contact_id: contactId,
                  template_name: r.reply_template_name ?? null,
                  business_phone_number_id: businessPhoneId,
                });
                await admin
                  .from("whatsapp_conversations")
                  .update({ last_outbound_at: nowIso })
                  .eq("id", conversationId);
                break; // first matched rule wins
              }
            }

            // ===== Auto-away outside business hours =====
            if (
              settings?.away_enabled &&
              settings?.away_template_name &&
              !isWithinBusinessHours(settings, new Date())
            ) {
              // Throttle: 1 per contact per 4h
              const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
              const { data: recent } = await admin
                .from("whatsapp_auto_replies_log")
                .select("id")
                .eq("wa_phone", fromPhone)
                .gte("sent_at", fourHoursAgo)
                .limit(1)
                .maybeSingle();
              if (!recent) {
                await sendWhatsAppTemplate(
                  fromPhone,
                  settings.away_template_name,
                  settings.away_template_language || "es_MX",
                  businessPhoneId,
                );
                await admin.from("whatsapp_auto_replies_log").insert({
                  wa_phone: fromPhone,
                  reason: "outside_business_hours",
                  template_name: settings.away_template_name,
                });
                await admin.from("whatsapp_messages").insert({
                  sender_phone: fromPhone,
                  message_body: `[template: ${settings.away_template_name}]`,
                  direction: "outbound",
                  status: "sent",
                  conversation_id: conversationId,
                  contact_id: contactId,
                  template_name: settings.away_template_name,
                  business_phone_number_id: businessPhoneId,
                });
                await admin
                  .from("whatsapp_conversations")
                  .update({ last_outbound_at: new Date().toISOString() })
                  .eq("id", conversationId);
              }
            }
          }

          // Status updates from Meta
          const statuses = Array.isArray(value?.statuses) ? value.statuses : [];
          for (const s of statuses) {
            await admin.from("whatsapp_messages").insert({
              wa_id: s?.id ?? null,
              sender_phone: normalizePhone(s?.recipient_id),
              message_body: null,
              direction: "outbound",
              status: s?.status ?? null,
              business_phone_number_id: businessPhoneId,
            });
          }
        }
      }

      return json({ ok: true, inserted }, 200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      console.error("Webhook error:", msg);
      return json({ error: msg }, 500);
    }
  }

  return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}