import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "search_companies",
  title: "Buscar empresas",
  description: "Busca empresas (clientes/prospectos) en el directorio por nombre o razón social. Devuelve hasta 20 coincidencias que el usuario autenticado tenga permitido ver.",
  inputSchema: {
    query: z.string().trim().min(1).describe("Texto a buscar en el nombre o razón social."),
    limit: z.number().int().min(1).max(50).optional().describe("Máximo de resultados (por defecto 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    }
    const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const max = limit ?? 20;
    const q = query.replace(/[%,]/g, " ").trim();
    const { data, error } = await client
      .from("companies")
      .select("id,nombre,razon_social,rfc,tipo,estatus")
      .or(`nombre.ilike.%${q}%,razon_social.ilike.%${q}%`)
      .limit(max);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(rows) }],
      structuredContent: { count: rows.length, results: rows },
    };
  },
});