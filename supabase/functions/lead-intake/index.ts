import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function clean(v: unknown, max = 500): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function normalizePhone(raw: unknown): string | null {
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

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "-" };
  const cut = parts.length > 2 ? 2 : 1;
  return { first: parts.slice(0, cut).join(" "), last: parts.slice(cut).join(" ") };
}

function pick(body: Record<string, unknown>, keys: string[]): unknown {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  if (req.method === "GET") {
    const url = new URL(req.url);
    const challenge = url.searchParams.get("hub.challenge");
    const verifyToken = url.searchParams.get("hub.verify_token");
    const expected = Deno.env.get("LEAD_INTAKE_VERIFY_TOKEN");
    if (challenge && expected && verifyToken === expected) {
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }
    return json({ ok: true, service: "lead-intake" }, 200);
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = new URL(req.url);
    const apiKey = req.headers.get("x-api-key")?.trim() || url.searchParams.get("api_key")?.trim() || "";
    if (!apiKey) return json({ error: "API key requerida (header x-api-key)" }, 401);

    const keyHash = await sha256(apiKey);
    const { data: source } = await admin
      .from("lead_sources")
      .select("*")
      .eq("api_key_hash", keyHash)
      .eq("is_active", true)
      .maybeSingle();
    if (!source) return json({ error: "API key invalida o inactiva" }, 401);

    const raw = await req.json().catch(() => null);
    if (!raw || typeof raw !== "object") return json({ error: "JSON invalido" }, 400);
    const body = raw as Record<string, unknown>;

    if (clean(body["_hp"]) || clean(body["website_hp"])) {
      return json({ ok: true, ignored: true }, 200);
    }

    if (source.dominio_permitido) {
      const origin = req.headers.get("origin") || req.headers.get("referer") || "";
      if (origin && !origin.includes(source.dominio_permitido)) {
        return json({ error: "Origen no permitido" }, 403);
      }
    }

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
    if (Object.keys(errors).length) return json({ error: "Datos invalidos", fields: errors }, 400);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || null;
    const userAgent = clean(req.headers.get("user-agent"), 400);

    if (ip) {
      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count } = await admin
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("source_id", source.id)
        .eq("ip", ip)
        .gte("created_at", since);
      if ((count ?? 0) >= 20) return json({ error: "Demasiadas solicitudes, intenta mas tarde" }, 429);
    }

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
      return json({ ok: true, lead_id: existing.id, duplicated: true }, 200);
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
        referrer: clean(body["referrer"] ?? req.headers.get("referer"), 500),
        ip,
        user_agent: userAgent,
        payload: body,
        contact_id: contactId,
        company_id: companyId,
        estatus: "nuevo",
      })
      .select("id")
      .single();

    if (leadErr) {
      console.error("lead-intake insert error:", leadErr);
      return json({ error: "No se pudo registrar el prospecto" }, 500);
    }

    if (source.notificar_whatsapp) {
      try {
        const TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
        const PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
        if (TOKEN && PHONE_ID) {
          const to = String(source.notificar_whatsapp).replace(/\D/g, "");
          const texto =
            `Nuevo prospecto (${source.nombre})\n` +
            `Nombre: ${nombreCompleto}\n` +
            (telefono ? `Tel: ${telefono}\n` : "") +
            (email ? `Correo: ${email}\n` : "") +
            (empresaNombre ? `Empresa: ${empresaNombre}\n` : "") +
            (interes ? `Interes: ${interes}\n` : "") +
            (mensaje ? `Mensaje: ${mensaje.slice(0, 300)}\n` : "") +
            `Atiendelo aqui: https://portal.lumaggs.com.mx/leads`;
          const resp = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: texto } }),
          });
          if (!resp.ok) console.error("WhatsApp notify failed:", resp.status, await resp.text());
        }
      } catch (e) {
        console.error("WhatsApp notify error:", e);
      }
    }

    return json({ ok: true, lead_id: lead.id, contact_id: contactId, company_id: companyId }, 200);
  } catch (e) {
    console.error("lead-intake error:", e);
    return json({ error: "Error interno" }, 500);
  }
});
