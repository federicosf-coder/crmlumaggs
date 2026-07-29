// Logica de negocio compartida para el alta de prospectos.
// La usan lead-intake (API publica) y facebook-leads-webhook (Meta Lead Ads).

export type LeadSource = {
  id: string;
  nombre: string;
  plaza_id: string | null;
  marca?: string | null;
  notificar_whatsapp?: string | null;
  dominio_permitido?: string | null;
};

export type ProcessMeta = {
  ip?: string | null;
  user_agent?: string | null;
  referrer?: string | null;
  automationId?: string | null;
  supabaseUrl?: string;
  serviceKey?: string;
};

export type ProcessResult =
  | { ok: true; lead_id: string; contact_id: string | null; company_id: string | null; duplicated?: boolean }
  | { ok: false; status: number; error: string; fields?: Record<string, string> };

export function clean(v: unknown, max = 500): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

export function normalizePhone(raw: unknown): string | null {
  const s = clean(raw, 40);
  if (!s) return null;
  const hasPlus = s.startsWith("+");
  const d = s.replace(/\D/g, "");
  if (!d) return null;
  if (hasPlus) return "+" + d;
  if (d.length === 10) return "+52" + d;
  if (d.length === 12 && d.startsWith("52")) return "+" + d;
  if (d.length === 13 && d.startsWith("521")) return "+52" + d.slice(3);
  return "+" + d;
}

export function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

export function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "-" };
  const cut = parts.length > 2 ? 2 : 1;
  return { first: parts.slice(0, cut).join(" "), last: parts.slice(cut).join(" ") };
}

export function pick(body: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const found = Object.keys(body).find(
      (bk) => bk.toLowerCase().replace(/[\s_-]/g, "") === k,
    );
    if (found && body[found] !== null && body[found] !== undefined && String(body[found]).trim() !== "") {
      return body[found];
    }
  }
  return null;
}

async function notifyWhatsApp(source: LeadSource, text: string) {
  try {
    const TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    if (!TOKEN || !PHONE_ID || !source.notificar_whatsapp) return;
    const to = String(source.notificar_whatsapp).replace(/\D/g, "");
    const resp = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
    });
    if (!resp.ok) console.error("WhatsApp notify failed:", resp.status, await resp.text());
  } catch (e) {
    console.error("WhatsApp notify error:", e);
  }
}

async function fireAutomation(meta: ProcessMeta, contactId: string | null, leadId: string) {
  if (!meta.automationId) return;
  try {
    const url = `${meta.supabaseUrl ?? Deno.env.get("SUPABASE_URL")}/functions/v1/run-automations`;
    const key = meta.serviceKey ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        trigger_type: "lead_created",
        entity_type: "contact",
        entity_id: contactId,
        trigger_key: `lead:${leadId}`,
        context: { lead_id: leadId, automation_id: meta.automationId },
      }),
    });
  } catch (e) {
    console.error("automation trigger error:", e);
  }
}

/**
 * Procesa un payload plano de formulario y crea/vincula contacto, empresa y lead.
 * Es la UNICA implementacion de la logica de negocio de prospectos.
 */
export async function processLead(
  admin: any,
  source: LeadSource,
  body: Record<string, unknown>,
  meta: ProcessMeta = {},
): Promise<ProcessResult> {
  const nombre = clean(pick(body, ["nombre", "name", "fullname", "nombrecompleto", "firstname"]), 160);
  const apellido = clean(pick(body, ["apellido", "apellidos", "lastname"]), 160);
  const nombreCompleto = [nombre, apellido].filter(Boolean).join(" ").trim();
  const emailRaw = clean(pick(body, ["email", "correo", "correoelectronico", "mail"]), 255);
  const email = emailRaw && isEmail(emailRaw) ? emailRaw.toLowerCase() : null;
  const telefono = normalizePhone(pick(body, ["telefono", "phone", "celular", "whatsapp", "phonenumber", "tel", "movil"]));
  const empresaNombre = clean(pick(body, ["empresa", "company", "companyname", "razonsocial", "negocio"]), 200);
  const mensaje = clean(pick(body, ["mensaje", "message", "comentarios", "comments", "notas"]), 2000);
  const interes = clean(pick(body, ["interes", "interest", "producto", "servicio", "asunto"]), 200);
  const ciudad = clean(pick(body, ["ciudad", "city", "plaza"]), 120);
  const estadoRegion = clean(pick(body, ["estado", "state", "region"]), 120);

  const errors: Record<string, string> = {};
  if (!nombreCompleto) errors.nombre = "El nombre es obligatorio";
  if (!email && !telefono) errors.contacto = "Se requiere al menos correo o telefono";
  if (emailRaw && !email) errors.email = "Correo con formato invalido";
  if (Object.keys(errors).length) {
    return { ok: false, status: 400, error: "Datos invalidos", fields: errors };
  }

  // Deduplicacion 24 h
  const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let dupQuery = admin
    .from("leads")
    .select("id, mensaje")
    .gte("created_at", since24)
    .not("estatus", "in", "(atendido,descartado)")
    .limit(1);
  if (email) dupQuery = dupQuery.eq("email", email);
  else if (telefono) dupQuery = dupQuery.eq("telefono", telefono);
  const { data: dupes } = await dupQuery;
  if (dupes && dupes.length > 0) {
    const existing = dupes[0] as { id: string; mensaje: string | null };
    const extra = mensaje
      ? `${existing.mensaje ? existing.mensaje + "\n---\n" : ""}${mensaje}`
      : existing.mensaje;
    await admin.from("leads").update({ mensaje: extra }).eq("id", existing.id);
    return { ok: true, lead_id: existing.id, contact_id: null, company_id: null, duplicated: true };
  }

  let contactId: string | null = null;
  let companyId: string | null = null;

  if (email) {
    const { data: c } = await admin
      .from("contacts")
      .select("id, company_id")
      .or(`email.ilike.${email},email2.ilike.${email}`)
      .limit(1)
      .maybeSingle();
    if (c) {
      contactId = c.id;
      companyId = c.company_id;
    }
  }
  if (!contactId && telefono) {
    const last10 = telefono.replace(/\D/g, "").slice(-10);
    const { data: c } = await admin
      .from("contacts")
      .select("id, company_id")
      .or(`phone.ilike.%${last10},mobile.ilike.%${last10},whatsapp_phone.ilike.%${last10}`)
      .limit(1)
      .maybeSingle();
    if (c) {
      contactId = c.id;
      companyId = c.company_id;
    }
  }

  if (!companyId && empresaNombre && source.plaza_id) {
    const { data: existingCo } = await admin
      .from("companies")
      .select("id")
      .ilike("name", empresaNombre)
      .limit(1)
      .maybeSingle();
    if (existingCo) {
      companyId = existingCo.id;
    } else {
      const { data: newCo, error: coErr } = await admin
        .from("companies")
        .insert({
          name: empresaNombre,
          plaza_id: source.plaza_id,
          city: ciudad,
          state: estadoRegion,
          phone: telefono,
          email,
          origen_contacto: "Cliente nos buscó",
          notes: `Alta automática desde ${source.nombre}`,
        })
        .select("id")
        .maybeSingle();
      if (coErr) console.error("company insert error:", coErr);
      companyId = newCo?.id ?? null;
    }
  }

  if (!contactId) {
    const { first, last } = splitName(nombreCompleto);
    const { data: newContact, error: ctErr } = await admin
      .from("contacts")
      .insert({
        first_name: first,
        last_name: last || "-",
        email,
        mobile: telefono,
        whatsapp_phone: telefono,
        company_id: companyId,
        plaza_id: source.plaza_id,
        origen_lead: source.nombre,
        notes: mensaje,
      })
      .select("id")
      .maybeSingle();
    if (ctErr) console.error("contact insert error:", ctErr);
    contactId = newContact?.id ?? null;
  }

  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .insert({
      source_id: source.id,
      nombre: nombreCompleto,
      telefono,
      email,
      empresa_nombre: empresaNombre,
      mensaje,
      interes,
      ciudad,
      estado_region: estadoRegion,
      utm_source: clean(body["utm_source"], 120),
      utm_medium: clean(body["utm_medium"], 120),
      utm_campaign: clean(body["utm_campaign"], 160),
      utm_content: clean(body["utm_content"], 160),
      utm_term: clean(body["utm_term"], 160),
      page_url: clean(body["page_url"] ?? body["url"], 500),
      referrer: clean(body["referrer"] ?? meta.referrer, 500),
      ip: meta.ip ?? null,
      user_agent: clean(meta.user_agent, 400),
      payload: body,
      contact_id: contactId,
      company_id: companyId,
      estatus: "nuevo",
    })
    .select("id")
    .single();

  if (leadErr) {
    console.error("lead insert error:", leadErr);
    return { ok: false, status: 500, error: "No se pudo registrar el prospecto" };
  }

  if (source.notificar_whatsapp) {
    await notifyWhatsApp(
      source,
      `Nuevo prospecto (${source.nombre})\n` +
        `Nombre: ${nombreCompleto}\n` +
        (telefono ? `Tel: ${telefono}\n` : "") +
        (email ? `Correo: ${email}\n` : "") +
        (empresaNombre ? `Empresa: ${empresaNombre}\n` : "") +
        (interes ? `Interes: ${interes}\n` : "") +
        (mensaje ? `Mensaje: ${mensaje.slice(0, 300)}\n` : "") +
        `Atiendelo aqui: https://portal.lumaggs.com.mx/leads`,
    );
  }

  await fireAutomation(meta, contactId, lead.id);

  return { ok: true, lead_id: lead.id, contact_id: contactId, company_id: companyId };
}