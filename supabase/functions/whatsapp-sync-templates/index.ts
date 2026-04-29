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
    if (!TOKEN) return json({ error: "Missing WHATSAPP_ACCESS_TOKEN" }, 500);

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

    // Read accounts from DB. Group by waba_id so we only fetch each WABA once,
    // even if multiple phone numbers share the same WABA. Templates belong to
    // the WABA, so all phones under the same WABA can use them.
    const { data: dbAccounts } = await admin
      .from("whatsapp_accounts")
      .select("waba_id, business_phone_number_id, label, is_active")
      .eq("is_active", true);
    const wabaSet = new Set<string>();
    (dbAccounts ?? []).forEach((a: any) => {
      if (a.waba_id) wabaSet.add(String(a.waba_id));
    });
    if (wabaSet.size === 0) return json({ error: "No hay cuentas con waba_id configurado" }, 400);

    let totalCount = 0;
    let upserted = 0;
    const errors: unknown[] = [];

    for (const waba of wabaSet) {
      const r = await fetch(
        `https://graph.facebook.com/v21.0/${waba}/message_templates?limit=200`,
        { headers: { Authorization: `Bearer ${TOKEN}` } },
      );
      const data = await r.json();
      if (!r.ok) {
        errors.push({ waba, error: data?.error });
        continue;
      }
      const templates = Array.isArray(data?.data) ? data.data : [];
      totalCount += templates.length;
      for (const t of templates) {
        const body = (t.components ?? []).find((c: any) => c.type === "BODY")?.text ?? null;
        const headerComp = (t.components ?? []).find((c: any) => c.type === "HEADER");
        const headerType: string = headerComp?.format ?? "NONE";
        const headerText: string | null = headerType === "TEXT" ? (headerComp?.text ?? null) : null;
        const headerImageUrl: string | null = headerType === "IMAGE"
          ? (headerComp?.example?.header_handle?.[0] ?? null)
          : null;
        const rejection = t.status === "REJECTED"
          ? (t.rejected_reason ?? t.reason ?? null)
          : null;
        const { error } = await admin.from("whatsapp_templates").upsert(
          {
            meta_template_id: t.id ?? null,
            name: t.name,
            language: t.language,
            category: t.category ?? null,
            status: t.status ?? "PENDING",
            body,
            components: t.components ?? null,
            header_type: headerType,
            header_text: headerText,
            header_image_url: headerImageUrl,
            rejection_reason: rejection,
            quality_score: t.quality_score?.score ?? null,
            last_synced_at: new Date().toISOString(),
            waba_id: waba,
            // Templates pertenecen al WABA, no a un número específico.
            // Dejamos null para que apliquen a todos los números bajo ese WABA.
            business_phone_number_id: null,
          },
          { onConflict: "name,language" },
        );
        if (!error) upserted++;
      }
    }

    return json({ ok: true, count: totalCount, upserted, errors }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Error" }, 500);
  }
});
