import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

type EntityType = 'deal' | 'company' | 'document' | 'contact' | 'task' | 'payment'

interface Body {
  trigger_type: string
  entity_type: EntityType
  entity_id?: string | null
  trigger_key?: string | null
  context?: Record<string, any>
}

function renderTemplate(body: string, vars: Record<string, any>): string {
  if (!body) return ''
  return body.replace(/\{([a-z0-9_]+)\}/gi, (m, key) => {
    const v = vars[key.toLowerCase()]
    return v === undefined || v === null || v === '' ? m : String(v)
  })
}

function getPath(obj: any, path: string): any {
  if (!obj) return undefined
  return path
    .split('.')
    .slice(1)
    .reduce((acc: any, k: string) => (acc == null ? acc : acc[k]), obj)
}

function compare(left: any, op: string, right: any): boolean {
  switch (op) {
    case 'eq':
    case '=':
    case '==':
      return String(left ?? '') === String(right ?? '')
    case 'neq':
    case '!=':
      return String(left ?? '') !== String(right ?? '')
    case 'gt':
      return Number(left) > Number(right)
    case 'gte':
      return Number(left) >= Number(right)
    case 'lt':
      return Number(left) < Number(right)
    case 'lte':
      return Number(left) <= Number(right)
    case 'contains':
      return String(left ?? '')
        .toLowerCase()
        .includes(String(right ?? '').toLowerCase())
    case 'in':
      return Array.isArray(right) && right.map(String).includes(String(left))
    case 'is_empty':
      return left == null || left === ''
    case 'is_not_empty':
      return left != null && left !== ''
    default:
      return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  let body: Body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { trigger_type, entity_type, entity_id, trigger_key } = body
  if (!trigger_type || !entity_type) {
    return new Response(JSON.stringify({ error: 'trigger_type and entity_type required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: autos, error: aErr } = await supabase
    .from('automations')
    .select('*, automation_actions(*)')
    .eq('is_active', true)
    .eq('entity_type', entity_type)
    .eq('trigger_type', trigger_type)

  if (aErr) {
    return new Response(JSON.stringify({ error: aErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const filtered = (autos || []).filter((a: any) => {
    if (!trigger_key) return true
    const cfg = a.trigger_config || {}
    return !cfg.button_id || cfg.button_id === trigger_key
  })

  let entity: any = null
  let company: any = null
  let contact: any = null
  let ejecutivo: any = null
  let creador: any = null
  let plaza: any = null
  let entityLabel = ''
  let pago: any = null
  let pagoAplicaciones: any[] = []
  let pagoComprobantes: { nombre: string; url: string }[] = []

  if (entity_id && entity_type === 'document') {
    const { data } = await supabase
      .from('documentos')
      .select('*')
      .eq('id', entity_id)
      .maybeSingle()
    entity = data
    entityLabel = data?.numero_cotizacion || data?.numero_factura || data?.numero_pedido || data?.id || ''
    if (data) {
      ;(data as any).company_id = (data as any).company_id ?? data.empresa_id
      ;(data as any).contact_id = (data as any).contact_id ?? data.contacto_id
    }
    if (data?.empresa_id) {
      const { data: c } = await supabase.from('companies').select('*').eq('id', data.empresa_id).maybeSingle()
      company = c
    }
    if (data?.contacto_id) {
      const { data: ct } = await supabase.from('contacts').select('*').eq('id', data.contacto_id).maybeSingle()
      contact = ct
    }
    if (data?.ejecutivo_venta_id) {
      const { data: ej } = await supabase.from('profiles').select('full_name, email, phone').eq('user_id', data.ejecutivo_venta_id).maybeSingle()
      ejecutivo = ej
    }
    if (data?.created_by) {
      const { data: cr } = await supabase.from('profiles').select('full_name').eq('user_id', data.created_by).maybeSingle()
      creador = cr
    }
    if (data?.plaza_id) {
      const { data: pl } = await supabase.from('plazas').select('nombre').eq('id', data.plaza_id).maybeSingle()
      plaza = pl
    }
  } else if (entity_id && entity_type === 'company') {
    const { data } = await supabase.from('companies').select('*').eq('id', entity_id).maybeSingle()
    entity = data
    company = data
    entityLabel = data?.name || ''
  } else if (entity_id && entity_type === 'contact') {
    const { data } = await supabase.from('contacts').select('*').eq('id', entity_id).maybeSingle()
    entity = data
    contact = data
    entityLabel = [data?.first_name, data?.last_name].filter(Boolean).join(' ')
  } else if (entity_id && entity_type === 'task') {
    const { data } = await supabase.from('crm_tasks').select('*').eq('id', entity_id).maybeSingle()
    entity = data
    entityLabel = data?.title || ''
  } else if (entity_id && entity_type === 'payment') {
    const { data: p } = await supabase
      .from('cobranza_pagos')
      .select('*')
      .eq('id', entity_id)
      .maybeSingle()
    pago = p
    entity = p
    if (p?.empresa_id) {
      const { data: c } = await supabase.from('companies').select('*').eq('id', p.empresa_id).maybeSingle()
      company = c
    }
    if (p?.creado_por) {
      const { data: cr } = await supabase.from('profiles').select('full_name').eq('user_id', p.creado_por).maybeSingle()
      creador = cr
    }
    if (p?.plaza_id) {
      const { data: pl } = await supabase.from('plazas').select('nombre').eq('id', p.plaza_id).maybeSingle()
      plaza = pl
    }
    // Aplicaciones (documentos relacionados)
    const { data: aps } = await supabase
      .from('cobranza_aplicaciones')
      .select('id, tipo_documento, documento_id, monto_aplicado, estatus_aplicacion')
      .eq('pago_id', entity_id)
      .eq('estatus_aplicacion', 'activa')
    pagoAplicaciones = aps || []
    if (pagoAplicaciones.length > 0) {
      const docIds = Array.from(new Set(pagoAplicaciones.map((a: any) => a.documento_id).filter(Boolean)))
      const { data: docs } = await supabase
        .from('documentos')
        .select('id, numero_factura, numero_pedido, numero_cotizacion')
        .in('id', docIds)
      const docMap = new Map<string, any>((docs || []).map((d: any) => [d.id, d]))
      pagoAplicaciones = pagoAplicaciones.map((a: any) => ({
        ...a,
        documento: docMap.get(a.documento_id) || null,
      }))
    }
    // Comprobantes (archivos del pago) → URLs firmadas
    const { data: arch } = await supabase
      .from('cobranza_pago_archivos')
      .select('url_archivo, nombre_archivo')
      .eq('pago_id', entity_id)
      .order('fecha_carga', { ascending: false })
    for (const a of arch || []) {
      const raw = (a as any).url_archivo || ''
      let signed = raw
      try {
        const marker = '/cobranza-pagos/'
        let path = raw
        const idx = raw.indexOf(marker)
        if (idx >= 0) path = decodeURIComponent(raw.slice(idx + marker.length))
        const { data: s } = await supabase.storage
          .from('cobranza-pagos')
          .createSignedUrl(path, 60 * 60 * 24 * 7)
        if (s?.signedUrl) signed = s.signedUrl
      } catch (_) { /* keep raw */ }
      pagoComprobantes.push({ nombre: (a as any).nombre_archivo || 'Comprobante', url: signed })
    }
    entityLabel = company?.name || p?.referencia_pago || (p?.id ? String(p.id).slice(0, 8) : '')
  }

  const entityScope: Record<string, any> = {}
  entityScope[entity_type] = entity || {}
  if (company) entityScope['company'] = company
  if (contact) entityScope['contact'] = contact

  let acuseUrlSigned = ''
  let ordenCompraUrlSigned = ''
  if (entity_type === 'document' && entity_id) {
    const SIGNED_TTL = 60 * 60 * 24 * 7
    const toSignedUrl = async (publicOrPath: string): Promise<string> => {
      if (!publicOrPath) return ''
      const marker = '/documentos/'
      let path = publicOrPath
      const idx = publicOrPath.indexOf(marker)
      if (idx >= 0) path = decodeURIComponent(publicOrPath.slice(idx + marker.length))
      const { data: signed } = await supabase.storage
        .from('documentos')
        .createSignedUrl(path, SIGNED_TTL)
      return signed?.signedUrl || publicOrPath
    }
    const { data: acuseRows } = await supabase
      .from('documento_acuse_archivos')
      .select('url_archivo, fecha_carga')
      .eq('documento_id', entity_id)
      .order('fecha_carga', { ascending: false })
      .limit(1)
    if (acuseRows && acuseRows.length > 0) {
      acuseUrlSigned = await toSignedUrl((acuseRows[0] as any).url_archivo || '')
    }
    const { data: ocRows } = await supabase
      .from('documento_orden_compra_archivos')
      .select('url_archivo, fecha_carga')
      .eq('documento_id', entity_id)
      .order('fecha_carga', { ascending: false })
      .limit(1)
    if (ocRows && ocRows.length > 0) {
      ordenCompraUrlSigned = await toSignedUrl((ocRows[0] as any).url_archivo || '')
    }
  }

  const vars: Record<string, any> = {
    nombre_empresa: company?.name || '',
    nombre_cliente: company?.name || '',
    razon_social: company?.razon_social || '',
    id_contpaq: company?.id_contpaq || '',
    rfc_cliente: company?.rfc || '',
    nombre_contacto: [contact?.first_name, contact?.last_name].filter(Boolean).join(' '),
    correo_contacto: contact?.email || '',
    telefono_contacto: contact?.phone || contact?.mobile || '',
    ejecutivo: ejecutivo?.full_name || '',
    correo_ejecutivo: ejecutivo?.email || '',
    telefono_ejecutivo: ejecutivo?.phone || '',
    registrado_por: creador?.full_name || '',
    plaza: plaza?.nombre || '',
    folio_cotizacion: entity?.numero_cotizacion || '',
    numero_factura: entity?.numero_factura || '',
    fecha: entity?.fecha_documento || new Date().toISOString().slice(0, 10),
    fecha_vencimiento: entity?.fecha_vencimiento || '',
    fecha_entrega_programada: entity?.fecha_entrega_programada || '',
    fecha_entrega_real: entity?.fecha_entrega_real || '',
    fecha_entrega_solicitada: entity?.fecha_entrega_programada || '',
    estatus_entrega: entity?.estatus_entrega_corporativa || '',
    numero_oc_cliente: entity?.numero_oc_cliente || '',
    fecha_oc_cliente: entity?.fecha_oc_cliente || '',
    total_cotizacion: entity?.total ?? '',
    saldo_pendiente: entity?.saldo_pendiente_cobranza ?? '',
    estatus_documento: entity?.estatus_factura || entity?.estatus_cotizacion || entity?.estatus_pedido || '',
    observaciones: entity?.notas || '',
    instrucciones_entrega: entity?.instrucciones_entrega || '',
    direccion_entrega: entity?.direccion_envio || '',
    direccion_entrega_completa: entity?.direccion_envio || '',
    direccion_entrega_ciudad: entity?.direccion_envio || '',
    direccion_entrega_estado: entity?.direccion_envio || '',
    nombre_empresa_vendedora: entity?.empresa_vendedora === 'galsa_phillips66' ? 'Galsa S.A. de C.V.' : 'Lumaggs S.A. de C.V.',
    acuse_url: acuseUrlSigned
      ? `<a href="${acuseUrlSigned}" style="color:#2563eb;text-decoration:underline;" target="_blank" rel="noopener noreferrer">Ver Acuse Comprobante</a>`
      : '',
    orden_compra_url: ordenCompraUrlSigned
      ? `<a href="${ordenCompraUrlSigned}" style="color:#2563eb;text-decoration:underline;" target="_blank" rel="noopener noreferrer">Ver Orden de Compra</a>`
      : '',
    ...(body.context || {}),
  }

  // Variables específicas de pagos (sólo si el evento corresponde a un pago)
  if (entity_type === 'payment' && pago) {
    const FORMA_PAGO_LABEL: Record<string, string> = {
      transferencia: 'Transferencia',
      deposito: 'Depósito',
      efectivo: 'Efectivo',
      cheque: 'Cheque',
      tarjeta: 'Tarjeta',
      contado: 'Contado',
      credito: 'Crédito Directo',
      credito_cescemex: 'Crédito Cescemex',
    }
    const TIPO_DOC_LABEL: Record<string, string> = {
      factura: 'Factura',
      pedido: 'Pedido',
      cotizacion: 'Cotización',
    }
    const moneyFmt = (n: any) => {
      const num = Number(n || 0)
      return num.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
    }
    const tipoPagoKey = String(pago.tipo_pago || '').toLowerCase()
    const formaPagoLabel = FORMA_PAGO_LABEL[tipoPagoKey] || pago.tipo_pago || '—'
    const fechaPagoFmt = pago.fecha_pago
      ? new Date(pago.fecha_pago).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : ''
    const docsHtml = pagoAplicaciones.length
      ? pagoAplicaciones.map((a: any) => {
          const folio = a.documento?.numero_factura || a.documento?.numero_pedido || a.documento?.numero_cotizacion || (a.documento_id ? String(a.documento_id).slice(0, 8) : '')
          const tipo = TIPO_DOC_LABEL[a.tipo_documento] || a.tipo_documento || 'Documento'
          return `<div style="display:flex;justify-content:space-between;padding:4px 0;"><span style="font-size:13px;color:#0f172a;"><strong>${tipo}</strong> ${folio}</span><span style="font-size:13px;color:#0f172a;font-weight:600;">${moneyFmt(a.monto_aplicado)}</span></div>`
        }).join('')
      : '<span style="color:#94a3b8;">Sin documentos relacionados</span>'
    const compsHtml = pagoComprobantes.length
      ? pagoComprobantes.map((c) => `<div style="padding:4px 0;"><a href="${c.url}" style="color:#2563eb;text-decoration:underline;" target="_blank" rel="noopener noreferrer">${c.nombre}</a></div>`).join('')
      : '<span style="color:#94a3b8;">Sin comprobantes</span>'
    Object.assign(vars, {
      empresa: company?.name || '',
      cliente: company?.name || '',
      fecha_pago: fechaPagoFmt,
      monto_total: moneyFmt(pago.monto_total),
      monto_pago: `${moneyFmt(pago.monto_total)} ${pago.moneda || 'MXN'}`,
      moneda: pago.moneda || 'MXN',
      referencia: pago.referencia_pago || '—',
      referencia_pago: pago.referencia_pago || '—',
      tipo_pago: formaPagoLabel,
      forma_pago: formaPagoLabel,
      banco: pago.banco || '—',
      observaciones: pago.observaciones || '—',
      registrado_por: creador?.full_name || vars.registrado_por || '—',
      documentos_lista: docsHtml,
      comprobantes_lista: compsHtml,
      nombre_empresa: company?.name || vars.nombre_empresa || '',
      nombre_cliente: company?.name || vars.nombre_cliente || '',
      razon_social: company?.razon_social || vars.razon_social || '',
      id_contpaq: company?.id_contpaq || vars.id_contpaq || '',
      ...(body.context || {}),
    })
  }

  const summary: any[] = []

  for (const auto of filtered) {
    const runRow: any = {
      automation_id: auto.id,
      entity_id: entity_id ?? null,
      entity_type,
      entity_label: entityLabel || null,
      triggered_by: 'user',
      status: 'success',
      actions_executed: 0,
    }

    try {
      const cond = auto.conditions || {}
      const items: any[] = Array.isArray(cond) ? cond : cond.items || []
      const logic: 'AND' | 'OR' = (cond.logic || 'AND') as any
      let pass = true
      if (items.length > 0) {
        const results = items.map((it: any) => {
          const left = it.field?.includes('.')
            ? getPath(entityScope[it.field.split('.')[0]], it.field)
            : entity?.[it.field]
          return compare(left, it.operator, it.value)
        })
        pass = logic === 'OR' ? results.some(Boolean) : results.every(Boolean)
      }

      if (!pass) {
        runRow.status = 'skipped'
        runRow.error_message = 'Conditions not met'
      } else {
        const actions: any[] = (auto.automation_actions || []).sort(
          (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)
        )
        let executed = 0
        for (const act of actions) {
          if (act.action_type === 'send_email') {
            const tplId = act.action_config?.template_id
            if (!tplId) continue
            const { data: tpl } = await supabase
              .from('templates')
              .select('*')
              .eq('id', tplId)
              .maybeSingle()
            if (!tpl) continue

            const directList: string[] = []
            const groupIds: string[] = []
            for (const it of (tpl.to_emails || []) as any[]) {
              if (it.type === 'email' && it.value) directList.push(it.value)
              else if (it.type === 'group' && it.value) groupIds.push(it.value)
            }
            if (groupIds.length > 0) {
              const { data: gm } = await supabase
                .from('email_group_members')
                .select('email')
                .in('group_id', groupIds)
              for (const r of gm || []) if (r.email) directList.push(r.email)
            }
            if (directList.length === 0 && contact?.email) directList.push(contact.email)
            const recipients = Array.from(new Set(directList.map((e) => e.trim()).filter(Boolean)))
            if (recipients.length === 0) {
              runRow.error_message = 'Sin destinatarios para el correo'
              continue
            }

            const subject = renderTemplate(tpl.subject || '', vars)
            const html = renderTemplate(tpl.body || '', vars)
            const ts = Date.now()

            const resolveList = async (list: any[]) => {
              const out: string[] = []
              const gids: string[] = []
              for (const it of list || []) {
                if (it.type === 'email' && it.value) out.push(it.value)
                else if (it.type === 'group' && it.value) gids.push(it.value)
              }
              if (gids.length) {
                const { data: gm } = await supabase
                  .from('email_group_members')
                  .select('email')
                  .in('group_id', gids)
                for (const r of gm || []) if (r.email) out.push(r.email)
              }
              return Array.from(new Set(out.map((e) => e.trim()).filter(Boolean)))
            }
            const ccList = await resolveList((tpl.cc_emails || []) as any[])
            const bccList = await resolveList((tpl.bcc_emails || []) as any[])

            for (const to of recipients) {
              const { error: invErr } = await supabase.functions.invoke(
                'send-transactional-email',
                {
                  body: {
                    templateName: 'raw-html',
                    recipientEmail: to,
                    idempotencyKey: `auto-${auto.id}-${entity_id || 'na'}-${to}-${ts}`,
                    subjectOverride: subject,
                    htmlOverride: html,
                    cc: ccList.length ? ccList : undefined,
                    bcc: bccList.length ? bccList : undefined,
                    replyTo: tpl.reply_to || undefined,
                    templateData: { __subject: subject, __html: html },
                  },
                }
              )
              if (invErr) throw new Error(`send-transactional-email: ${invErr.message}`)
            }
            executed += 1
          } else {
            runRow.error_message = `Action '${act.action_type}' aún no implementada`
          }
        }
        runRow.actions_executed = executed
      }
    } catch (e) {
      runRow.status = 'failed'
      runRow.error_message = e instanceof Error ? e.message : String(e)
    }

    await supabase.from('automation_runs').insert(runRow)
    if (runRow.status === 'success' && runRow.actions_executed > 0) {
      await supabase
        .from('automations')
        .update({ run_count: (auto.run_count || 0) + 1, last_run_at: new Date().toISOString() })
        .eq('id', auto.id)
    }
    summary.push({ automation: auto.name, ...runRow })
  }

  return new Response(
    JSON.stringify({ matched: filtered.length, runs: summary }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
