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

type Confianza = 'alta' | 'media' | 'baja'
type PageOut = { n: number; doc_type_id: string | null; es_continuacion: boolean; confianza: Confianza; razon: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  try {
    // Auth interna únicamente
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)
    const jwt = authHeader.slice(7)
    const { data: { user } } = await supabase.auth.getUser(jwt)
    if (!user) return json({ error: 'unauthorized' }, 401)

    let body: any
    try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }

    const requestId = typeof body?.request_id === 'string' ? body.request_id : ''
    if (!/^[0-9a-f-]{36}$/i.test(requestId)) return json({ error: 'invalid_request_id' }, 400)

    const pagesIn = Array.isArray(body?.pages) ? body.pages : null
    if (!pagesIn || pagesIn.length < 1 || pagesIn.length > 20) return json({ error: 'pages_must_be_1_to_20' }, 400)
    const pages: { n: number; b64: string }[] = []
    for (const p of pagesIn) {
      const n = Number(p?.n)
      const b64 = typeof p?.b64 === 'string' ? p.b64 : ''
      if (!Number.isFinite(n) || !b64) return json({ error: 'invalid_page' }, 400)
      pages.push({ n, b64 })
    }
    const prev = body?.prev && Number.isFinite(Number(body.prev.n))
      ? { n: Number(body.prev.n), doc_type_id: typeof body.prev.doc_type_id === 'string' ? body.prev.doc_type_id : null }
      : null

    const { data: cr, error: crErr } = await supabase
      .from('credit_requests')
      .select('razon_social, rep_legal_nombre, aval_nombre, aval_es_distinto, tipo_persona')
      .eq('id', requestId)
      .maybeSingle()
    if (crErr) return json({ error: crErr.message }, 500)
    if (!cr) return json({ error: 'request_not_found' }, 400)

    const { data: tipos, error: tErr } = await supabase
      .from('credit_doc_types')
      .select('id, nombre, descripcion')
      .eq('is_active', true)
    if (tErr) return json({ error: tErr.message }, 500)
    const validIds = new Set((tipos || []).map((t: any) => String(t.id)))
    const listaTipos = (tipos || []).map((t: any) => `${t.id} — ${t.nombre} — ${t.descripcion ?? ''}`).join('\n')

    const c: any = cr
    const contexto = [
      `Solicitante / razón social: ${c.razon_social || 'desconocido'} (tipo de persona: ${c.tipo_persona || 'desconocido'})`,
      `Representante legal: ${c.rep_legal_nombre || 'desconocido'}`,
      c.aval_es_distinto ? `Aval: ${c.aval_nombre || 'desconocido'}` : null,
      prev ? `La página anterior (${prev.n}) fue del tipo ${prev.doc_type_id ?? 'null'}.` : null,
    ].filter(Boolean).join('\n')

    const prompt = `Eres un clasificador de expedientes de crédito mexicanos escaneados. Recibirás páginas escaneadas y debes clasificar cada una en un tipo de documento.

TIPOS DE DOCUMENTO (id — nombre — descripción):
${listaTipos}

CONTEXTO:
${contexto}

REGLAS:
- Clasifica CADA página; usa únicamente ids de la lista anterior, o null si no corresponde a ninguno, está en blanco o es ilegible.
- es_continuacion = true si la página pertenece al MISMO documento físico que la página anterior (numeración "Página 2 de 5", mismo folio/escritura, sello notarial continuo, reverso de una identificación, mismo estado de cuenta).
- Identificación o comprobante de domicilio: decide entre el tipo normal y el "del Aval" comparando el nombre impreso con el representante legal vs el aval; si no se puede leer, confianza "baja".
- Acta Constitutiva vs Poder del Representante Legal: distingue por el objeto del instrumento notarial; si hay duda, confianza "media".
- Carátula de estado de cuenta = solo la primera hoja resumen; el resto es "Estado de cuenta bancario".
- confianza: "alta" | "media" | "baja". razon: máximo 12 palabras.

Responde SOLO con JSON válido, sin texto adicional ni bloque de código:
{ "pages": [ { "n": number, "doc_type_id": string|null, "es_continuacion": boolean, "confianza": "alta"|"media"|"baja", "razon": string } ] }`

    const content: any[] = [{ type: 'text', text: prompt }]
    for (const p of pages) {
      content.push({ type: 'text', text: `PÁGINA ${p.n}` })
      content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${p.b64}` } })
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
    if (res.status === 429) return json({ error: 'rate_limited' }, 429)
    if (res.status === 402) return json({ error: 'credits_exhausted' }, 402)
    if (!res.ok) return json({ error: `ai_error_${res.status}: ${await res.text()}` }, 502)
    const data = await res.json()
    const text: string = data?.choices?.[0]?.message?.content || '{}'
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
    let parsed: any = {}
    try { parsed = JSON.parse(clean) } catch { parsed = {} }

    const byN = new Map<number, any>()
    for (const p of Array.isArray(parsed?.pages) ? parsed.pages : []) {
      const n = Number(p?.n)
      if (Number.isFinite(n) && !byN.has(n)) byN.set(n, p)
    }

    const out: PageOut[] = pages.map(({ n }) => {
      const p = byN.get(n)
      if (!p) return { n, doc_type_id: null, es_continuacion: false, confianza: 'baja', razon: 'Sin respuesta del clasificador' }
      let id: string | null = typeof p.doc_type_id === 'string' && p.doc_type_id ? p.doc_type_id : null
      let confianza: Confianza = ['alta', 'media', 'baja'].includes(p.confianza) ? p.confianza : 'baja'
      if (id !== null && !validIds.has(id)) { id = null; confianza = 'baja' }
      const razon = String(p.razon ?? '').split(/\s+/).filter(Boolean).slice(0, 12).join(' ')
      return { n, doc_type_id: id, es_continuacion: p.es_continuacion === true, confianza, razon }
    })

    return json({ ok: true, pages: out })
  } catch (e: any) {
    console.error('credito-clasificar-paginas error', e)
    return json({ error: e?.message || 'server_error' }, 500)
  }
})
