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

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!
const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions'
const MODEL = 'google/gemini-3-flash-preview'

const MESES: Record<string, string> = {
  enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
  julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10',
  noviembre: '11', diciembre: '12',
}
function toISODate(v: any): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (m) {
    const d = m[1].padStart(2, '0'), mo = m[2].padStart(2, '0')
    let y = m[3]; if (y.length === 2) y = (parseInt(y) > 50 ? '19' : '20') + y
    return `${y}-${mo}-${d}`
  }
  m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`
  const low = s.toLowerCase().replace(/\./g, '')
  m = low.match(/(\d{1,2})\s*(?:de\s+)?([a-záéíóú]+)\s*(?:de\s+|del\s+)?(\d{2,4})/)
  if (m && MESES[m[2]]) {
    let y = m[3]; if (y.length === 2) y = (parseInt(y) > 50 ? '19' : '20') + y
    return `${y}-${MESES[m[2]]}-${m[1].padStart(2,'0')}`
  }
  m = low.match(/^([a-záéíóú]+)\s+(\d{1,2}),?\s+(\d{4})$/)
  if (m && MESES[m[1]]) return `${m[3]}-${MESES[m[1]]}-${m[2].padStart(2,'0')}`
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

type Kind =
  | 'ine_front' | 'ine_back' | 'ine_full' | 'passport'
  | 'comprobante_domicilio' | 'csf' | 'acta_constitutiva'
  | 'aval_ine_front' | 'aval_ine_back' | 'aval_ine_full' | 'aval_passport'
  | 'aval_comprobante_domicilio'

const PROMPTS_BASE: Record<string, string> = {
  ine_front: `Extrae datos de la CARA FRONTAL de la credencial INE/IFE mexicana de la imagen/PDF. Devuelve únicamente JSON con estas llaves (usa null si no aparece):
{
  "nombre_completo": string|null,
  "curp": string|null,
  "fecha_nacimiento": string|null, // formato YYYY-MM-DD
  "sexo": "H"|"M"|null,
  "domicilio": string|null,
  "numero_identificacion": string|null, // "Clave de Elector" o número impreso
  "fecha_vencimiento": string|null, // "Vigencia" o "Año de registro" — devuelve último año vigente como YYYY-12-31
  "tipo_documento": "ine"
}`,
  ine_back: `Extrae datos del REVERSO de la credencial INE/IFE mexicana. Devuelve únicamente JSON con estas llaves (null si no aparece):
{
  "cic": string|null,
  "ocr_back": string|null, // bloque MRZ/OCR completo si está visible
  "numero_identificacion": string|null, // CIC o número visible
  "tipo_documento": "ine"
}`,
  ine_full: `La imagen/PDF contiene la credencial INE/IFE (frente y/o reverso). Extrae todos los datos visibles y devuelve sólo JSON:
{
  "nombre_completo": string|null,
  "curp": string|null,
  "fecha_nacimiento": string|null,
  "sexo": "H"|"M"|null,
  "domicilio": string|null,
  "numero_identificacion": string|null,
  "fecha_vencimiento": string|null,
  "cic": string|null,
  "tipo_documento": "ine"
}`,
  passport: `Extrae datos del pasaporte (mexicano u otro) visible en la imagen/PDF. Devuelve sólo JSON:
{
  "nombre_completo": string|null,
  "fecha_nacimiento": string|null,
  "sexo": "H"|"M"|null,
  "numero_identificacion": string|null, // número de pasaporte
  "fecha_vencimiento": string|null, // YYYY-MM-DD
  "pais_nacimiento": string|null,
  "nacionalidad": string|null,
  "tipo_documento": "pasaporte"
}`,
  comprobante_domicilio: `La imagen/PDF es un comprobante de domicilio (recibo de luz, agua, predial, teléfono, etc.). Extrae sólo JSON:
{
  "titular": string|null,
  "domicilio": string|null,
  "calle": string|null,
  "numero": string|null,
  "colonia": string|null,
  "municipio": string|null,
  "ciudad": string|null,
  "estado": string|null,
  "codigo_postal": string|null,
  "fecha_emision": string|null, // YYYY-MM-DD
  "proveedor": string|null // CFE, Telmex, predial, etc.
}`,
  csf: `La imagen/PDF es la Constancia de Situación Fiscal del SAT (México). Extrae sólo JSON:
{
  "rfc": string|null,
  "razon_social": string|null,
  "nombre_completo": string|null,
  "regimen_fiscal": string|null,
  "codigo_postal": string|null,
  "domicilio": string|null,
  "calle": string|null,
  "numero_exterior": string|null,
  "colonia": string|null,
  "municipio": string|null,
  "estado": string|null,
  "fecha_inicio_operaciones": string|null,
  "fecha_emision_documento": string|null, // fecha de emisión/impresión de la constancia, YYYY-MM-DD
  "actividad_economica": string|null,
  "tipo_persona": "fisica"|"moral"|null
}`,
  acta_constitutiva: `La imagen/PDF es un Acta Constitutiva de una sociedad mercantil mexicana (puede ser muy larga; concéntrate en datos clave del primer testimonio y antecedentes registrales). Devuelve sólo JSON:
{
  "escritura_constitutiva": string|null, // número de escritura pública, notario, número de notaría, ciudad y fecha. Ej: "Escritura pública 12,345 de fecha 15/03/2018, Notario Público No. 45 Lic. Juan Pérez, Monterrey, N.L."
  "datos_registro": string|null, // datos de inscripción en el Registro Público de Comercio: folio mercantil electrónico, fecha de inscripción, ciudad. Ej: "Folio Mercantil Electrónico N-2018012345 del 20/04/2018, RPC Monterrey, N.L."
  "ultima_asamblea": string|null, // referencia a la última asamblea protocolizada visible (escritura, notario, fecha, asunto). Ej: "Asamblea ordinaria del 12/05/2023, protocolizada en escritura 23,456, Notario 78"
  "administrador_presidente": string|null, // nombre completo del Administrador Único, Presidente del Consejo o representante legal vigente
  "razon_social": string|null,
  "objeto_social": string|null,
  "fecha_constitucion": string|null // YYYY-MM-DD
}`,
}
const PROMPTS: Record<Kind, string> = {
  ine_front: PROMPTS_BASE.ine_front,
  ine_back: PROMPTS_BASE.ine_back,
  ine_full: PROMPTS_BASE.ine_full,
  passport: PROMPTS_BASE.passport,
  comprobante_domicilio: PROMPTS_BASE.comprobante_domicilio,
  csf: PROMPTS_BASE.csf,
  acta_constitutiva: PROMPTS_BASE.acta_constitutiva,
  aval_ine_front: PROMPTS_BASE.ine_front,
  aval_ine_back: PROMPTS_BASE.ine_back,
  aval_ine_full: PROMPTS_BASE.ine_full,
  aval_passport: PROMPTS_BASE.passport,
  aval_comprobante_domicilio: PROMPTS_BASE.comprobante_domicilio,
}

async function callAI(prompt: string, fileB64: string, mime: string) {
  const isPdf = mime === 'application/pdf' || mime.includes('pdf')
  const dataUrl = `data:${mime};base64,${fileB64}`
  const content: any[] = [
    { type: 'text', text: prompt + '\n\nResponde ÚNICAMENTE con el JSON válido, sin texto adicional ni bloque de código.' },
  ]
  if (isPdf) {
    content.push({ type: 'file', file: { filename: 'doc.pdf', file_data: dataUrl } })
  } else {
    content.push({ type: 'image_url', image_url: { url: dataUrl } })
  }
  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Lovable-API-Key': LOVABLE_API_KEY,
      'X-Lovable-AIG-SDK': 'vercel-ai-sdk',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content }],
      response_format: { type: 'json_object' },
    }),
  })
  if (res.status === 429) throw new Error('rate_limited')
  if (res.status === 402) throw new Error('credits_exhausted')
  if (!res.ok) throw new Error(`ai_error_${res.status}: ${await res.text()}`)
  const data = await res.json()
  const text: string = data?.choices?.[0]?.message?.content || '{}'
  // strip code fences if any
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  try { return JSON.parse(clean) } catch { return { _raw: text } }
}

async function resolveRequestId(body: any, req: Request): Promise<string | null> {
  if (body.token) {
    const { data } = await supabase.from('credit_requests').select('id').eq('client_token', body.token).maybeSingle()
    if (data?.id) return data.id
    const { data: party } = await supabase.from('credit_request_parties').select('credit_request_id').eq('client_token', body.token).maybeSingle()
    if (party?.credit_request_id) return party.credit_request_id
    return null
  }
  if (body.request_id) {
    // Verify auth (internal call must include Authorization header)
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return null
    const jwt = authHeader.slice(7)
    const { data: { user } } = await supabase.auth.getUser(jwt)
    if (!user) return null
    const { data } = await supabase.from('credit_requests').select('id').eq('id', body.request_id).maybeSingle()
    return data?.id || null
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const body = await req.json()
    const kind = body.kind as Kind
    if (!PROMPTS[kind]) return json({ error: 'invalid_kind' }, 400)
    const fileB64 = String(body.file_b64 || '')
    const mime = String(body.mime || 'image/jpeg')
    if (!fileB64) return json({ error: 'missing_file' }, 400)
    if (fileB64.length > 20 * 1024 * 1024) return json({ error: 'file_too_large' }, 400)

    const requestId = await resolveRequestId(body, req)
    if (!requestId) return json({ error: 'unauthorized' }, 401)

    const parsed = await callAI(PROMPTS[kind], fileB64, mime)

    // Compute suggested updates to credit_requests, only filling missing fields.
    const { data: cur } = await supabase.from('credit_requests').select('*').eq('id', requestId).maybeSingle()
    const updates: Record<string, any> = {}
    const fillIfEmpty = (col: string, val: any) => {
      if (val === null || val === undefined || val === '') return
      const existing = cur ? (cur as any)[col] : null
      if (existing === null || existing === '' || existing === undefined) {
        updates[col] = val
      }
    }

    if (kind === 'csf') {
      fillIfEmpty('rfc', parsed.rfc)
      fillIfEmpty('razon_social', parsed.razon_social || parsed.nombre_completo)
      fillIfEmpty('domicilio_fiscal', parsed.domicilio)
      fillIfEmpty('ciudad_fiscal', parsed.municipio || parsed.ciudad)
      fillIfEmpty('estado_fiscal', parsed.estado)
      // El domicilio comercial se toma de la CSF; el comprobante sólo lo verifica
      fillIfEmpty('domicilio_comercial', parsed.domicilio)
      fillIfEmpty('ciudad_comercial', parsed.municipio || parsed.ciudad)
      fillIfEmpty('csf_rfc', parsed.rfc)
      fillIfEmpty('csf_razon_social', parsed.razon_social || parsed.nombre_completo)
      fillIfEmpty('csf_regimen_fiscal', parsed.regimen_fiscal)
      fillIfEmpty('csf_cp', parsed.codigo_postal)
      fillIfEmpty('csf_domicilio', parsed.domicilio)
      fillIfEmpty('csf_actividad_economica', parsed.actividad_economica)
      fillIfEmpty('csf_fecha_inicio_operaciones', toISODate(parsed.fecha_inicio_operaciones))
      fillIfEmpty('csf_tipo_persona', parsed.tipo_persona)
      updates.csf_parseado = true
    } else if (kind === 'comprobante_domicilio') {
      // NO autollenar domicilio_comercial: ese viene de la CSF.
      // Se devuelve el domicilio extraído para que la UI lo compare con el de la CSF.
    } else if (kind === 'acta_constitutiva') {
      fillIfEmpty('escritura_constitutiva', parsed.escritura_constitutiva)
      fillIfEmpty('datos_registro', parsed.datos_registro)
      fillIfEmpty('ultima_asamblea', parsed.ultima_asamblea)
      fillIfEmpty('administrador_presidente', parsed.administrador_presidente)
      fillIfEmpty('razon_social', parsed.razon_social)
    } else if (kind === 'ine_front' || kind === 'ine_back' || kind === 'ine_full' || kind === 'passport') {
      fillIfEmpty('rep_legal_nombre', parsed.nombre_completo)
      fillIfEmpty('rep_legal_curp', parsed.curp)
      fillIfEmpty('rep_legal_fecha_nacimiento', toISODate(parsed.fecha_nacimiento))
      fillIfEmpty('rep_legal_pais_nacimiento', parsed.pais_nacimiento)
      fillIfEmpty('rep_legal_tipo_id', kind === 'passport' ? 'Pasaporte' : 'INE')
      fillIfEmpty('rep_legal_num_id', parsed.numero_identificacion || parsed.cic)
      fillIfEmpty('rep_legal_vencimiento_id', toISODate(parsed.fecha_vencimiento))
    } else if (kind === 'aval_ine_front' || kind === 'aval_ine_back' || kind === 'aval_ine_full' || kind === 'aval_passport') {
      fillIfEmpty('aval_nombre', parsed.nombre_completo)
      fillIfEmpty('aval_direccion', parsed.domicilio)
    } else if (kind === 'aval_comprobante_domicilio') {
      // El comprobante del aval también ayuda a llenar dirección/ciudad si faltan
      fillIfEmpty('aval_direccion', parsed.domicilio)
      fillIfEmpty('aval_ciudad', parsed.municipio || parsed.ciudad)
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('credit_requests').update(updates).eq('id', requestId)
      if (error) return json({ error: error.message }, 500)
    }

    // Compute document validity dates for storage on the uploaded file record
    const fechaEmision = toISODate(parsed.fecha_emision_documento || parsed.fecha_emision)
    let fechaVencimiento: string | null = null
    if (fechaEmision) {
      const base = new Date(fechaEmision + 'T00:00:00Z')
      if (kind === 'csf') {
        base.setUTCDate(base.getUTCDate() + 60)
        fechaVencimiento = base.toISOString().slice(0, 10)
      } else if (kind === 'comprobante_domicilio') {
        base.setUTCDate(base.getUTCDate() + 90)
        fechaVencimiento = base.toISOString().slice(0, 10)
      }
    }

    return json({ ok: true, parsed, updated: updates, fecha_emision: fechaEmision, fecha_vencimiento: fechaVencimiento })
  } catch (e: any) {
    console.error('credito-autofill error', e)
    return json({ error: e?.message || 'server_error' }, 500)
  }
})