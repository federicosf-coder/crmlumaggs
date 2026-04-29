import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Slugify nombre para Meta (lowercase, _, sin acentos). */
function slugifyName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

/** Convierte {placeholder_named} -> {{n}} y devuelve mapa ordenado. */
function compile(source: string): { body: string; variable_map: string[] } {
  const re = /\{([a-z_][a-z0-9_]*)\}/gi;
  const seen = new Set<string>();
  const order: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const k = m[1].toLowerCase();
    if (!seen.has(k)) { seen.add(k); order.push(k); }
  }
  const idx = new Map(order.map((k, i) => [k, i + 1]));
  const body = source.replace(re, (_m, raw) => {
    const i = idx.get(String(raw).toLowerCase());
    return i ? `{{${i}}}` : _m;
  });
  return { body, variable_map: order };
}

function defaultExample(k: string): string {
  if (k.includes("nombre")) return "Juan Pérez";
  if (k.includes("empresa")) return "Empresa Demo S.A.";
  if (k.includes("folio")) return "COT-001234";
  if (k.includes("total") || k.includes("monto")) return "$12,500.00";
  if (k.includes("fecha")) return "31/12/2026";
  if (k.includes("producto")) return "Lubricante Delo 400";
  if (k.includes("ejecutivo")) return "Ana López";
  return "Texto de ejemplo";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const APP_ID = Deno.env.get("WHATSAPP_APP_ID");
    if (!TOKEN) return json({ error: "Falta WHATSAPP_ACCESS_TOKEN" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: "No autenticado" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const allowed = (roles ?? []).some((r) => r.role === "admin" || r.role === "manager");
    if (!allowed) return json({ error: "Solo admin/manager" }, 403);

    const body = await req.json().catch(() => ({} as any));
    const rawName = String(body?.name ?? "").trim();
    const sourceBody = String(body?.body ?? "").trim();
    const category = String(body?.category ?? "UTILITY").toUpperCase();
    const language = String(body?.language ?? "es_MX");
    const wabaIdInput = body?.waba_id ? String(body.waba_id) : null;
    const examplesOverride: string[] | undefined = Array.isArray(body?.examples) ? body.examples : undefined;
    // Header opcional: NONE | TEXT | IMAGE
    const headerType = String(body?.header_type ?? "NONE").toUpperCase();
    const headerText: string | null = body?.header_text ? String(body.header_text) : null;
    const headerImageUrl: string | null = body?.header_image_url ? String(body.header_image_url) : null;
    // Botones interactivos opcionales (máx 3 según Meta)
    // Estructura esperada: [{ kind: 'quick_reply'|'opt_out'|'phone'|'url', text: string, phone?: string, url?: string }]
    const rawButtons: any[] = Array.isArray(body?.buttons) ? body.buttons : [];

    if (!rawName) return json({ error: "name requerido" }, 400);
    if (!sourceBody) return json({ error: "body requerido" }, 400);

    const name = slugifyName(rawName);
    const { body: metaBody, variable_map } = compile(sourceBody);

    // Resolver waba_id
    let wabaId = wabaIdInput;
    if (!wabaId) {
      const { data: acct } = await admin
        .from("whatsapp_accounts")
        .select("waba_id")
        .eq("is_active", true)
        .not("waba_id", "is", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      wabaId = acct?.waba_id ?? null;
    }
    if (!wabaId) return json({ error: "No hay WABA configurado" }, 400);

    // Construir componente BODY con examples (obligatorio si hay variables)
    const examples =
      examplesOverride && examplesOverride.length === variable_map.length
        ? examplesOverride
        : variable_map.map(defaultExample);

    const bodyComponent: Record<string, unknown> = {
      type: "BODY",
      text: metaBody,
    };
    if (variable_map.length > 0) {
      bodyComponent.example = { body_text: [examples] };
    }

    const components: Record<string, unknown>[] = [];
    if (headerType === "IMAGE") {
      if (!headerImageUrl) {
        return json({ error: "header_image_url requerido para header IMAGE" }, 400);
      }
      if (!APP_ID) {
        return json({ error: "Falta WHATSAPP_APP_ID (necesario para subir el ejemplo de imagen del header a Meta)" }, 500);
      }
      // Meta requiere un header_handle obtenido vía Resumable Upload API, no una URL pública.
      try {
        // 1) Descargar la imagen pública
        const imgRes = await fetch(headerImageUrl);
        if (!imgRes.ok) {
          return json({ error: `No se pudo descargar la imagen del header (${imgRes.status})` }, 400);
        }
        const contentType = imgRes.headers.get("content-type") || "image/jpeg";
        const imgBuf = new Uint8Array(await imgRes.arrayBuffer());
        const fileLength = imgBuf.byteLength;
        const fileName = headerImageUrl.split("/").pop()?.split("?")[0] || "header.jpg";

        // 2) Crear sesión de upload
        const sessRes = await fetch(
          `https://graph.facebook.com/v21.0/${APP_ID}/uploads?file_name=${encodeURIComponent(fileName)}&file_length=${fileLength}&file_type=${encodeURIComponent(contentType)}`,
          { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` } },
        );
        const sessData = await sessRes.json().catch(() => ({}));
        if (!sessRes.ok || !sessData?.id) {
          return json({ error: "No se pudo iniciar la sesión de upload con Meta", details: sessData }, 400);
        }
        const sessionId = sessData.id as string; // formato: upload:XYZ

        // 3) Subir bytes y obtener handle
        const upRes = await fetch(`https://graph.facebook.com/v21.0/${sessionId}`, {
          method: "POST",
          headers: {
            Authorization: `OAuth ${TOKEN}`,
            file_offset: "0",
            "Content-Type": contentType,
          },
          body: imgBuf,
        });
        const upData = await upRes.json().catch(() => ({}));
        if (!upRes.ok || !upData?.h) {
          return json({ error: "No se pudo subir la imagen del header a Meta", details: upData }, 400);
        }
        const headerHandle = upData.h as string;

        components.push({
          type: "HEADER",
          format: "IMAGE",
          example: { header_handle: [headerHandle] },
        });
      } catch (e) {
        return json({ error: "Error subiendo la imagen del header: " + (e instanceof Error ? e.message : String(e)) }, 500);
      }
    } else if (headerType === "TEXT" && headerText) {
      components.push({ type: "HEADER", format: "TEXT", text: headerText });
    }
    components.push(bodyComponent);

    // Botones (componente BUTTONS) — Meta acepta máximo 3
    if (rawButtons.length > 0) {
      const metaButtons: Record<string, unknown>[] = [];
      for (const b of rawButtons.slice(0, 3)) {
        const kind = String(b?.kind ?? "quick_reply").toLowerCase();
        const text = String(b?.text ?? "").trim().slice(0, 25);
        if (!text) continue;
        if (kind === "phone") {
          const phone = String(b?.phone ?? "").trim();
          if (!phone) continue;
          metaButtons.push({ type: "PHONE_NUMBER", text, phone_number: phone });
        } else if (kind === "url") {
          const url = String(b?.url ?? "").trim();
          if (!url) continue;
          metaButtons.push({ type: "URL", text, url });
        } else {
          // quick_reply y opt_out se envían como QUICK_REPLY a Meta.
          // El opt-out se distingue por el texto/payload al recibirlo en el webhook.
          metaButtons.push({ type: "QUICK_REPLY", text });
        }
      }
      if (metaButtons.length > 0) {
        components.push({ type: "BUTTONS", buttons: metaButtons });
      }
    }

    // POST a Meta
    const r = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/message_templates`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        language,
        category,
        components,
      }),
    });
    const metaResp = await r.json().catch(() => ({}));

    if (!r.ok) {
      return json({ error: metaResp?.error?.error_user_msg ?? metaResp?.error?.message ?? "Error en Meta", details: metaResp }, 400);
    }

    // Persistir en BD
    const status = (metaResp?.status as string) ?? "PENDING";
    const metaTemplateId = metaResp?.id ?? null;

    const { error: upErr } = await admin.from("whatsapp_templates").upsert(
      {
        meta_template_id: metaTemplateId,
        name,
        language,
        category,
        status,
        body: metaBody,
        source_body: sourceBody,
        variable_map,
        components,
        header_type: headerType,
        header_image_url: headerType === "IMAGE" ? headerImageUrl : null,
        header_text: headerType === "TEXT" ? headerText : null,
        buttons: rawButtons,
        rejection_reason: null,
        last_synced_at: new Date().toISOString(),
        waba_id: wabaId,
        business_phone_number_id: null,
      },
      { onConflict: "name,language" },
    );
    if (upErr) return json({ error: upErr.message }, 500);

    return json({ ok: true, name, language, status, meta_template_id: metaTemplateId, variable_map }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Error" }, 500);
  }
});