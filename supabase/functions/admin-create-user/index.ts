import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Role = "admin" | "manager" | "sales" | "delivery" | "warehouse" | "customer_service" | "accounting";

interface Body {
  email: string;
  password: string;
  full_name: string;
  phone?: string | null;
  plaza_id?: string | null;
  team_ids?: string[];
  roles?: Role[];
}

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
    if (userErr || !userData.user) {
      return json({ error: "No autenticado" }, 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verify caller has admin or manager role
    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const allowed = (callerRoles ?? []).some((r) => r.role === "admin" || r.role === "manager");
    if (!allowed) return json({ error: "Permiso denegado" }, 403);

    const body = (await req.json()) as Body;
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password;
    const full_name = (body.full_name || "").trim();
    if (!email || !password || !full_name) return json({ error: "Faltan campos requeridos" }, 400);
    if (password.length < 6) return json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400);

    // Unique email check (profiles)
    const { data: existing } = await admin
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();
    if (existing) return json({ error: "Ya existe un usuario con ese correo" }, 409);

    // Create user (email confirmed)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone: body.phone ?? null },
    });
    if (createErr || !created.user) {
      const msg = createErr?.message || "No se pudo crear el usuario";
      const status = msg.toLowerCase().includes("already") ? 409 : 400;
      return json({ error: msg }, status);
    }

    const newUserId = created.user.id;

    // Set profile to approved + plaza
    await admin
      .from("profiles")
      .update({
        approval_status: "aprobado",
        plaza_id: body.plaza_id || null,
        full_name,
        phone: body.phone || null,
      })
      .eq("user_id", newUserId);

    // Teams
    const teamIds = body.team_ids ?? [];
    if (teamIds.length) {
      await admin
        .from("team_members")
        .insert(teamIds.map((team_id) => ({ user_id: newUserId, team_id })));
    }

    // Roles
    const roles = (body.roles ?? []) as Role[];
    if (roles.length) {
      await admin.from("user_roles").insert(roles.map((role) => ({ user_id: newUserId, role })));
    }

    return json({ user_id: newUserId }, 200);
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