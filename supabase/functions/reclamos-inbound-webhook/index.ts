import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const BUZON = 'reclamos@correo.lumaggs.com.mx';
const GATEWAY = 'https://connector-gateway.lovable.dev/resend';
const EventSchema = z.object({ type: z.string(), data: z.object({ email_id: z.string().optional(), id: z.string().optional() }).passthrough().optional() }).passthrough();

function extraerEmail(value: unknown): string {
  if (value && typeof value === 'object') return extraerEmail((value as any).email ?? (value as any).address);
  const text = String(value ?? '').trim();
  return (text.match(/<([^>]+)>/)?.[1] || text).trim().toLowerCase();
}
function aLista(value: unknown): string[] {
  return (Array.isArray(value) ? value : value == null ? [] : typeof value === 'object' ? [value] : String(value).split(',')).map(extraerEmail).filter(Boolean);
}
function leerHeaders(value: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (Array.isArray(value)) {
    for (const header of value) if (header?.name || header?.key) result[String(header.name || header.key).toLowerCase()] = String(header.value ?? '');
  } else if (value && typeof value === 'object') {
    for (const [key, content] of Object.entries(value)) result[key.toLowerCase()] = Array.isArray(content) ? content.join(', ') : String(content ?? '');
  }
  return result;
}
function recipients(data: any, headers: Record<string, string>): string[] {
  return [...aLista(data.to), ...aLista(data.cc), ...aLista(data.bcc), ...aLista(data.delivered_to ?? data['delivered-to']), ...aLista(data.envelope_to ?? data.envelopeTo), ...['delivered-to', 'x-original-to', 'x-forwarded-to', 'envelope-to', 'to', 'cc', 'bcc'].flatMap((key) => aLista(headers[key]))];
}
async function firmaValida(req: Request, raw: string, secret: string): Promise<boolean> {
  const id = req.headers.get('svix-id');
  const timestamp = req.headers.get('svix-timestamp');
  const signatures = req.headers.get('svix-signature');
  if (!id || !timestamp || !signatures || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const bytes = Uint8Array.from(atob(secret.replace(/^whsec_/, '')), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${raw}`)));
  const expected = btoa(Array.from(signed, (byte) => String.fromCharCode(byte)).join(''));
  return signatures.split(' ').some((signature) => {
    const [version, actual] = signature.split(',');
    if (version !== 'v1' || !actual || actual.length !== expected.length) return false;
    let difference = 0;
    for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
    return difference === 0;
  });
}

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const signingSecret = Deno.env.get('RESEND_WEBHOOK_SECRET_RECLAMOS') || Deno.env.get('RESEND_WEBHOOK_SECRET');
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!apiKey || !resendKey || !signingSecret || !url || !serviceKey) return json({ error: 'configuracion_incompleta' }, 500);
    const raw = await req.text();
    let verified = false;
    try { verified = await firmaValida(req, raw, signingSecret); } catch { verified = false; }
    if (!verified) return json({ error: 'firma_invalida' }, 401);
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { return json({ error: 'payload_invalido' }, 400); }
    const parsed = EventSchema.safeParse(payload);
    if (!parsed.success) return json({ error: 'payload_invalido', details: parsed.error.flatten() }, 400);
    const event = parsed.data;
    if (event.type !== 'email.received') return json({ ok: true, ignorado: 'tipo_evento' });
    const data: any = event.data || {};
    if (extraerEmail(data.from).endsWith('@correo.lumaggs.com.mx')) return json({ ok: true, ignorado: 'remitente_interno' });
    const emailId = data.email_id || data.id;
    if (typeof emailId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(emailId)) return json({ error: 'email_id_invalido' }, 400);
    const gatewayHeaders = { Authorization: `Bearer ${apiKey}`, 'X-Connection-Api-Key': resendKey };
    const gatewayGet = async (path: string): Promise<any> => {
      const response = await fetch(`${GATEWAY}${path}`, { headers: gatewayHeaders });
      if (!response.ok) {
        const details = await response.text();
        console.error(`Resend [${response.status}]: ${details}`);
        throw Object.assign(new Error('No se pudo recuperar el correo de Resend'), { providerStatus: response.status, details });
      }
      return response.json();
    };
    // Resend solo incluye metadatos en el evento; los headers de entrega pueden estar en el correo completo.
    const fetched = await gatewayGet(`/emails/receiving/${emailId}`);
    const email = fetched?.data && typeof fetched.data === 'object' && !Array.isArray(fetched.data) ? fetched.data : fetched;
    const headers = { ...leerHeaders(data.headers), ...leerHeaders(email.headers) };
    if (![...recipients(data, headers), ...recipients(email, headers)].some((address) => address.includes(BUZON))) return json({ ok: true, ignorado: 'destinatario_no_coincide' });
    const rawFrom = email.from || data.from || '';
    const from = extraerEmail(rawFrom);
    if (from.endsWith('@correo.lumaggs.com.mx')) return json({ ok: true, ignorado: 'remitente_interno' });
    const subject = String(email.subject ?? data.subject ?? '');
    const html = String(email.html || '');
    const text = String(email.text || html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>'));
    const token = (subject.match(/REC-[A-F0-9]{6}/i)?.[0] || text.match(/REC-[A-F0-9]{6}/i)?.[0])?.toUpperCase();
    if (!token) return json({ ok: true, ignorado: 'reclamo_no_encontrado' });
    const admin = createClient(url, serviceKey);
    const { data: reclamo, error: findError } = await (admin as any).from('inv_reclamos').select('id').ilike('token_correo', token).maybeSingle();
    if (findError) throw findError;
    if (!reclamo) return json({ ok: true, ignorado: 'reclamo_no_encontrado' });
    const { data: duplicate, error: duplicateError } = await (admin as any).from('inv_reclamo_seguimiento').select('id').eq('resend_email_id', emailId).limit(1);
    if (duplicateError) throw duplicateError;
    if (duplicate?.length) return json({ ok: true, ignorado: 'duplicado' });
    const attachments: { nombre: string; path: string; tipo: string; tamano: number }[] = [];
    let nextPath: string | null = `/emails/receiving/${emailId}/attachments`;
    const names = new Set<string>();
    while (nextPath) {
      const result = await gatewayGet(nextPath);
      const list = Array.isArray(result) ? result : result.data || [];
      if (!Array.isArray(list)) throw new Error('Lista de adjuntos inválida');
      for (const attachment of list) {
        const downloadUrl = attachment.download_url || attachment.downloadUrl;
        if (typeof downloadUrl !== 'string' || !downloadUrl.startsWith('https://')) throw new Error('URL de adjunto inválida');
        const download = await fetch(downloadUrl);
        if (!download.ok) throw Object.assign(new Error('No se pudo descargar el adjunto'), { providerStatus: download.status, details: await download.text() });
        const bytes = new Uint8Array(await download.arrayBuffer());
        const nombre = String(attachment.filename || 'adjunto');
        let filename = nombre.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '').slice(-160) || 'adjunto';
        if (names.has(filename)) filename = `${String(attachment.id || attachments.length).replace(/[^a-zA-Z0-9_-]/g, '_')}_${filename}`;
        names.add(filename);
        const path = `${reclamo.id}/correos/${emailId}/${filename}`;
        const tipo = String(attachment.content_type || 'application/octet-stream');
        const { error } = await admin.storage.from('inventario-reclamos').upload(path, bytes, { contentType: tipo, upsert: true });
        if (error) throw error;
        attachments.push({ nombre, path, tipo, tamano: bytes.length });
      }
      const last = list.at(-1)?.id;
      nextPath = result.has_more && last ? `/emails/receiving/${emailId}/attachments?after=${encodeURIComponent(String(last))}` : null;
    }
    const fromName = typeof rawFrom === 'object' ? rawFrom.name || null : String(rawFrom).match(/^\s*"?([^<]*?)"?\s*</)?.[1]?.trim().replace(/^"|"$/g, '') || null;
    const { error: insertError } = await (admin as any).from('inv_reclamo_seguimiento').insert({
      reclamo_id: reclamo.id, direccion: 'entrante', tipo: 'respuesta', from_email: from, from_nombre: fromName,
      destinatarios: aLista(email.to ?? data.to), cc: aLista(email.cc ?? data.cc), reply_to: aLista(email.reply_to ?? headers['reply-to']),
      asunto: subject, cuerpo: html || null, cuerpo_texto: text || null, adjuntos: attachments,
      message_id: headers['message-id'] || email.message_id || data.message_id || null,
      in_reply_to: headers['in-reply-to'] || email.in_reply_to || null, resend_email_id: emailId, estatus_envio: 'recibido',
    });
    if (insertError) {
      if (insertError.code === '23505') return json({ ok: true, ignorado: 'duplicado' });
      throw insertError;
    }
    return json({ ok: true, adjuntos: attachments.length });
  } catch (error: any) {
    console.error('reclamos-inbound-webhook:', error.message);
    return json({ error: error.message, status: error.providerStatus, details: error.details }, error.providerStatus || 500);
  }
});