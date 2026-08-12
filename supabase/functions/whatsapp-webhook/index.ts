import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const VERIFY_TOKEN = "LumaggsCRM2026";

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  return digits;
}

function isWithinBusinessHours(settings: any, now: Date): boolean {
  try {
    const bh = settings?.business_hours;
    if (!bh) return true;
    const tz = bh.timezone || "America/Mexico_City";
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const weekday = parts.find((p) => p.type === "weekday")?.value?.toLowerCase() ?? "";
    const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
    const cur = `${hour}:${minute}`;
    const day = bh[weekday];
    if (!day || !day.enabled) return false;
    return cur >= day.start && cur <= day.end;
  } catch {
    return true;
  }
}

function resolveCredentials(phoneNumberId: string | null | undefined) {
  const TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  return { TOKEN, phoneId: phoneNumberId ?? null };
}

/**
 * Descarga un media de WhatsApp (document/image/audio/video/sticker) y lo
 * sube al bucket privado `whatsapp-media`. Devuelve metadatos para persistir
 * en `whatsapp_messages`.
 */
async function downloadAndStoreMedia(
  admin: ReturnType<typeof createClient>,
  mediaId: string,
  fallbackFilename: string | null,
  fallbackMime: string | null,
  conversationId: string | null,
): Promise<{
  storage_path: string | null;
  public_url: string | null;
  mime_type: string | null;
  filename: string | null;
  size_bytes: number | null;
}> {
  const TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  if (!TOKEN || !mediaId) {
    return {
      storage_path: null,
      public_url: null,
      mime_type: fallbackMime,
      filename: fallbackFilename,
      size_bytes: null,
    };
  }
  try {
    // 1) Resolver URL temporal del media
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!metaRes.ok) {
      console.warn(`[wa-webhook] media metadata failed (${metaRes.status})`);
      return {
        storage_path: null,
        public_url: null,
        mime_type: fallbackMime,
        filename: fallbackFilename,
        size_bytes: null,
      };
    }
    const meta = await metaRes.json();
    const mediaUrl: string | undefined = meta?.url;
    const mimeType: string = meta?.mime_type ?? fallbackMime ?? "application/octet-stream";
    if (!mediaUrl) {
      return {
        storage_path: null,
        public_url: null,
        mime_type: mimeType,
        filename: fallbackFilename,
        size_bytes: null,
      };
    }
    // 2) Descargar binario (requiere Bearer)
    const fileRes = await fetch(mediaUrl, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!fileRes.ok) {
      console.warn(`[wa-webhook] media download failed (${fileRes.status})`);
      return {
        storage_path: null,
        public_url: null,
        mime_type: mimeType,
        filename: fallbackFilename,
        size_bytes: null,
      };
    }
    const buf = new Uint8Array(await fileRes.arrayBuffer());
    // 3) Determinar nombre y ruta
    const extFromMime = (() => {
      const m = mimeType.toLowerCase();
      if (m.includes("pdf")) return "pdf";
      if (m.includes("msword")) return "doc";
      if (m.includes("officedocument.wordprocessingml")) return "docx";
      if (m.includes("ms-excel")) return "xls";
      if (m.includes("officedocument.spreadsheetml")) return "xlsx";
      if (m.includes("powerpoint")) return "ppt";
      if (m.includes("officedocument.presentationml")) return "pptx";
      if (m.includes("plain")) return "txt";
      if (m.includes("csv")) return "csv";
      if (m.includes("zip")) return "zip";
      if (m.includes("jpeg")) return "jpg";
      if (m.includes("png")) return "png";
      if (m.includes("webp")) return "webp";
      if (m.includes("ogg")) return "ogg";
      if (m.includes("mpeg")) return "mp3";
      if (m.includes("mp4")) return "mp4";
      return "bin";
    })();
    const safeBase = (fallbackFilename ?? `${mediaId}.${extFromMime}`).replace(/[^\w.\-]+/g, "_").slice(0, 120);
    const finalName = safeBase.includes(".") ? safeBase : `${safeBase}.${extFromMime}`;
    const folder = conversationId ?? "unlinked";
    const storagePath = `${folder}/${Date.now()}_${mediaId}_${finalName}`;
    // 4) Subir a Storage
    const { error: upErr } = await admin.storage
      .from("whatsapp-media")
      .upload(storagePath, buf, { contentType: mimeType, upsert: false });
    if (upErr) {
      console.warn("[wa-webhook] storage upload failed:", upErr);
      return {
        storage_path: null,
        public_url: null,
        mime_type: mimeType,
        filename: finalName,
        size_bytes: buf.byteLength,
      };
    }
    // Bucket es privado: generamos URL firmada de larga duración (7 días) como referencia.
    const { data: signed } = await admin.storage.from("whatsapp-media").createSignedUrl(storagePath, 60 * 60 * 24 * 7);
    return {
      storage_path: storagePath,
      public_url: signed?.signedUrl ?? null,
      mime_type: mimeType,
      filename: finalName,
      size_bytes: buf.byteLength,
    };
  } catch (e) {
    console.warn("[wa-webhook] downloadAndStoreMedia exception:", e);
    return {
      storage_path: null,
      public_url: null,
      mime_type: fallbackMime,
      filename: fallbackFilename,
      size_bytes: null,
    };
  }
}

async function sendWhatsAppText(toPhone: string, text: string, businessPhoneId?: string | null) {
  const { TOKEN, phoneId } = resolveCredentials(businessPhoneId);
  if (!TOKEN || !phoneId) return { ok: false, error: "Missing WhatsApp credentials" };
  const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toPhone,
      type: "text",
      text: { body: text },
    }),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data };
}

/**
 * Envía un texto por WhatsApp Y lo registra en whatsapp_messages para que
 * aparezca en el historial de la conversación (alternando cliente/bot).
 */
async function sendAndLogText(
  admin: ReturnType<typeof createClient>,
  params: {
    toPhone: string;
    text: string;
    businessPhoneId: string | null;
    conversationId: string | null;
    contactId: string | null;
    whatsappAccountId: string | null;
  },
) {
  const res = await sendWhatsAppText(params.toPhone, params.text, params.businessPhoneId);
  const waMessageId = (res as any)?.data?.messages?.[0]?.id ?? null;
  try {
    await admin.from("whatsapp_messages").insert({
      wa_id: waMessageId,
      sender_phone: params.toPhone,
      message_body: params.text,
      direction: "outbound",
      status: res.ok ? "sent" : "failed",
      conversation_id: params.conversationId,
      contact_id: params.contactId,
      business_phone_number_id: params.businessPhoneId,
      whatsapp_account_id: params.whatsappAccountId,
    });
    if (params.conversationId) {
      await admin
        .from("whatsapp_conversations")
        .update({
          last_outbound_at: new Date().toISOString(),
          last_message_preview: params.text.slice(0, 120),
        })
        .eq("id", params.conversationId);
    }
  } catch (e) {
    console.warn("[wa-webhook] sendAndLogText persistence failed:", e);
  }
  return res;
}

async function sendWhatsAppTemplate(toPhone: string, name: string, language: string, businessPhoneId?: string | null) {
  const { TOKEN, phoneId } = resolveCredentials(businessPhoneId);
  if (!TOKEN || !phoneId) return { ok: false, error: "Missing WhatsApp credentials" };
  const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toPhone,
      type: "template",
      template: { name, language: { code: language } },
    }),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data };
}

// ============================================================
// FLUJO AUTOMATIZADO DE DERIVACIÓN POR ZONA (sin IA)
// Activo únicamente para los business_phone_number_id listados.
// Fácil de extender: agregar más zonas o cuentas aquí.
// ============================================================
const ROUTING_ACCOUNTS: Record<string, {
  empresa: string;
  zonas: Array<{ id: string; label: string; telefono: string; keywords: string[] }>;
}> = {
  "1128863556971458": {
    empresa: "Lumaggs",
    zonas: [
      {
        id: "mexicali",
        label: "Mexicali y Valle",
        telefono: "5216861349130",
        keywords: ["1", "1️⃣", "mexicali", "mexicali y valle", "valle"],
      },
      {
        id: "costa",
        label: "Tijuana, Tecate, Ensenada y San Quintín",
        telefono: "5216645634361",
        keywords: [
          "2", "2️⃣", "tijuana", "costa", "tecate", "ensenada", "san quintin", "san quintín",
          "tijuana, tecate, ensenada y san quintin",
          "tijuana, tecate, ensenada y san quintín",
        ],
      },
    ],
  },
  // Galsa (Proveedora Galsa · +52 1 686 561 8533)
  "318296624690022": {
    empresa: "Proveedora Galsa",
    zonas: [
      {
        id: "mexicali",
        label: "Mexicali",
        telefono: "5216861790126",
        keywords: ["1", "1️⃣", "mexicali"],
      },
      {
        id: "costa",
        label: "Tijuana, Ensenada, Tecate, San Quintín, Rosarito",
        telefono: "5216645634361",
        keywords: [
          "2", "2️⃣", "tijuana", "ensenada", "tecate", "san quintin", "san quintín",
          "rosarito", "costa",
        ],
      },
      {
        id: "valle",
        label: "Valle de Mexicali",
        telefono: "5216861682488",
        keywords: ["3", "3️⃣", "valle", "valle de mexicali"],
      },
      {
        id: "san-luis",
        label: "San Luis R.C.",
        telefono: "5216531517816",
        keywords: [
          "4", "4️⃣", "san luis", "san luis rc", "san luis r.c.",
          "san luis rio colorado", "san luis río colorado",
        ],
      },
    ],
  },
};

function buildZonaPrompt(cfg: typeof ROUTING_ACCOUNTS[string]): string {
  const opts = cfg.zonas
    .map((z, i) => `${i + 1}\u20e3 ${z.label}`)
    .join("\n");
  return `¡Hola! 👋\nGracias por comunicarte con ${cfg.empresa}.\n\n¿De dónde nos contactas?\n\n${opts}\n\nResponde con el número de la opción.`;
}

function matchZona(cfg: typeof ROUTING_ACCOUNTS[string], text: string) {
  const norm = (text ?? "").toLowerCase().trim();
  if (!norm) return null;
  return cfg.zonas.find((z) => z.keywords.some((k) => norm === k || norm.includes(k))) ?? null;
}

/**
 * Devuelve true si el flujo automatizado ya manejó el mensaje y se debe
 * omitir la lógica normal de bot/away.
 */
async function handleZoneRouting(
  admin: ReturnType<typeof createClient>,
  params: {
    debugId: string;
    businessPhoneId: string | null;
    fromPhone: string;
    text: string | null;
    conversationId: string | null;
    contactId: string | null;
    whatsappAccountId: string | null;
  },
): Promise<boolean> {
  const { debugId, businessPhoneId, fromPhone, text, conversationId, contactId, whatsappAccountId } = params;
  if (!businessPhoneId) return false;
  const cfg = ROUTING_ACCOUNTS[businessPhoneId];
  if (!cfg) return false;

  const logCtx = { conversationId, contactId, whatsappAccountId, businessPhoneId };

  const { data: sessionRows, error: sessionDebugError } = await admin
    .from("whatsapp_routing_sessions")
    .select("id,wa_phone,business_phone_number_id,mensaje_original,zona_seleccionada,telefono_destino,estado,created_at,updated_at")
    .eq("wa_phone", fromPhone)
    .eq("business_phone_number_id", businessPhoneId)
    .order("created_at", { ascending: false });
  console.log(`[wa-routing-debug:${debugId}] SESSION_LOOKUP`, JSON.stringify({
    searchBy: { wa_phone: fromPhone, business_phone_number_id: businessPhoneId },
    rowCount: sessionRows?.length ?? 0,
    latestRow: sessionRows?.[0] ?? null,
    error: sessionDebugError ? { code: sessionDebugError.code, message: sessionDebugError.message } : null,
  }));

  // Última sesión de este contacto en esta línea (cualquier estado).
  const { data: ultima, error: ultimaError } = await admin
    .from("whatsapp_routing_sessions")
    .select("*")
    .eq("wa_phone", fromPhone)
    .eq("business_phone_number_id", businessPhoneId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  console.log(`[wa-routing-debug:${debugId}] SESSION_SELECTED`, JSON.stringify({
    session: ultima ?? null,
    realSessionState: ultima?.estado ?? null,
    mensajeOriginal: ultima?.mensaje_original ?? null,
    error: ultimaError ? { code: ultimaError.code, message: ultimaError.message } : null,
  }));

  // CASO 1: hay sesión ESPERANDO_ZONA → solo procesar respuesta de zona.
  if (ultima && ultima.estado === "esperando_zona") {
    console.log(`[wa-routing-debug:${debugId}] BRANCH [ ESPERANDO_ZONA ]`);
    const zona = matchZona(cfg, text ?? "");
    console.log(`[wa-routing-debug:${debugId}] ZONE_MATCH`, JSON.stringify({ incoming: text, matched: zona ?? null }));
    if (zona) {
      const mensajeOriginal = ultima.mensaje_original ?? "";
      const link = `https://wa.me/${zona.telefono}?text=${encodeURIComponent(mensajeOriginal)}`;
      const reply = `Perfecto.\n\nHaz clic en el siguiente enlace para continuar la conversación con el asesor de ${zona.label}.\n\n${link}\n\nMuchas gracias.`;
      const sendResult = await sendAndLogText(admin, { toPhone: fromPhone, text: reply, ...logCtx });
      const { error: finalizeError } = await admin
        .from("whatsapp_routing_sessions")
        .update({
          zona_seleccionada: zona.id,
          telefono_destino: zona.telefono,
          estado: "finalizado",
          updated_at: new Date().toISOString(),
        })
        .eq("id", ultima.id);
      console.log(`[wa-routing-debug:${debugId}] FINALIZE_RESULT`, JSON.stringify({
        sendOk: sendResult.ok,
        sessionId: ultima.id,
        error: finalizeError ? { code: finalizeError.code, message: finalizeError.message } : null,
      }));
      return true;
    }
    // Respuesta inválida: solo re-preguntar zona, NO reiniciar ni resaludar.
    const rePregunta = `Por favor responde con el número de tu zona:\n\n${cfg.zonas
      .map((z, i) => `${i + 1}\u20e3 ${z.label}`)
      .join("\n")}`;
    const sendResult = await sendAndLogText(admin, { toPhone: fromPhone, text: rePregunta, ...logCtx });
    console.log(`[wa-routing-debug:${debugId}] REPROMPT_RESULT`, JSON.stringify({ sendOk: sendResult.ok }));
    return true;
  }

  // CASO 2: reutilizar la fila existente si la hay; solo insertar si el contacto nunca ha tenido sesión.
  console.log(`[wa-routing-debug:${debugId}] BRANCH [ NUEVA CONVERSACIÓN / REUSO ]`);
  if (ultima) {
    const { error: resetError } = await admin
      .from("whatsapp_routing_sessions")
      .update({
        estado: "esperando_zona",
        mensaje_original: text ?? "",
        zona_seleccionada: null,
        telefono_destino: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ultima.id);
    console.log(`[wa-routing-debug:${debugId}] SESSION_REUSE_RESULT`, JSON.stringify({
      sessionId: ultima.id,
      error: resetError ? { code: resetError.code, message: resetError.message } : null,
    }));
  } else {
    const { error: insertSessionError } = await admin
      .from("whatsapp_routing_sessions")
      .insert({
        wa_phone: fromPhone,
        business_phone_number_id: businessPhoneId,
        mensaje_original: text ?? "",
        estado: "esperando_zona",
      });
    console.log(`[wa-routing-debug:${debugId}] SESSION_INSERT_RESULT`, JSON.stringify({
      error: insertSessionError ? {
        code: insertSessionError.code,
        message: insertSessionError.message,
        details: insertSessionError.details,
      } : null,
    }));
  }
  const sendResult = await sendAndLogText(admin, { toPhone: fromPhone, text: buildZonaPrompt(cfg), ...logCtx });
  console.log(`[wa-routing-debug:${debugId}] WELCOME_RESULT`, JSON.stringify({ sendOk: sendResult.ok }));
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // GET: webhook verification handshake from Meta
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  // POST: incoming message events
  if (req.method === "POST") {
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(SUPABASE_URL, SERVICE_KEY);

      const body = await req.json().catch(() => ({}));
      console.log("WhatsApp webhook payload:", JSON.stringify(body));

      // Load settings & rules once per webhook hit
      const [{ data: settingsRow }, { data: rulesRows }] = await Promise.all([
        admin.from("whatsapp_settings").select("*").eq("id", 1).maybeSingle(),
        admin.from("whatsapp_keyword_rules").select("*").eq("is_active", true).order("priority", { ascending: false }),
      ]);
      const settings = settingsRow ?? {};
      const rules = rulesRows ?? [];

      let inserted = 0;
      const entries = Array.isArray(body?.entry) ? body.entry : [];
      for (const entry of entries) {
        const changes = Array.isArray(entry?.changes) ? entry.changes : [];
        for (const change of changes) {
          const value = change?.value ?? {};

          // ── Meta template status updates
          if (change?.field === "message_template_status_update") {
            try {
              const tplName: string | null = value?.message_template_name ?? null;
              const tplLang: string | null = value?.message_template_language ?? "es_MX";
              const newStatus: string | null = value?.event ?? null;
              const reason: string | null = value?.reason ?? value?.rejected_reason ?? null;
              const metaTplId: string | null = value?.message_template_id ?? null;
              if (tplName && newStatus) {
                const update: Record<string, unknown> = {
                  status: newStatus,
                  rejection_reason: newStatus === "REJECTED" ? reason : null,
                  last_synced_at: new Date().toISOString(),
                };
                if (metaTplId) update.meta_template_id = String(metaTplId);
                await admin.from("whatsapp_templates").update(update).eq("name", tplName).eq("language", tplLang);
                console.log(`[wa-webhook] template ${tplName}/${tplLang} -> ${newStatus}`);
              }
            } catch (e) {
              console.warn("[wa-webhook] template status update failed", e);
            }
            continue;
          }

          // Quality update
          if (change?.field === "message_template_quality_update") {
            try {
              const tplName: string | null = value?.message_template_name ?? null;
              const tplLang: string | null = value?.message_template_language ?? "es_MX";
              const newQuality: string | null = value?.new_quality_score ?? null;
              if (tplName && newQuality) {
                await admin
                  .from("whatsapp_templates")
                  .update({ quality_score: newQuality })
                  .eq("name", tplName)
                  .eq("language", tplLang);
              }
            } catch (e) {
              console.warn("[wa-webhook] template quality update failed", e);
            }
            continue;
          }

          const businessPhoneId = value?.metadata?.phone_number_id ?? null;
          let whatsappAccountId: string | null = null;
          if (businessPhoneId) {
            try {
              const { data: acct, error: acctErr } = await admin
                .from("whatsapp_accounts")
                .select("id, label")
                .eq("business_phone_number_id", businessPhoneId)
                .maybeSingle();

              if (acctErr) {
                console.warn(
                  `Account lookup failed for phone_number_id=${businessPhoneId}; continuing unlinked:`,
                  acctErr,
                );
              } else if (!acct) {
                console.warn(
                  `No whatsapp_accounts row found for phone_number_id=${businessPhoneId}; continuing unlinked.`,
                );
              } else {
                whatsappAccountId = acct.id;
                console.log(`Routing webhook to account ${acct.label} (${acct.id})`);
              }
            } catch (acctException) {
              console.warn(
                `Account lookup exception for phone_number_id=${businessPhoneId}; continuing unlinked:`,
                acctException,
              );
            }
          }

          const contactsArr = Array.isArray(value?.contacts) ? value.contacts : [];
          const profileNameByWa: Record<string, string> = {};
          for (const c of contactsArr) {
            const wa = normalizePhone(c?.wa_id);
            if (wa && c?.profile?.name) profileNameByWa[wa] = c.profile.name;
          }

          const messages = Array.isArray(value?.messages) ? value.messages : [];
          for (const msg of messages) {
            try {
              const fromPhone = normalizePhone(msg?.from);
              if (!fromPhone) continue;

              // ==========================================
              // SOPORTE PARA UBICACIONES (INTERCEPCIÓN)
              // ==========================================
              let locationText = null;
              if (msg?.type === "location" && msg?.location) {
                const lat = msg.location.latitude;
                const lng = msg.location.longitude;
                const name = msg.location.name || "Ubicación compartida";
                const address = msg.location.address ? "\nDirección: " + msg.location.address : "";

                // URL universal y oficial de Google Maps
                const googleMapsUrl = "https://maps.google.com/?q=" + lat + "," + lng;
                locationText = "📍 *" + name + "*" + address + "\n\n🌐 Enlace al mapa:\n" + googleMapsUrl;
              }
              // ==========================================

              const text =
                locationText ?? // Prioriza el formato de ubicación si existe
                msg?.text?.body ??
                msg?.button?.text ??
                msg?.interactive?.button_reply?.title ??
                msg?.interactive?.list_reply?.title ??
                (msg?.type ? `[${msg.type}]` : null);

              const profileName = profileNameByWa[fromPhone] ?? null;
              const debugId = msg?.id ?? `${fromPhone}-${Date.now()}`;
              console.log(`=========================\nDEBUG [${debugId}]\n=========================`);
              console.log(`[wa-routing-debug:${debugId}] INCOMING`, JSON.stringify({
                message: text,
                fromPhone,
                businessPhoneId,
                lookupStrategy: {
                  contact: "contacts.whatsapp_phone OR phone OR mobile = fromPhone",
                  conversation: "whatsapp_conversations.wa_phone + business_phone_number_id",
                  session: "whatsapp_routing_sessions.wa_phone + business_phone_number_id",
                },
              }));

              let contactId: string | null = null;
              try {
                const { data: contactMatch, error: contactErr } = await admin
                  .from("contacts")
                  .select("id")
                  .or(`whatsapp_phone.eq.${fromPhone},phone.eq.${fromPhone},mobile.eq.${fromPhone}`)
                  .limit(1)
                  .maybeSingle();
                if (contactErr) {
                  console.warn(`Contact lookup failed for wa_phone=${fromPhone}; continuing unlinked:`, contactErr);
                }
                contactId = contactMatch?.id ?? null;
                console.log(`[wa-routing-debug:${debugId}] CONTACT_LOOKUP`, JSON.stringify({
                  contactId,
                  found: Boolean(contactMatch),
                  error: contactErr ? { code: contactErr.code, message: contactErr.message } : null,
                }));
              } catch (contactException) {
                console.warn(
                  `Contact lookup exception for wa_phone=${fromPhone}; continuing unlinked:`,
                  contactException,
                );
              }

              const nowIso = new Date().toISOString();
              let conversationDebugQuery = admin
                .from("whatsapp_conversations")
                .select("id,wa_phone,contact_id,business_phone_number_id,status,created_at,updated_at")
                .eq("wa_phone", fromPhone);
              conversationDebugQuery = businessPhoneId
                ? conversationDebugQuery.eq("business_phone_number_id", businessPhoneId)
                : conversationDebugQuery.is("business_phone_number_id", null);
              const { data: conversationRows, error: conversationDebugError } = await conversationDebugQuery;
              console.log(`[wa-routing-debug:${debugId}] CONVERSATION_LOOKUP`, JSON.stringify({
                searchBy: { wa_phone: fromPhone, business_phone_number_id: businessPhoneId },
                rowCount: conversationRows?.length ?? 0,
                latestConversation: conversationRows?.[0] ?? null,
                rows: conversationRows ?? [],
                error: conversationDebugError ? { code: conversationDebugError.code, message: conversationDebugError.message } : null,
              }));
              let convQuery = admin
                .from("whatsapp_conversations")
                .select("id, unread_count, contact_id")
                .eq("wa_phone", fromPhone);
              convQuery = businessPhoneId
                ? convQuery.eq("business_phone_number_id", businessPhoneId)
                : convQuery.is("business_phone_number_id", null);
              const { data: existingConv, error: existingConvError } = await convQuery.maybeSingle();
              console.log(`[wa-routing-debug:${debugId}] CONVERSATION_SELECTED`, JSON.stringify({
                conversation: existingConv ?? null,
                error: existingConvError ? { code: existingConvError.code, message: existingConvError.message } : null,
              }));

              let conversationId: string | null = null;
              try {
                if (existingConv) {
                  conversationId = existingConv.id;
                  const { error: updateConvErr } = await admin
                    .from("whatsapp_conversations")
                    .update({
                      contact_id: existingConv.contact_id ?? contactId,
                      wa_profile_name: profileName ?? undefined,
                      last_inbound_at: nowIso,
                      last_message_preview: (text ?? "").slice(0, 120), // Aquí guardará el link en lugar de [location]
                      unread_count: (existingConv.unread_count ?? 0) + 1,
                      status: "open",
                      business_phone_number_id: businessPhoneId ?? undefined,
                      whatsapp_account_id: whatsappAccountId ?? undefined,
                    })
                    .eq("id", conversationId);
                  if (updateConvErr)
                    console.warn("Conversation update failed; message will still be saved:", updateConvErr);
                  console.log(`[wa-routing-debug:${debugId}] CONVERSATION_UPDATE_RESULT`, JSON.stringify({
                    conversationId,
                    error: updateConvErr ? { code: updateConvErr.code, message: updateConvErr.message } : null,
                  }));
                } else {
                  const { data: newConv, error: newConvErr } = await admin
                    .from("whatsapp_conversations")
                    .insert({
                      wa_phone: fromPhone,
                      contact_id: contactId,
                      wa_profile_name: profileName,
                      last_inbound_at: nowIso,
                      last_message_preview: (text ?? "").slice(0, 120),
                      unread_count: 1,
                      business_phone_number_id: businessPhoneId,
                      whatsapp_account_id: whatsappAccountId,
                    })
                    .select("id")
                    .maybeSingle();
                  if (newConvErr) console.warn("Conversation insert failed; message will still be saved:", newConvErr);
                  conversationId = newConv?.id ?? null;
                  console.log(`[wa-routing-debug:${debugId}] CONVERSATION_INSERT_RESULT`, JSON.stringify({
                    conversationId,
                    created: newConv ?? null,
                    error: newConvErr ? { code: newConvErr.code, message: newConvErr.message } : null,
                  }));
                }
              } catch (conversationException) {
                console.warn("Conversation persistence exception; message will still be saved:", conversationException);
              }
              const { data: persistedConversation, error: persistedConversationError } = conversationId
                ? await admin
                    .from("whatsapp_conversations")
                    .select("id,wa_phone,contact_id,business_phone_number_id,status,created_at,updated_at")
                    .eq("id", conversationId)
                    .maybeSingle()
                : { data: null, error: null };
              console.log(`[wa-routing-debug:${debugId}] CONVERSATION_BEFORE_ROUTING`, JSON.stringify({
                conversationId,
                contactId,
                persisted: persistedConversation ?? null,
                error: persistedConversationError
                  ? { code: persistedConversationError.code, message: persistedConversationError.message }
                  : null,
              }));

              // ===== Descarga de media (document, image, audio, video, sticker) =====
              let mediaInfo: {
                storage_path: string | null;
                public_url: string | null;
                mime_type: string | null;
                filename: string | null;
                size_bytes: number | null;
              } = { storage_path: null, public_url: null, mime_type: null, filename: null, size_bytes: null };
              const mediaTypes = ["document", "image", "audio", "video", "sticker"] as const;
              const mType = msg?.type as string | undefined;
              if (mType && (mediaTypes as readonly string[]).includes(mType)) {
                const mediaNode = msg[mType];
                const mediaId = mediaNode?.id;
                if (mediaId) {
                  mediaInfo = await downloadAndStoreMedia(
                    admin,
                    mediaId,
                    mediaNode?.filename ?? null,
                    mediaNode?.mime_type ?? null,
                    conversationId,
                  );
                }
              }

              const captionText = msg?.[mType ?? ""]?.caption ?? null;
              const bodyToStore =
                mType === "document" ? (captionText ?? mediaInfo.filename ?? text) : (captionText ?? text);

              const { error: insErr } = await admin.from("whatsapp_messages").insert({
                wa_id: msg?.id ?? null,
                sender_phone: fromPhone,
                message_body: bodyToStore,
                direction: "inbound",
                status: "received",
                contact_id: contactId,
                conversation_id: conversationId,
                wa_profile_name: profileName,
                media_type: msg?.type ?? null,
                media_url: mediaInfo.public_url,
                media_storage_path: mediaInfo.storage_path,
                media_filename: mediaInfo.filename,
                media_mime_type: mediaInfo.mime_type,
                media_size_bytes: mediaInfo.size_bytes,
                business_phone_number_id: businessPhoneId,
                whatsapp_account_id: whatsappAccountId,
              });
              if (insErr) console.error("Insert message error:", insErr);
              else inserted++;

              // ===== Asesor IA (tiene prioridad sobre la derivación por zona) =====
              let aiHandled = false;
              try {
                const { data: acct } = await admin
                  .from("whatsapp_accounts")
                  .select("ai_advisor_enabled")
                  .eq("business_phone_number_id", businessPhoneId)
                  .maybeSingle();
                if (acct?.ai_advisor_enabled) {
                  const res = await admin.functions.invoke("whatsapp-ai-advisor", {
                    body: {
                      conversation_id: conversationId,
                      wa_phone: fromPhone,
                      business_phone_number_id: businessPhoneId,
                      contact_id: contactId,
                      whatsapp_account_id: whatsappAccountId,
                      text,
                    },
                  });
                  if (res.error) console.error("[wa-webhook] asesor IA error:", res.error);
                  aiHandled = true;
                }
              } catch (aiEx) {
                console.warn("[wa-webhook] asesor IA exception:", aiEx);
              }

              // ===== Flujo automatizado de derivación por zona (sin IA) =====
              let routingHandled = aiHandled;
              try {
                if (!aiHandled) routingHandled = await handleZoneRouting(admin, {
                  debugId,
                  businessPhoneId,
                  fromPhone,
                  text,
                  conversationId,
                  contactId,
                  whatsappAccountId,
                });
              } catch (routingEx) {
                console.warn("[wa-webhook] zone routing exception:", routingEx);
              }

              // ===== Opt-out por botón de plantilla =====
              try {
                const btnText: string | null = msg?.button?.text ?? msg?.interactive?.button_reply?.title ?? null;
                if (btnText && contactId) {
                  const norm = btnText.toLowerCase().trim();
                  const isOptOut =
                    norm.includes("no me interesa") ||
                    norm.includes("darse de baja") ||
                    norm.includes("dar de baja") ||
                    norm === "baja" ||
                    norm === "stop" ||
                    norm === "cancelar suscripcion" ||
                    norm === "cancelar suscripción";
                  if (isOptOut) {
                    const { error: optErr } = await admin
                      .from("contacts")
                      .update({
                        no_contactar: true,
                        no_contactar_fecha: new Date().toISOString(),
                        no_contactar_motivo: `Opt-out vía WhatsApp: "${btnText}"`,
                      })
                      .eq("id", contactId);
                    if (optErr) console.warn("[wa-webhook] opt-out update failed:", optErr);
                    else console.log(`[wa-webhook] contact ${contactId} marcado como no_contactar`);
                  }
                }
              } catch (optEx) {
                console.warn("[wa-webhook] opt-out handler exception:", optEx);
              }

              // ===== Bot keyword matching =====
              const lower = (text ?? "").toLowerCase();
              if (!routingHandled && settings?.bot_enabled && lower) {
                for (const r of rules) {
                  const kw = String(r.keyword ?? "").toLowerCase();
                  if (!kw) continue;
                  const matched =
                    r.match_type === "exact"
                      ? lower.trim() === kw
                      : r.match_type === "starts_with"
                        ? lower.trim().startsWith(kw)
                        : lower.includes(kw);
                  if (!matched) continue;
                  if (r.reply_template_name) {
                    await sendWhatsAppTemplate(
                      fromPhone,
                      r.reply_template_name,
                      r.reply_template_language || "es_MX",
                      businessPhoneId,
                    );
                  } else if (r.reply_text) {
                    await sendWhatsAppText(fromPhone, r.reply_text, businessPhoneId);
                  }
                  await admin.from("whatsapp_messages").insert({
                    sender_phone: fromPhone,
                    message_body: r.reply_text ?? `[template: ${r.reply_template_name}]`,
                    direction: "outbound",
                    status: "sent",
                    conversation_id: conversationId,
                    contact_id: contactId,
                    template_name: r.reply_template_name ?? null,
                    business_phone_number_id: businessPhoneId,
                    whatsapp_account_id: whatsappAccountId,
                  });
                  await admin
                    .from("whatsapp_conversations")
                    .update({ last_outbound_at: nowIso })
                    .eq("id", conversationId);
                  break;
                }
              }

              // ===== Auto-away outside business hours =====
              if (
                !routingHandled &&
                settings?.away_enabled &&
                settings?.away_template_name &&
                !isWithinBusinessHours(settings, new Date())
              ) {
                const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
                const { data: recent } = await admin
                  .from("whatsapp_auto_replies_log")
                  .select("id")
                  .eq("wa_phone", fromPhone)
                  .gte("sent_at", fourHoursAgo)
                  .limit(1)
                  .maybeSingle();
                if (!recent) {
                  await sendWhatsAppTemplate(
                    fromPhone,
                    settings.away_template_name,
                    settings.away_template_language || "es_MX",
                    businessPhoneId,
                  );
                  await admin.from("whatsapp_auto_replies_log").insert({
                    wa_phone: fromPhone,
                    reason: "outside_business_hours",
                    template_name: settings.away_template_name,
                  });
                  await admin.from("whatsapp_messages").insert({
                    sender_phone: fromPhone,
                    message_body: `[template: ${settings.away_template_name}]`,
                    direction: "outbound",
                    status: "sent",
                    conversation_id: conversationId,
                    contact_id: contactId,
                    template_name: settings.away_template_name,
                    business_phone_number_id: businessPhoneId,
                    whatsapp_account_id: whatsappAccountId,
                  });
                  await admin
                    .from("whatsapp_conversations")
                    .update({ last_outbound_at: new Date().toISOString() })
                    .eq("id", conversationId);
                }
              }
            } catch (messageError) {
              console.error("Message processing error; continuing with remaining webhook events:", {
                phone_number_id: businessPhoneId,
                wa_id: msg?.id ?? null,
                error: messageError instanceof Error ? messageError.message : messageError,
              });
            }
          }

          // Status updates from Meta
          const statuses = Array.isArray(value?.statuses) ? value.statuses : [];
          for (const s of statuses) {
            await admin.from("whatsapp_messages").insert({
              wa_id: s?.id ?? null,
              sender_phone: normalizePhone(s?.recipient_id),
              message_body: null,
              direction: "outbound",
              status: s?.status ?? null,
              business_phone_number_id: businessPhoneId,
              whatsapp_account_id: whatsappAccountId,
            });
          }
        }
      }

      return json({ ok: true, inserted }, 200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      console.error("Webhook error:", msg);
      return json({ error: msg }, 500);
    }
  }

  return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
