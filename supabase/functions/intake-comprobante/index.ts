import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';

const PROMPT = `Del comprobante de pago (transferencia, depósito o pago con tarjeta) extrae SOLO este JSON sin texto adicional ni markdown: {"monto":0,"fecha":"YYYY-MM-DD o null","banco":"string o null","referencia":"string o null","clabe":"string de 18 dígitos o null","tarjeta_ultimos4":"4 dígitos o null"}. Si el comprobante no trae alguno de estos datos, usa null en ese campo. No inventes valores.`;

const CANALES = ['android_share', 'ios_shortcut', 'app_manual'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const jsonRes = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  if (req.method !== 'POST') return jsonRes({ error: 'method_not_allowed' }, 405);

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return jsonRes({ error: 'multipart_requerido' }, 400);
    }

    const file = form.get('file');
    const token = (form.get('token') as string | null)?.trim() || '';
    let canal = (form.get('canal') as string | null)?.trim() || 'app_manual';
    if (!CANALES.includes(canal)) canal = 'app_manual';

    if (!(file instanceof File)) return jsonRes({ error: 'archivo_faltante' }, 400);
    if (!token) return jsonRes({ error: 'token_faltante' }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: tokenRow } = await admin
      .from('user_upload_tokens')
      .select('id, user_id')
      .eq('token', token)
      .eq('revoked', false)
      .maybeSingle();

    if (!tokenRow) return jsonRes({ error: 'token_invalido' }, 401);

    await admin
      .from('user_upload_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', tokenRow.id);

    const nombreOriginal = file.name || 'comprobante';
    const sanitizado = nombreOriginal.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
    const storagePath = `${tokenRow.user_id}/${Date.now()}-${sanitizado}`;
    const mime = file.type || 'application/octet-stream';
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: upErr } = await admin.storage
      .from('comprobantes-intake')
      .upload(storagePath, bytes, { contentType: mime, upsert: false });
    if (upErr) return jsonRes({ error: 'upload_failed', detail: upErr.message }, 500);

    // Extracción con IA (nunca debe impedir el registro)
    let extraido: Record<string, unknown> | null = null;
    let extraccionError: string | null = null;

    try {
      if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY no configurada');
      if (!mime.startsWith('image/') && mime !== 'application/pdf') {
        throw new Error(`tipo_no_soportado: ${mime}`);
      }

      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const dataUrl = `data:${mime};base64,${btoa(bin)}`;

      const contentPart = mime.startsWith('image/')
        ? { type: 'image_url', image_url: { url: dataUrl } }
        : { type: 'file', file: { filename: sanitizado || 'comprobante.pdf', file_data: dataUrl } };

      const res = await fetch(GATEWAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LOVABLE_API_KEY}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, contentPart] }],
          max_tokens: 1000,
        }),
      });

      if (res.status === 429) throw new Error('rate_limit');
      if (res.status === 402) throw new Error('credits_exhausted');
      if (!res.ok) throw new Error(`gateway_${res.status}`);

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || '';
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('json_not_found');
      extraido = JSON.parse(m[0]);
    } catch (e) {
      extraccionError = (e as Error).message?.slice(0, 500) || 'error_extraccion';
      extraido = null;
    }

    const soloDigitos = (v: unknown) => {
      const s = v == null ? '' : String(v).replace(/\D/g, '');
      return s || null;
    };
    const asText = (v: unknown) => {
      const s = v == null ? '' : String(v).trim();
      return s && s.toLowerCase() !== 'null' ? s : null;
    };
    const asNumber = (v: unknown) => {
      if (v == null) return null;
      const n = Number(String(v).replace(/[^0-9.-]/g, ''));
      return Number.isFinite(n) ? n : null;
    };
    const asFecha = (v: unknown) => {
      const s = asText(v);
      return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
    };

    const insertPayload: Record<string, unknown> = {
      ejecutivo_id: tokenRow.user_id,
      canal,
      storage_path: storagePath,
      nombre_archivo: nombreOriginal,
      mime_type: mime,
      estatus: 'pendiente',
    };

    if (extraido) {
      insertPayload.monto_extraido = asNumber(extraido.monto);
      insertPayload.fecha_extraida = asFecha(extraido.fecha);
      insertPayload.banco_extraido = asText(extraido.banco);
      insertPayload.referencia_extraida = asText(extraido.referencia);
      insertPayload.clabe_extraida = soloDigitos(extraido.clabe);
      insertPayload.tarjeta_ultimos4_extraida = soloDigitos(extraido.tarjeta_ultimos4);
      insertPayload.extraccion_raw = extraido;
    } else {
      insertPayload.extraccion_error = extraccionError;
    }

    const { data: inserted, error: insErr } = await admin
      .from('comprobantes_intake')
      .insert(insertPayload)
      .select('id')
      .single();

    if (insErr) return jsonRes({ error: 'insert_failed', detail: insErr.message }, 500);

    return jsonRes({ ok: true, intake_id: inserted.id, extraccion_error: extraccionError });
  } catch (e) {
    return jsonRes({ error: (e as Error).message }, 500);
  }
});
