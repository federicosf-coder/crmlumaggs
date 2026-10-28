import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { canSendCobranza, validateCobranzaEmail } from "./validation.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Método no permitido" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) throw new Error("Servicio no configurado");
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ ok: false, error: "No autenticado" }, 401);
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: auth, error: authError } = await userClient.auth.getUser();
    if (authError || !auth.user) return json({ ok: false, error: "No autenticado" }, 401);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: roles, error: rolesError } = await admin.from("user_roles").select("role").eq("user_id", auth.user.id);
    if (rolesError) throw rolesError;
    if (!canSendCobranza((roles ?? []).map((r) => r.role))) return json({ ok: false, error: "Permiso denegado" }, 403);

    let body;
    try {
      const raw = await req.text();
      if (raw.length > 14 * 1024 * 1024) return json({ ok: false, error: "Solicitud demasiado grande" }, 413);
      body = validateCobranzaEmail(JSON.parse(raw));
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : "Solicitud inválida" }, 400);
    }

    const { data: profile, error: profileError } = await admin.from("profiles").select("email, full_name").eq("user_id", body.user_id).maybeSingle();
    if (profileError) throw profileError;
    const email = profile?.email?.trim();
    let sendError: string | null = null;
    let providerStatus: number | undefined;
    let providerDetails: string | undefined;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sendError = "El destinatario no tiene un correo válido en su perfil";
    } else {
      try {
        const resendKey = Deno.env.get("RESEND_API_KEY");
        const lovableKey = Deno.env.get("LOVABLE_API_KEY");
        if (!resendKey || !lovableKey) throw new Error("Credenciales de Resend no configuradas");
        const response = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": resendKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "LubriManager <cobranza@lumaggs.com.mx>",
            to: [email], subject: body.asunto, html: body.html,
            attachments: [{ filename: body.filename, content: body.pdf }],
          }),
        });
        if (!response.ok) {
          providerStatus = response.status;
          providerDetails = await response.text();
          console.error(`Resend [${providerStatus}]: ${providerDetails}`);
          sendError = `Error de correo [${providerStatus}]: ${providerDetails}`;
        }
      } catch (error) {
        sendError = error instanceof Error ? error.message : "Error al enviar el correo";
      }
    }

    const { error: logError } = await admin.from("cobranza_envios").insert({
      marca: body.marca, corte: body.corte, tipo: body.tipo,
      destinatario_user_id: body.user_id, destinatario_nombre: profile?.full_name || body.nombre,
      destinatario_email: email || null, canal: "correo", asunto: body.asunto,
      n_facturas: body.n_facturas, saldo: body.saldo, vencido: body.vencido, vencido_1_7: body.vencido_1_7,
      estado: sendError ? "error" : "enviado", error: sendError, enviado_por: auth.user.id,
    });
    if (logError) {
      console.error("Error de registro de cobranza:", logError);
      return json({ ok: false, error: sendError || "El correo se envió, pero no se pudo registrar; no lo reenvíes" }, 500);
    }
    if (sendError) return json({ ok: false, error: sendError, status: providerStatus, details: providerDetails }, providerStatus || 400);
    return json({ ok: true });
  } catch (error) {
    console.error("cobranza-enviar:", error);
    return json({ ok: false, error: error instanceof Error ? error.message : "Error al procesar el envío" }, 500);
  }
});