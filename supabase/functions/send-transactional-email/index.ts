import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

// Configuration baked in at scaffold time — do NOT change these manually.
// To update, re-run the email domain setup flow.
const SITE_NAME = "Lumaggs"
// SENDER_DOMAIN is the verified sender subdomain FQDN (e.g., "notify.example.com").
// It MUST match the subdomain delegated to Lovable's nameservers — never the root domain.
// The email API looks up this exact domain; a mismatch causes "No email domain record found".
const SENDER_DOMAIN = "chevron.lumaggs.com.mx"
// FROM_DOMAIN is the domain shown in the From: header (e.g., "example.com").
// When display_from_root is enabled, this can be the root domain for cleaner branding,
// even though actual sending uses the subdomain above.
const FROM_DOMAIN = "lumaggs.com.mx"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

// Generate a cryptographically random 32-byte hex token
function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function signStorageUrlsInHtml(
  html: string,
  supabase: ReturnType<typeof createClient>,
  expiresIn = 60 * 60 * 24 * 7
): Promise<string> {
  if (!html) return html
  const re = /https?:\/\/[^\s"'<>]*\/storage\/v1\/object\/(?:public|sign)\/(document-files|template-attachments)\/[^\s"'<>)]+/gi
  const matches = Array.from(new Set(html.match(re) || []))
  if (matches.length === 0) return html
  const replacements = new Map<string, string>()
  await Promise.all(matches.map(async (url) => {
    try {
      const clean = url.split('?')[0]
      const match = clean.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/i)
      if (!match) return
      const bucket = match[1]
      const path = decodeURIComponent(match[2])
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
      if (data?.signedUrl) replacements.set(url, data.signedUrl)
    } catch (err) {
      console.warn('Could not sign storage URL in email HTML', { url, err })
    }
  }))
  let out = html
  for (const [from, to] of replacements) out = out.split(from).join(to)
  return out
}

// Auth note: this function uses verify_jwt = true in config.toml, so Supabase's
// gateway validates the caller's JWT (anon or service_role) before the request
// reaches this code. No in-function auth check is needed.

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Parse request body
  let templateName: string
  let recipientEmail: string
  let idempotencyKey: string
  let messageId: string
  let templateData: Record<string, any> = {}
  let subjectOverride: string | undefined
  let htmlOverride: string | undefined
  let cc: string[] | undefined
  let bcc: string[] | undefined
  let replyTo: string | undefined
  try {
    const body = await req.json()
    templateName = body.templateName || body.template_name
    recipientEmail = body.recipientEmail || body.recipient_email
    messageId = crypto.randomUUID()
    idempotencyKey = body.idempotencyKey || body.idempotency_key || messageId
    if (body.templateData && typeof body.templateData === 'object') {
      templateData = body.templateData
    }
    if (typeof body.subjectOverride === 'string') subjectOverride = body.subjectOverride
    if (typeof body.htmlOverride === 'string') htmlOverride = body.htmlOverride
    if (Array.isArray(body.cc)) cc = body.cc.filter((e: any) => typeof e === 'string' && e)
    if (Array.isArray(body.bcc)) bcc = body.bcc.filter((e: any) => typeof e === 'string' && e)
    if (typeof body.replyTo === 'string' && body.replyTo) replyTo = body.replyTo
    else if (typeof body.reply_to === 'string' && body.reply_to) replyTo = body.reply_to
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (!templateName) {
    return new Response(
      JSON.stringify({ error: 'templateName is required' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 1. Look up template from registry (early — needed to resolve recipient)
  const template = TEMPLATES[templateName]

  if (!template) {
    console.error('Template not found in registry', { templateName })
    return new Response(
      JSON.stringify({
        error: `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`,
      }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Resolve effective recipient: template-level `to` takes precedence over
  // the caller-provided recipientEmail. This allows notification templates
  // to always send to a fixed address (e.g., site owner from env var).
  const effectiveRecipient = template.to || recipientEmail

  if (!effectiveRecipient) {
    return new Response(
      JSON.stringify({
        error: 'recipientEmail is required (unless the template defines a fixed recipient)',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Create Supabase client with service role (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Idempotency guard: if this exact send was already accepted recently, do not send again.
  if (idempotencyKey) {
    const { data: existingSend, error: existingSendError } = await supabase
      .from('email_send_log')
      .select('id, status')
      .eq('metadata->>idempotency_key', idempotencyKey)
      .in('status', ['pending', 'sent'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingSendError) {
      console.warn('Idempotency lookup failed; continuing send', { error: existingSendError, idempotencyKey })
    } else if (existingSend) {
      console.log('Skipping duplicate email send by idempotency key', { templateName, effectiveRecipient, idempotencyKey })
      return new Response(
        JSON.stringify({ success: true, duplicate: true, status: existingSend.status }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
  }

  // 2. Check suppression list (fail-closed: if we can't verify, don't send)
  const { data: suppressed, error: suppressionError } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', effectiveRecipient.toLowerCase())
    .maybeSingle()

  if (suppressionError) {
    console.error('Suppression check failed — refusing to send', {
      error: suppressionError,
      effectiveRecipient,
    })
    return new Response(
      JSON.stringify({ error: 'Failed to verify suppression status' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (suppressed) {
    // Log the suppressed attempt
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'suppressed',
    })

    console.log('Email suppressed', { effectiveRecipient, templateName })
    return new Response(
      JSON.stringify({ success: false, reason: 'email_suppressed' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 3. Get or create unsubscribe token (one token per email address)
  const normalizedEmail = effectiveRecipient.toLowerCase()
  let unsubscribeToken: string

  // Check for existing token for this email
  const { data: existingToken, error: tokenLookupError } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (tokenLookupError) {
    console.error('Token lookup failed', {
      error: tokenLookupError,
      email: normalizedEmail,
    })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: 'Failed to look up unsubscribe token',
    })
    return new Response(
      JSON.stringify({ error: 'Failed to prepare email' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (existingToken && !existingToken.used_at) {
    // Reuse existing unused token
    unsubscribeToken = existingToken.token
  } else if (!existingToken) {
    // Create new token — upsert handles concurrent inserts gracefully
    unsubscribeToken = generateToken()
    const { error: tokenError } = await supabase
      .from('email_unsubscribe_tokens')
      .upsert(
        { token: unsubscribeToken, email: normalizedEmail },
        { onConflict: 'email', ignoreDuplicates: true }
      )

    if (tokenError) {
      console.error('Failed to create unsubscribe token', {
        error: tokenError,
      })
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'failed',
        error_message: 'Failed to create unsubscribe token',
      })
      return new Response(
        JSON.stringify({ error: 'Failed to prepare email' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // If another request raced us, our upsert was silently ignored.
    // Re-read to get the actual stored token.
    const { data: storedToken, error: reReadError } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (reReadError || !storedToken) {
      console.error('Failed to read back unsubscribe token after upsert', {
        error: reReadError,
        email: normalizedEmail,
      })
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'failed',
        error_message: 'Failed to confirm unsubscribe token storage',
      })
      return new Response(
        JSON.stringify({ error: 'Failed to prepare email' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
    unsubscribeToken = storedToken.token
  } else {
    // Token exists but is already used — email should have been caught by suppression check above.
    // This is a safety fallback; log and skip sending.
    console.warn('Unsubscribe token already used but email not suppressed', {
      email: normalizedEmail,
    })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'suppressed',
      error_message:
        'Unsubscribe token used but email missing from suppressed list',
    })
    return new Response(
      JSON.stringify({ success: false, reason: 'email_suppressed' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 4. Render React Email template to HTML and plain text
  const rawHtml = htmlOverride
    ? htmlOverride
    : await renderAsync(React.createElement(template.component, templateData))
  const html = await signStorageUrlsInHtml(rawHtml, supabase)
  const plainText = htmlOverride
    ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : await renderAsync(
        React.createElement(template.component, templateData),
        { plainText: true }
      )

  // Resolve subject — caller override > template static/function
  const resolvedSubject =
    subjectOverride ??
    (typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject)

  // 5. Enqueue the pre-rendered email for async processing by the dispatcher.
  // The dispatcher (process-email-queue) handles sending, retries, and rate-limit backoff.

  // If cc/bcc are present, route this email through Resend so the message
  // carries real Cc/Bcc headers and Reply-All works in recipients' clients.
  // The Lovable email provider does not support cc/bcc, so we bypass the queue.
  const hasCcBcc = (cc && cc.length > 0) || (bcc && bcc.length > 0)
  if (hasCcBcc) {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      console.error('Resend not configured for cc/bcc send', {
        hasLovable: !!LOVABLE_API_KEY,
        hasResend: !!RESEND_API_KEY,
      })
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'failed',
        error_message: 'Resend connector not configured (missing LOVABLE_API_KEY or RESEND_API_KEY)',
      })
      return new Response(
        JSON.stringify({ error: 'Email provider for cc/bcc is not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'pending',
      metadata: {
        idempotency_key: idempotencyKey,
        provider: 'resend',
        cc: cc && cc.length ? cc : undefined,
        bcc: bcc && bcc.length ? bcc : undefined,
        reply_to: replyTo || undefined,
      },
    })

    const fromAddress = `${SITE_NAME} <noreply@${FROM_DOMAIN}>`
    const resendBody: Record<string, unknown> = {
      from: fromAddress,
      to: [effectiveRecipient],
      subject: resolvedSubject,
      html,
      text: plainText,
    }
    if (cc && cc.length) resendBody.cc = cc
    if (bcc && bcc.length) resendBody.bcc = bcc
    if (replyTo) resendBody.reply_to = replyTo

    try {
      const resp = await fetch('https://connector-gateway.lovable.dev/resend/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': RESEND_API_KEY,
        },
        body: JSON.stringify(resendBody),
      })

      const respText = await resp.text()
      let providerMessageId: string | null = null
      if (respText) {
        try {
          const respJson = JSON.parse(respText)
          providerMessageId = respJson?.id || null
        } catch {
          // Response body is not valid JSON; leave provider_message_id as null.
        }
      }

      if (!resp.ok) {
        console.error('Resend send failed', { status: resp.status, body: respText })
        await supabase.from('email_send_log').insert({
          message_id: messageId,
          template_name: templateName,
          recipient_email: effectiveRecipient,
          status: 'failed',
          error_message: `Resend ${resp.status}: ${respText.slice(0, 500)}`,
        })
        return new Response(
          JSON.stringify({ error: 'Failed to send email via Resend', details: respText }),
          {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'sent',
        provider_message_id: providerMessageId,
        metadata: {
          idempotency_key: idempotencyKey,
          provider: 'resend',
          cc: cc && cc.length ? cc : undefined,
          bcc: bcc && bcc.length ? bcc : undefined,
          reply_to: replyTo || undefined,
        },
      })

      console.log('Transactional email sent via Resend', {
        templateName,
        effectiveRecipient,
        ccCount: cc?.length || 0,
        bccCount: bcc?.length || 0,
      })

      return new Response(
        JSON.stringify({ success: true, provider: 'resend', sent: true }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    } catch (err) {
      console.error('Resend request threw', err)
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'failed',
        error_message: `Resend request error: ${String(err).slice(0, 500)}`,
      })
      return new Response(
        JSON.stringify({ error: 'Failed to send email via Resend' }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
  }

  // Default path: no cc/bcc — use Lovable's queued email infrastructure.
  // Log pending BEFORE enqueue so we have a record even if enqueue crashes
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: effectiveRecipient,
    status: 'pending',
    metadata: {
      idempotency_key: idempotencyKey,
      reply_to: replyTo || undefined,
    },
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: effectiveRecipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: resolvedSubject,
      html,
      text: plainText,
      purpose: 'transactional',
      label: templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
      reply_to: replyTo || undefined,
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue email', {
      error: enqueueError,
      templateName,
      effectiveRecipient,
    })

    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })

    return new Response(JSON.stringify({ error: 'Failed to enqueue email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log('Transactional email enqueued', { templateName, effectiveRecipient })

  return new Response(
    JSON.stringify({ success: true, queued: true }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
})
