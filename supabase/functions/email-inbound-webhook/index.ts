import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';

const PROMPT = `Este documento puede ser un comprobante de pago (transferencia SPEI, depósito o pago con tarjeta) o puede venir rodeado de contenido irrelevante: encabezados de correo reenviado (De/Para/Asunto/CC), firmas de correo con fotos, logos de empresas, etc. IGNORA por completo firmas de correo, logos, fotos de personas y encabezados de correo — enfócate SOLO en los datos del comprobante bancario en sí (la tabla o ticket con los datos de la operación). Extrae SOLO este JSON sin texto adicional ni markdown: {"monto":0,"fecha":"YYYY-MM-DD o null","banco":"string o null","referencia":"string o null","clabe":"string de 18 dígitos o null","tarjeta_ultimos4":"4 dígitos o null","nombre_detectado":"string o null","metodo":"transferencia|efectivo|tarjeta|cheque|otro"}. "monto" es el importe principal de la operación (el 'Importe a Transferir' o equivalente, NUNCA la comisión ni el IVA de la comisión). "nombre_detectado" es específicamente el ORDENANTE/PAGADOR de la transferencia (quien envía el dinero, el campo 'Nombre del Ordenante' o equivalente) — NUNCA el beneficiario/receptor (que normalmente es la empresa que recibe el pago), y NUNCA el nombre de alguien que reenvía el correo o aparece en una firma. "metodo" debe ser uno de: transferencia, efectivo, tarjeta, cheque, otro, según lo que indique el comprobante; si no es claro usa "transferencia" porque es el método más común. Si no encuentras un comprobante bancario real en el documento (por ejemplo, si solo hay una firma de correo o un logo), deja todos los campos en null excepto "metodo" que debe ser "transferencia". No inventes valores.`;

const METODOS = ['transferencia', 'efectivo', 'tarjeta', 'cheque', 'otro'];

const BUZON_COMPROBANTES = 'comprobantes@correo.lumaggs.com.mx';
const BUZON_CREDITO = 'documentos@correo.lumaggs.com.mx';
const BUZON_PRECIOS = 'precios@correo.lumaggs.com.mx';
const FOLIO_REGEX = /CR-\d{4}-\d{4}/i;
const CONFIANZAS = ['alta', 'media', 'baja'];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    const destinatarios: string[] = Array.isArray(data.to)
      ? data.to.map((t: unknown) => extraerEmail(String(t ?? '')))
      : [extraerEmail(String(data.to ?? ''))];
    const esComprobantes = destinatarios.some((d) => d.includes(BUZON_COMPROBANTES));
    const esCredito = !esComprobantes && destinatarios.some((d) => d.includes(BUZON_CREDITO));
    const esPrecios =
      !esComprobantes && !esCredito && destinatarios.some((d) => d.includes(BUZON_PRECIOS));
    if (!esComprobantes && !esCredito && !esPrecios) {
      return jsonRes({ ok: true, ignorado: 'destinatario_no_coincide' });
    }


    const emailId: string = String(data.email_id ?? data.id ?? '');
    const fromRaw: string = String(data.from ?? '');
    const from = extraerEmail(fromRaw);
    const subject: string | null = asText(data.subject);
    const attachments: Array<any> = Array.isArray(data.attachments) ? data.attachments : [];

    // Texto del cuerpo del correo como contexto adicional para la extracción con IA
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
        } else {
          const errorBody = await emailRes.text();
          console.error('fetch cuerpo correo no OK:', emailRes.status, errorBody);
        }
      } catch (e) {
        console.error('error obteniendo cuerpo del correo:', (e as Error).message);
      }
    }

    if (!emailId) return jsonRes({ error: 'email_id_faltante' }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ============ FLUJO AUTORIZACIÓN DE PRECIO (precios@) ============
    if (esPrecios) {
      let asuntoLimpio = String(subject ?? '').trim();
      const prefijoRe = /^(re|res|fw|fwd|aw)\s*:\s*/i;
      const corcheteRe = /^\[[^\]]*\]\s*/;
      let cambio = true;
      while (cambio) {
        cambio = false;
        if (prefijoRe.test(asuntoLimpio)) {
          asuntoLimpio = asuntoLimpio.replace(prefijoRe, '').trim();
          cambio = true;
        }
        if (corcheteRe.test(asuntoLimpio)) {
          asuntoLimpio = asuntoLimpio.replace(corcheteRe, '').trim();
          cambio = true;
        }
      }

      let autorizacionId: string | null = null;
      if (asuntoLimpio) {
        const { data: exactas } = await admin
          .from('documento_autorizaciones_precio')
          .select('id, estatus')
          .eq('estatus', 'enviado')
          .eq('asunto_enviado', asuntoLimpio)
          .order('enviado_at', { ascending: false })
          .limit(1);
        if (exactas && exactas.length > 0) {
          autorizacionId = exactas[0].id;
        } else {
          const { data: parciales } = await admin
            .from('documento_autorizaciones_precio')
            .select('id, estatus')
            .eq('estatus', 'enviado')
            .ilike('asunto_enviado', `%${asuntoLimpio}%`)
            .order('enviado_at', { ascending: false })
            .limit(1);
          if (parciales && parciales.length > 0) autorizacionId = parciales[0].id;
        }
      }

      if (!autorizacionId) {
        console.error('autorización de precio no encontrada para asunto:', subject);
        return jsonRes({ ok: true, ignorado: 'autorizacion_no_encontrada', asunto: subject });
      }

      let clasificacion = 'indeterminado';
      let motivo: string | null = null;
      let nombreFirmante: string | null = null;
      let contenidoExtraido: unknown = null;

      try {
        const prompt =
          'Estás leyendo la respuesta de un correo donde se pidió autorización para un cambio de precio en un pedido. Analiza el siguiente cuerpo de correo y determina si la persona AUTORIZA, RECHAZA, o si la respuesta es AMBIGUA/INDETERMINADA. Responde SOLO este JSON sin texto adicional ni markdown: {"clasificacion":"autorizado|rechazado|indeterminado","motivo":"string o null con cualquier justificación, condición o comentario que haya dado","nombre_firmante":"string o null si detectas el nombre de quien firma la respuesta (por ejemplo al final del correo)"}. Ejemplos de autorización: \'adelante\', \'autorizado\', \'sí, procede\', \'ok\', \'aprobado\'. Ejemplos de rechazo: \'no procede\', \'rechazado\', \'no autorizo\'. Si no es ninguno de los dos claramente, usa indeterminado.';

        const res = await fetch(GATEWAY_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              { role: 'system', content: prompt },
              { role: 'user', content: bodyText || '(correo sin texto)' },
            ],
          }),
        });
        if (!res.ok) throw new Error(`IA ${res.status}: ${await res.text()}`);
        const json = await res.json();
        const raw = String(json?.choices?.[0]?.message?.content ?? '')
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .trim();
        const parsed = JSON.parse(raw);
        contenidoExtraido = parsed;
        if (['autorizado', 'rechazado', 'indeterminado'].includes(parsed?.clasificacion)) {
          clasificacion = parsed.clasificacion;
        }
        motivo = parsed?.motivo ?? null;
        nombreFirmante = parsed?.nombre_firmante ?? null;
      } catch (e) {
        console.error('error clasificando respuesta de autorización:', (e as Error).message);
      }

      const remitenteNombre = nombreFirmante || (from ? from.split('@')[0] : null);

      const { error: respError } = await admin.from('documento_autorizacion_respuestas').insert({
        autorizacion_id: autorizacionId,
        remitente_email: from,
        remitente_nombre_detectado: remitenteNombre,
        asunto: subject,
        clasificacion,
        contenido_extraido: contenidoExtraido,
        resend_email_id: emailId,
      });
      if (respError) console.error('error insertando respuesta:', respError.message);

      const { data: actual } = await admin
        .from('documento_autorizaciones_precio')
        .select('estatus')
        .eq('id', autorizacionId)
        .maybeSingle();

      const update: Record<string, unknown> = {
        autorizacion_respondido_at: new Date().toISOString(),
        autorizado_por_texto: remitenteNombre,
        motivo,
      };
      if (actual?.estatus === 'enviado') {
        update.estatus = clasificacion;
        update.autorizado =
          clasificacion === 'autorizado' ? true : clasificacion === 'rechazado' ? false : null;
      }

      const { error: updError } = await admin
        .from('documento_autorizaciones_precio')
        .update(update)
        .eq('id', autorizacionId);
      if (updError) console.error('error actualizando autorización:', updError.message);

      return jsonRes({ ok: true, autorizacion_id: autorizacionId, clasificacion });
    }



    // ===================== FLUJO CRÉDITO (documentos@) =====================
    if (esCredito) {
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

      const validosCredito = attachments.filter((a) => {
        const ct = String(a?.content_type ?? '').toLowerCase();
        if (ct === 'application/pdf') return true;
        if (ct.startsWith('image/')) return true;
        return false;
      });

      if (validosCredito.length === 0) return jsonRes({ ok: true, procesados: 0, motivo: 'sin_adjuntos_validos' });

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

      const PROMPT_CREDITO = `Eres un clasificador de documentos para un expediente de solicitud de crédito empresarial en México. Se te entrega un archivo adjunto que llegó por correo electrónico. Debes decidir a cuál de los siguientes tipos de documento corresponde:\n\n${listaTipos || '(sin tipos configurados)'}\n\nIGNORA firmas de correo, logos de empresas, fotos de personas y encabezados de correo reenviado. Si el archivo no parece ninguno de los documentos listados (por ejemplo es una firma de correo, un logo, o un documento no relacionado con el expediente de crédito), devuelve doc_type_id en null.\n\nResponde SOLO este JSON sin texto adicional ni markdown: {"doc_type_id":"uuid del tipo que corresponde o null si no coincide con ninguno","confianza":"alta|media|baja","razon":"explicación breve"}. El doc_type_id debe ser exactamente uno de los ids listados arriba. No inventes ids.`;

      let listadoCredito: Array<any> = [];
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
          listadoCredito = attJson?.data ?? attJson ?? [];
          if (!Array.isArray(listadoCredito)) listadoCredito = [];
        }
      } catch (e) {
        console.error('error listando adjuntos:', (e as Error).message);
      }

      let procesadosCredito = 0;

      for (const att of validosCredito) {
        try {
          const ct = String(att?.content_type ?? '').toLowerCase();
          const meta = listadoCredito.find((l: any) => String(l?.id) === String(att.id)) ?? null;
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
            aiContent.push({ type: 'text', text: PROMPT_CREDITO });
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

          console.log(`att ${att.id} insertado OK (credito)`);
          procesadosCredito++;
        } catch (e) {
          console.error(`adjunto ${att?.id} fallo:`, (e as Error).message);
        }
      }

      return jsonRes({
        ok: true,
        procesados: procesadosCredito,
        credit_request_id: creditRequestId,
        folio_detectado: folioDetectado,
      });
    }
    // ===================== FIN FLUJO CRÉDITO =====================


    // Snapshot visual del correo completo (HTML) para verlo/imprimirlo después
    let emailHtmlPath: string | null = null;
    if (emailHtmlRaw) {
      try {
        const htmlPath = `email/${emailId}/cuerpo.html`;
        const { error: htmlErr } = await admin.storage
          .from('comprobantes-intake')
          .upload(htmlPath, new TextEncoder().encode(emailHtmlRaw), {
            contentType: 'text/html',
            upsert: true,
          });
        if (htmlErr) throw new Error(htmlErr.message);
        emailHtmlPath = htmlPath;
      } catch (e) {
        console.error('error subiendo snapshot html del correo:', (e as Error).message);
        emailHtmlPath = null;
      }
    }


    // Identificación del remitente
    let ejecutivoId: string | null = null;
    let empresaId: string | null = null;

    if (from) {
      const { data: perfil } = await admin
        .from('profiles')
        .select('user_id')
        .ilike('email', from)
        .limit(1)
        .maybeSingle();
      if (perfil?.user_id) ejecutivoId = perfil.user_id;

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
      if (ct === 'application/pdf') return true;
      if (ct.startsWith('image/')) return true;
      return false;
    });

    console.log('diagnóstico previo al descarte: attachments=', attachments.length, 'bodyText_length=', (bodyText || '').length);

    if (validos.length === 0) return jsonRes({ ok: true, procesados: 0, motivo: 'sin_adjuntos_validos' });

    // Lista de adjuntos con download_url y size real a través del gateway de conectores de Lovable
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

    console.log('listado adjuntos gateway:', JSON.stringify(listado.map((l: any) => ({ id: l?.id, size: l?.size, has_url: !!(l?.download_url ?? l?.downloadUrl) }))));
    console.log('attachments del webhook:', JSON.stringify(validos.map((a: any) => ({ id: a?.id, content_type: a?.content_type, disposition: a?.content_disposition }))));

    let procesados = 0;

    for (const att of validos) {
      try {
        const ct = String(att?.content_type ?? '').toLowerCase();
        const meta = listado.find((l: any) => String(l?.id) === String(att.id)) ?? null;
        const sizeReal = Number(meta?.size ?? 0) || 0;
        console.log(`att ${att.id}: ct=${ct} meta_encontrado=${!!meta} sizeReal=${sizeReal}`);
        if (ct.startsWith('image/') && sizeReal <= 15000) continue;

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

          const aiContent: any[] = [];
          if (bodyText) {
            aiContent.push({
              type: 'text',
              text: `Contexto: este archivo venía adjunto a un correo. Este es el texto del cuerpo del correo, que puede contener el comprobante real en formato texto en vez de en la imagen/PDF adjunto — si aquí están los datos del comprobante (banco, monto, ordenante, etc.), úsalos en vez de o junto con el adjunto:\n\n${bodyText}`,
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
          extraccionError = (e as Error).message?.slice(0, 500) || 'error_extraccion';
          extraido = null;
        }

        let comprobanteGeneradoPath: string | null = null;
        if (extraido) {
          try {
            const doc = await PDFDocument.create();
            const page = doc.addPage([612, 792]);
            const font = await doc.embedFont(StandardFonts.Helvetica);
            const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
            const black = rgb(0, 0, 0);
            const gray = rgb(0.4, 0.4, 0.4);

            let y = 720;
            page.drawText('Comprobante de Pago', { x: 72, y, font: fontBold, size: 18, color: black });
            y -= 28;
            page.drawText('Generado automáticamente a partir de un correo electrónico', { x: 72, y, font, size: 9, color: gray });
            y -= 40;

            const montoNum = asNumber(extraido.monto);
            const montoStr = montoNum != null
              ? `$${montoNum.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : 'No detectado';

            const fields = [
              { label: 'Ordenante:', value: asText(extraido.nombre_detectado) || 'No detectado' },
              { label: 'Monto:', value: montoStr },
              { label: 'Fecha:', value: asText(extraido.fecha) || 'No detectada' },
              { label: 'Banco:', value: asText(extraido.banco) || 'No detectado' },
              { label: 'Referencia:', value: asText(extraido.referencia) || 'No detectada' },
              { label: 'CLABE:', value: soloDigitos(extraido.clabe) || 'No detectada' },
              { label: 'Método de pago:', value: asText(extraido.metodo) || 'transferencia' },
            ];

            for (const f of fields) {
              page.drawText(f.label, { x: 72, y, font: fontBold, size: 11, color: black });
              const labelWidth = fontBold.widthOfTextAtSize(f.label, 11);
              page.drawText(f.value, { x: 72 + labelWidth + 6, y, font, size: 11, color: black });
              y -= 24;
            }

            y -= 24;
            page.drawText('Datos del correo de origen', { x: 72, y, font: fontBold, size: 12, color: black });
            y -= 28;

            const emailFields = [
              { label: 'Remitente:', value: from || 'No disponible' },
              { label: 'Asunto:', value: subject || 'Sin asunto' },
              { label: 'Recibido:', value: new Date().toLocaleString('es-MX') },
            ];
            for (const f of emailFields) {
              page.drawText(f.label, { x: 72, y, font: fontBold, size: 11, color: black });
              const labelWidth = fontBold.widthOfTextAtSize(f.label, 11);
              page.drawText(f.value, { x: 72 + labelWidth + 6, y, font, size: 11, color: black });
              y -= 24;
            }

            y -= 36;
            page.drawText('Este documento fue generado automáticamente por el sistema a partir de la información extraída del correo.', { x: 72, y, font, size: 9, color: gray });
            y -= 14;
            page.drawText('Verifica contra el correo original antes de aplicar el pago.', { x: 72, y, font, size: 9, color: gray });

            const pdfBytes = await doc.save();
            const pdfPath = `email/${emailId}/${att.id}-comprobante-generado.pdf`;
            const { error: pdfUploadErr } = await admin.storage
              .from('comprobantes-intake')
              .upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: true });
            if (pdfUploadErr) {
              console.error('error subiendo pdf generado:', pdfUploadErr.message);
            } else {
              comprobanteGeneradoPath = pdfPath;
            }
          } catch (e) {
            console.error('error generando pdf de comprobante:', (e as Error).message);
          }
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
        if (emailHtmlPath) insertPayload.email_html_storage_path = emailHtmlPath;
        if (comprobanteGeneradoPath) insertPayload.comprobante_generado_path = comprobanteGeneradoPath;


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

        console.log(`att ${att.id} insertado OK`);
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
