import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';

const PROMPT = `Esta es una imagen o PDF de un calendario de entregas de un cliente corporativo. Tiene formato de matriz: cada fila es un producto (con código Chevron y nombre), y las columnas son fechas de entrega con la cantidad a entregar en cada celda. Extrae SOLO este JSON sin texto adicional ni markdown: {"lugar_entrega":"string o null","numero_pedido":"string o null","entregas":[{"codigo":"string","nombre_producto":"string","fecha":"YYYY-MM-DD","cantidad":0}]}. Genera una entrada en "entregas" por cada combinación producto+fecha donde la cantidad sea mayor a 0 — ignora las celdas en cero o vacías. Las fechas suelen venir como 'DD-Mmm' en el encabezado de columna (ej. '10-Aug'); conviértelas a formato YYYY-MM-DD usando el año que corresponda según el contexto del documento (busca un año explícito en el título o encabezado; si no lo encuentras, usa el año actual). El código de producto suele ser el primer valor de cada fila (columna 'CHEVRON CODE' o similar). "lugar_entrega" es el nombre de la planta, yarda o ubicación de entrega si el documento lo menciona explícitamente (ej. "Planta Norte", "Yarda 2"); si el documento no menciona ninguna ubicación específica, usa null. "numero_pedido" es el número de pedido/solicitud de entrega del documento — en los PDF de Hyundai aparece como un número (ej. "264057312") justo debajo del texto "Solicitud de Entrega" o similar; en otros documentos puede tener otro nombre o no existir. Si no lo encuentras, usa null.`;

function mimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'application/pdf';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const jsonRes = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const { cliente, file_path } = await req.json();
    if (!cliente || !file_path) return jsonRes({ error: 'missing_params' }, 400);

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
    const { data: blob, error: dlErr } = await admin.storage.from('entregas-corporativas').download(file_path);
    if (dlErr || !blob) return jsonRes({ error: dlErr?.message || 'download_failed' }, 500);
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const file_b64 = btoa(bin);
    const mime = mimeFromPath(file_path);
    const dataUrl = `data:${mime};base64,${file_b64}`;

    const contentPart = mime === 'application/pdf'
      ? { type: 'file', file: { filename: file_path.split('/').pop() || 'calendario.pdf', file_data: dataUrl } }
      : { type: 'image_url', image_url: { url: dataUrl } };

    const res = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: [
          { type: 'text', text: `Cliente: ${cliente}\n\n${PROMPT}` },
          contentPart,
        ] }],
        max_tokens: 8000,
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