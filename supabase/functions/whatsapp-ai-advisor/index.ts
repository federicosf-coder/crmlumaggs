// Asesor B2B de lubricantes Chevron para WhatsApp (Lumaggs, Baja California).
//
// Responsabilidades separadas:
//   catálogo comercial (CRM) -> qué productos vendemos (única fuente para ofrecer)
//   base de conocimiento     -> información técnica (digest / TDS / SDS)
//   búsqueda web             -> investigación de aplicaciones
//   IA                       -> interpreta, razona y explica; nunca inventa datos
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { embedOne } from "../_shared/ai-embeddings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MODEL = "google/gemini-3.6-flash";
const CHAT_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const HISTORY_LIMIT = 60;

const STAGES = [
  "information",
  "consultation",
  "product_identified",
  "quotation_requested",
  "ready_for_salesperson",
  "transferred",
  "human_active",
  "closed",
] as const;

type Admin = ReturnType<typeof createClient>;

// ─────────────────────────── utilidades ───────────────────────────
const norm = (s: unknown) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function tokenize(q: string): string[] {
  return norm(q)
    .replace(/[^\w\s./-]+/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/** "delo400" -> "delo 400", "15w-40" -> "15w40" para tolerar cómo escribe el cliente. */
function expandToken(t: string): string[] {
  const out = new Set<string>([t]);
  out.add(t.replace(/[-.\s]/g, ""));
  const split = t.replace(/([a-z]+)(\d+)/g, "$1 $2").trim();
  split.split(" ").forEach((p) => p.length >= 2 && out.add(p));
  return [...out];
}

// ─────────────────────── catálogo comercial ───────────────────────
type CatalogRow = {
  codigo: string | null;
  nombre_producto: string | null;
  descripcion: string | null;
  marca: string | null;
  linea: string | null;
  viscosidad: string | null;
  aplicacion: string | null;
  uso: string | null;
  presentacion: string | null;
  haystack: string;
};

let catalogCache: { at: number; rows: CatalogRow[] } | null = null;

async function loadCatalog(admin: Admin): Promise<CatalogRow[]> {
  if (catalogCache && Date.now() - catalogCache.at < 5 * 60_000) return catalogCache.rows;
  const { data, error } = await admin
    .from("productos")
    .select(
      "codigo,nombre_producto,descripcion,is_active," +
        "presentaciones(nombre)," +
        "marca:product_option_values!productos_marca_id_fkey(value)," +
        "linea:product_option_values!productos_linea_id_fkey(value)," +
        "viscosidad:product_option_values!productos_viscosidad_id_fkey(value)," +
        "aplicacion:product_option_values!productos_aplicacion_id_fkey(value)," +
        "uso:product_option_values!productos_uso_id_fkey(value)",
    )
    .eq("is_active", true);
  if (error) throw new Error(`Catálogo: ${error.message}`);
  const rows: CatalogRow[] = (data ?? []).map((p: any) => {
    const row = {
      codigo: p.codigo ?? null,
      nombre_producto: p.nombre_producto ?? null,
      descripcion: p.descripcion ?? null,
      marca: p.marca?.value ?? null,
      linea: p.linea?.value ?? null,
      viscosidad: p.viscosidad?.value ?? null,
      aplicacion: p.aplicacion?.value ?? null,
      uso: p.uso?.value ?? null,
      presentacion: p.presentaciones?.nombre ?? null,
      haystack: "",
    };
    row.haystack = norm(
      [row.codigo, row.nombre_producto, row.descripcion, row.marca, row.linea, row.viscosidad, row.aplicacion, row.uso, row.presentacion]
        .filter(Boolean)
        .join(" "),
    ).replace(/[-.]/g, "");
    return row;
  });
  catalogCache = { at: Date.now(), rows };
  return rows;
}

async function buscarCatalogo(
  admin: Admin,
  args: { texto?: string; viscosidad?: string; aplicacion?: string; linea?: string; limite?: number },
) {
  const rows = await loadCatalog(admin);
  const limit = Math.min(Number(args.limite ?? 8), 15);
  const terms = [args.texto, args.viscosidad, args.aplicacion, args.linea].filter(Boolean).join(" ");
  const tokens = tokenize(terms);
  if (tokens.length === 0) {
    return { total_catalogo: rows.length, resultados: [], nota: "Sin criterios de búsqueda." };
  }
  const scored = rows
    .map((r) => {
      let score = 0;
      for (const t of tokens) {
        const variants = expandToken(t).map((v) => v.replace(/[-.]/g, ""));
        if (variants.some((v) => r.haystack.includes(v))) score++;
      }
      return { r, score };
    })
    .filter((x) => x.score === tokens.length)
    .slice(0, limit);

  const partial = scored.length === 0
    ? rows
        .map((r) => {
          let score = 0;
          for (const t of tokens) {
            const variants = expandToken(t).map((v) => v.replace(/[-.]/g, ""));
            if (variants.some((v) => r.haystack.includes(v))) score++;
          }
          return { r, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
    : scored;

  // Agrupamos por producto para exponer TODAS sus presentaciones disponibles.
  const grupos = new Map<string, any>();
  for (const { r } of partial) {
    const key = norm(r.nombre_producto ?? r.codigo ?? "");
    if (!grupos.has(key)) {
      grupos.set(key, {
        producto: r.nombre_producto,
        descripcion: r.descripcion,
        marca: r.marca,
        linea: r.linea,
        viscosidad: r.viscosidad,
        aplicacion: r.aplicacion,
        uso: r.uso,
        presentaciones_disponibles: [] as Array<{ presentacion: string | null; codigo: string | null }>,
      });
    }
    const g = grupos.get(key);
    if (!g.presentaciones_disponibles.some((p: any) => norm(p.presentacion) === norm(r.presentacion))) {
      g.presentaciones_disponibles.push({ presentacion: r.presentacion, codigo: r.codigo });
    }
  }

  return {
    coincidencia: scored.length > 0 ? "exacta" : partial.length > 0 ? "parcial" : "ninguna",
    aviso_inventario:
      "El catálogo indica qué productos MANEJA Lumaggs. NO representa inventario ni existencia. Nunca confirmes disponibilidad, existencia ni tiempos de entrega.",
    resultados: [...grupos.values()],
  };
}

// ─────────────────── base de conocimiento (RAG técnico) ───────────────────
async function buscarConocimiento(admin: Admin, args: { consulta?: string; fuente?: string }) {
  const consulta = String(args.consulta ?? "").trim();
  if (!consulta) return { fragmentos: [] };
  try {
    const vector = await embedOne(consulta);
    const { data, error } = await admin.rpc("match_bot_knowledge", {
      query_embedding: JSON.stringify(vector),
      match_count: 6,
      filter_source: args.fuente ?? null,
    });
    if (error) return { fragmentos: [], error: error.message };
    return {
      fragmentos: (data ?? []).map((d: any) => ({
        fuente: d.source_type,
        documento: d.title,
        pagina: d.page,
        texto: String(d.content ?? "").slice(0, 1200),
        similitud: Number(d.similarity ?? 0).toFixed(3),
      })),
    };
  } catch (e) {
    return { fragmentos: [], error: e instanceof Error ? e.message : "error" };
  }
}

// ─────────────────────── búsqueda web (Firecrawl) ───────────────────────
async function buscarInternet(args: { consulta?: string }) {
  const consulta = String(args.consulta ?? "").trim();
  if (!consulta) return { disponible: false, motivo: "Consulta vacía" };
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const fcKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!fcKey || !lovableKey) {
    return {
      disponible: false,
      motivo: "La búsqueda web no está configurada en este momento. No inventes datos: pide el dato faltante o transfiere al asesor.",
    };
  }
  try {
    const res = await fetch("https://connector-gateway.lovable.dev/firecrawl/v2/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": fcKey,
      },
      body: JSON.stringify({ query: consulta, limit: 4, lang: "es", country: "mx" }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error(`[wa-advisor] firecrawl ${res.status}: ${t.slice(0, 300)}`);
      return { disponible: false, motivo: `Búsqueda web no disponible (${res.status})` };
    }
    const data = await res.json();
    const items = (data?.data ?? data?.results ?? []) as any[];
    return {
      disponible: true,
      resultados: items.slice(0, 4).map((r) => ({
        titulo: r.title,
        url: r.url,
        extracto: String(r.description ?? r.markdown ?? "").slice(0, 700),
      })),
    };
  } catch (e) {
    return { disponible: false, motivo: e instanceof Error ? e.message : "error" };
  }
}

// ───────────────────── ficha de lead (progresiva) ─────────────────────
const PROFILE_FIELDS = [
  "conversation_stage", "intent", "cliente_nombre", "empresa_nombre", "tipo_cliente",
  "municipio", "cotizacion_solicitada", "productos_solicitados", "vehiculos",
  "contexto_negocio", "recomendaciones", "resumen", "notas_comerciales",
] as const;

function mergeList(prev: unknown, next: unknown): unknown[] {
  const a = Array.isArray(prev) ? prev : [];
  const b = Array.isArray(next) ? next : [];
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const item of [...a, ...b]) {
    const k = typeof item === "string" ? norm(item) : norm(JSON.stringify(item));
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

/**
 * Fusiona productos por nombre normalizado: el dato MÁS RECIENTE gana
 * (cantidad, presentación, aplicación). Evita que "3 cubetas" y "1 cubeta"
 * queden como dos productos distintos y que el bot vuelva a preguntar.
 */
function mergeProductos(prev: unknown, next: unknown): unknown[] {
  const toObj = (p: any) => (typeof p === "string" ? { producto: p } : (p ?? {}));
  const a = (Array.isArray(prev) ? prev : []).map(toObj);
  const b = (Array.isArray(next) ? next : []).map(toObj);
  const keyOf = (p: any) => norm(p?.producto ?? p?.nombre ?? JSON.stringify(p));
  const map = new Map<string, any>();
  for (const p of a) {
    const k = keyOf(p);
    if (k) map.set(k, { ...p });
  }
  for (const p of b) {
    const k = keyOf(p);
    if (!k) continue;
    const base = map.get(k) ?? {};
    const merged = { ...base };
    // Solo sobreescribimos con valores realmente provistos en el turno actual.
    for (const [field, value] of Object.entries(p)) {
      if (value === undefined || value === null || value === "") continue;
      merged[field] = value;
    }
    map.set(k, merged);
  }
  return [...map.values()];
}

async function actualizarFicha(admin: Admin, profile: any, args: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  for (const f of PROFILE_FIELDS) {
    const v = (args as any)[f];
    if (v === undefined || v === null || v === "") continue;
    if (f === "conversation_stage" && !STAGES.includes(String(v) as any)) continue;
    if (f === "productos_solicitados") {
      patch[f] = args.reemplazar_productos === true
        ? mergeProductos([], v)
        : mergeProductos(profile?.[f], v);
    } else if (f === "vehiculos" || f === "recomendaciones") {
      patch[f] = mergeList(profile?.[f], v);
    } else if (f === "contexto_negocio") {
      patch[f] = { ...(profile?.contexto_negocio ?? {}), ...(typeof v === "object" ? v : { nota: v }) };
    } else {
      patch[f] = v;
    }
  }
  if (Object.keys(patch).length === 0) return { ok: true, sin_cambios: true };
  const { data, error } = await admin
    .from("bot_lead_profiles")
    .update(patch)
    .eq("id", profile.id)
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  Object.assign(profile, data ?? patch);
  return { ok: true, ficha: patch };
}

async function transferirAsesor(admin: Admin, profile: any, args: Record<string, unknown>, ctx: {
  waPhone: string; contactId: string | null;
}) {
  await actualizarFicha(admin, profile, { ...args, conversation_stage: "transferred" });

  const resumen = String(profile.resumen ?? args?.resumen ?? "").slice(0, 4000);
  const productos = Array.isArray(profile.productos_solicitados) ? profile.productos_solicitados : [];
  const vehiculos = Array.isArray(profile.vehiculos) ? profile.vehiculos : [];
  const detalle = [
    resumen,
    productos.length
      ? `Productos a cotizar:\n${productos
          .map((p: any) => {
            if (typeof p === "string") return `- ${p}`;
            const partes = [
              p?.producto,
              p?.presentacion ? `presentación: ${p.presentacion}` : null,
              p?.cantidad ? `cantidad: ${p.cantidad}${p?.unidad ? " " + p.unidad : ""}` : null,
              p?.aplicacion ? `aplicación: ${p.aplicacion}` : null,
            ].filter(Boolean);
            return `- ${partes.join(" · ")}`;
          })
          .join("\n")}`
      : "",
    vehiculos.length ? `Equipos/vehículos: ${vehiculos.map((v: any) => (typeof v === "string" ? v : JSON.stringify(v))).join(", ")}` : "",
    profile.notas_comerciales ? `Notas: ${profile.notas_comerciales}` : "",
  ].filter(Boolean).join("\n");

  let leadId = profile.lead_id as string | null;
  try {
    if (leadId) {
      await admin.from("leads").update({
        nombre: profile.cliente_nombre ?? undefined,
        empresa_nombre: profile.empresa_nombre ?? undefined,
        ciudad: profile.municipio ?? undefined,
        mensaje: detalle || undefined,
        interes: profile.intent ?? undefined,
      }).eq("id", leadId);
    } else {
      const { data: lead, error } = await admin.from("leads").insert({
        nombre: profile.cliente_nombre ?? "Prospecto WhatsApp",
        telefono: ctx.waPhone,
        empresa_nombre: profile.empresa_nombre ?? null,
        ciudad: profile.municipio ?? null,
        mensaje: detalle || null,
        interes: profile.intent ?? "asesoria_lubricantes",
        contact_id: ctx.contactId,
        payload: {
          origen: "whatsapp_asesor_ia",
          conversation_id: profile.conversation_id,
          ficha: {
            tipo_cliente: profile.tipo_cliente,
            productos_solicitados: productos,
            vehiculos,
            contexto_negocio: profile.contexto_negocio,
            recomendaciones: profile.recomendaciones,
            cotizacion_solicitada: profile.cotizacion_solicitada,
          },
        },
      }).select("id").maybeSingle();
      if (error) console.error("[wa-advisor] lead insert:", error.message);
      leadId = lead?.id ?? null;
    }
  } catch (e) {
    console.error("[wa-advisor] lead error:", e);
  }

  await admin.from("bot_lead_profiles")
    .update({ lead_id: leadId, transferred_at: new Date().toISOString() })
    .eq("id", profile.id);
  profile.lead_id = leadId;
  return { ok: true, lead_id: leadId };
}

// ─────────────────────────── prompt ───────────────────────────
function systemPrompt(profile: any, contexto: string): string {
  return `Eres asesor comercial y técnico de LUMAGGS, distribuidor autorizado Chevron para clientes empresariales (B2B) de Baja California. Atiendes por WhatsApp en español mexicano, con tono profesional, cercano y breve.

PRECISIÓN ANTES QUE NATURALIDAD. Nunca inventes. Si no tienes certeza, dilo y pide solo el dato faltante o transfiere al asesor.

SEPARACIÓN DE FUENTES (obligatoria):
- buscar_catalogo: ÚNICA fuente para saber qué vendemos. Todo producto se busca aquí PRIMERO.
- buscar_conocimiento: biblioteca técnica de Lumaggs (digest Chevron, guías de venta, comparativos, fichas). CONSÚLTALA SIEMPRE antes de responder sobre compatibilidad con maquinaria/equipo, aplicaciones, especificaciones o usos. No define qué vendemos.
- buscar_internet: solo investigación de aplicaciones (qué requiere un motor/equipo). Nunca sustituye al catálogo.
- Tú razonas y explicas; no generas datos técnicos que no vengan de esas fuentes.

REGLAS DURAS:
1. Nunca des precios, costos, descuentos, existencias, inventario, tiempos de entrega ni cotizaciones. Si lo piden: el asesor lo confirma.
1b. NO HAY INTEGRACIÓN DE INVENTARIO. Que un producto esté en el catálogo solo significa que LO MANEJAMOS. Prohibido decir "sí tenemos en existencia", "está disponible", "hay X unidades", "te lo entregamos", "disponibilidad inmediata". Si preguntan disponibilidad responde en la línea de: "Sí manejamos ese producto; para confirmar existencia y disponibilidad, un asesor te envía la información."
2. Máximo DOS recomendaciones. Si solo una opción es compatible, recomienda una sola. Si ninguna, dilo y transfiere.
3. Si un producto no está en el catálogo, no lo ofrezcas: indica que el asesor puede revisar la alternativa.
4. No pidas el teléfono (ya lo tienes). No repitas preguntas ya respondidas ni datos que ya conoces.
5. Si el cliente ya nombró el producto, no preguntes por el vehículo.
6. Si una consulta técnica no se puede resolver con certeza, pide ÚNICAMENTE el dato faltante (motor, año, servicio, tipo de equipo) o transfiere. Jamás completes con suposiciones.
7. Mensajes cortos (2-6 líneas), sin listas largas ni tecnicismos innecesarios.
8. Compatibilidad técnica: antes de afirmar que un producto sirve para cierta maquinaria/equipo, busca en la biblioteca (buscar_conocimiento). Nunca supongas compatibilidad por categoría. Si la biblioteca no lo cubre, dilo y canaliza con el asesor.

PRESENTACIÓN Y CANTIDAD (para que el asesor pueda cotizar):
- Si el producto tiene varias presentaciones (litro, cubeta, tambor, tote...), puedes informarlas y DEBES preguntar cuál necesita. Nunca asumas una presentación cuando hay varias. Al listarlas di "lo manejamos en ..." — nunca "lo tenemos disponible en ..." (eso sugiere existencia).
- Pregunta la cantidad de forma natural, solo si aún no la dio. Interpreta "necesito 10", "quiero 5 cubetas", "cotízame 2 totes" como cantidad + presentación.
- Nunca vuelvas a preguntar presentación o cantidad que el cliente ya indicó (revisa la ficha y el historial).
- Guarda cada producto en la ficha como objeto { producto, presentacion, cantidad, unidad } vía actualizar_ficha_lead.
- Antes de transferir una solicitud de cotización procura tener: producto + presentación + cantidad (y aplicación/maquinaria cuando sea relevante). Si el cliente no quiere darlos o no aplican, transfiere igual y anótalo en las notas.

ETAPAS (conversation_stage): information, consultation, product_identified, quotation_requested, ready_for_salesperson, transferred, human_active, closed.
- En information/consultation solo informas y asesoras: NO pidas municipio ni datos comerciales.
- Pide el municipio SOLO cuando ya hay intención comercial suficiente (quiere comprar, cotizar, surtir flotilla o pide hablar con un asesor) y vas a pasar a ready_for_salesperson.
- NO se requiere un producto identificado para transferir: un cliente puede necesitar asesoría sin saber qué producto quiere.

FICHA PROGRESIVA: en CADA turno donde aparezca información nueva llama a actualizar_ficha_lead con solo los campos nuevos (nombre, empresa, tipo de cliente, municipio, intención, productos, vehículos, contexto de negocio, recomendaciones, resumen, notas y la etapa). No esperes al final.

TRANSFERENCIA: cuando haya intención comercial suficiente y ya tengas el municipio, llama a transferir_a_asesor y despídete diciendo que un asesor de Lumaggs continuará la conversación. No prometas tiempos. En el resumen incluye producto, presentación, cantidad y aplicación/maquinaria cuando existan.

FICHA ACTUAL:
${JSON.stringify({
    etapa: profile.conversation_stage,
    intencion: profile.intent,
    cliente: profile.cliente_nombre,
    empresa: profile.empresa_nombre,
    tipo_cliente: profile.tipo_cliente,
    municipio: profile.municipio,
    cotizacion_solicitada: profile.cotizacion_solicitada,
    productos_solicitados: profile.productos_solicitados,
    vehiculos: profile.vehiculos,
    contexto_negocio: profile.contexto_negocio,
    recomendaciones: profile.recomendaciones,
  })}

DATOS QUE YA CONOCES DEL CRM (no los vuelvas a preguntar):
${contexto || "Sin registro previo en el CRM."}`;
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "buscar_catalogo",
      description: "Búsqueda estructurada en el catálogo comercial de Lumaggs. Única fuente válida para saber qué productos se venden.",
      parameters: {
        type: "object",
        properties: {
          texto: { type: "string", description: "Texto libre: nombre, código, línea o descripción (ej. 'delo 400 xle 15w40')." },
          viscosidad: { type: "string" },
          aplicacion: { type: "string" },
          linea: { type: "string" },
          limite: { type: "number" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_conocimiento",
      description: "Biblioteca técnica de Lumaggs (digest Chevron, guías de venta, comparativos, fichas técnicas y hojas de seguridad). Úsala SIEMPRE antes de responder sobre compatibilidad con maquinaria/equipo, aplicaciones, especificaciones o usos.",
      parameters: {
        type: "object",
        properties: { consulta: { type: "string" }, fuente: { type: "string" } },
        required: ["consulta"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_internet",
      description: "Investigación de aplicaciones en internet (qué lubricante especifica un motor, equipo o vehículo). Prioriza fuentes oficiales.",
      parameters: { type: "object", properties: { consulta: { type: "string" } }, required: ["consulta"] },
    },
  },
  {
    type: "function",
    function: {
      name: "actualizar_ficha_lead",
      description: "Guarda de forma incremental la información nueva de la conversación. Envía solo los campos con datos nuevos.",
      parameters: {
        type: "object",
        properties: {
          conversation_stage: { type: "string", enum: STAGES as unknown as string[] },
          intent: { type: "string" },
          cliente_nombre: { type: "string" },
          empresa_nombre: { type: "string" },
          tipo_cliente: { type: "string" },
          municipio: { type: "string" },
          cotizacion_solicitada: { type: "boolean" },
          productos_solicitados: {
            type: "array",
            description: "Productos de interés con su presentación y cantidad cuando se conozcan.",
            items: {
              type: "object",
              properties: {
                producto: { type: "string" },
                presentacion: { type: "string", description: "litro, cubeta, tambor, tote, etc." },
                cantidad: { type: "number" },
                unidad: { type: "string" },
                aplicacion: { type: "string", description: "maquinaria o equipo donde se usará" },
              },
            },
          },
          vehiculos: { type: "array", items: { type: "string" } },
          contexto_negocio: { type: "object", properties: { nota: { type: "string" } } },
          recomendaciones: { type: "array", items: { type: "string" } },
          resumen: { type: "string" },
          notas_comerciales: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transferir_a_asesor",
      description: "Marca la conversación lista para el asesor humano y registra el prospecto. Requiere intención comercial y municipio. Si es cotización, procura tener producto, presentación y cantidad antes de llamarla.",
      parameters: {
        type: "object",
        properties: { resumen: { type: "string" }, notas_comerciales: { type: "string" }, municipio: { type: "string" } },
        required: ["resumen"],
      },
    },
  },
];

// ─────────────────────────── envío WhatsApp ───────────────────────────
async function sendAndLog(admin: Admin, p: {
  toPhone: string; text: string; businessPhoneId: string | null;
  conversationId: string | null; contactId: string | null; whatsappAccountId: string | null;
}) {
  const TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  let ok = false; let waId: string | null = null;
  if (TOKEN && p.businessPhoneId) {
    const r = await fetch(`https://graph.facebook.com/v21.0/${p.businessPhoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: p.toPhone, type: "text", text: { body: p.text } }),
    });
    const data = await r.json().catch(() => ({}));
    ok = r.ok;
    waId = data?.messages?.[0]?.id ?? null;
    if (!ok) console.error("[wa-advisor] send failed:", JSON.stringify(data).slice(0, 400));
  }
  await admin.from("whatsapp_messages").insert({
    wa_id: waId,
    sender_phone: p.toPhone,
    message_body: p.text,
    direction: "outbound",
    status: ok ? "sent" : "failed",
    conversation_id: p.conversationId,
    contact_id: p.contactId,
    business_phone_number_id: p.businessPhoneId,
    whatsapp_account_id: p.whatsappAccountId,
  });
  if (p.conversationId) {
    await admin.from("whatsapp_conversations")
      .update({ last_outbound_at: new Date().toISOString(), last_message_preview: p.text.slice(0, 120) })
      .eq("id", p.conversationId);
  }
  return ok;
}

// ─────────────────────────── handler ───────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const body = await req.json().catch(() => ({}));
    const conversationId: string | null = body?.conversation_id ?? null;
    const waPhone: string = String(body?.wa_phone ?? "");
    const businessPhoneId: string | null = body?.business_phone_number_id ?? null;
    const contactId: string | null = body?.contact_id ?? null;
    const whatsappAccountId: string | null = body?.whatsapp_account_id ?? null;
    const dryRun = Boolean(body?.dry_run);
    if (!waPhone) return json({ error: "Falta wa_phone" }, 400);

    // ── ficha (crear si no existe) ──
    let profile: any = null;
    if (conversationId) {
      const { data } = await admin.from("bot_lead_profiles").select("*").eq("conversation_id", conversationId).maybeSingle();
      profile = data ?? null;
    }
    if (!profile) {
      const { data, error } = await admin.from("bot_lead_profiles").insert({
        conversation_id: conversationId,
        wa_phone: waPhone,
        business_phone_number_id: businessPhoneId,
        contact_id: contactId,
      }).select("*").maybeSingle();
      if (error) return json({ error: error.message }, 500);
      profile = data;
    }

    if (String(profile.conversation_stage) === "closed") {
      return json({ skipped: true, reason: profile.conversation_stage });
    }

    // ── historial COMPLETO reciente de la conversación (sin ventana de tiempo:
    //    el cliente puede volver horas o días después y debe conservarse el contexto) ──
    const { data: history } = await admin
      .from("whatsapp_messages")
      .select("direction,message_body,created_by,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);
    const ordered = (history ?? []).slice().reverse();

    // Un asesor humano contestó recientemente (6 h) → el bot se calla.
    const HUMAN_PAUSE_MS = 6 * 60 * 60 * 1000;
    const humanReplied = ordered.some(
      (m: any) =>
        m.direction === "outbound" &&
        m.created_by &&
        Date.now() - new Date(m.created_at).getTime() < HUMAN_PAUSE_MS,
    );
    if (humanReplied) {
      await admin.from("bot_lead_profiles").update({ conversation_stage: "human_active" }).eq("id", profile.id);
      return json({ skipped: true, reason: "human_active" });
    }
    // Sin intervención humana reciente → el bot retoma la conversación.
    if (String(profile.conversation_stage) === "human_active") {
      await admin.from("bot_lead_profiles").update({ conversation_stage: "consultation" }).eq("id", profile.id);
      profile.conversation_stage = "consultation";
    }

    // ── contexto del CRM ──
    let contexto = "";
    if (contactId) {
      const { data: c } = await admin
        .from("contacts")
        .select("first_name,last_name,email,job_title,company_id,companies(name,industry,city)")
        .eq("id", contactId)
        .maybeSingle();
      if (c) {
        contexto = JSON.stringify({
          contacto: `${(c as any).first_name ?? ""} ${(c as any).last_name ?? ""}`.trim(),
          puesto: (c as any).job_title ?? null,
          ciudad: (c as any).companies?.city ?? null,
          empresa: (c as any).companies?.name ?? null,
          giro: (c as any).companies?.industry ?? null,
        });
        if (!profile.cliente_nombre || !profile.empresa_nombre) {
          await admin.from("bot_lead_profiles").update({
            cliente_nombre: profile.cliente_nombre ??
              (`${(c as any).first_name ?? ""} ${(c as any).last_name ?? ""}`.trim() || null),
            empresa_nombre: profile.empresa_nombre ?? (c as any).companies?.name ?? null,
            company_id: profile.company_id ?? (c as any).company_id ?? null,
          }).eq("id", profile.id);
        }
      }
    }

    const messages: any[] = [
      { role: "system", content: systemPrompt(profile, contexto) },
      ...ordered
        .filter((m: any) => (m.message_body ?? "").trim())
        .map((m: any) => ({
          role: m.direction === "inbound" ? "user" : "assistant",
          content: String(m.message_body),
        })),
    ];
    if (messages[messages.length - 1]?.role !== "user") {
      messages.push({ role: "user", content: String(body?.text ?? "(el cliente envió un mensaje sin texto)") });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY no configurada" }, 500);

    let reply = "";
    for (let step = 0; step < 6; step++) {
      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "Lovable-API-Key": apiKey,
        },
        body: JSON.stringify({ model: MODEL, messages, tools: TOOLS, temperature: 0.3 }),
      });
      if (!res.ok) {
        const t = await res.text();
        console.error(`[wa-advisor] gateway ${res.status}: ${t.slice(0, 500)}`);
        return json({ error: `AI ${res.status}`, detail: t.slice(0, 500) }, res.status === 429 || res.status === 402 ? res.status : 500);
      }
      const data = await res.json();
      const choice = data?.choices?.[0]?.message;
      if (!choice) break;
      messages.push(choice);
      const calls = choice.tool_calls ?? [];
      if (calls.length === 0) {
        reply = String(choice.content ?? "").trim();
        break;
      }
      for (const call of calls) {
        const name = call?.function?.name;
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(call?.function?.arguments ?? "{}"); } catch { /* ignore */ }
        let result: unknown = { error: "Herramienta desconocida" };
        try {
          if (name === "buscar_catalogo") result = await buscarCatalogo(admin, args as any);
          else if (name === "buscar_conocimiento") result = await buscarConocimiento(admin, args as any);
          else if (name === "buscar_internet") result = await buscarInternet(args as any);
          else if (name === "actualizar_ficha_lead") result = await actualizarFicha(admin, profile, args);
          else if (name === "transferir_a_asesor") result = await transferirAsesor(admin, profile, args, { waPhone, contactId });
        } catch (e) {
          result = { error: e instanceof Error ? e.message : "error de herramienta" };
        }
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result).slice(0, 12000) });
      }
    }

    if (!reply) {
      reply = "Con gusto te apoyo. ¿Me confirmas qué equipo o producto necesitas para orientarte mejor?";
    }

    if (dryRun) return json({ reply, stage: profile.conversation_stage, profile_id: profile.id });

    const sent = await sendAndLog(admin, {
      toPhone: waPhone,
      text: reply,
      businessPhoneId,
      conversationId,
      contactId,
      whatsappAccountId,
    });
    return json({ ok: true, sent, reply, stage: profile.conversation_stage });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    console.error("[wa-advisor]", message);
    return json({ error: message }, 500);
  }
});