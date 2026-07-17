import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_pending_activities",
  title: "Listar actividades y tareas pendientes",
  description: "Devuelve las actividades/tareas CRM pendientes que el usuario autenticado puede ver (según sus permisos).",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Máximo de resultados (por defecto 30)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    }
    const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client
      .from("crm_tasks")
      .select("id,titulo,descripcion,fecha_programada,estatus,prioridad,company_id,tipo,responsable_id")
      .in("estatus", ["pendiente", "en_progreso"])
      .order("fecha_programada", { ascending: true })
      .limit(limit ?? 30);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(rows) }],
      structuredContent: { count: rows.length, tasks: rows },
    };
  },
});