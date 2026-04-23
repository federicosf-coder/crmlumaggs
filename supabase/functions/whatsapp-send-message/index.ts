import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d]/g, "");
  return digits || null;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    if (!TOKEN || !PHONE_ID) return json({ error: "Missing WhatsApp credentials" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "No autenticado" }, 401);
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const toPhone = normalizePhone(body?.to_phone ?? body?.wa_phone);
    const conversationId = body?.conversation_id as string | undefined;
    const kind = body?.kind as "text" | "template";
    const text = body?.text as string | undefined;
    const templateName = body?.template_name as string | undefined;
    const templateLanguage = (body?.template_language as string | undefined) || "es_MX";
    const templateComponents = body?.template_components as unknown[] | undefined;

    if (!toPhone) return json({ error: "to_phone requerido" }, 400);
    if (kind !== "text" && kind !== "template") return json({ error: "kind inválido" }, 400);
    if (kind === "text" && !text) return json({ error: "text requerido" }, 400);
    if (kind === "template" && !templateName) return json({ error: "template_name requerido" }, 400);

    // Resolve / create conversation
    let convId = conversationId;
    let convRow: any = null;
    if (convId) {
      const { data } = await admin
        .from("whatsapp_conversations")
        .select("*")
        .eq("id", convId)
        .maybeSingle();
      convRow = data;
    }
    if (!convRow) {
      const { data } = await admin
        .from("whatsapp_conversations")
        .select("*")
        .eq("wa_phone", toPhone)
        .maybeSingle();
      convRow = data;
    }
    if (!convRow) {
      const { data: created } = await admin
        .from("whatsapp_conversations")
        .insert({ wa_phone: toPhone })
        .select("*")
        .single();
      convRow = created;
    }
    convId = convRow.id;

    // 24h window enforcement for free-form text
    if (kind === "text") {
      const lastInbound = convRow.last_inbound_at ? new Date(convRow.last_inbound_at).getTime() : 0;
      const ageMs = Date.now() - lastInbound;
      if (!lastInbound || ageMs > 24 * 60 * 60 * 1000) {
        return json(
          {
            error: "Ventana de atención cerrada (24h). Use una plantilla aprobada para reanudar.",
            window_closed: true,
          },
          400,
        );
      }
    }

    // Send to Meta
    const payload =
      kind === "text"
        ? {
            messaging_product: "whatsapp",
            to: toPhone,
            type: "text",
            text: { body: text },
          }
        : {
            messaging_product: "whatsapp",
            to: toPhone,
            type: "template",
            template: {
              name: templateName,
              language: { code: templateLanguage },
              ...(templateComponents ? { components: templateComponents } : {}),
            },
          };

    const r = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));

    const waMessageId = data?.messages?.[0]?.id ?? null;
    const ok = r.ok && !data?.error;

    await admin.from("whatsapp_messages").insert({
      wa_id: waMessageId,
      sender_phone: toPhone,
      message_body: kind === "text" ? text : `[template: ${templateName}]`,
      direction: "outbound",
      status: ok ? "sent" : "failed",
      conversation_id: convId,
      contact_id: convRow.contact_id ?? null,
      template_name: kind === "template" ? templateName : null,
      created_by: userId,
      error_message: ok ? null : JSON.stringify(data?.error ?? data).slice(0, 500),
    });

    if (ok) {
      await admin
        .from("whatsapp_conversations")
        .update({
          last_outbound_at: new Date().toISOString(),
          last_message_preview: (kind === "text" ? text : `[plantilla] ${templateName}`)?.slice(0, 120),
          unread_count: 0,
          status: "open",
        })
        .eq("id", convId);
    }

    if (!ok) return json({ error: data?.error?.message ?? "Error en Meta", details: data }, 400);
    return json({ ok: true, wa_message_id: waMessageId, conversation_id: convId }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    console.error("send-message error:", msg);
    return json({ error: msg }, 500);
  }
});
