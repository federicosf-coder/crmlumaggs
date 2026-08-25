import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';

const BUZON_CREDITO = 'documentos@correo.lumaggs.com.mx';
const FOLIO_REGEX = /CR-\d{4}-\d{4}/i;

function extraerEmail(from: string): string {
  const m = from?.match(/<([^>]+)>/);
  return (m ? m[1] : from || '').trim().toLowerCase();
}

const asText = (v: unknown) => {
  const s = v == null ? '' : String(v).trim();
  return s && s.toLowerCase() !== 'null' ? s : null;
};

const CONFIANZAS = ['alta', 'media', 'baja'];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error('headers svix faltantes en email-inbound-credito-webhook');
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
      console.error('error verificando firma:', (e as Error).message);
      return jsonRes({ error: 'firma_invalida' }, 401);
    }

    if (!firmaOk) {
      console.error('firma invalida en email-inbound-credito-webhook');
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

    const destinatarios: string[] = Array.isArray(data.to)
      ? data.to.map((t: unknown) => extraerEmail(String(t ?? '')))
      : [extraerEmail(String(data.to ?? ''))];
    if (!destinatarios.some((d) => d.includes(BUZON_CREDITO))) {
      return jsonRes({ ok: true, ignorado: 'destinatario_no_coincide' });
    }

    const emailId: string = String(data.email_id ?? data.id ?? '');
    const fromRaw: string = String(data.from ?? '');
    const from = extraerEmail(fromRaw);
    const subject: string | null = asText(data.subject);
    const attachments: Array<any> = Array.isArray(data.attachments) ? data.attachments : [];

    // Cuerpo del correo (texto) para buscar folio si no está en el asunto
    let bodyText = '';
    let emailHtmlRaw = '';
    const textFromPayload = asText(data.text);
    if (textFromPayload) bodyText = textFromPayload.slice(0, 6000);
    if (data.html) emailHtmlRaw = String(data.html);

    if (emailId && LOVABLE_API_KEY && RESEND_API_KEY && (!textFromPayload || !emailHtmlRaw)) {
      try {
        const emailRes = await fetch(`https://connector-gateway.lovable.dev/resend/emails/receiving/${emailId}`, {
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            'X-Connection-Api-Key': RESEND_API_KEY,
          },
        });
        if (emailRes.ok) {
          const emailJson = await emailRes.json();
          if (!emailHtmlRaw && emailJson?.html) emailHtmlRaw = String(emailJson.html);
          if (!textFromPayload) {
            let rawText = asText(emailJson?.text) || '';
            if (!rawText && emailHtmlRaw) {
              rawText = emailHtmlRaw
                .replace(/<[^>]+>/g, ' ')
                .replace(/&nbsp;/gi, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/\s+/g, ' ')
                .trim();
            }
            if (rawText) bodyText = rawText.slice(0, 6000);
          }
        }
      } catch (e) {
        console.error('error obteniendo cuerpo del correo:', (e as Error).message);
      }
    }

    if (!emailId) return jsonRes({ error: 'email_id_faltante' }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Detección de folio y solicitud de crédito
    const folioMatch = (subject && subject.match(FOLIO_REGEX)) || (bodyText && bodyText.match(FOLIO_REGEX)) || null;
    const folioDetectado = folioMatch ? folioMatch[0].toUpperCase() : null;

    let creditRequestId: string | null = null;
    if (folioDetectado) {
      const { data: solicitud } = await admin
        .from('credit_requests')
        .select('id')
        .eq('folio', folioDetectado)
        .limit(1)
        .maybeSingle();
      if (solicitud?.id) creditRequestId = solicitud.id;
    }

    if (!creditRequestId && from) {
      const { data: porCorreo } = await admin
        .from('credit_requests')
        .select('id, created_at')
        .ilike('correo_contacto', from)
        .order('created_at', { ascending: false })
        .limit(1);
      if (porCorreo && porCorreo.length > 0) creditRequestId = porCorreo[0].id;
    }

    console.log(`credito intake: folio=${folioDetectado} credit_request_id=${creditRequestId} from=${from}`);

    const validos = attachments.filter((a) => {
      const ct = String(a?.content_type ?? '').toLowerCase();
      if (ct === 'application/pdf') return true;
      if (ct.startsWith('image/')) return true;
      return false;
    });

    if (validos.length === 0) return jsonRes({ ok: true, procesados: 0, motivo: 'sin_adjuntos_validos' });

    // Catálogo de tipos de documento de crédito
    let tipos: Array<{ id: string; nombre: string; instrucciones_cliente: string | null }> = [];
    try {
      const { data: tiposData, error: tiposErr } = await admin
        .from('credit_doc_types')
        .select('id, nombre, instrucciones_cliente, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (tiposErr) throw new Error(tiposErr.message);
      tipos = (tiposData ?? []) as any;
    } catch (e) {
      console.error('error cargando credit_doc_types:', (e as Error).message);
    }

    const listaTipos = tipos
      .map((t) => `- id: ${t.id} | nombre: ${t.nombre}${t.instrucciones_cliente ? ` | instrucciones: ${t.instrucciones_cliente}` : ''}`)
      .join('\n');

    const PROMPT = `Eres un clasificador de documentos para un expediente de solicitud de crédito empresarial en México. Se te entrega un archivo adjunto que llegó por correo electrónico. Debes decidir a cuál de los siguientes tipos de documento corresponde:\n\n${listaTipos || '(sin tipos configurados)'}\n\nIGNORA firmas de correo, logos de empresas, fotos de personas y encabezados de correo reenviado. Si el archivo no parece ninguno de los documentos listados (por ejemplo es una firma de correo, un logo, o un documento no relacionado con el expediente de crédito), devuelve doc_type_id en null.\n\nResponde SOLO este JSON sin texto adicional ni markdown: {"doc_type_id":"uuid del tipo que corresponde o null si no coincide con ninguno","confianza":"alta|media|baja","razon":"explicación breve"}. El doc_type_id debe ser exactamente uno de los ids listados arriba. No inventes ids.`;

    // Lista de adjuntos con download_url y size real vía gateway de conectores
    let listado: Array<any> = [];
    try {
      const attRes = await fetch(`https://connector-gateway.lovable.dev/resend/emails/receiving/${emailId}/attachments`, {
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': RESEND_API_KEY,
        },
      });
      if (!attRes.ok) {
        console.error('error listando adjuntos:', attRes.status);
      } else {
        const attJson = await attRes.json();
        listado = attJson?.data ?? attJson ?? [];
        if (!Array.isArray(listado)) listado = [];
      }
    } catch (e) {
      console.error('error listando adjuntos:', (e as Error).message);
    }

    let procesados = 0;

    for (const att of validos) {
      try {
        const ct = String(att?.content_type ?? '').toLowerCase();
        const meta = listado.find((l: any) => String(l?.id) === String(att.id)) ?? null;
        const sizeReal = Number(meta?.size ?? 0) || 0;
        console.log(`att ${att.id}: ct=${ct} meta=${!!meta} size=${sizeReal}`);
        if (ct.startsWith('image/') && sizeReal <= 15000) continue;

        const downloadUrl = meta?.download_url ?? meta?.downloadUrl;
        if (!downloadUrl) throw new Error(`sin_download_url para adjunto ${att.id}`);

        const dl = await fetch(downloadUrl);
        if (!dl.ok) throw new Error(`descarga_fallida_${dl.status}`);
        const bytes = new Uint8Array(await dl.arrayBuffer());

        const nombreOriginal = att.filename || 'documento';
        const sanitizado = String(nombreOriginal).replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
        const mime = String(att.content_type || 'application/octet-stream');
        const storagePath = `email-intake/${emailId}/${att.id}-${sanitizado}`;

        const { error: upErr } = await admin.storage
          .from('credit-docs')
          .upload(storagePath, bytes, { contentType: mime, upsert: false });
        if (upErr) throw new Error(`upload_failed: ${upErr.message}`);

        // Clasificación con IA (nunca debe impedir el registro)
        let extraido: Record<string, unknown> | null = null;
        let extraccionError: string | null = null;

        try {
          if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY no configurada');
          if (tipos.length === 0) throw new Error('sin_tipos_activos');
          if (!mime.startsWith('image/') && mime !== 'application/pdf') {
            throw new Error(`tipo_no_soportado: ${mime}`);
          }

          let bin = '';
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          const dataUrl = `data:${mime};base64,${btoa(bin)}`;

          const contentPart = mime.startsWith('image/')
            ? { type: 'image_url', image_url: { url: dataUrl } }
            : { type: 'file', file: { filename: sanitizado || 'documento.pdf', file_data: dataUrl } };

          const aiContent: any[] = [];
          if (bodyText) {
            aiContent.push({
              type: 'text',
              text: `Contexto: este archivo venía adjunto a un correo. Texto del cuerpo del correo (puede ayudar a identificar el documento):\n\n${bodyText}`,
            });
          }
          aiContent.push({ type: 'text', text: PROMPT });
          aiContent.push(contentPart);

          const res = await fetch(GATEWAY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LOVABLE_API_KEY}` },
            body: JSON.stringify({
              model: MODEL,
              messages: [{ role: 'user', content: aiContent }],
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
          extraccionError = (e as Error).message?.slice(0, 500) || 'error_clasificacion';
          extraido = null;
        }

        const insertPayload: Record<string, unknown> = {
          credit_request_id: creditRequestId,
          folio_detectado: folioDetectado,
          storage_path: storagePath,
          nombre_archivo: nombreOriginal,
          mime_type: mime,
          estatus: 'pendiente',
          remitente_email: from || null,
          asunto_email: subject,
          resend_email_id: emailId,
        };

        if (extraido) {
          const docTypeRaw = asText(extraido.doc_type_id);
          const docTypeValido =
            docTypeRaw && UUID_REGEX.test(docTypeRaw) && tipos.some((t) => t.id === docTypeRaw) ? docTypeRaw : null;
          insertPayload.doc_type_sugerido_id = docTypeValido;

          const confRaw = (asText(extraido.confianza) || '').toLowerCase();
          insertPayload.confianza_ia = CONFIANZAS.includes(confRaw) ? confRaw : null;
          insertPayload.extraccion_raw = extraido;
        } else {
          insertPayload.doc_type_sugerido_id = null;
          insertPayload.extraccion_error = extraccionError;
        }

        const { error: insErr } = await admin.from('credito_docs_intake').insert(insertPayload);
        if (insErr) throw new Error(`insert_failed: ${insErr.message}`);

        console.log(`att ${att.id} insertado OK`);
        procesados++;
      } catch (e) {
        console.error(`adjunto ${att?.id} fallo:`, (e as Error).message);
      }
    }

    return jsonRes({ ok: true, procesados, credit_request_id: creditRequestId, folio_detectado: folioDetectado });
  } catch (e) {
    console.error('email-inbound-credito-webhook error:', e);
    return jsonRes({ error: (e as Error).message }, 500);
  }
});
