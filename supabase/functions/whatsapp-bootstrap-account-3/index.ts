import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID_3");
    const WABA_ID = Deno.env.get("WHATSAPP_WABA_ID_3");
    if (!TOKEN || !PHONE_ID || !WABA_ID) {
      return json({ error: "Faltan secrets WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID_3 / WHATSAPP_WABA_ID_3" }, 500);
    }

    // Suscribir la app al WABA para que Meta envíe eventos de webhook (mensajes entrantes, estados, etc.)
    let subscribeResult: unknown = null;
    try {
      const sr = await fetch(
        `https://graph.facebook.com/v22.0/${WABA_ID}/subscribed_apps`,
        { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` } },
      );
      subscribeResult = { ok: sr.ok, status: sr.status, body: await sr.json().catch(() => null) };
    } catch (e) {
      subscribeResult = { ok: false, error: String(e) };
    }

    // Consultar metadata del número en Meta.
    let display_phone = "";
    let verified_name: string | null = null;
    try {
      const r = await fetch(
        `https://graph.facebook.com/v22.0/${PHONE_ID}?fields=display_phone_number,verified_name`,
        { headers: { Authorization: `Bearer ${TOKEN}` } },
      );
      const j = await r.json();
      if (!r.ok) {
        return json({ error: "Meta API error", detail: j }, 400);
      }
      display_phone = (j?.display_phone_number as string) ?? "";
      verified_name = (j?.verified_name as string) ?? null;
    } catch (e) {
      return json({ error: "No se pudo consultar Meta", detail: String(e) }, 500);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Upsert por business_phone_number_id.
    const { data: existing } = await admin
      .from("whatsapp_accounts")
      .select("id")
      .eq("business_phone_number_id", PHONE_ID)
      .maybeSingle();

    const payload = {
      label: "Galsa",
      business_phone_number_id: PHONE_ID,
      waba_id: WABA_ID,
      display_phone,
      color: "#f59e0b",
      is_active: true,
    };

    let row;
    if (existing?.id) {
      const { data, error } = await admin
        .from("whatsapp_accounts")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 500);
      row = data;
    } else {
      const { data, error } = await admin
        .from("whatsapp_accounts")
        .insert(payload)
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 500);
      row = data;
    }

    return json({ ok: true, verified_name, account: row, subscribe: subscribeResult });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});