import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PORTAL_BASE = Deno.env.get('CREDITO_PORTAL_BASE') || 'https://portal.lumaggs.com.mx'
const REMIND_AFTER_DAYS = 3   // primer recordatorio luego de N días sin movimiento
const REMIND_INTERVAL_DAYS = 3 // siguiente recordatorio cada N días
const MAX_REMINDERS = 5
const PENDING_STATES = ['portal_enviado', 'llenando_formulario']

function html(req: any, link: string) {
  const folio = req.folio || ''
  const nombre = req.client_nombre_contacto || req.razon_social || ''
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;background:#f6f7fb;padding:24px;color:#1f2937">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #e5e7eb">
    <p style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;margin:0">Procesadora de Servicios Magg's</p>
    <h1 style="font-size:18px;margin:8px 0 4px">Recordatorio: tu solicitud de crédito ${folio}</h1>
    <p style="margin:0;color:#4b5563">Hola${nombre ? ' ' + nombre : ''}, notamos que tu solicitud de crédito aún tiene información pendiente.</p>
    <p style="margin:14px 0;color:#4b5563">Continúa donde la dejaste desde tu portal personalizado:</p>
    <p style="text-align:center;margin:22px 0">
      <a href="${link}" style="background:#7c3aed;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">Continuar mi solicitud</a>
    </p>
    <p style="font-size:12px;color:#6b7280;margin:18px 0 0">Si ya enviaste toda la información, puedes ignorar este mensaje.</p>
    <p style="font-size:11px;color:#9ca3af;margin-top:18px;word-break:break-all">${link}</p>
  </div>
  </body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const cutoffFirst = new Date(Date.now() - REMIND_AFTER_DAYS * 86400_000).toISOString()
  const cutoffNext = new Date(Date.now() - REMIND_INTERVAL_DAYS * 86400_000).toISOString()

  // Candidatos: estado pendiente, email cliente, dentro del límite de recordatorios
  const { data: pending, error } = await supabase
    .from('credit_requests')
    .select('id, folio, estado, client_token, client_email, client_nombre_contacto, razon_social, ultimo_recordatorio_enviado, recordatorio_count, created_at, updated_at')
    .in('estado', PENDING_STATES as any)
    .not('client_email', 'is', null)
    .lt('recordatorio_count', MAX_REMINDERS)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const due = (pending || []).filter((r: any) => {
    if (!r.ultimo_recordatorio_enviado) return r.updated_at < cutoffFirst
    return r.ultimo_recordatorio_enviado < cutoffNext
  })

  let sent = 0; let failed = 0
  const errors: any[] = []

  for (const r of due) {
    const link = `${PORTAL_BASE}/portal/credito/${r.client_token}`
    try {
      const { error: sendErr } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'raw-html',
          recipientEmail: r.client_email,
          subjectOverride: `Recordatorio: tu solicitud de crédito ${r.folio || ''}`.trim(),
          htmlOverride: html(r, link),
          idempotencyKey: `credito-reminder-${r.id}-${Date.now()}`,
        },
      })
      if (sendErr) throw sendErr
      await supabase.from('credit_requests')
        .update({
          ultimo_recordatorio_enviado: new Date().toISOString(),
          recordatorio_count: (r.recordatorio_count || 0) + 1,
        })
        .eq('id', r.id)
      await supabase.from('credit_request_history').insert({
        credit_request_id: r.id,
        estado_nuevo: r.estado,
        nota: `Recordatorio enviado a ${r.client_email} (#${(r.recordatorio_count || 0) + 1})`,
      })
      sent++
    } catch (e: any) {
      failed++
      errors.push({ id: r.id, error: e?.message || String(e) })
    }
  }

  return new Response(JSON.stringify({ ok: true, evaluated: (pending || []).length, due: due.length, sent, failed, errors }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})