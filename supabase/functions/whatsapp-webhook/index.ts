import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const VERIFY_TOKEN = "LumaggsCRM2026";

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

      const rows: Array<{
        wa_id: string | null;
        sender_phone: string | null;
        message_body: string | null;
        direction: string;
        status: string | null;
      }> = [];

      // Parse WhatsApp Cloud API payload structure
      const entries = Array.isArray(body?.entry) ? body.entry : [];
      for (const entry of entries) {
        const changes = Array.isArray(entry?.changes) ? entry.changes : [];
        for (const change of changes) {
          const value = change?.value ?? {};
          const messages = Array.isArray(value?.messages) ? value.messages : [];
          for (const msg of messages) {
            const text =
              msg?.text?.body ??
              msg?.button?.text ??
              msg?.interactive?.button_reply?.title ??
              msg?.interactive?.list_reply?.title ??
              (msg?.type ? `[${msg.type}]` : null);
            rows.push({
              wa_id: msg?.id ?? null,
              sender_phone: msg?.from ?? null,
              message_body: text,
              direction: "inbound",
              status: "received",
            });
          }

          const statuses = Array.isArray(value?.statuses) ? value.statuses : [];
          for (const s of statuses) {
            rows.push({
              wa_id: s?.id ?? null,
              sender_phone: s?.recipient_id ?? null,
              message_body: null,
              direction: "outbound",
              status: s?.status ?? null,
            });
          }
        }
      }

      if (rows.length > 0) {
        const { error } = await admin.from("whatsapp_messages").insert(rows);
        if (error) {
          console.error("Insert error:", error);
          return json({ error: error.message }, 500);
        }
      }

      return json({ ok: true, inserted: rows.length }, 200);
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