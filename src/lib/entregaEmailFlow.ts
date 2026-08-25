import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/formatters";
import { resolveEmailRecipients } from "@/lib/templates";

const BUCKET = "entregas-corporativas";
const TEMPLATE_NAME = "entrega-notificacion";
const SYSTEM_KEY = "entrega_notificacion";

const FALLBACK_SUBJECT =
  "Entrega Corporativa — {cliente} — {lugar_entrega} — {fecha_programada}";
const FALLBACK_BODY =
  "<p>Entrega de {cliente} en {lugar_entrega} el {fecha_programada}.</p>{productos_lista}{evidencias_lista}";

function render(text: string, vars: Record<string, string>): string {
  let out = text || "";
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v ?? "");
  }
  return out;
}

export interface EntregaEmailFlow {
  title: string;
  description: string;
  subjectOverride: string;
  htmlOverride: string;
  cc: string[];
  bcc: string[];
  replyTo?: string;
  comprobantes: { nombre: string; url: string }[];
  previouslySentEmails: string[];
  templateName: string;
  defaultEmails?: string[];
}

export async function buildEntregaEmailFlow(
  entregaId: string,
  registradoPor?: string
): Promise<EntregaEmailFlow> {
  // 1. Entrega + ubicación
  const { data: entrega, error } = await (supabase as any)
    .from("entregas_corporativas")
    .select(
      "id, cliente, fecha_programada, numero_pedido, lugar_entrega_texto, factura_referencia, ubicacion:entregas_corporativas_ubicaciones(nombre, direccion)"
    )
    .eq("id", entregaId)
    .maybeSingle();
  if (error) throw error;
  if (!entrega) throw new Error("Entrega no encontrada");
  const ubicacion = entrega.ubicacion || null;

  // 2. Líneas
  const { data: lineas } = await (supabase as any)
    .from("entregas_corporativas_lineas")
    .select("codigo_producto, nombre_producto, cantidad")
    .eq("entrega_id", entregaId);
  const productosLista =
    lineas && lineas.length
      ? `<ul>${lineas
          .map(
            (l: any) =>
              `<li>${l.codigo_producto} ${l.nombre_producto || ""} — ${Number(
                l.cantidad
              )}</li>`
          )
          .join("")}</ul>`
      : "<em>Sin productos</em>";

  // 3. Evidencias + signed URLs (7 días)
  const { data: evidencias } = await (supabase as any)
    .from("entregas_corporativas_evidencias")
    .select("storage_path, nombre_archivo")
    .eq("entrega_id", entregaId);

  const comprobantes: { nombre: string; url: string }[] = [];
  for (const ev of evidencias || []) {
    try {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(ev.storage_path, 60 * 60 * 24 * 7);
      if (signed?.signedUrl) {
        comprobantes.push({
          nombre: ev.nombre_archivo || ev.storage_path,
          url: signed.signedUrl,
        });
      }
    } catch {
      /* omitir evidencia sin URL */
    }
  }
  const evidenciasLista = comprobantes.length
    ? `<ul>${comprobantes
        .map((c) => `<li><a href="${c.url}">${c.nombre}</a></li>`)
        .join("")}</ul>`
    : "<em>Sin evidencias</em>";

  // 4. Variables
  const tplVars: Record<string, string> = {
    cliente: entrega.cliente || "—",
    lugar_entrega: ubicacion?.nombre || entrega.lugar_entrega_texto || "—",
    direccion_entrega: ubicacion?.direccion || "—",
    fecha_programada: entrega.fecha_programada
      ? formatDate(entrega.fecha_programada)
      : "—",
    factura_referencia: entrega.factura_referencia || "—",
    numero_pedido: entrega.numero_pedido || "—",
    productos_lista: productosLista,
    evidencias_lista: evidenciasLista,
    registrado_por: registradoPor || "—",
  };

  // 5. Plantilla del sistema
  let tpl: any = null;
  try {
    const { data } = await (supabase as any)
      .from("templates")
      .select("id, subject, body, to_emails, cc_emails, bcc_emails, reply_to")
      .eq("system_key", SYSTEM_KEY)
      .eq("is_active", true)
      .limit(1);
    tpl = (data || [])[0] || null;
  } catch {
    tpl = null;
  }

  // 6. Render
  const subjectOverride = render(tpl?.subject || FALLBACK_SUBJECT, tplVars);
  const htmlOverride = render(tpl?.body || FALLBACK_BODY, tplVars);

  // 7. Destinatarios de plantilla
  const to = await resolveEmailRecipients(tpl?.to_emails);
  const cc = await resolveEmailRecipients(tpl?.cc_emails);
  const bcc = await resolveEmailRecipients(tpl?.bcc_emails);
  let replyTo: string | undefined;
  if (tpl?.reply_to) {
    if (typeof tpl.reply_to === "string") replyTo = tpl.reply_to;
    else {
      const r = await resolveEmailRecipients(tpl.reply_to);
      replyTo = r[0];
    }
  }

  // 8. Envíos previos
  let previouslySentEmails: string[] = [];
  try {
    const { data: logs } = await (supabase as any)
      .from("email_send_log")
      .select("recipient_email")
      .eq("template_name", TEMPLATE_NAME)
      .eq("status", "sent")
      .eq("metadata->>entrega_id", entregaId);
    previouslySentEmails = (logs || [])
      .map((l: any) => (l.recipient_email || "").toLowerCase())
      .filter(Boolean);
  } catch {
    previouslySentEmails = [];
  }

  return {
    title: `Notificar entrega — ${tplVars.cliente}`,
    description: "Al enviar, la entrega se marcará como entregada.",
    subjectOverride,
    htmlOverride,
    cc,
    bcc,
    replyTo,
    comprobantes,
    previouslySentEmails,
    templateName: TEMPLATE_NAME,
    defaultEmails: to,
  };
}
