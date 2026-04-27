import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key);

    const body = await req.json().catch(() => ({}));
    const targetMes: string = body.mes ?? new Date().toISOString().slice(0, 7); // YYYY-MM

    // Empresas activas en los últimos 6 meses, por marca
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const fromDate = sixMonthsAgo.toISOString().slice(0, 10);

    const { data: docs, error: docsErr } = await admin
      .from("documentos")
      .select("empresa_id, empresa_vendedora")
      .eq("tipo_documento", "factura")
      .eq("is_active", true)
      .gte("fecha_documento", fromDate)
      .not("empresa_id", "is", null);

    if (docsErr) throw docsErr;

    const seen = new Set<string>();
    const tasks: Array<{ company_id: string; marca: string }> = [];
    for (const d of docs ?? []) {
      const marca = (d as any).empresa_vendedora === "galsa_phillips66" ? "phillips66" : "chevron";
      const key = `${(d as any).empresa_id}|${marca}`;
      if (seen.has(key)) continue;
      seen.add(key);
      tasks.push({ company_id: (d as any).empresa_id, marca });
    }

    let created = 0;
    let existed = 0;
    let failed = 0;
    for (const t of tasks) {
      const { data: dealId, error } = await admin.rpc("get_or_create_deal_recompra_mes", {
        p_company_id: t.company_id,
        p_marca: t.marca,
        p_mes: targetMes,
      });
      if (error) {
        failed++;
        console.warn("rpc error", t, error.message);
        continue;
      }
      if (dealId) created++; else existed++;
    }

    return new Response(
      JSON.stringify({ ok: true, mes: targetMes, candidates: tasks.length, processed: created, existed, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});