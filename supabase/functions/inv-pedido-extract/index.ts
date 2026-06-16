import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';

const PROMPT_CHEVRON = `Eres un asistente que extrae datos de órdenes de compra Chevron (Business Point).
Del PDF adjunto extrae ÚNICAMENTE un JSON válido (sin texto extra) con esta forma:
{
  "numero_po": string,
  "numero_orden": string,
  "fecha_despacho": "YYYY-MM-DD",
  "almacen_destino": string,
  "total_monto": number,
  "moneda": "MXN",
  "lineas": [
    { "codigo": string, "descripcion": string, "cantidad": number, "unidad": string, "precio_unitario": number, "precio_neto": number }
  ]
}
Reglas: códigos de 9 dígitos. PL=cubeta, DR=tambor. No inventes valores; omite líneas dudosas.`;

const PROMPT_PHILLIPS = `Eres un asistente que extrae datos de órdenes Phillips 66 (History Orders Detail).
Del PDF adjunto extrae ÚNICAMENTE un JSON válido (sin texto extra) con esta forma:
{
  "numero_orden": string,
  "numero_po": string,
  "fecha_pedido": "YYYY-MM-DD",
  "fecha_despacho": "YYYY-MM-DD",
  "planta": string,
  "total_monto": number,
  "moneda": "USD",
  "lineas": [
    { "codigo": string, "nombre": string, "precio_por_galon": number, "galones_por_empaque": number, "tipo_empaque": string, "cantidad_galones": number, "cantidad_empaques": number }
  ]
}
Reglas: códigos de 8 dígitos con ceros a la izquierda. Pail=5 GAL, Drum=55 GAL, Case=3 GAL.
cantidad_empaques = cantidad_galones / galones_por_empaque. No inventes valores.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const jsonRes = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const { proveedor, file_path } = await req.json();
    if (!proveedor || !file_path) return jsonRes({ error: 'missing_params' }, 400);

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
    const { data: blob, error: dlErr } = await admin.storage.from('inventario-pedidos').download(file_path);
    if (dlErr || !blob) return jsonRes({ error: dlErr?.message || 'download_failed' }, 500);
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const file_b64 = btoa(bin);
    const mime = 'application/pdf';
    const dataUrl = `data:${mime};base64,${file_b64}`;
    const prompt = proveedor === 'phillips66' ? PROMPT_PHILLIPS : PROMPT_CHEVRON;

    const res = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'file', file: { filename: 'pedido.pdf', file_data: dataUrl } },
        ] }],
        max_tokens: 2000,
      }),
    });
    if (res.status === 429) return jsonRes({ error: 'rate_limit' }, 429);
    if (res.status === 402) return jsonRes({ error: 'credits_exhausted' }, 402);
    if (!res.ok) return jsonRes({ error: `gateway_${res.status}` }, 500);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return jsonRes({ error: 'json_not_found', raw: text });
    try {
      const parsed = JSON.parse(m[0]);
      return jsonRes({ extracted: parsed, raw: text });
    } catch {
      return jsonRes({ error: 'invalid_json', raw: text });
    }
  } catch (e) {
    return jsonRes({ error: (e as Error).message }, 500);
  }
});