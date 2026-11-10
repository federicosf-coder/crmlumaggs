const G = "https://graph.facebook.com/v21.0";
async function get(path: string, tok?: string) {
  if (!tok) return "no token";
  try {
    const r = await fetch(`${G}/${path}${path.includes("?") ? "&" : "?"}access_token=${tok}`);
    return await r.json();
  } catch (e) { return String(e); }
}
Deno.serve(async (req) => {
  if (req.method === "POST") {
    const tok = Deno.env.get("WHATSAPP_ACCESS_TOKEN_MARKETING")!;
    const r = await fetch(`${G}/1127465449904495/subscribed_apps`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({
        override_callback_uri: "https://fnqeicdqblkhfpyboxre.supabase.co/functions/v1/whatsapp-webhook",
        verify_token: "LumaggsCRM2026",
      }),
    });
    const post = await r.json();
    const after = await get("1127465449904495/subscribed_apps", tok);
    return new Response(JSON.stringify({ post, after }, null, 1), { headers: { "Content-Type": "application/json" } });
  }
  const toks: Record<string, string | undefined> = {
    marketing: Deno.env.get("WHATSAPP_ACCESS_TOKEN_MARKETING"),
    crm: Deno.env.get("WHATSAPP_ACCESS_TOKEN_CRM_LUMAGGS"),
    main: Deno.env.get("WHATSAPP_ACCESS_TOKEN"),
  };
  const out: Record<string, unknown> = {};
  for (const [k, t] of Object.entries(toks)) {
    out[k] = {
      mkt_phone: await get("1476909262169059?fields=display_phone_number,status,platform_type,code_verification_status,name_status,quality_rating,webhook_configuration,is_on_biz_app,account_mode", t),
      mkt_subs: await get("1127465449904495/subscribed_apps", t),
      galsa_phone: await get("318296624690022?fields=display_phone_number,status,platform_type,webhook_configuration,is_on_biz_app,account_mode", t),
      galsa_subs: await get("282327838294623/subscribed_apps", t),
    };
  }
  return new Response(JSON.stringify(out, null, 1), { headers: { "Content-Type": "application/json" } });
});
