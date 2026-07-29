import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: stats, error } = await admin.rpc("recompute_lead_sla");
    if (error) throw error;

    // Alertas de WhatsApp para leads que cruzaron la hora sin atencion
    const { data: pendientes } = await admin
      .from("leads")
      .select("id, nombre, telefono, email, interes, source_id, created_at, lead_sources(nombre, notificar_whatsapp)")
      .is("primer_contacto_at", null)
      .is("alerta_enviada_at", null)
      .in("estatus", ["alerta", "frio", "recuperacion"])
      .limit(20);

    const TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    let enviadas = 0;

    for (const lead of pendientes ?? []) {
      const src = (lead as any).lead_sources;
      const destino = src?.notificar_whatsapp;
      if (!destino || !TOKEN || !PHONE_ID) continue;
      const mins = Math.round((Date.now() - new Date(lead.created_at).getTime()) / 60000);
      const texto =
        `Prospecto sin atender (${mins} min)\n` +
        `Nombre: ${lead.nombre}\n` +
        (lead.telefono ? `Tel: ${lead.telefono}\n` : "") +
        (lead.email ? `Correo: ${lead.email}\n` : "") +
        `Bandeja: https://portal.lumaggs.com.mx/leads`;
      try {
        const resp = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: String(destino).replace(/\D/g, ""),
            type: "text",
            text: { body: texto },
          }),
        });
        if (!resp.ok) console.error("alerta whatsapp fallo:", resp.status, await resp.text());
        else enviadas++;
      } catch (e) {
        console.error("alerta whatsapp error:", e);
      }
      await admin.from("leads").update({ alerta_enviada_at: new Date().toISOString() }).eq("id", lead.id);
    }

    return new Response(JSON.stringify({ ok: true, stats, alertas_enviadas: enviadas }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("lead-sla-monitor error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
