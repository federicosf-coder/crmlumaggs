import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { processLeadgen } from "../_shared/facebook-leadgen.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GRAPH = "https://graph.facebook.com/v21.0";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function graph(path: string, token: string, init?: RequestInit) {
  const sep = path.includes("?") ? "&" : "?";
  const resp = await fetch(`${GRAPH}${path}${sep}access_token=${encodeURIComponent(token)}`, init);
  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new Error(`Graph ${resp.status}: ${JSON.stringify(data?.error ?? data)?.slice(0, 500)}`);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "No autorizado" }, 401);

  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: claimsErr } = await anon.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (claimsErr || !claims?.claims?.sub) return json({ error: "No autorizado" }, 401);
  const userId = claims.claims.sub as string;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
  const allowed = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "manager");
  if (!allowed) return json({ error: "Requiere rol de administrador o gerente" }, 403);

  const userToken = Deno.env.get("FB_USER_ACCESS_TOKEN") ?? Deno.env.get("WHATSAPP_ACCESS_TOKEN");

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    if (action === "get_config") {
      return json({
        ok: true,
        webhook_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/facebook-leads-webhook`,
        verify_token: Deno.env.get("FB_LEADGEN_VERIFY_TOKEN") ?? null,
        tiene_app_secret: Boolean(Deno.env.get("FB_APP_SECRET") ?? Deno.env.get("WHATSAPP_APP_SECRET")),
        tiene_token_usuario: Boolean(Deno.env.get("FB_USER_ACCESS_TOKEN") ?? Deno.env.get("WHATSAPP_ACCESS_TOKEN")),
      });
    }

    if (action === "list_pages") {
      if (!userToken) return json({ error: "Falta el token de la app de Meta (FB_USER_ACCESS_TOKEN)" }, 400);
      const data = await graph(`/me/accounts?fields=id,name,access_token,tasks&limit=100`, userToken);
      const pages = (data?.data ?? []).map((p: any) => ({ id: p.id, name: p.name }));
      return json({ ok: true, pages });
    }

    if (action === "list_forms") {
      const pageId = String(body?.page_id ?? "");
      if (!pageId) return json({ error: "page_id requerido" }, 400);
      const { data: saved } = await admin
        .from("lead_integration_pages")
        .select("page_access_token")
        .eq("page_id", pageId)
        .not("page_access_token", "is", null)
        .maybeSingle();
      const token = saved?.page_access_token || userToken;
      if (!token) return json({ error: "Sin token para esta página" }, 400);
      const data = await graph(
        `/${pageId}/leadgen_forms?fields=id,name,status,questions{key,label,type}&limit=100`,
        token,
      );
      return json({ ok: true, forms: data?.data ?? [] });
    }

    if (action === "subscribe_page") {
      const pageId = String(body?.page_id ?? "");
      const integrationId = String(body?.integration_id ?? "");
      const pageName = body?.page_name ? String(body.page_name) : null;
      if (!pageId || !integrationId) return json({ error: "page_id e integration_id requeridos" }, 400);
      if (!userToken) return json({ error: "Falta el token de la app de Meta" }, 400);

      const accounts = await graph(`/me/accounts?fields=id,name,access_token&limit=100`, userToken);
      const acct = (accounts?.data ?? []).find((p: any) => String(p.id) === pageId);
      const pageToken = acct?.access_token;
      if (!pageToken) return json({ error: "No se encontró la página o falta permiso pages_show_list" }, 400);

      await graph(`/${pageId}/subscribed_apps?subscribed_fields=leadgen`, pageToken, { method: "POST" });

      const { error } = await admin.from("lead_integration_pages").upsert(
        {
          integration_id: integrationId,
          page_id: pageId,
          page_name: pageName ?? acct?.name ?? null,
          page_access_token: pageToken,
          subscribed_at: new Date().toISOString(),
          is_active: true,
        },
        { onConflict: "integration_id,page_id" },
      );
      if (error) throw new Error(error.message);
      return json({ ok: true });
    }

    if (action === "unsubscribe_page") {
      const pageId = String(body?.page_id ?? "");
      const integrationId = String(body?.integration_id ?? "");
      if (!pageId || !integrationId) return json({ error: "page_id e integration_id requeridos" }, 400);
      const { data: saved } = await admin
        .from("lead_integration_pages")
        .select("page_access_token")
        .eq("integration_id", integrationId)
        .eq("page_id", pageId)
        .maybeSingle();
      if (saved?.page_access_token) {
        try {
          await graph(`/${pageId}/subscribed_apps`, saved.page_access_token, { method: "DELETE" });
        } catch (e) {
          console.error("unsubscribe warning:", e);
        }
      }
      await admin
        .from("lead_integration_pages")
        .delete()
        .eq("integration_id", integrationId)
        .eq("page_id", pageId);
      await admin.from("lead_integration_forms").delete().eq("integration_id", integrationId).eq("page_id", pageId);
      return json({ ok: true });
    }

    if (action === "test_lead" || action === "reprocess") {
      const leadgenId = String(body?.leadgen_id ?? "");
      const pageId = String(body?.page_id ?? "");
      const formId = String(body?.form_id ?? "");
      if (!leadgenId) return json({ error: "leadgen_id requerido" }, 400);
      if (action === "reprocess") {
        await admin.from("lead_integration_events").delete().eq("leadgen_id", leadgenId);
      }
      const result = await processLeadgen(admin, { pageId, formId, leadgenId });
      return json({ ok: true, result });
    }

    return json({ error: "Acción no reconocida" }, 400);
  } catch (e) {
    console.error("facebook-graph-admin error:", e);
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});