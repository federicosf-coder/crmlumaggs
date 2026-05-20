import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';

const PROMPT = `Eres un asistente experto en documentos del Registro Público de la Propiedad (RPP) de México.
La imagen/PDF adjunta es un comprobante o consulta de propiedades en RPP. Lee el documento completo y redacta un
RESUMEN EJECUTIVO en español de la(s) propiedad(es) y los datos del registro, integrando de forma narrativa y clara
los datos relevantes que aparezcan: partida, fecha de partida, sección, volante, recibo oficial, fecha y hora,
monto, analista, acto y tipo de contrato, vendedor(es) y comprador(es), folio real, tipo de predio, lote, manzana,
colonia, municipio, superficie, medidas y colindancias (Norte/Sur/Oriente/Poniente), valor de operación, valor de
avalúo, clave catastral y antecedentes.

Devuelve ÚNICAMENTE un JSON válido (sin texto adicional, sin bloque de código) con esta forma:
{ "resumen": string }

Reglas:
- "resumen" debe ser un texto corrido en párrafos (puedes usar saltos de línea), en español formal, listo para
  pegarse en un expediente.
- No inventes datos: si algún campo no aparece en el documento, simplemente no lo menciones.
- Conserva números, monedas y formato original ($, m², etc.).
- Si hay varios vendedores o compradores, menciónalos a todos.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const jsonRes = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const { request_id, who, file_b64: fileB64In, mime: mimeIn } = await req.json();
    if (!request_id || !who) return jsonRes({ error: 'missing_params' }, 400);
    if (who !== 'solicitante' && who !== 'aval') return jsonRes({ error: 'invalid_who' }, 400);
    if (fileB64In && String(fileB64In).length > 20 * 1024 * 1024) return jsonRes({ error: 'file_too_large' }, 400);

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

    let file_b64 = fileB64In as string | undefined;
    let mime = mimeIn as string | undefined;
    if (!file_b64) {
      // Fetch document from storage using stored path
      const colDoc = who === 'solicitante' ? 'rpp_solicitante_doc_path' : 'rpp_aval_doc_path';
      const { data: cr2 } = await admin.from('credit_requests').select(colDoc).eq('id', request_id).maybeSingle();
      const path = (cr2 as any)?.[colDoc] as string | null;
      if (!path) return jsonRes({ error: 'sin_comprobante' }, 400);
      const { data: blob, error: dlErr } = await admin.storage.from('credit-docs').download(path);
      if (dlErr || !blob) return jsonRes({ error: dlErr?.message || 'download_failed' }, 500);
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      file_b64 = btoa(bin);
      mime = blob.type || (path.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
    }
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
    try { parsed = JSON.parse(clean); } catch { parsed = { resumen: clean }; }
    const resumen: string = typeof parsed?.resumen === 'string' ? parsed.resumen.trim() : '';

    const col = who === 'solicitante' ? 'rpp_solicitante_data' : 'rpp_aval_data';
    const { data: cr } = await admin.from('credit_requests').select(col).eq('id', request_id).maybeSingle();
    const existing: any = (cr as any)?.[col] || {};
    const merged: any = { ...existing, resumen, resumen_generated_at: new Date().toISOString() };
    await admin.from('credit_requests').update({ [col]: merged } as any).eq('id', request_id);

    return jsonRes({ ok: true, resumen, merged });
  } catch (e: any) {
    console.error('credito-rpp-extract error', e);
    return new Response(JSON.stringify({ error: e?.message || 'server_error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});