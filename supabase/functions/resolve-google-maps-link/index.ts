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

function isAllowedMapsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return host === "maps.app.goo.gl" || host === "goo.gl" || (host.endsWith("google.com") && url.pathname.startsWith("/maps"));
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { url } = await req.json();
    if (typeof url !== "string" || !isAllowedMapsUrl(url)) {
      return json({ error: "Enlace de Google Maps inválido" }, 400);
    }

    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 LovableCloud/1.0" },
    });

    return json({ finalUrl: response.url || url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo resolver el enlace";
    return json({ error: message }, 500);
  }
});