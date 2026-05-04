import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { dealId } = await req.json();
    if (!dealId) {
      return new Response(JSON.stringify({ error: "dealId requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Deal + relaciones
    const { data: deal, error: dErr } = await supabase
      .from("crm_deals")
      .select(`
        id, title, notes, potencial_unidades, close_date, mes_negocio, pipeline_type,
        companies(name, giro, tamano_empresa, clasificacion_potencial),
        contacts(first_name, last_name, position),
        crm_pipeline_stages(name),
        crm_pipelines(nombre, marca)
      `)
      .eq("id", dealId)
      .maybeSingle();
    if (dErr) throw dErr;
    if (!deal) throw new Error("Negocio no encontrado");

    // Actividades
    const { data: activities } = await supabase
      .from("crm_activities")
      .select("type, title, description, created_at")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false })
      .limit(20);

    // Productos del deal (si existen)
    const { data: items } = await supabase
      .from("crm_deal_items")
      .select("cantidad, product:products(nombre, marca, viscosidad)")
      .eq("deal_id", dealId)
      .limit(30);

    const marca = (deal as any).crm_pipelines?.marca === "phillips66" ? "Phillips 66" : "Chevron";
    const stageName = (deal as any).crm_pipeline_stages?.name || "Desconocida";
    const empresa = (deal as any).companies?.name || "Sin empresa";
    const lastActivity = activities?.[0]?.created_at;
    const daysSince = lastActivity
      ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86400000)
      : null;

    const context = {
      negocio: deal.title,
      marca,
      etapa: stageName,
      tipo: (deal as any).pipeline_type,
      potencial_unidades: (deal as any).potencial_unidades,
      cierre: (deal as any).close_date,
      empresa: (deal as any).companies,
      contacto: (deal as any).contacts,
      notas: deal.notes,
      productos: (items || []).map((i: any) => ({
        cantidad: i.cantidad,
        nombre: i.product?.nombre,
        marca: i.product?.marca,
        viscosidad: i.product?.viscosidad,
      })),
      actividades: (activities || []).map((a) => ({
        tipo: a.type, titulo: a.title, descripcion: a.description, fecha: a.created_at,
      })),
      dias_desde_ultima_actividad: daysSince,
    };

    const systemPrompt = `Eres un Experto Senior en Ventas B2B de lubricantes industriales (Chevron y Phillips 66) en México, plataforma LubriManager. Tono profesional, directo y orientado a resultados. Responde SIEMPRE en español, con tácticas concretas y accionables HOY.`;

    const userPrompt = `Analiza este negocio y devuelve JSON estricto.\n\nDATOS:\n${JSON.stringify(context, null, 2)}\n\nRequisitos del JSON:\n{\n  "resumen": "máx 2 líneas que sintetizan el estado real",\n  "acciones": ["acción 1", "acción 2", "acción 3"],\n  "riesgo": { "hay_riesgo": boolean, "motivo": "máx 1 línea si aplica" }\n}\n\nReglas:\n- "acciones": exactamente 3 tácticas específicas para avanzar el cierre HOY.\n- Marca riesgo si hay >14 días sin actividad, etapa estancada o señales de pérdida.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "entregar_analisis",
            description: "Entrega el análisis estratégico estructurado",
            parameters: {
              type: "object",
              properties: {
                resumen: { type: "string" },
                acciones: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 },
                riesgo: {
                  type: "object",
                  properties: {
                    hay_riesgo: { type: "boolean" },
                    motivo: { type: "string" },
                  },
                  required: ["hay_riesgo"],
                },
              },
              required: ["resumen", "acciones", "riesgo"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "entregar_analisis" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de uso alcanzado, intenta en un momento." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA agotados. Agrega saldo en Lovable Cloud." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      throw new Error("Error del servicio de IA");
    }

    const data = await aiResp.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : null;
    if (!parsed) throw new Error("Respuesta de IA vacía");

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("strategic-analysis error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});