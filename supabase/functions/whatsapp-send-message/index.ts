import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d]/g, "");
  return digits || null;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const PHONE_ID_1 = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const PHONE_ID_2 = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID_2");
    const PHONE_ID_3 = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID_3");
    if (!TOKEN || (!PHONE_ID_1 && !PHONE_ID_2 && !PHONE_ID_3)) return json({ error: "Missing WhatsApp credentials" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "No autenticado" }, 401);
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const toPhone = normalizePhone(body?.to_phone ?? body?.wa_phone);
    const conversationId = body?.conversation_id as string | undefined;
    const kind = body?.kind as "text" | "template" | "media";
    const text = body?.text as string | undefined;
    const templateName = body?.template_name as string | undefined;
    const templateLanguage = (body?.template_language as string | undefined) || "es_MX";
    let templateComponents = body?.template_components as unknown[] | undefined;
    // Nuevo: variables nombradas { nombre_cliente: "...", folio_cotizacion: "..." }
    const templateVariables = body?.template_variables as Record<string, string | number> | undefined;
    const explicitPhoneId = (body?.business_phone_number_id as string | undefined)?.trim() || null;
    // Media (outbound)
    const mediaStoragePath = body?.media_storage_path as string | undefined;
    const mediaCategory = body?.media_category as "image" | "video" | "document" | "audio" | undefined;
    const mediaMime = body?.media_mime_type as string | undefined;
    const mediaFilename = body?.media_filename as string | undefined;
    const mediaCaption = (body?.caption as string | undefined) ?? "";

    if (!toPhone) return json({ error: "to_phone requerido" }, 400);
    if (kind !== "text" && kind !== "template" && kind !== "media") return json({ error: "kind inválido" }, 400);
    if (kind === "text" && !text) return json({ error: "text requerido" }, 400);
    if (kind === "template" && !templateName) return json({ error: "template_name requerido" }, 400);
    if (kind === "media") {
      if (!mediaStoragePath) return json({ error: "media_storage_path requerido" }, 400);
      if (!mediaCategory || !["image", "video", "document", "audio"].includes(mediaCategory)) {
        return json({ error: "media_category inválido" }, 400);
      }
    }

    // Si vienen variables nombradas, construir `template_components` desde variable_map.
    // Esto evita el error #132000 (number of parameters doesn't match).
    let bodyVariableNames: string[] = [];
    if (kind === "template") {
      const { data: tplRow } = await admin
        .from("whatsapp_templates")
        .select("body, variable_map")
        .eq("name", templateName)
        .eq("language", templateLanguage)
        .maybeSingle();

      const tplBody = (tplRow?.body as string | null) ?? "";
      let variableMap: string[] = Array.isArray(tplRow?.variable_map)
        ? (tplRow!.variable_map as string[])
        : [];

      // Fallback: si el body trae placeholders con nombre ({{nombre}}) y el
      // variable_map está vacío, derivamos el map desde el propio body.
      if (variableMap.length === 0) {
        const named = [
          ...new Set(
            [...tplBody.matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g)].map((m) => m[1]),
          ),
        ];
        if (named.length > 0) variableMap = named;
      }
      bodyVariableNames = variableMap;

      // Si se enviaron variables nombradas, armamos componentes en el orden del map.
      if (templateVariables && variableMap.length > 0 && !templateComponents) {
        const missing = variableMap.filter((k) => {
          const v = templateVariables[k];
          return v === undefined || v === null || v === "";
        });
        if (missing.length > 0) {
          return json(
            {
              error: `Faltan variables para la plantilla "${templateName}": ${missing.join(", ")}`,
              missing,
            },
            400,
          );
        }
        templateComponents = [
          {
            type: "body",
            parameters: variableMap.map((k) => ({ type: "text", text: String(templateVariables[k]) })),
          },
        ];
      }

      // Validación final: número de parámetros debe coincidir con los
      // placeholders del body ({{n}} numéricos o {{nombre}} con nombre).
      const matches = tplBody.match(/\{\{\s*(\d+)\s*\}\}/g) || [];
      const numericExpected = matches.reduce((max, m) => {
        const n = parseInt(m.replace(/[^\d]/g, ""), 10);
        return !Number.isNaN(n) && n > max ? n : max;
      }, 0);
      const expected = Math.max(numericExpected, variableMap.length);
      if (expected > 0) {
        const bodyComp = (templateComponents || []).find(
          (c: any) => String(c?.type ?? "").toLowerCase() === "body",
        ) as any;
        const params: any[] = bodyComp?.parameters ?? [];
        if (params.length !== expected) {
          return json(
            {
              error: `La plantilla "${templateName}" requiere ${expected} variable(s) y se recibieron ${params.length}.`,
              expected,
              received: params.length,
            },
            400,
          );
        }
      }
    }

    // Resolve / create conversation
    let convId = conversationId;
    let convRow: any = null;
    if (convId) {
      const { data } = await admin
        .from("whatsapp_conversations")
        .select("*")
        .eq("id", convId)
        .maybeSingle();
      convRow = data;
    }
    if (!convRow) {
      const { data } = await admin
        .from("whatsapp_conversations")
        .select("*")
        .eq("wa_phone", toPhone)
        .maybeSingle();
      convRow = data;
    }
    if (!convRow) {
      // For new conversations, prefer the explicitly chosen line, then fall back.
      const defaultPhoneId = explicitPhoneId ?? PHONE_ID_1 ?? PHONE_ID_2 ?? PHONE_ID_3 ?? null;
      const { data: created } = await admin
        .from("whatsapp_conversations")
        .insert({ wa_phone: toPhone, business_phone_number_id: defaultPhoneId })
        .select("*")
        .single();
      convRow = created;
    }
    convId = convRow.id;

    // Resolve which business line (phone_number_id) to use for this send.
    // Priority: explicit override from request > conversation's stored line > registered active account > env default.
    const convPhoneId: string | null = convRow.business_phone_number_id ?? null;
    let activePhoneId: string | null = explicitPhoneId ?? convPhoneId ?? null;
    if (!activePhoneId) {
      const { data: defaultAcct } = await admin
        .from("whatsapp_accounts")
        .select("business_phone_number_id")
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      activePhoneId = defaultAcct?.business_phone_number_id ?? PHONE_ID_1 ?? PHONE_ID_2 ?? PHONE_ID_3 ?? null;
    }
    if (!activePhoneId) return json({ error: "No hay phone_number_id configurado para esta conversación" }, 500);

    // Validate the chosen line is registered & active.
    const { data: acctCheck } = await admin
      .from("whatsapp_accounts")
      .select("business_phone_number_id,is_active,label")
      .eq("business_phone_number_id", activePhoneId)
      .maybeSingle();
    if (!acctCheck || acctCheck.is_active === false) {
      return json({ error: `La línea ${activePhoneId} no está registrada o está inactiva` }, 400);
    }

    // Persist override on the conversation so future sends keep using this line.
    if (explicitPhoneId && explicitPhoneId !== convPhoneId) {
      await admin
        .from("whatsapp_conversations")
        .update({ business_phone_number_id: explicitPhoneId })
        .eq("id", convId);
      convRow.business_phone_number_id = explicitPhoneId;
    }

    // 24h window enforcement for free-form text
    if (kind === "text" || kind === "media") {
      const lastInbound = convRow.last_inbound_at ? new Date(convRow.last_inbound_at).getTime() : 0;
      const ageMs = Date.now() - lastInbound;
      if (!lastInbound || ageMs > 24 * 60 * 60 * 1000) {
        return json(
          {
            error: "Ventana de atención cerrada (24h). Use una plantilla aprobada para reanudar.",
            window_closed: true,
          },
          400,
        );
      }
    }

    // ===== Media flow: bucket → Meta /media → send by id =====
    let metaMediaId: string | null = null;
    let mediaPublicUrl: string | null = null;
    let mediaSizeBytes: number | null = null;
    if (kind === "media") {
      // 1) Descargar binario desde el bucket privado
      const { data: fileBlob, error: dlErr } = await admin.storage
        .from("whatsapp-media")
        .download(mediaStoragePath!);
      if (dlErr || !fileBlob) {
        return json({ error: `No se pudo leer el archivo: ${dlErr?.message ?? "desconocido"}` }, 400);
      }
      const ab = await fileBlob.arrayBuffer();
      mediaSizeBytes = ab.byteLength;
      const contentType = mediaMime || fileBlob.type || "application/octet-stream";
      // 2) Subir a Meta /media
      const form = new FormData();
      form.append("messaging_product", "whatsapp");
      form.append("type", contentType);
      form.append(
        "file",
        new Blob([ab], { type: contentType }),
        mediaFilename || "file.bin",
      );
      const upRes = await fetch(`https://graph.facebook.com/v21.0/${activePhoneId}/media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}` },
        body: form,
      });
      const upData = await upRes.json().catch(() => ({}));
      if (!upRes.ok || !upData?.id) {
        return json(
          { error: upData?.error?.message ?? "Falló la subida del archivo a WhatsApp", details: upData },
          400,
        );
      }
      metaMediaId = String(upData.id);
      // 3) Generar signed URL para mostrar en el historial
      const { data: signed } = await admin.storage
        .from("whatsapp-media")
        .createSignedUrl(mediaStoragePath!, 60 * 60 * 24 * 7);
      mediaPublicUrl = signed?.signedUrl ?? null;
    }

    // Send to Meta
    let payload: Record<string, unknown>;
    if (kind === "text") {
      payload = { messaging_product: "whatsapp", to: toPhone, type: "text", text: { body: text } };
    } else if (kind === "template") {
      payload = {
        messaging_product: "whatsapp",
        to: toPhone,
        type: "template",
        template: {
          name: templateName,
          language: { code: templateLanguage },
          ...(templateComponents ? { components: templateComponents } : {}),
        },
      };
    } else {
      // media
      const mediaObj: Record<string, unknown> = { id: metaMediaId };
      if (mediaCaption && (mediaCategory === "image" || mediaCategory === "video" || mediaCategory === "document")) {
        mediaObj.caption = mediaCaption.slice(0, 1024);
      }
      if (mediaCategory === "document" && mediaFilename) {
        mediaObj.filename = mediaFilename;
      }
      payload = {
        messaging_product: "whatsapp",
        to: toPhone,
        type: mediaCategory!,
        [mediaCategory!]: mediaObj,
      };
    }

    const postToMeta = async (p: Record<string, unknown>) => {
      const res = await fetch(`https://graph.facebook.com/v21.0/${activePhoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      const d = await res.json().catch(() => ({}));
      return { res, d };
    };

    let { res: r, d: data } = await postToMeta(payload);

    // Meta rechaza con (#100) "Parameter name is missing or empty" cuando la
    // plantilla en Meta usa parámetros NOMBRADOS ({{nombre}}) y enviamos
    // parámetros posicionales. Reintentamos agregando `parameter_name`.
    const needsNamedParams =
      kind === "template" &&
      data?.error?.code === 100 &&
      String(data?.error?.error_data?.details ?? "").toLowerCase().includes("parameter name") &&
      bodyVariableNames.length > 0 &&
      Array.isArray(templateComponents);
    if (needsNamedParams) {
      const namedComponents = (templateComponents as any[]).map((c: any) => {
        if (String(c?.type ?? "").toLowerCase() !== "body") return c;
        return {
          ...c,
          parameters: (c.parameters ?? []).map((p: any, i: number) => ({
            ...p,
            parameter_name: bodyVariableNames[i] ?? `var${i + 1}`,
          })),
        };
      });
      const retryPayload = {
        ...payload,
        template: { ...(payload as any).template, components: namedComponents },
      };
      ({ res: r, d: data } = await postToMeta(retryPayload));
    }

    const waMessageId = data?.messages?.[0]?.id ?? null;
    const ok = r.ok && !data?.error;

    const previewText =
      kind === "text"
        ? text
        : kind === "template"
          ? `[plantilla] ${templateName}`
          : `[${mediaCategory}] ${mediaFilename ?? ""}${mediaCaption ? ` · ${mediaCaption}` : ""}`;

    await admin.from("whatsapp_messages").insert({
      wa_id: waMessageId,
      sender_phone: toPhone,
      message_body: kind === "media" ? (mediaCaption || mediaFilename || null) : (kind === "text" ? text : `[template: ${templateName}]`),
      direction: "outbound",
      status: ok ? "sent" : "failed",
      conversation_id: convId,
      contact_id: convRow.contact_id ?? null,
      template_name: kind === "template" ? templateName : null,
      created_by: userId,
      error_message: ok ? null : JSON.stringify(data?.error ?? data).slice(0, 500),
      business_phone_number_id: activePhoneId,
      ...(kind === "media"
        ? {
            media_type: mediaCategory,
            media_url: mediaPublicUrl,
            media_storage_path: mediaStoragePath,
            media_filename: mediaFilename ?? null,
            media_mime_type: mediaMime ?? null,
            media_size_bytes: mediaSizeBytes,
          }
        : {}),
    });

    if (ok) {
      await admin
        .from("whatsapp_conversations")
        .update({
          last_outbound_at: new Date().toISOString(),
          last_message_preview: previewText?.slice(0, 120),
          unread_count: 0,
          status: "open",
        })
        .eq("id", convId);
    }

    if (!ok) return json({ error: data?.error?.message ?? "Error en Meta", details: data }, 400);
    return json({ ok: true, wa_message_id: waMessageId, conversation_id: convId }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    console.error("send-message error:", msg);
    return json({ error: msg }, 500);
  }
});
