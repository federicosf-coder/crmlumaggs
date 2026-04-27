import { corsHeaders } from "@supabase/supabase-js/cors";

/**
 * Registra un número de WhatsApp Business en Meta Cloud API con el PIN de
 * verificación en dos pasos. Llama a:
 *   POST https://graph.facebook.com/v22.0/{phone_number_id}/register
 *   body: { messaging_product: "whatsapp", pin: "123456" }
 *
 * Body esperado: { phone_number_id: string, pin: string }
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    if (!token) {
      return new Response(
        JSON.stringify({ error: "WHATSAPP_ACCESS_TOKEN no configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let payload: { phone_number_id?: string; pin?: string } = {};
    try {
      payload = await req.json();
    } catch {
      // ignore – validamos abajo
    }

    const phoneNumberId = (payload.phone_number_id ?? "").toString().trim();
    const pin = (payload.pin ?? "").toString().trim();

    if (!/^\d{6,}$/.test(phoneNumberId)) {
      return new Response(
        JSON.stringify({ error: "phone_number_id inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!/^\d{6}$/.test(pin)) {
      return new Response(
        JSON.stringify({ error: "pin debe tener 6 dígitos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/register`;
    const metaRes = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", pin }),
    });

    const text = await metaRes.text();
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = text; }

    return new Response(
      JSON.stringify({ ok: metaRes.ok, status: metaRes.status, response: parsed }),
      {
        status: metaRes.ok ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});