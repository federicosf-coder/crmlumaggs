import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const B64 = /^[A-Za-z0-9+/]+=*$/;
const MAX = 8 * 1024 * 1024;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Método no permitido" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!, service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ ok: false, error: "No autenticado" }, 401);
    const { data: auth } = await createClient(url, anon, { global: { headers: { Authorization: authorization } } }).auth.getUser();
    if (!auth?.user) return json({ ok: false, error: "No autenticado" }, 401);
    const admin = createClient(url, service, { auth: { persistSession: false } });

    const raw = await req.text();
    if (raw.length > 24 * 1024 * 1024) return json({ ok: false, error: "Solicitud demasiado grande" }, 413);
    const b = JSON.parse(raw);
    const nombre = typeof b.filename === "string" ? b.filename.replace(/[^\w-]+/g, "_").slice(0, 120) : "";
    const corte = typeof b.corte === "string" ? b.corte.slice(0, 40) : "";
    const marca = typeof b.marca === "string" ? b.marca.slice(0, 40) : "";
    if (!UUID.test(b.user_id ?? "") || !nombre || !corte) return json({ ok: false, error: "Datos incompletos" }, 400);
    for (const k of ["pdf", "xlsx"]) {
      const v = b[k];
      if (typeof v !== "string" || v.length % 4 !== 0 || !B64.test(v) || v.length * 0.75 > MAX) return json({ ok: false, error: `Archivo ${k} inválido` }, 400);
    }
    if (!atob(b.pdf.slice(0, 8)).startsWith("%PDF-")) return json({ ok: false, error: "PDF inválido" }, 400);

    // Permiso: el propio ejecutivo, admin/master, o jefe de un equipo al que pertenece.
    const me = auth.user.id;
    let permitido = me === b.user_id;
    if (!permitido) {
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", me);
      permitido = (roles ?? []).some((r) => r.role === "admin" || r.role === "master");
    }
    if (!permitido) {
      const { data: tm } = await admin.from("team_managers").select("team_id").eq("user_id", me);
      const teams = (tm ?? []).map((t) => t.team_id);
      if (teams.length) {
        const { data: mem } = await admin.from("team_members").select("user_id").in("team_id", teams).eq("user_id", b.user_id);
        permitido = (mem ?? []).length > 0;
      }
    }
    if (!permitido) return json({ ok: false, error: "No puedes enviar la guía de esta persona" }, 403);

    const { data: perfiles } = await admin.from("profiles").select("user_id, email, full_name").in("user_id", [b.user_id, me]);
    const dest = perfiles?.find((p) => p.user_id === b.user_id);
    const yo = perfiles?.find((p) => p.user_id === me);
    const to = dest?.email?.trim();
    if (!to) return json({ ok: false, error: "El ejecutivo no tiene correo en su perfil" }, 400);
    const cc = me !== b.user_id && yo?.email && yo.email !== to ? [yo.email.trim()] : undefined;

    const resendKey = Deno.env.get("RESEND_API_KEY"), lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!resendKey || !lovableKey) throw new Error("Correo no configurado");
    const quien = esc(dest?.full_name || "");
    const html = `<p>Hola ${quien},</p><p>Te comparto tu <b>Guía de Batalla</b> (${esc(marca)}) con corte <b>${esc(corte)}</b>, en PDF y Excel.</p><p>Revisa los clientes que aún no compran este mes y los que llevan más de 91 días sin compra. ¡Que no se nos vaya ningún cliente sin venta!</p>${cc ? `<p>Enviado por ${esc(yo?.full_name || yo?.email || "")}.</p>` : ""}`;
    const r = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": resendKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "LubriManager <noreply@lumaggs.com.mx>", reply_to: "f.sarinanaf@lumaggs.com.mx", to: [to], cc,
        subject: `Guía de Batalla ${marca} — ${corte}`, html,
        attachments: [{ filename: `${nombre}.pdf`, content: b.pdf }, { filename: `${nombre}.xlsx`, content: b.xlsx }],
      }),
    });
    if (!r.ok) {
      const details = await r.text();
      console.error(`Resend [${r.status}]: ${details}`);
      return json({ ok: false, error: `Error de correo [${r.status}]`, details }, r.status);
    }
    return json({ ok: true, to, cc: cc ?? [] });
  } catch (e) {
    console.error("guia-batalla-enviar:", e);
    return json({ ok: false, error: e instanceof Error ? e.message : "Error" }, 500);
  }
});
