import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GOOGLE_MAPS_API_KEY no configurada' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(supabaseUrl, serviceKey)

  let limit = 100
  try {
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      if (typeof body?.limit === 'number' && body.limit > 0 && body.limit <= 500) limit = body.limit
    }
  } catch { /* ignore */ }

  const { data: rows, error } = await admin
    .from('direcciones_empresa')
    .select('id, direccion_completa')
    .eq('is_active', true)
    .not('direccion_completa', 'is', null)
    .or('coordenadas_lat.is.null,coordenadas_lng.is.null')
    .limit(limit)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let updated = 0
  let failed = 0
  const failures: Array<{ id: string; status: string }> = []

  for (const r of rows ?? []) {
    const addr = (r.direccion_completa || '').trim()
    if (addr.length < 5) { failed++; continue }
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&region=mx&key=${apiKey}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.status !== 'OK' || !data.results?.[0]?.geometry?.location) {
        failed++
        failures.push({ id: r.id, status: data.status || 'NO_RESULTS' })
        continue
      }
      const loc = data.results[0].geometry.location
      const placeId = data.results[0].place_id || null
      const formatted = data.results[0].formatted_address || null
      const { error: upErr } = await admin
        .from('direcciones_empresa')
        .update({
          coordenadas_lat: loc.lat,
          coordenadas_lng: loc.lng,
          codigo_google: placeId,
          direccion_completa: formatted ?? addr,
        })
        .eq('id', r.id)
      if (upErr) { failed++; failures.push({ id: r.id, status: upErr.message }) }
      else updated++
    } catch (e) {
      failed++
      failures.push({ id: r.id, status: e instanceof Error ? e.message : 'error' })
    }
    // Light throttle to stay under Google rate limits
    await new Promise((res) => setTimeout(res, 60))
  }

  return new Response(JSON.stringify({
    scanned: rows?.length ?? 0,
    updated,
    failed,
    failures: failures.slice(0, 20),
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})