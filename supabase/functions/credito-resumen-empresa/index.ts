import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { request_id } = await req.json();
    if (!request_id) {
      return new Response(JSON.stringify({ error: 'request_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY no configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: cr, error: crErr } = await admin
      .from('credit_requests')
      .select('*, companies(*)')
      .eq('id', request_id)
      .maybeSingle();
    if (crErr || !cr) {
      return new Response(JSON.stringify({ error: 'Solicitud no encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const c: any = cr.companies || {};
    const ctx = {
      razon_social: c.razon_social || cr.razon_social || null,
      nombre_comercial: c.name || cr.nombre_comercial || null,
      giro: cr.giro_comercial || c.industry || null,
      industrias: c.industrias || [],
      website: c.website || null,
      telefono: c.phone || cr.telefono || null,
      email: c.email || cr.correo_contacto || null,
      direccion: [c.address, c.city, c.state, c.zip_code].filter(Boolean).join(', ') || null,
      tipo_destino_lubricante: c.tipo_destino_lubricante,
      potencial_unidades: c.potencial_unidades,
      potencial_cliente: c.potencial_cliente,
      barrera_entrada: c.barrera_entrada,
      riesgo_cambio_marca: c.riesgo_cambio_marca,
      tomador_decision: c.tomador_decision,
      origen_contacto: c.origen_contacto,
      tipo_cliente_comercial: c.tipo_cliente_comercial,
      ticket_promedio: c.ticket_promedio,
      volumen_mensual_estimado: c.volumen_mensual_estimado,
      monto_solicitado: cr.monto_solicitado,
      dias_credito: cr.dias_credito,
      tipo_credito: cr.tipo,
      antiguedad: cr.antiguedad,
      rfc: cr.rfc || cr.csf_rfc,
      csf_actividad: cr.csf_actividad_economica,
      csf_regimen: cr.csf_regimen_fiscal,
      fecha_inicio_operaciones: cr.csf_fecha_inicio_operaciones,
      referencias_comerciales: cr.referencias_comerciales,
      datos_bancarios: (cr.datos_bancarios || []).map((b: any) => ({ banco: b.banco, plaza: b.plaza })),
      notas_empresa: c.notes,
    };

    const systemPrompt = `Eres un analista de crédito experto. Generas resúmenes ejecutivos breves (máx 250 palabras) en español, profesionales y objetivos para evaluar si conviene otorgar crédito comercial a un cliente. NUNCA inventes datos. Si falta información clave, indícalo. Estructura tu respuesta con secciones cortas: Perfil del Negocio, Capacidad y Antigüedad, Riesgo y Recomendación.`;
    const userPrompt = `Analiza este prospecto de crédito y genera el resumen ejecutivo. Datos disponibles:\n\n${JSON.stringify(ctx, null, 2)}\n\nUsa SOLO los datos proporcionados. No inventes facturación, ni clientes, ni datos que no aparezcan. Si un campo está vacío, omítelo o señala "información no disponible".`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: 'Límite de uso alcanzado. Intenta más tarde.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: 'Créditos de IA agotados. Agrega créditos al workspace.' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!aiRes.ok) {
      const t = await aiRes.text();
      return new Response(JSON.stringify({ error: 'AI error: ' + t.slice(0, 300) }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const aiJson = await aiRes.json();
    const resumen = aiJson?.choices?.[0]?.message?.content?.trim();
    if (!resumen) {
      return new Response(JSON.stringify({ error: 'AI no devolvió contenido' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await admin.from('credit_requests').update({
      resumen_empresa: resumen,
      resumen_empresa_generated_at: new Date().toISOString(),
      resumen_empresa_generated_by: userData.user.id,
    }).eq('id', request_id);

    return new Response(JSON.stringify({ resumen }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});