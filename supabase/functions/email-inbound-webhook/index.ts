import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'npm:resend@4';

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';

const PROMPT = `Del comprobante de pago (transferencia, depósito o pago con tarjeta) extrae SOLO este JSON sin texto adicional ni markdown: {"monto":0,"fecha":"YYYY-MM-DD o null","banco":"string o null","referencia":"string o null","clabe":"string de 18 dígitos o null","tarjeta_ultimos4":"4 dígitos o null","nombre_detectado":"string o null","metodo":"transferencia|efectivo|tarjeta|cheque|otro"}. "nombre_detectado" es el nombre de la empresa o persona que aparece como ordenante, beneficiario, titular de la cuenta o en el concepto (el nombre más probable del cliente). "metodo" debe ser uno de: transferencia, efectivo, tarjeta, cheque, otro, según lo que indique el comprobante; si no es claro usa "transferencia" porque es el método más común. Si el comprobante no trae alguno de estos datos, usa null en ese campo. No inventes valores.`;

const METODOS = ['transferencia', 'efectivo', 'tarjeta', 'cheque', 'otro'];

function normalizarAlias(input: string): string {
  return input
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extraerEmail(from: string): string {
  const m = from?.match(/<([^>]+)>/);
  return (m ? m[1] : from || '').trim().toLowerCase();
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const jsonRes = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  if (req.method !== 'POST') return jsonRes({ error: 'method_not_allowed' }, 405);

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const RESEND_WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!RESEND_WEBHOOK_SECRET) {
      console.error('RESEND_WEBHOOK_SECRET no configurado');
      return jsonRes({ error: 'RESEND_WEBHOOK_SECRET no configurado' }, 500);
    }

    const rawBody = await req.text();
    const resend = new Resend(RESEND_API_KEY);

    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error('headers svix faltantes en email-inbound-webhook');
      return jsonRes({ error: 'firma_invalida' }, 401);
    }

    let firmaOk = false;
    try {
      const secretB64 = RESEND_WEBHOOK_SECRET.replace(/^whsec_/, '');
      const keyBytes = Uint8Array.from(atob(secretB64), (c) => c.charCodeAt(0));
      const key = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      const mensaje = `${svixId}.${svixTimestamp}.${rawBody}`;
      const firmaBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(mensaje));
      const firmaBytes = new Uint8Array(firmaBuf);
      let firmaBin = '';
      for (let i = 0; i < firmaBytes.length; i++) firmaBin += String.fromCharCode(firmaBytes[i]);
      const esperada = btoa(firmaBin);

      const iguales = (a: string, b: string) => {
        if (a.length !== b.length) return false;
        let diff = 0;
        for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
        return diff === 0;
      };

      for (const parte of svixSignature.split(' ')) {
        const [version, firma] = parte.split(',');
        if (version === 'v1' && firma && iguales(esperada, firma)) {
          firmaOk = true;
          break;
        }
      }
    } catch (e) {
      console.error('error verificando firma en email-inbound-webhook:', (e as Error).message);
      return jsonRes({ error: 'firma_invalida' }, 401);
    }

    if (!firmaOk) {
      console.error('firma invalida en email-inbound-webhook');
      return jsonRes({ error: 'firma_invalida' }, 401);
    }

    let evt: any;
    try {
      evt = JSON.parse(rawBody);
    } catch {
      return jsonRes({ error: 'payload_invalido' }, 400);
    }

    if (evt?.type !== 'email.received') return jsonRes({ ok: true, ignorado: evt?.type ?? null });


    const data = evt.data ?? {};
    const emailId: string = String(data.email_id ?? data.id ?? '');
    const fromRaw: string = String(data.from ?? '');
    const from = extraerEmail(fromRaw);
    const subject: string | null = asText(data.subject);
    const attachments: Array<any> = Array.isArray(data.attachments) ? data.attachments : [];

    if (!emailId) return jsonRes({ error: 'email_id_faltante' }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Idempotencia
    const { data: previos } = await admin
      .from('comprobantes_intake')
      .select('id')
      .eq('resend_email_id', emailId)
      .limit(1);
    if (previos && previos.length > 0) {
      return jsonRes({ ok: true, duplicado: true, procesados: 0 });
    }

    // Identificación del remitente
    let ejecutivoId: string | null = null;
    let empresaId: string | null = null;

    if (from) {
      const { data: perfil } = await admin
        .from('profiles')
        .select('id')
        .ilike('email', from)
        .limit(1)
        .maybeSingle();
      if (perfil?.id) ejecutivoId = perfil.id;

      const { data: contacto } = await admin
        .from('contacts')
        .select('company_id')
        .ilike('email', from)
        .limit(1)
        .maybeSingle();
      if (contacto?.company_id) {
        empresaId = contacto.company_id;
      } else {
        const { data: empresa } = await admin
          .from('companies')
          .select('id')
          .ilike('email', from)
          .limit(1)
          .maybeSingle();
        if (empresa?.id) empresaId = empresa.id;
      }

      if (empresaId && !ejecutivoId) {
        const { data: ej } = await admin
          .from('company_ejecutivos')
          .select('user_id')
          .eq('company_id', empresaId)
          .limit(1)
          .maybeSingle();
        if (ej?.user_id) ejecutivoId = ej.user_id;
      }
    }

    const validos = attachments.filter((a) => {
      const ct = String(a?.content_type ?? '').toLowerCase();
      return ct.startsWith('image/') || ct === 'application/pdf';
    });

    if (validos.length === 0) return jsonRes({ ok: true, procesados: 0, motivo: 'sin_adjuntos_validos' });

    // Lista de adjuntos con download_url
    let listado: Array<any> = [];
    try {
      const res: any = await (resend as any).emails.receiving.attachments.list({ emailId });
      listado = res?.data?.data ?? res?.data ?? [];
      if (!Array.isArray(listado)) listado = [];
    } catch (e) {
      console.error('error listando adjuntos:', (e as Error).message);
    }

    let procesados = 0;

    for (const att of validos) {
      try {
        const meta = listado.find((l: any) => String(l?.id) === String(att.id)) ?? null;
        const downloadUrl = meta?.download_url ?? meta?.downloadUrl;
        if (!downloadUrl) throw new Error(`sin_download_url para adjunto ${att.id}`);

        const dl = await fetch(downloadUrl);
        if (!dl.ok) throw new Error(`descarga_fallida_${dl.status}`);
        const bytes = new Uint8Array(await dl.arrayBuffer());

        const nombreOriginal = att.filename || 'comprobante';
        const sanitizado = String(nombreOriginal).replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
        const mime = String(att.content_type || 'application/octet-stream');
        const storagePath = `email/${emailId}/${att.id}-${sanitizado}`;

        const { error: upErr } = await admin.storage
          .from('comprobantes-intake')
          .upload(storagePath, bytes, { contentType: mime, upsert: false });
        if (upErr) throw new Error(`upload_failed: ${upErr.message}`);

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

          const json = await res.json();
          const text = json?.choices?.[0]?.message?.content || '';
          const m = text.match(/\{[\s\S]*\}/);
          if (!m) throw new Error('json_not_found');
          extraido = JSON.parse(m[0]);
        } catch (e) {
          extraccionError = (e as Error).message?.slice(0, 500) || 'error_extraccion';
          extraido = null;
        }

        const insertPayload: Record<string, unknown> = {
          ejecutivo_id: ejecutivoId,
          canal: 'email',
          storage_path: storagePath,
          nombre_archivo: nombreOriginal,
          mime_type: mime,
          estatus: 'pendiente',
          remitente_email: from || null,
          asunto_email: subject,
          resend_email_id: emailId,
        };
        if (empresaId) insertPayload.empresa_id = empresaId;

        if (extraido) {
          insertPayload.monto_extraido = asNumber(extraido.monto);
          insertPayload.fecha_extraida = asFecha(extraido.fecha);
          insertPayload.banco_extraido = asText(extraido.banco);
          insertPayload.referencia_extraida = asText(extraido.referencia);
          insertPayload.clabe_extraida = soloDigitos(extraido.clabe);
          insertPayload.tarjeta_ultimos4_extraida = soloDigitos(extraido.tarjeta_ultimos4);
          insertPayload.extraccion_raw = extraido;

          const nombreDetectado = asText(extraido.nombre_detectado);
          insertPayload.nombre_detectado = nombreDetectado;

          const metodoRaw = (asText(extraido.metodo) || '').toLowerCase();
          insertPayload.metodo_extraido = METODOS.includes(metodoRaw) ? metodoRaw : 'transferencia';

          if (nombreDetectado && !empresaId) {
            const aliasNorm = normalizarAlias(nombreDetectado);
            if (aliasNorm) {
              const { data: alias } = await admin
                .from('comprobante_cliente_aliases')
                .select('id, empresa_id, veces_usado')
                .eq('alias_normalizado', aliasNorm)
                .maybeSingle();
              if (alias?.empresa_id) {
                insertPayload.empresa_id = alias.empresa_id;
                await admin
                  .from('comprobante_cliente_aliases')
                  .update({ veces_usado: (alias.veces_usado || 0) + 1, updated_at: new Date().toISOString() })
                  .eq('id', alias.id);
              }
            }
          }
        } else {
          insertPayload.extraccion_error = extraccionError;
        }

        const { error: insErr } = await admin.from('comprobantes_intake').insert(insertPayload);
        if (insErr) throw new Error(`insert_failed: ${insErr.message}`);

        procesados++;
      } catch (e) {
        console.error(`adjunto ${att?.id} fallo:`, (e as Error).message);
      }
    }

    return jsonRes({ ok: true, procesados });
  } catch (e) {
    console.error('email-inbound-webhook error:', e);
    return jsonRes({ error: (e as Error).message }, 500);
  }
});
