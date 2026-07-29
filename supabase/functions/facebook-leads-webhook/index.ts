import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { processLeadgen } from "../_shared/facebook-leadgen.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

async function verifySignature(appSecret: string, raw: string, header: string | null): Promise<boolean> {
  if (!header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === header.slice(7);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Verificacion del webhook (Meta)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const expected = Deno.env.get("FB_LEADGEN_VERIFY_TOKEN");
    if (mode === "subscribe" && expected && token === expected && challenge) {
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const raw = await req.text();

  const appSecret = Deno.env.get("FB_APP_SECRET") ?? Deno.env.get("WHATSAPP_APP_SECRET");
  if (appSecret) {
    const ok = await verifySignature(appSecret, raw, req.headers.get("x-hub-signature-256"));
    if (!ok) {
      console.error("firma invalida en facebook-leads-webhook");
      return new Response("Invalid signature", { status: 401, headers: corsHeaders });
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400, headers: corsHeaders });
  }

  // Siempre respondemos 200 a Meta; los errores quedan en la bitacora.
  try {
    for (const entry of payload?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        if (change?.field !== "leadgen") continue;
        const v = change.value ?? {};
        const pageId = String(v.page_id ?? entry?.id ?? "");
        const formId = String(v.form_id ?? "");
        const leadgenId = String(v.leadgen_id ?? "");
        if (!leadgenId) continue;

        // Idempotencia: si ya lo procesamos, salir
        const { data: prev } = await admin
          .from("lead_integration_events")
          .select("id")
          .eq("leadgen_id", leadgenId)
          .maybeSingle();
        if (prev) continue;

        await processLeadgen(admin, { pageId, formId, leadgenId, rawValue: v });
      }
    }
  } catch (e) {
    console.error("facebook-leads-webhook error:", e);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
