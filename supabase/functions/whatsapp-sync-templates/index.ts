import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status: number) {
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
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const WABA_ID = Deno.env.get("WHATSAPP_WABA_ID");
    if (!TOKEN || !WABA_ID) return json({ error: "Missing WhatsApp WABA credentials" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: "No autenticado" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const allowed = (roles ?? []).some((r) => r.role === "admin" || r.role === "manager");
    if (!allowed) return json({ error: "Solo admin/manager" }, 403);

    const r = await fetch(
      `https://graph.facebook.com/v21.0/${WABA_ID}/message_templates?limit=200`,
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );
    const data = await r.json();
    if (!r.ok) return json({ error: data?.error?.message ?? "Meta error", details: data }, 400);

    const templates = Array.isArray(data?.data) ? data.data : [];
    let upserted = 0;
    for (const t of templates) {
      const body = (t.components ?? []).find((c: any) => c.type === "BODY")?.text ?? null;
      const { error } = await admin.from("whatsapp_templates").upsert(
        {
          meta_template_id: t.id ?? null,
          name: t.name,
          language: t.language,
          category: t.category ?? null,
          status: t.status ?? "PENDING",
          body,
          components: t.components ?? null,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "name,language" },
      );
      if (!error) upserted++;
    }

    return json({ ok: true, count: templates.length, upserted }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Error" }, 500);
  }
});
