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

    // Only admins can change other users' passwords
    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const isAdmin = (callerRoles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) return json({ error: "Solo administradores pueden cambiar contraseñas" }, 403);

    const { user_id, password } = await req.json();
    if (!user_id || typeof user_id !== "string") return json({ error: "user_id requerido" }, 400);
    if (!password || typeof password !== "string" || password.length < 6) {
      return json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400);
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(user_id, { password });
    if (updErr) {
      const msg = updErr.message || "";
      if (/weak|pwned|leaked|known/i.test(msg)) {
        return json({
          error:
            "La contraseña es demasiado común o ha aparecido en filtraciones conocidas. Elige una más segura (mezcla mayúsculas, minúsculas, números y símbolos).",
        }, 400);
      }
      return json({ error: msg || "No se pudo actualizar la contraseña" }, 400);
    }

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
