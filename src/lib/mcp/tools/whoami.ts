import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "whoami",
  title: "Quién soy",
  description: "Devuelve el perfil del usuario autenticado (nombre, email, roles y plaza).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    }
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const client = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const userId = ctx.getUserId();
    const [{ data: profile }, { data: rolesData }] = await Promise.all([
      client.from("profiles").select("full_name,email,phone,plaza_id,approval_status").eq("user_id", userId!).maybeSingle(),
      client.from("user_roles").select("role").eq("user_id", userId!),
    ]);
    const payload = {
      user_id: userId,
      email: ctx.getUserEmail() ?? profile?.email ?? null,
      full_name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      plaza_id: profile?.plaza_id ?? null,
      approval_status: profile?.approval_status ?? null,
      roles: (rolesData ?? []).map((r: { role: string }) => r.role),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});