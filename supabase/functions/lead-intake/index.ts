import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { clean, processLead } from "../_shared/lead-processing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  if (req.method === "GET") {
    const url = new URL(req.url);
    const challenge = url.searchParams.get("hub.challenge");
    const verifyToken = url.searchParams.get("hub.verify_token");
    const expected = Deno.env.get("LEAD_INTAKE_VERIFY_TOKEN");
    if (challenge && expected && verifyToken === expected) {
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }
    return json({ ok: true, service: "lead-intake" }, 200);
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = new URL(req.url);
    const apiKey = req.headers.get("x-api-key")?.trim() || url.searchParams.get("api_key")?.trim() || "";
    if (!apiKey) return json({ error: "API key requerida (header x-api-key)" }, 401);

    const keyHash = await sha256(apiKey);
    const { data: source } = await admin
      .from("lead_sources")
      .select("*")
      .eq("api_key_hash", keyHash)
      .eq("is_active", true)
      .maybeSingle();
    if (!source) return json({ error: "API key invalida o inactiva" }, 401);

    const raw = await req.json().catch(() => null);
    if (!raw || typeof raw !== "object") return json({ error: "JSON invalido" }, 400);
    const body = raw as Record<string, unknown>;

    if (clean(body["_hp"]) || clean(body["website_hp"])) {
      return json({ ok: true, ignored: true }, 200);
    }

    if (source.dominio_permitido) {
      const origin = req.headers.get("origin") || req.headers.get("referer") || "";
      if (origin && !origin.includes(source.dominio_permitido)) {
        return json({ error: "Origen no permitido" }, 403);
      }
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || null;
    const userAgent = clean(req.headers.get("user-agent"), 400);

    if (ip) {
      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count } = await admin
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("source_id", source.id)
        .eq("ip", ip)
        .gte("created_at", since);
      if ((count ?? 0) >= 20) return json({ error: "Demasiadas solicitudes, intenta mas tarde" }, 429);
    }

    const result = await processLead(admin, source, body, {
      ip,
      user_agent: userAgent,
      referrer: req.headers.get("referer"),
    });
    if (!result.ok) {
      return json({ error: result.error, ...(result.fields ? { fields: result.fields } : {}) }, result.status);
    }
    return json(result, 200);
  } catch (e) {
    console.error("lead-intake error:", e);
    return json({ error: "Error interno" }, 500);
  }
});
