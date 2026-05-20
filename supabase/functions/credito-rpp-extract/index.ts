import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';

const PROMPT = `Eres un asistente experto en documentos del Registro Público de la Propiedad (RPP) de México.
La imagen/PDF adjunta es un comprobante o consulta de propiedades en RPP. Extrae TODOS los campos que puedas identificar
y devuelve ÚNICAMENTE un JSON válido (sin texto adicional, sin bloque de código) con esta estructura. Usa null si no aparece:
{
  "partida": string|null,
  "fecha_partida": string|null,
  "seccion": string|null,
  "volante": string|null,
  "recibo_oficial": string|null,
  "fecha": string|null,
  "hora": string|null,
  "monto": string|null,
  "analista": string|null,
  "acto": string|null,
  "tipo_contrato": string|null,
  "vendedor": string|null,
  "comprador": string|null,
  "folio_real": string|null,
  "tipo_predio": string|null,
  "lote": string|null,
  "manzana": string|null,
  "colonia": string|null,
  "municipio": string|null,
  "superficie": string|null,
  "medidas_colindancias": string|null,
  "valor_operacion": string|null,
  "valor_avaluo": string|null,
  "clave_catastral": string|null,
  "antecedentes": string|null
}

Reglas:
- Si hay varios vendedores o compradores, sepáralos con " / ".
- "medidas_colindancias" debe contener todas las medidas y colindancias (Norte/Sur/Oriente/Poniente) en un solo string.
- Conserva números, monedas y formato original ($, m², etc.).
- No inventes datos.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const jsonRes = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const { request_id, who, file_b64, mime } = await req.json();
    if (!request_id || !who || !file_b64) return jsonRes({ error: 'missing_params' }, 400);
    if (who !== 'solicitante' && who !== 'aval') return jsonRes({ error: 'invalid_who' }, 400);
    if (String(file_b64).length > 20 * 1024 * 1024) return jsonRes({ error: 'file_too_large' }, 400);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return jsonRes({ error: 'LOVABLE_API_KEY no configurada' }, 500);

    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return jsonRes({ error: 'No autenticado' }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const isPdf = (mime || '').includes('pdf');
    const dataUrl = `data:${mime || 'image/jpeg'};base64,${file_b64}`;
    const content: any[] = [{ type: 'text', text: PROMPT }];
    if (isPdf) content.push({ type: 'file', file: { filename: 'rpp.pdf', file_data: dataUrl } });
    else content.push({ type: 'image_url', image_url: { url: dataUrl } });

    const res = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content }],
        response_format: { type: 'json_object' },
      }),
    });
    if (res.status === 429) return jsonRes({ error: 'rate_limited' }, 429);
    if (res.status === 402) return jsonRes({ error: 'credits_exhausted' }, 402);
    if (!res.ok) return jsonRes({ error: `ai_error_${res.status}: ${await res.text()}` }, 500);
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content || '{}';
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    let parsed: any = {};
    try { parsed = JSON.parse(clean); } catch { parsed = {}; }

    // Merge with existing data (parsed values override null/empty existing)
    const col = who === 'solicitante' ? 'rpp_solicitante_data' : 'rpp_aval_data';
    const { data: cr } = await admin.from('credit_requests').select(col).eq('id', request_id).maybeSingle();
    const existing: any = (cr as any)?.[col] || {};
    const merged: any = { ...existing };
    for (const [k, v] of Object.entries(parsed)) {
      if (v !== null && v !== undefined && String(v).trim() !== '') merged[k] = v;
    }
    await admin.from('credit_requests').update({ [col]: merged } as any).eq('id', request_id);

    return jsonRes({ ok: true, parsed, merged });
  } catch (e: any) {
    console.error('credito-rpp-extract error', e);
    return new Response(JSON.stringify({ error: e?.message || 'server_error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});