const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend';

Deno.serve(async (req) => {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'missing_keys' }), { status: 500 });
  }
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    'X-Connection-Api-Key': RESEND_API_KEY,
  };

  const call = async (path: string, method: string, body?: unknown) => {
    const r = await fetch(`${GATEWAY_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let json: unknown = text;
    try { json = JSON.parse(text); } catch { /* keep text */ }
    return { status: r.status, body: json };
  };

  const out: Record<string, unknown> = {};

  const domains = await call('/domains', 'GET');
  const existing = (domains.body as any)?.data?.find((d: any) => d.name === 'correo.lumaggs.com.mx');
  if (existing) {
    out.domain_existed = true;
    out.domain = await call(`/domains/${existing.id}`, 'GET');
  } else {
    out.domain_existed = false;
    out.domain = await call('/domains', 'POST', { name: 'correo.lumaggs.com.mx', capabilities: { receiving: 'enabled' } });
  }

  const endpoint = 'https://fnqeicdqblkhfpyboxre.supabase.co/functions/v1/email-inbound-webhook';
  const hooks = await call('/webhooks', 'GET');
  const hookExists = (hooks.body as any)?.data?.find((w: any) => w.endpoint === endpoint);
  if (hookExists) {
    out.webhook_existed = true;
    out.webhook = hookExists;
  } else {
    out.webhook_existed = false;
    out.webhook = await call('/webhooks', 'POST', { endpoint, events: ['email.received'] });
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
});
