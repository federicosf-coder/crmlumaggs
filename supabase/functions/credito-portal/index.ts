import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// Validate token → returns { requestId, partyId? }
async function resolveToken(token: string): Promise<{ requestId: string; partyId: string | null } | null> {
  if (!token) return null
  const { data: req } = await supabase
    .from('credit_requests')
    .select('id')
    .eq('client_token', token)
    .maybeSingle()
  if (req) return { requestId: req.id, partyId: null }
  const { data: party } = await supabase
    .from('credit_request_parties')
    .select('id, credit_request_id')
    .eq('client_token', token)
    .maybeSingle()
  if (party) return { requestId: party.credit_request_id, partyId: party.id }
  return null
}

const FORM_FIELDS = [
  'razon_social','nombre_comercial','rfc','telefono','correo_contacto',
  'domicilio_fiscal','ciudad_fiscal','estado_fiscal','antiguedad',
  'domicilio_comercial','ciudad_comercial','giro_comercial',
  'monto_solicitado','dias_credito',
  'accionistas','escritura_constitutiva','datos_registro','ultima_asamblea','administrador_presidente',
  'datos_bancarios','referencias_comerciales',
  'aval_nombre','aval_direccion','aval_ciudad','aval_relacion','aval_regimen_conyugal',
  'rep_legal_nombre','rep_legal_curp','rep_legal_rfc','rep_legal_tipo_id','rep_legal_num_id',
  'rep_legal_fecha_nacimiento','rep_legal_pais_nacimiento',
  'lfpiorpi_beneficiario_controlador','lfpiorpi_tiene_documentacion',
  'lfpiorpi_fecha_firma','lfpiorpi_lugar_firma',
] as const

const SIGN_MAP: Record<string, { fechaCol: string; nombreCol: string }> = {
  solicitud:        { fechaCol: 'firma_solicitud_fecha',        nombreCol: 'firma_solicitud_nombre' },
  buro:             { fechaCol: 'firma_buro_fecha',             nombreCol: 'firma_buro_nombre' },
  confidencialidad: { fechaCol: 'firma_confidencialidad_fecha', nombreCol: 'firma_confidencialidad_nombre' },
  subsistencia:     { fechaCol: 'firma_subsistencia_fecha',     nombreCol: 'firma_subsistencia_nombre' },
  lfpiorpi:         { fechaCol: 'firma_lfpiorpi_fecha',         nombreCol: 'firma_lfpiorpi_nombre' },
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  let body: any
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }

  const { action, token } = body || {}
  if (!action || !token) return json({ error: 'missing_action_or_token' }, 400)

  const ctx = await resolveToken(String(token))
  if (!ctx) return json({ error: 'invalid_token' }, 401)

  try {
    if (action === 'get') {
      const [{ data: request }, { data: parties }, { data: docTypes }, { data: docs }] = await Promise.all([
        supabase.from('credit_requests').select('*, companies(name)').eq('id', ctx.requestId).maybeSingle(),
        supabase.from('credit_request_parties').select('*').eq('credit_request_id', ctx.requestId),
        supabase.from('credit_doc_types').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('credit_request_docs').select('*').eq('credit_request_id', ctx.requestId).eq('visibilidad', 'publica'),
      ])
      const { data: completeness } = await supabase.rpc('credit_request_completeness', { req_id: ctx.requestId })
      return json({ request, parties: parties || [], docTypes: docTypes || [], docs: docs || [], completeness, ctx })
    }

    if (action === 'update_form') {
      const updates: Record<string, any> = {}
      for (const k of FORM_FIELDS) if (k in (body.fields || {})) updates[k] = body.fields[k]
      if (Object.keys(updates).length === 0) return json({ ok: true })
      const { error } = await supabase.from('credit_requests').update(updates).eq('id', ctx.requestId)
      if (error) return json({ error: error.message }, 500)
      // mark state as llenando if still in earlier stage
      await supabase.from('credit_requests')
        .update({ estado: 'llenando_formulario' })
        .eq('id', ctx.requestId)
        .in('estado', ['borrador', 'portal_enviado'])
      return json({ ok: true })
    }

    if (action === 'sign') {
      const map = SIGN_MAP[String(body.tipo || '')]
      const nombre = String(body.nombre || '').trim()
      if (!map || !nombre) return json({ error: 'invalid_sign' }, 400)
      const updates: Record<string, any> = {
        [map.fechaCol]: new Date().toISOString(),
        [map.nombreCol]: nombre,
      }
      const { error } = await supabase.from('credit_requests').update(updates).eq('id', ctx.requestId)
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    if (action === 'upload_doc') {
      const docTypeId = body.doc_type_id || null
      const filename = String(body.filename || 'archivo.pdf').replace(/[^\w.\-]+/g, '_')
      const mime = String(body.mime || 'application/octet-stream')
      const b64 = String(body.file_b64 || '')
      if (!b64) return json({ error: 'missing_file' }, 400)
      const bytes = b64ToBytes(b64)
      if (bytes.length > 15 * 1024 * 1024) return json({ error: 'file_too_large' }, 400)
      const path = `${ctx.requestId}/${crypto.randomUUID()}_${filename}`
      const { error: upErr } = await supabase.storage.from('credit-docs').upload(path, bytes, { contentType: mime, upsert: false })
      if (upErr) return json({ error: upErr.message }, 500)
      const { error: insErr } = await supabase.from('credit_request_docs').insert({
        credit_request_id: ctx.requestId,
        doc_type_id: docTypeId,
        party_id: ctx.partyId,
        nombre_personalizado: body.nombre_personalizado || null,
        url_archivo: path,
        nombre_archivo: filename,
        tipo_archivo: mime,
        estado: 'recibido',
        visibilidad: 'publica',
        subido_por_cliente: true,
      })
      if (insErr) return json({ error: insErr.message }, 500)
      return json({ ok: true, path })
    }

    if (action === 'delete_doc') {
      const { data: doc } = await supabase.from('credit_request_docs').select('*').eq('id', body.doc_id).maybeSingle()
      if (!doc || doc.credit_request_id !== ctx.requestId || !doc.subido_por_cliente) {
        return json({ error: 'not_allowed' }, 403)
      }
      if (doc.url_archivo) await supabase.storage.from('credit-docs').remove([doc.url_archivo])
      await supabase.from('credit_request_docs').delete().eq('id', doc.id)
      return json({ ok: true })
    }

    if (action === 'signed_url') {
      const docId = body.doc_id
      const { data: doc } = await supabase.from('credit_request_docs').select('url_archivo, visibilidad, credit_request_id').eq('id', docId).maybeSingle()
      if (!doc || doc.credit_request_id !== ctx.requestId || doc.visibilidad !== 'publica' || !doc.url_archivo) {
        return json({ error: 'not_found' }, 404)
      }
      const { data: signed, error } = await supabase.storage.from('credit-docs').createSignedUrl(doc.url_archivo, 600)
      if (error || !signed) return json({ error: error?.message || 'sign_error' }, 500)
      return json({ url: signed.signedUrl })
    }

    return json({ error: 'unknown_action' }, 400)
  } catch (e: any) {
    console.error('credito-portal error', e)
    return json({ error: e?.message || 'server_error' }, 500)
  }
})
