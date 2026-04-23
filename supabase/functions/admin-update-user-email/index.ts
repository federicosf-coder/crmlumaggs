import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "No autenticado" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Only admins/managers can change emails
    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const isAllowed = (callerRoles ?? []).some((r) => r.role === "admin" || r.role === "manager");
    if (!isAllowed) return json({ error: "Solo administradores pueden cambiar el correo" }, 403);

    const { user_id, email } = await req.json();
    if (!user_id || typeof user_id !== "string") return json({ error: "user_id requerido" }, 400);
    const newEmail = (email ?? "").toString().trim().toLowerCase();
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return json({ error: "Correo inválido" }, 400);
    }

    // Check current email — only allow assigning when there is no previous email
    const { data: targetUser, error: getErr } = await admin.auth.admin.getUserById(user_id);
    if (getErr || !targetUser?.user) return json({ error: "Usuario no encontrado" }, 404);

    const currentEmail = (targetUser.user.email ?? "").trim();
    if (currentEmail) {
      return json(
        { error: "Este usuario ya tiene un correo asignado y no puede cambiarse para preservar las relaciones existentes." },
        409,
      );
    }

    // Also check the profiles table mirror
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("user_id", user_id)
      .maybeSingle();
    if (profile?.email && profile.email.trim()) {
      return json(
        { error: "Este usuario ya tiene un correo asignado y no puede cambiarse para preservar las relaciones existentes." },
        409,
      );
    }

    // Update auth user
    const { error: updErr } = await admin.auth.admin.updateUserById(user_id, {
      email: newEmail,
      email_confirm: true,
    });
    if (updErr) return json({ error: updErr.message }, 400);

    // Mirror in profiles
    await admin.from("profiles").update({ email: newEmail }).eq("user_id", user_id);

    return json({ ok: true }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}