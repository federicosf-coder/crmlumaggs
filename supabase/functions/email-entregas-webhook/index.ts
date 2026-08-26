import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';
const BUCKET = 'entregas-corporativas';
const BUZON = 'entregas@correo.lumaggs.com.mx';

const PROMPT = `Este documento contiene instrucciones de Chevron (proveedor) sobre una o más entregas corporativas a clientes de Chevron (a quienes Lumaggs entrega en su nombre). Puede ser uno de estos formatos, u otro similar:

FORMATO "ORDEN DE COMPRA": título "ORDEN DE COMPRA", con "Num. de Orden: XXXXXXX" (ese es el numero_pedido). Bajo el encabezado "EMPRESA A EMBARCAR" suelen aparecer DOS entidades listadas en secuencia: la primera es la casa matriz/oficina central del cliente (ej. "MTK APODACA") y la SEGUNDA es la sucursal/planta específica real de entrega (ej. "MTK MEXICALI", "MTK TIJUANA") con su propia dirección — usa SIEMPRE la segunda entidad (nombre + dirección) como lugar_entrega, nunca la primera. Los productos vienen en una tabla con columnas LINEA, ARTICULO (código), DESCRIPCION, CANTIDAD, UDM, PRECIO UNITARIO, TOTAL — ARTICULO es el codigo, DESCRIPCION es nombre_producto, CANTIDAD es la cantidad. Si hay un campo "Fecha Compromiso" con valor, úsalo como fecha de las entregas; si está vacío, deja fecha en null.

FORMATO "ORDER CONFIRMATION" (generado por Chevron): tiene "Sold-To-Party" (casa matriz/facturación, NO usar esto como lugar_entrega) y "Ship-To-Party" (nombre + dirección completa) que SIEMPRE es la fuente correcta de lugar_entrega — combina el nombre y las líneas de dirección que le siguen en un solo string. El campo "Requested delivery date" (formato DD-MMM-YYYY, ej. "23-AUG-2026") es la fecha real de entrega solicitada — conviértela a YYYY-MM-DD (AUG=08, y así con los demás meses en inglés) y úsala como fecha para cada producto de esta orden. El campo "Purchase order number" es el numero_pedido correcto (coincide con el "Num. de Orden" de la Orden de Compra relacionada) — NUNCA uses el campo "Order number" (ese es un número interno de Chevron, no el número de pedido del cliente). Los productos vienen en una tabla con columnas Item, Material (código), Material Description, Ord.Qty, UOM, Unit Price, Net Price — Material es el codigo, Material Description es nombre_producto, Ord.Qty es la cantidad.

Si el documento no es ninguno de estos dos formatos, extrae la información equivalente de la forma más razonable posible: identifica cliente, lugar de entrega real (la dirección/sucursal específica de destino, no la casa matriz), fecha de entrega solicitada, número de pedido, y productos con cantidad.

IMPORTANTE: un mismo correo puede incluir VARIAS órdenes distintas (cada una con su propio número de pedido). Nunca pongas un número de pedido como si fuera código de producto — el número de pedido siempre va en "numero_pedido" de su propio objeto dentro de "pedidos".

Extrae SOLO este JSON sin texto adicional ni markdown: {"pedidos":[{"cliente_detectado":"string o null","lugar_entrega":"string o null","numero_pedido":"string o null","entregas":[{"codigo":"string","nombre_producto":"string o null","fecha":"YYYY-MM-DD o null","cantidad":0}]}]}.

Genera UN objeto dentro de "pedidos" por cada número de pedido/orden distinto. Si un pedido se menciona pero este documento no trae detalle de productos, crea su objeto con "entregas": [] — nunca inventes productos.

"cliente_detectado": nombre del cliente corporativo (ej. "Mecánica Tek", "Hyundai", "Kenworth", o el que aparezca); si no se menciona, null.

Si no encuentras información real de ninguna entrega/pedido (correo es solo firma o acuse sin relación a programar entregas), retorna "pedidos": []. No inventes valores.`;

function extraerEmail(from: string): string {
  const m = from?.match(/<([^>]+)>/);
  return (m ? m[1] : from || '').trim().toLowerCase();
}

const asText = (v: unknown) => {
  const s = v == null ? '' : String(v).trim();
  return s && s.toLowerCase() !== 'null' ? s : null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const jsonRes = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  if (req.method !== 'POST') return jsonRes({ error: 'method_not_allowed' }, 405);

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const RESEND_WEBHOOK_SECRET_ENTREGAS = Deno.env.get('RESEND_WEBHOOK_SECRET_ENTREGAS');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!RESEND_WEBHOOK_SECRET_ENTREGAS) {
      console.error('RESEND_WEBHOOK_SECRET_ENTREGAS no configurado');
      return jsonRes({ error: 'RESEND_WEBHOOK_SECRET_ENTREGAS no configurado' }, 500);
    }

    const rawBody = await req.text();

    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error('headers svix faltantes en email-entregas-webhook');
      return jsonRes({ error: 'firma_invalida' }, 401);
    }

    let firmaOk = false;
    try {
      const secretB64 = RESEND_WEBHOOK_SECRET_ENTREGAS.replace(/^whsec_/, '');
      const keyBytes = Uint8Array.from(atob(secretB64), (c) => c.charCodeAt(0));
      const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
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
      console.error('error verificando firma en email-entregas-webhook:', (e as Error).message);
      return jsonRes({ error: 'firma_invalida' }, 401);
    }

    if (!firmaOk) {
      console.error('firma invalida en email-entregas-webhook');
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

    if (!destinatarios.some((d) => d.includes(BUZON))) {
      return jsonRes({ ok: true, ignorado: 'destinatario_no_coincide' });
    }

    const emailId: string = String(data.email_id ?? data.id ?? '');
    const from = extraerEmail(String(data.from ?? ''));
    const subject: string | null = asText(data.subject);
    const attachments: Array<any> = Array.isArray(data.attachments) ? data.attachments : [];

    if (!emailId) return jsonRes({ error: 'email_id_faltante' }, 400);

    // Cuerpo del correo
    let bodyText = '';
    let emailHtmlRaw = '';
    const textFromPayload = asText(data.text);
    if (textFromPayload) bodyText = textFromPayload.slice(0, 6000);
    if (data.html) emailHtmlRaw = String(data.html);

    if (LOVABLE_API_KEY && RESEND_API_KEY && (!textFromPayload || !emailHtmlRaw)) {
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

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Snapshot HTML
    let emailHtmlPath: string | null = null;
    if (emailHtmlRaw) {
      try {
        const htmlPath = `email-intake/${emailId}/cuerpo.html`;
        const { error: htmlErr } = await admin.storage
          .from(BUCKET)
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

    const validos = attachments.filter((a) => {
      const ct = String(a?.content_type ?? '').toLowerCase();
      return ct === 'application/pdf' || ct.startsWith('image/');
    });

    // Listado de adjuntos vía gateway (download_url + size real)
    let listado: Array<any> = [];
    if (validos.length > 0) {
      try {
        const attRes = await fetch(
          `https://connector-gateway.lovable.dev/resend/emails/receiving/${emailId}/attachments`,
          {
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              'X-Connection-Api-Key': RESEND_API_KEY,
            },
          },
        );
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
    }

    const extraerConIA = async (contentPart: any | null) => {
      let extraido: Record<string, unknown> | null = null;
      let extraccionError: string | null = null;
      try {
        if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY no configurada');

        const aiContent: any[] = [];
        if (bodyText) {
          aiContent.push({
            type: 'text',
            text: `Contexto: este es el texto del cuerpo del correo recibido. Puede contener las instrucciones de entrega en texto, o complementar la información del archivo adjunto:\n\n${bodyText}`,
          });
        }
        aiContent.push({ type: 'text', text: PROMPT });
        if (contentPart) aiContent.push(contentPart);

        const res = await fetch(GATEWAY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LOVABLE_API_KEY}` },
          body: JSON.stringify({
            model: MODEL,
            messages: [{ role: 'user', content: aiContent }],
            max_tokens: 4000,
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
      return { extraido, extraccionError };
    };

    const insertar = async (
      storagePath: string | null,
      mime: string | null,
      extraido: Record<string, unknown> | null,
      extraccionError: string | null,
    ): Promise<number> => {
      const base: Record<string, unknown> = {
        canal: 'email',
        remitente_email: from || null,
        asunto_email: subject,
        storage_path: storagePath,
        mime_type: mime,
        email_html_storage_path: emailHtmlPath,
        resend_email_id: emailId,
        estatus: 'pendiente',
      };

      const pedidos = extraido && Array.isArray((extraido as any).pedidos) ? ((extraido as any).pedidos as any[]) : [];

      const filas: Record<string, unknown>[] =
        pedidos.length > 0
          ? pedidos.map((p) => ({
              ...base,
              cliente_detectado: asText(p?.cliente_detectado),
              lugar_entrega_detectado: asText(p?.lugar_entrega),
              numero_pedido_detectado: asText(p?.numero_pedido),
              entregas_extraidas: Array.isArray(p?.entregas) ? p.entregas : null,
              extraccion_raw: p ?? null,
              extraccion_error: null,
            }))
          : [
              {
                ...base,
                cliente_detectado: null,
                lugar_entrega_detectado: null,
                numero_pedido_detectado: null,
                entregas_extraidas: null,
                extraccion_raw: extraido ?? null,
                extraccion_error: extraido ? null : extraccionError,
              },
            ];

      const { error: insErr } = await admin.from('entregas_corporativas_intake').insert(filas);
      if (insErr) throw new Error(`insert_failed: ${insErr.message}`);
      return filas.length;
    };

    let procesados = 0;
    let adjuntosProcesados = 0;

    if (validos.length > 0) {
      for (const att of validos) {
        try {
          const ct = String(att?.content_type ?? '').toLowerCase();
          const meta = listado.find((l: any) => String(l?.id) === String(att.id)) ?? null;
          const sizeReal = Number(meta?.size ?? 0) || 0;
          if (ct.startsWith('image/') && sizeReal <= 15000) continue;

          const downloadUrl = meta?.download_url ?? meta?.downloadUrl;
          if (!downloadUrl) throw new Error(`sin_download_url para adjunto ${att.id}`);

          const dl = await fetch(downloadUrl);
          if (!dl.ok) throw new Error(`descarga_fallida_${dl.status}`);
          const bytes = new Uint8Array(await dl.arrayBuffer());

          const nombreOriginal = att.filename || 'adjunto';
          const sanitizado = String(nombreOriginal).replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
          const mime = String(att.content_type || 'application/octet-stream');
          const storagePath = `email-intake/${emailId}/${att.id}-${sanitizado}`;

          const { error: upErr } = await admin.storage
            .from(BUCKET)
            .upload(storagePath, bytes, { contentType: mime, upsert: true });
          if (upErr) throw new Error(`upload_failed: ${upErr.message}`);

          let bin = '';
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          const dataUrl = `data:${mime};base64,${btoa(bin)}`;
          const contentPart = mime.startsWith('image/')
            ? { type: 'image_url', image_url: { url: dataUrl } }
            : { type: 'file', file: { filename: sanitizado || 'documento.pdf', file_data: dataUrl } };

          const { extraido, extraccionError } = await extraerConIA(contentPart);
          procesados += await insertar(storagePath, mime, extraido, extraccionError);
          adjuntosProcesados++;
        } catch (e) {
          console.error(`adjunto ${att?.id} fallo:`, (e as Error).message);
        }
      }
    }

    if (adjuntosProcesados === 0 && bodyText) {
      try {
        const { extraido, extraccionError } = await extraerConIA(null);
        procesados += await insertar(null, null, extraido, extraccionError);
      } catch (e) {
        console.error('fallo procesando solo texto:', (e as Error).message);
      }
    }


    return jsonRes({ ok: true, procesados });
  } catch (e) {
    console.error('email-entregas-webhook error:', e);
    return jsonRes({ error: (e as Error).message }, 500);
  }
});
