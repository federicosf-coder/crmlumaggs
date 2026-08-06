import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';

const PROMPT_CHEVRON = `Del PDF de orden Chevron Business Point extrae SOLO este JSON sin texto adicional ni markdown:
{"numero_po":"string","numero_orden":"string","almacen_destino":"1001 o 1002","total_monto":0,"moneda":"MXN","estado_general":"string","lineas":[{"codigo":"string","descripcion":"string","cantidad":0,"unidad":"string","precio_unitario":0,"precio_neto":0,"estado":"string"}]}
El código del producto son los primeros 9 dígitos de cada línea. La cantidad es el número antes de 'CA','DR','PL' u otra unidad de empaque. almacen_destino: si el campo "Destinatario:" menciona "Mexicali" usa "1001", si menciona "Tijuana" usa "1002". estado_general es el texto que aparece en "Estado de la orden:". estado de cada línea es el texto que aparece debajo de esa línea de producto (ej. "En proceso", "Programado", "Cancelado"). Ignora las fechas de entrega.`;

const PROMPT_PHILLIPS = `Del PDF de History Orders Detail de Phillips 66 extrae SOLO este JSON sin texto adicional ni markdown:
{"numero_orden":"string","numero_po":"string","fecha_pedido":"YYYY-MM-DD","planta":"string","almacen_destino":"string","total_monto":0,"moneda":"USD","lineas":[{"codigo":"string","nombre":"string","precio_por_galon":0,"galones_por_empaque":0,"cantidad_empaques":0,"precio_total":0}]}
El almacen_destino viene del campo 'Additional Bol'. El código es el número de 8 dígitos. La cantidad de empaques es el número en la columna Quantity.`;

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