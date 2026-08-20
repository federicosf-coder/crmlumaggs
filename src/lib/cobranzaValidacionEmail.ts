import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { extractDocFilesPath, signDocFilesUrlsInHtml } from "@/lib/storageSignedUrl";
import {
  renderTemplate,
  resolveEmailRecipients,
  buildTemplateAttachmentsBlock,
  type EmailRecipientItem,
} from "@/lib/templates";
import { resolveTemplate } from "@/lib/resolveTemplate";

const FORMA_PAGO_TPL_LABEL: Record<string, string> = {
  contado: "Contado",
  credito: "Crédito Directo",
  credito_cescemex: "Crédito Cescemex",
};

const TIPO_LABEL: Record<string, string> = {
  factura: "Factura",
  pedido: "Pedido",
  cotizacion: "Cotización",
};

async function loadSystemTemplate(systemKey: string): Promise<{
  id: string;
  subject: string;
  body: string;
  to_emails: EmailRecipientItem[];
  cc_emails: EmailRecipientItem[];
  bcc_emails: EmailRecipientItem[];
  reply_to: string | null;
} | null> {
  const { data } = await (supabase as any)
    .from("templates")
    .select("id, subject, body, to_emails, cc_emails, bcc_emails, reply_to")
    .eq("system_key", systemKey)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!data || !data.body) return null;
  return {
    id: data.id,
    subject: data.subject || "",
    body: data.body,
    to_emails: (data.to_emails as EmailRecipientItem[]) || [],
    cc_emails: (data.cc_emails as EmailRecipientItem[]) || [],
    bcc_emails: (data.bcc_emails as EmailRecipientItem[]) || [],
    reply_to: data.reply_to || null,
  };
}

export interface ValidacionEmailFlow {
  title: string;
  description: string;
  subjectOverride?: string;
  htmlOverride?: string;
  cc: string[];
  bcc: string[];
  replyTo?: string;
  defaultEmails: string[];
  blockedEmails: string[];
  comprobantes: { nombre: string; url: string }[];
  previouslySentEmails: string[];
  templateName: string;
  empresaNombre: string;
  montoTotalFormateado: string;
  moneda: string;
  fechaPagoFormateada: string;
  observaciones?: string;
  documentosLigados: { tipo: string; numero: string; monto: string }[];
}

export async function buildValidacionEmailFlow(
  pagoId: string,
  flow: "contado" | "credito" | "credito_cescemex",
  registradoPor?: string
): Promise<ValidacionEmailFlow | null> {
  const { data: pago } = await (supabase as any)
    .from("cobranza_pagos")
    .select(
      "id, empresa_id, fecha_pago, monto_total, moneda, tipo_pago, referencia_pago, banco, observaciones, empresa:companies!cobranza_pagos_empresa_id_fkey(name, razon_social, id_contpaq, email)"
    )
    .eq("id", pagoId)
    .maybeSingle();
  if (!pago) return null;

  // Documentos ligados
  const { data: aplicaciones } = await (supabase as any)
    .from("cobranza_aplicaciones")
    .select(
      "documento_id, tipo_documento, monto_aplicado, estatus_aplicacion, documento:documentos(numero_factura, numero_pedido, numero_cotizacion)"
    )
    .eq("pago_id", pagoId)
    .eq("estatus_aplicacion", "activa");

  const documentosLigados = (aplicaciones || []).map((a: any) => ({
    tipo: TIPO_LABEL[a.tipo_documento] || a.tipo_documento,
    numero:
      a.documento?.numero_factura ||
      a.documento?.numero_pedido ||
      a.documento?.numero_cotizacion ||
      String(a.documento_id || "").slice(0, 8),
    monto: formatCurrency(Number(a.monto_aplicado)),
  }));

  const emails: string[] = [];

  // Correos PROHIBIDOS: empresa + contactos
  const blocked: string[] = [];
  if (pago.empresa?.email) blocked.push(String(pago.empresa.email).toLowerCase());
  const { data: contactos } = await (supabase as any)
    .from("contacts")
    .select("email")
    .eq("company_id", pago.empresa_id);
  (contactos || []).forEach((c: any) => {
    if (c.email) {
      const e = String(c.email).toLowerCase();
      if (!blocked.includes(e)) blocked.push(e);
    }
  });

  const groupName =
    flow === "contado"
      ? "Cobranza Contado"
      : flow === "credito"
      ? "Cobranza Crédito Directo"
      : "Cobranza Cescemex";

  const settingKey =
    flow === "contado"
      ? "destinatarios_default_contado"
      : flow === "credito"
      ? "destinatarios_default_credito_directo"
      : "destinatarios_default_credito_cescemex";

  const { data: setting } = await (supabase as any)
    .from("system_settings")
    .select("value")
    .eq("key", settingKey)
    .maybeSingle();
  const list = Array.isArray(setting?.value) ? (setting!.value as any[]) : [];
  list.forEach((e: any) => {
    if (typeof e === "string" && e && !emails.includes(e)) emails.push(e);
  });

  const { data: grp } = await (supabase as any)
    .from("email_groups")
    .select("id")
    .eq("nombre", groupName)
    .eq("is_active", true)
    .maybeSingle();
  if (grp?.id) {
    const { data: members } = await (supabase as any)
      .from("email_group_members")
      .select("email")
      .eq("group_id", grp.id);
    (members || []).forEach((m: any) => {
      if (m.email && !emails.includes(m.email)) emails.push(m.email);
    });
  }

  const filteredEmails = emails.filter((e) => !blocked.includes(e.toLowerCase()));

  // Comprobantes firmados (7 días)
  const { data: archivos } = await (supabase as any)
    .from("cobranza_pago_archivos")
    .select("nombre_archivo,url_archivo")
    .eq("pago_id", pagoId);
  const SIGNED_TTL = 60 * 60 * 24 * 7;
  const signedComprobantes = await Promise.all(
    (archivos || []).map(async (a: any) => {
      const path = extractDocFilesPath(a.url_archivo);
      const { data } = await supabase.storage
        .from("document-files")
        .createSignedUrl(path, SIGNED_TTL);
      return { nombre: a.nombre_archivo, url: data?.signedUrl || a.url_archivo };
    })
  );

  const docsHtml = documentosLigados.length
    ? documentosLigados
        .map(
          (d) =>
            `<div style="display:flex;align-items:center;gap:24px;padding:4px 0;"><span style="min-width:110px;"><strong>${d.tipo}</strong></span><span style="min-width:140px;color:#334155;">${d.numero}</span><span style="font-weight:600;margin-left:auto;">${d.monto}</span></div>`
        )
        .join("")
    : '<span style="color:#94a3b8;">Sin documentos ligados</span>';
  const compsHtml = signedComprobantes.length
    ? signedComprobantes
        .map(
          (a) =>
            `<div style="padding:4px 0;"><a href="${a.url}" style="color:#2563eb;text-decoration:underline;">${a.nombre}</a></div>`
        )
        .join("")
    : '<span style="color:#94a3b8;">Sin comprobantes</span>';

  const formaLabel =
    flow === "contado" ? "Contado" : flow === "credito" ? "Crédito Directo" : "Crédito Cescemex";

  const tplVars: Record<string, any> = {
    nombre_cliente: pago.empresa?.name || "",
    cliente: pago.empresa?.name || "",
    empresa: pago.empresa?.name || "",
    razon_social: pago.empresa?.razon_social || "",
    id_contpaq: pago.empresa?.id_contpaq || "",
    monto_pago: `${formatCurrency(Number(pago.monto_total))} ${pago.moneda || "MXN"}`,
    monto_total: formatCurrency(Number(pago.monto_total)),
    moneda: pago.moneda || "MXN",
    fecha_pago: formatDate(pago.fecha_pago),
    tipo_pago: FORMA_PAGO_TPL_LABEL[pago.tipo_pago || ""] || pago.tipo_pago || "—",
    forma_pago: formaLabel,
    referencia: pago.referencia_pago || "—",
    referencia_pago: pago.referencia_pago || "—",
    banco: pago.banco || "—",
    observaciones: pago.observaciones || "—",
    registrado_por: registradoPor || "—",
    documentos_lista: docsHtml,
    comprobantes_lista: compsHtml,
    liga_documento: signedComprobantes[0]?.url ?? "",
  };

  const perFlowKey =
    flow === "contado"
      ? "pago_validacion_contado"
      : flow === "credito"
      ? "pago_validacion_credito_directo"
      : "pago_validacion_credito_cescemex";

  let dbTpl = await loadSystemTemplate(perFlowKey);
  if (!dbTpl) dbTpl = await loadSystemTemplate("pago_validacion");

  let resolvedSubject = dbTpl?.subject || "";
  let resolvedBody = dbTpl?.body || "";
  if (dbTpl) {
    try {
      resolvedSubject = await resolveTemplate(resolvedSubject, { pagoId });
      resolvedBody = await resolveTemplate(resolvedBody, { pagoId });
    } catch (e) {
      console.warn("[cobranza] resolveTemplate failed", e);
    }
  }
  const subjectOverride = dbTpl ? renderTemplate(resolvedSubject, tplVars) : undefined;
  let htmlOverride = dbTpl ? renderTemplate(resolvedBody, tplVars) : undefined;
  if (htmlOverride) {
    htmlOverride = await signDocFilesUrlsInHtml(htmlOverride);
  }
  if (dbTpl?.id && htmlOverride) {
    try {
      const att = await buildTemplateAttachmentsBlock(dbTpl.id);
      if (att.html) htmlOverride = htmlOverride + att.html;
    } catch (e) {
      console.warn("[cobranza] No se pudieron anexar adjuntos de plantilla", e);
    }
  }

  const tplToEmails = dbTpl ? await resolveEmailRecipients(dbTpl.to_emails) : [];
  const tplCc = dbTpl ? await resolveEmailRecipients(dbTpl.cc_emails) : [];
  const tplBcc = dbTpl ? await resolveEmailRecipients(dbTpl.bcc_emails) : [];
  const tplReplyTo = dbTpl?.reply_to || null;
  tplToEmails.forEach((e) => {
    if (!filteredEmails.includes(e) && !blocked.includes(e.toLowerCase())) filteredEmails.push(e);
  });

  const { data: sentLogs } = await (supabase as any)
    .from("email_send_log")
    .select("recipient_email,status")
    .eq("template_name", "pago-validacion")
    .eq("status", "sent");
  const sentSet = new Set(
    (sentLogs || []).map((l: any) => (l.recipient_email || "").toLowerCase())
  );
  const previouslySentEmails = filteredEmails
    .filter((e) => sentSet.has(e.toLowerCase()))
    .map((e) => e.toLowerCase());

  return {
    title: `Solicitud de validación — ${formaLabel}`,
    description: `Se enviará a los destinatarios del grupo "${groupName}". Al enviar, el estatus del pago cambiará a "Enviado a Validar".`,
    subjectOverride,
    htmlOverride,
    cc: Array.from(new Set([...filteredEmails, ...tplCc])),
    bcc: tplBcc,
    replyTo: registradoPor || tplReplyTo || undefined,
    defaultEmails: filteredEmails,
    blockedEmails: blocked,
    comprobantes: signedComprobantes,
    previouslySentEmails,
    templateName: "pago-validacion",
    empresaNombre: pago.empresa?.name || "",
    montoTotalFormateado: formatCurrency(Number(pago.monto_total)),
    moneda: pago.moneda || "MXN",
    fechaPagoFormateada: formatDate(pago.fecha_pago),
    observaciones: pago.observaciones || undefined,
    documentosLigados,
  };
}
