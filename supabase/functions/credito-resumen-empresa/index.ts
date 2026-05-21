import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { request_id } = await req.json();
    if (!request_id) {
      return new Response(JSON.stringify({ error: 'request_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY no configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: cr, error: crErr } = await admin
      .from('credit_requests')
      .select('*, companies(*)')
      .eq('id', request_id)
      .maybeSingle();
    if (crErr || !cr) {
      return new Response(JSON.stringify({ error: 'Solicitud no encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const c: any = cr.companies || {};
    const name = c.razon_social || c.name || cr.razon_social || cr.nombre_comercial || '';
    const rfc = cr.rfc || cr.csf_rfc || c.rfc || '';
    const website = c.website || '';
    const email = c.email || cr.correo_contacto || '';

    // Resolver industrias estrictamente desde el catálogo administrable.
    // No usar csf_actividad_economica ni códigos SCIAN: el resumen debe
    // referirse a la industria solo con las etiquetas del catálogo.
    const claves: string[] = Array.isArray(c.industrias) ? c.industrias : [];
    let industriaLabels: string[] = [];
    if (claves.length > 0) {
      const { data: catRows } = await admin
        .from('industrias_catalog')
        .select('clave, etiqueta')
        .in('clave', claves);
      industriaLabels = (catRows || []).map((r: any) => r.etiqueta || r.clave);
    }
    const industry = industriaLabels.join(', ');

    const systemPrompt = `Eres un asistente de inteligencia comercial para un vendedor B2B en México. Tu trabajo NO es emitir un dictamen crediticio ni recomendar aprobar o rechazar a la empresa. Tu trabajo es entregarle al vendedor toda la información útil que encuentres en línea sobre la empresa, para que él tome una decisión informada. Tono: "aquí está todo lo que encontré sobre esta empresa", nunca "no la apruebes".`;
    const userPrompt = `Datos de la empresa: ${name}, RFC: ${rfc}, Sitio web: ${website}, Industria: ${industry || '(no asignada)'}, Email: ${email}

Busca en: su sitio web, perfil de Google Business, LinkedIn, notas de prensa, directorios sectoriales, portales de transporte/logística y registros públicos de empresas en México.

IMPORTANTE — Industria/Giro: cuando te refieras a la industria o giro de la empresa, usa EXCLUSIVAMENTE las etiquetas listadas arriba en "Industria" (provenientes de nuestro catálogo interno). NO inventes subcategorías, NO uses códigos ni nombres SCIAN, NO uses la actividad económica del CSF/SAT, NO agregues frases como "específicamente en …". Si no hay industria asignada, simplemente omite mencionar la industria.

Devuelve ÚNICAMENTE un objeto JSON válido (sin markdown, sin texto extra):

{
  "resumen": string (exactamente 2 párrafos en español, en formato narrativo y fluido —no listas, no viñetas—. Párrafo 1: quién es la empresa, a qué se dedica, desde cuándo opera, dónde tiene presencia y qué tan legítima/establecida se ve. Párrafo 2: contexto comercial útil para el vendedor —tamaño aparente, clientes o sectores que atiende, señales de actividad reciente, presencia digital, o cualquier dato relevante que ayude a entenderla mejor como prospecto—.),
  "hallazgos": string[] (3-5 datos concretos encontrados en línea sobre la empresa),
  "fuentes_consultadas": string[] (URLs reales o nombres de las fuentes utilizadas)
}

Reglas de tono OBLIGATORIAS para el resumen:
- Es una herramienta de inteligencia para el vendedor, NO un dictamen crediticio.
- NO emitas recomendaciones de aprobar/rechazar crédito, NO uses palabras como "riesgo", "no recomendado", "rechazar", "aprobar", "score", "calificación crediticia".
- NO inventes información: si algo no se puede confirmar, omítelo en lugar de especular.
- Lenguaje neutral, informativo y útil, como si le pasaras tus notas de investigación a un colega vendedor.`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: 'Límite de uso alcanzado. Intenta más tarde.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: 'Créditos de IA agotados. Agrega créditos al workspace.' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!aiRes.ok) {
      const t = await aiRes.text();
      return new Response(JSON.stringify({ error: 'AI error: ' + t.slice(0, 300) }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      return new Response(JSON.stringify({ error: 'AI no devolvió contenido' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let parsed: any;
    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return new Response(JSON.stringify({ error: 'AI no devolvió JSON válido', raw }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resumen = String(parsed?.resumen || '').trim();
    const hallazgos = Array.isArray(parsed?.hallazgos) ? parsed.hallazgos.map((x: any) => String(x)) : [];
    const fuentes_consultadas = Array.isArray(parsed?.fuentes_consultadas) ? parsed.fuentes_consultadas.map((x: any) => String(x)) : [];
    const data = { hallazgos, fuentes_consultadas };

    await admin.from('credit_requests').update({
      resumen_empresa: resumen,
      resumen_empresa_data: data,
      resumen_empresa_generated_at: new Date().toISOString(),
      resumen_empresa_generated_by: userData.user.id,
    }).eq('id', request_id);

    return new Response(JSON.stringify({ resumen, ...data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});