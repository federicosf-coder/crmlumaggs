import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';

const PROMPT = `Esta es una foto tomada en campo de un vehículo, letrero, aviso o tarjeta de presentación de un posible cliente/prospecto de venta de lubricantes. Extrae SOLO este JSON sin texto adicional ni markdown: {"nombre_contacto":"string o null","empresa_nombre":"string o null","telefono":"string o null","giro_negocio":"string o null (ej. transporte, taller mecánico, construcción, refaccionaria, etc, basado en lo que se vea en la imagen)","notas":"string o null (cualquier otro dato visible relevante: dirección parcial, placas, colores corporativos, etc)"}. Si no puedes leer con certeza algún dato, usa null en ese campo. No inventes información que no esté visible en la imagen.`;

function mimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'heic') return 'image/heic';
  return 'image/jpeg';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const jsonRes = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const { file_path } = await req.json();
    if (!file_path) return jsonRes({ error: 'missing_params' }, 400);

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
    const { data: blob, error: dlErr } = await admin.storage.from('leads-fotos').download(file_path);
    if (dlErr || !blob) return jsonRes({ error: dlErr?.message || 'download_failed' }, 500);
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const dataUrl = `data:${mimeFromPath(file_path)};base64,${btoa(bin)}`;

    const res = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: [
          { type: 'text', text: PROMPT },
          { type: 'image_url', image_url: { url: dataUrl } },
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
      return jsonRes({ extracted: JSON.parse(m[0]), raw: text });
    } catch {
      return jsonRes({ error: 'invalid_json', raw: text });
    }
  } catch (e) {
    return jsonRes({ error: (e as Error).message }, 500);
  }
});
