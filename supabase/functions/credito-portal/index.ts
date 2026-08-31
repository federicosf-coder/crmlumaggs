import { createClient } from 'npm:@supabase/supabase-js@2'
import { extractText, getDocumentProxy } from 'npm:unpdf@0.12.1'

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
  'tipo_persona',
  'razon_social','nombre_comercial','rfc','telefono','correo_contacto','client_nombre_contacto',
  'domicilio_fiscal','ciudad_fiscal','estado_fiscal','antiguedad',
  'domicilio_comercial','ciudad_comercial','estado_comercial','giro_comercial',
  'monto_solicitado','dias_credito','monto_solicitado_lumaggs','monto_solicitado_galsa',
  'accionistas','escritura_constitutiva','datos_registro','ultima_asamblea','administrador_presidente',
  'datos_bancarios','referencias_comerciales',
  'aval_nombre','aval_direccion','aval_ciudad','aval_relacion','aval_regimen_conyugal','aval_es_distinto',
  'rep_legal_nombre','rep_legal_curp','rep_legal_rfc','rep_legal_tipo_id','rep_legal_num_id',
  'rep_legal_fecha_nacimiento','rep_legal_pais_nacimiento','rep_legal_vencimiento_id',
  'lfpiorpi_beneficiario_controlador','lfpiorpi_tiene_documentacion',
  'lfpiorpi_fecha_firma','lfpiorpi_lugar_firma',
  'bc_data','bc_es_representante_legal','bc_confirmacion_no_existe','bc_tipo_persona',
  'poder_representante_requerido','registro_publico_requerido','estado_cuenta_requerido',
] as const

const SIGN_MAP: Record<string, { fechaCol: string; nombreCol: string }> = {
  solicitud:        { fechaCol: 'firma_solicitud_fecha',        nombreCol: 'firma_solicitud_nombre' },
  buro:             { fechaCol: 'firma_buro_fecha',             nombreCol: 'firma_buro_nombre' },
  confidencialidad: { fechaCol: 'firma_confidencialidad_fecha', nombreCol: 'firma_confidencialidad_nombre' },
  subsistencia:     { fechaCol: 'firma_subsistencia_fecha',     nombreCol: 'firma_subsistencia_nombre' },
  lfpiorpi:         { fechaCol: 'firma_lfpiorpi_fecha',         nombreCol: 'firma_lfpiorpi_nombre' },
  'solicitud-lumaggs': { fechaCol: 'firma_solicitud_lumaggs_fecha', nombreCol: 'firma_solicitud_lumaggs_nombre' },
  'solicitud-galsa':   { fechaCol: 'firma_solicitud_galsa_fecha',   nombreCol: 'firma_solicitud_galsa_nombre' },
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// ---- CSF (Constancia de Situación Fiscal) parser ----
function norm(s: string) {
  return s.replace(/\u00A0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\r/g, '').trim()
}
function pick(text: string, re: RegExp): string | null {
  const m = text.match(re); return m && m[1] ? norm(m[1]) : null
}
function parseCsfText(raw: string) {
  const t = raw.replace(/\u00A0/g, ' ')
  // RFC: 12 (moral) or 13 (fisica) alphanumeric
  const rfc = pick(t, /\bRFC\s*:?\s*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\b/i)
  const razon =
    pick(t, /Denominaci[oó]n\s*\/?\s*Raz[oó]n\s+Social\s*:?\s*([^\n]+?)(?=\s*(?:R[eé]gimen|Nombre|R\.F\.C|Fecha\b))/i) ||
    pick(t, /Nombre\s*\(s\)\s*:?\s*([^\n]+?)(?=\s*(?:Primer|Apellido|R\.F\.C|R[eé]gimen|Fecha))/i)
  const regimen = pick(t, /R[eé]gimen\s*:?\s*([^\n]+?)(?=\s*(?:Fecha|Estatus|$))/i)
  const cp = pick(t, /C[oó]digo\s+Postal\s*:?\s*(\d{5})/i)
  const fechaIni = pick(t, /Fecha\s+de\s+inicio\s+de\s+operaciones\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i)
  const actividad = pick(t, /Actividad\s+Econ[oó]mica\s*[:\n]+\s*([^\n]+)/i)
  // Build domicilio from common fields
  const calle = pick(t, /Nombre\s+de\s+(?:la\s+)?[Vv]ialidad\s*:?\s*([^\n]+?)(?=\s*(?:N[uú]mero|Colonia|C[oó]digo))/i)
  const numExt = pick(t, /N[uú]mero\s+Exterior\s*:?\s*([^\n]+?)(?=\s*(?:N[uú]mero\s+Interior|Colonia|C[oó]digo))/i)
  const numInt = pick(t, /N[uú]mero\s+Interior\s*:?\s*([^\n]+?)(?=\s*(?:Colonia|C[oó]digo))/i)
  const colonia = pick(t, /(?:Nombre\s+de\s+(?:la\s+)?)?Colonia\s*:?\s*([^\n]+?)(?=\s*(?:Municipio|Delegaci[oó]n|C[oó]digo|Entidad))/i)
  const municipio = pick(t, /(?:Municipio|Delegaci[oó]n)\s*(?:\/Delegaci[oó]n)?\s*:?\s*([^\n]+?)(?=\s*(?:Entidad|C[oó]digo))/i)
  const entidad = pick(t, /Entidad\s+Federativa\s*:?\s*([^\n]+?)(?=\s*(?:Entre\b|C[oó]digo|Tel[eé]fono|$))/i)
  const domParts = [calle, numExt ? `#${numExt}` : null, numInt ? `Int. ${numInt}` : null, colonia ? `Col. ${colonia}` : null]
    .filter(Boolean).join(' ')
  // Tipo de persona: RFC 12 → moral, 13 → física
  const tipoPersona = rfc ? (rfc.length === 12 ? 'moral' : 'fisica') : null
  // Parse date dd/mm/yyyy → ISO
  let fechaIso: string | null = null
  if (fechaIni) {
    const [d, m, y] = fechaIni.split('/')
    if (d && m && y) fechaIso = `${y}-${m}-${d}`
  }
  return {
    csf_rfc: rfc,
    csf_razon_social: razon,
    csf_regimen_fiscal: regimen,
    csf_cp: cp,
    csf_domicilio: domParts || null,
    csf_actividad_economica: actividad,
    csf_fecha_inicio_operaciones: fechaIso,
    csf_tipo_persona: tipoPersona,
    _municipio: municipio,
    _entidad: entidad,
  }
}
async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes)
  const { text } = await extractText(pdf, { mergePages: true })
  return Array.isArray(text) ? text.join('\n') : String(text || '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  let body: any
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }

  const { action, token } = body || {}
  if (!action || !token) return json({ error: 'missing_action_or_token' }, 400)

  // Public share for Cescemex: independent of client_token flow
  if (action === 'cescemex_docs') {
    try {
      const { data: reqRow } = await supabase
        .from('credit_requests')
        .select('id, folio, cescemex_share_expires_at, companies(name)')
        .eq('cescemex_share_token', String(token))
        .maybeSingle()
      if (!reqRow) return json({ error: 'invalid_or_expired_token' }, 401)
      const expiresAt = reqRow.cescemex_share_expires_at ? new Date(reqRow.cescemex_share_expires_at).getTime() : 0
      const nowMs = Date.now()
      if (!expiresAt || expiresAt <= nowMs) return json({ error: 'invalid_or_expired_token' }, 401)
      const remainingSec = Math.min(604800, Math.max(60, Math.floor((expiresAt - nowMs) / 1000)))
      const { data: docsRows } = await supabase
        .from('credit_request_docs')
        .select('id, nombre_archivo, url_archivo')
        .eq('credit_request_id', reqRow.id)
        .order('created_at', { ascending: true })
      const out: any[] = []
      for (const d of docsRows || []) {
        if (!d.url_archivo) continue
        const { data: signed } = await supabase.storage
          .from('credit-docs')
          .createSignedUrl(d.url_archivo, remainingSec)
        if (signed?.signedUrl) {
          out.push({ nombre_archivo: d.nombre_archivo || 'archivo', signed_url: signed.signedUrl })
        }
      }
      return json({
        company_name: (reqRow as any).companies?.name || '',
        folio: reqRow.folio || '',
        docs: out,
      })
    } catch (e: any) {
      console.error('cescemex_docs error', e)
      return json({ error: 'server_error' }, 500)
    }
  }

  const ctx = await resolveToken(String(token))
  if (!ctx) return json({ error: 'invalid_token' }, 401)

  try {
    if (action === 'get') {
      const [{ data: request }, { data: parties }, { data: docTypes }, { data: docs }] = await Promise.all([
        supabase.from('credit_requests').select('*, companies(id, name, uso_cfdi, industrias)').eq('id', ctx.requestId).maybeSingle(),
        supabase.from('credit_request_parties').select('*').eq('credit_request_id', ctx.requestId),
        supabase.from('credit_doc_types').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('credit_request_docs').select('*').eq('credit_request_id', ctx.requestId).eq('visibilidad', 'publica'),
      ])
      const { data: completeness } = await supabase.rpc('credit_request_completeness', { req_id: ctx.requestId })
      const { data: industrias } = await supabase
        .from('industrias_catalog').select('clave, etiqueta').eq('activo', true).order('etiqueta')
      return json({ request, parties: parties || [], docTypes: docTypes || [], docs: docs || [], completeness, industrias: industrias || [], ctx })
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

    if (action === 'update_company') {
      const { data: req } = await supabase
        .from('credit_requests').select('company_id').eq('id', ctx.requestId).maybeSingle()
      if (!req?.company_id) return json({ error: 'no_company' }, 400)
      const updates: Record<string, any> = {}
      if ('uso_cfdi' in (body.fields || {})) updates.uso_cfdi = body.fields.uso_cfdi || null
      if ('industrias' in (body.fields || {})) updates.industrias = body.fields.industrias || []
      if (Object.keys(updates).length === 0) return json({ ok: true })
      const { error } = await supabase.from('companies').update(updates).eq('id', req.company_id)
      if (error) return json({ error: error.message }, 500)
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

    if (action === 'upload_firma') {
      const tipo = String(body.tipo || '')
      const map = SIGN_MAP[tipo]
      if (!map) return json({ error: 'invalid_firma_key' }, 400)
      const nombre = String(body.nombre || '').trim()
      if (!nombre) return json({ error: 'missing_nombre' }, 400)
      const filename = String(body.filename || 'firma.pdf').replace(/[^\w.\-]+/g, '_')
      const mime = String(body.mime || 'application/pdf')
      const b64 = String(body.file_b64 || '')
      if (!b64) return json({ error: 'missing_file' }, 400)
      const bytes = b64ToBytes(b64)
      if (bytes.length > 15 * 1024 * 1024) return json({ error: 'file_too_large' }, 400)
      const path = `${ctx.requestId}/${tipo}_${Date.now()}_${filename}`
      const { error: upErr } = await supabase.storage.from('credit-docs').upload(path, bytes, { contentType: mime, upsert: false })
      if (upErr) return json({ error: upErr.message }, 500)
      const { data: docRow, error: insErr } = await supabase.from('credit_request_docs').insert({
        credit_request_id: ctx.requestId,
        doc_type_id: null,
        party_id: ctx.partyId,
        url_archivo: path,
        nombre_archivo: filename,
        tipo_archivo: mime,
        estado: 'recibido',
        visibilidad: 'publica',
        subido_por_cliente: true,
        metadata: { firma_key: tipo, firma_nombre: nombre },
      }).select('id').single()
      if (insErr || !docRow) return json({ error: insErr?.message || 'insert_error' }, 500)
      const docIdCol = `${map.fechaCol.replace('_fecha', '')}_doc_id`
      const updates: Record<string, any> = {
        [map.fechaCol]: new Date().toISOString(),
        [map.nombreCol]: nombre,
        [docIdCol]: docRow.id,
      }
      const { error: updErr } = await supabase.from('credit_requests').update(updates).eq('id', ctx.requestId)
      if (updErr) return json({ error: updErr.message }, 500)
      return json({ ok: true, doc_id: docRow.id, path })
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

    if (action === 'print_data') {
      const keysRaw = Array.isArray(body.keys) ? body.keys : []
      const keys: string[] = keysRaw.map((k: any) => String(k))
      const tplKeys = Array.from(new Set(keys.map((k) => k.startsWith('solicitud-') ? 'solicitud' : k)))
      const [{ data: request }, { data: templates }] = await Promise.all([
        supabase.from('credit_requests').select('*, companies(*)').eq('id', ctx.requestId).maybeSingle(),
        tplKeys.length > 0
          ? supabase.from('credit_doc_templates').select('*').in('key', tplKeys).eq('activo', true)
          : Promise.resolve({ data: [] } as any),
      ])
      if (!request) return json({ error: 'not_found' }, 404)
      return json({ request, templates: templates || [] })
    }

    if (action === 'parse_csf') {
      const filename = String(body.filename || 'csf.pdf').replace(/[^\w.\-]+/g, '_')
      const mime = String(body.mime || 'application/pdf')
      const b64 = String(body.file_b64 || '')
      if (!b64) return json({ error: 'missing_file' }, 400)
      const bytes = b64ToBytes(b64)
      if (bytes.length > 15 * 1024 * 1024) return json({ error: 'file_too_large' }, 400)
      let parsed: any
      try {
        const text = await extractPdfText(bytes)
        parsed = parseCsfText(text)
      } catch (e: any) {
        return json({ error: 'pdf_parse_failed', detail: e?.message }, 400)
      }
      if (!parsed.csf_rfc) return json({ error: 'csf_no_rfc', parsed }, 400)
      // Upload original PDF for audit
      const path = `${ctx.requestId}/${crypto.randomUUID()}_${filename}`
      const { error: upErr } = await supabase.storage.from('credit-docs')
        .upload(path, bytes, { contentType: mime, upsert: false })
      if (upErr) return json({ error: upErr.message }, 500)
      await supabase.from('credit_request_docs').insert({
        credit_request_id: ctx.requestId,
        doc_type_id: null,
        party_id: ctx.partyId,
        nombre_personalizado: 'Constancia de Situación Fiscal (autocompletada)',
        url_archivo: path,
        nombre_archivo: filename,
        tipo_archivo: mime,
        estado: 'recibido',
        visibilidad: 'publica',
        subido_por_cliente: true,
      })
      // Save CSF fields + autocompletar campos vacíos de la solicitud
      const { data: cur } = await supabase.from('credit_requests')
        .select('rfc,razon_social,domicilio_fiscal,ciudad_fiscal,estado_fiscal')
        .eq('id', ctx.requestId).maybeSingle()
      const updates: Record<string, any> = {
        csf_rfc: parsed.csf_rfc,
        csf_razon_social: parsed.csf_razon_social,
        csf_regimen_fiscal: parsed.csf_regimen_fiscal,
        csf_cp: parsed.csf_cp,
        csf_domicilio: parsed.csf_domicilio,
        csf_actividad_economica: parsed.csf_actividad_economica,
        csf_fecha_inicio_operaciones: parsed.csf_fecha_inicio_operaciones,
        csf_tipo_persona: parsed.csf_tipo_persona,
        csf_parseado: true,
      }
      if (cur && !cur.rfc && parsed.csf_rfc) updates.rfc = parsed.csf_rfc
      if (cur && !cur.razon_social && parsed.csf_razon_social) updates.razon_social = parsed.csf_razon_social
      if (cur && !cur.domicilio_fiscal && parsed.csf_domicilio) updates.domicilio_fiscal = parsed.csf_domicilio
      if (cur && !cur.ciudad_fiscal && parsed._municipio) updates.ciudad_fiscal = parsed._municipio
      if (cur && !cur.estado_fiscal && parsed._entidad) updates.estado_fiscal = parsed._entidad
      const { error: updErr } = await supabase.from('credit_requests').update(updates).eq('id', ctx.requestId)
      if (updErr) return json({ error: updErr.message }, 500)
      return json({ ok: true, parsed })
    }

    return json({ error: 'unknown_action' }, 400)
  } catch (e: any) {
    console.error('credito-portal error', e)
    return json({ error: e?.message || 'server_error' }, 500)
  }
})
