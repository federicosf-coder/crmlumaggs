import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_overdue_invoices",
  title: "Listar facturas vencidas",
  description: "Lista las facturas con estatus distinto a 'pagada' y saldo pendiente, para las empresas visibles por el usuario autenticado. Devuelve hasta 50 registros ordenados por fecha de vencimiento.",
  inputSchema: {
    company_id: z.string().uuid().optional().describe("Filtrar por una empresa específica."),
    only_overdue: z.boolean().optional().describe("Si es true, solo devuelve facturas ya vencidas (fecha_vencimiento < hoy)."),
    limit: z.number().int().min(1).max(100).optional().describe("Máximo de resultados (por defecto 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ company_id, only_overdue, limit }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    }
    const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let q = client
      .from("documents")
      .select("id,numero,fecha,fecha_vencimiento,total,saldo_pendiente_cobranza,monto_pagado,estatus_factura,company_id,companies(name)")
      .eq("tipo_documento", "factura")
      .neq("estatus_factura", "pagada")
      .order("fecha_vencimiento", { ascending: true })
      .limit(limit ?? 50);
    if (company_id) q = q.eq("company_id", company_id);
    if (only_overdue) q = q.lt("fecha_vencimiento", new Date().toISOString().slice(0, 10));
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(rows) }],
      structuredContent: { count: rows.length, invoices: rows },
    };
  },
});