import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase as _sb } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Mail, ExternalLink, Send, ChevronDown, ChevronUp, FileText, Phone, UserPlus, Pencil, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { normalizePhoneForWhatsApp, buildWaMeLink, copyMessage } from "@/lib/whatsapp";
import { extractDocFilesPath } from "@/lib/storageSignedUrl";
import { generateCompanyCreditoCobranzaPdfArtifact } from "@/lib/templateDocumentGenerators";
import { ContactFormDialog, type ContactEditData } from "@/components/ContactFormDialog";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _sb;

interface FacturaLite {
  id: string;
  empresa_id: string;
  numero_factura: string | null;
  saldo_pendiente_cobranza: number | null;
  fecha_vencimiento: string | null;
  total: number | null;
  empresa_vendedora?: string | null;
}

interface Props {
  factura: FacturaLite | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultTab?: "whatsapp" | "email";
  empresaNombre?: string;
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n || 0);

function renderPlaceholders(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\s*([\w_]+)\s*\}/g, (_m, k) => (vars[k] != null ? vars[k] : `{${k}}`))
             .replace(/\{\{\s*([\w_]+)\s*\}\}/g, (_m, k) => (vars[k] != null ? vars[k] : `{{${k}}}`));
}

export function CobranzaComunicacionDialog({ factura, open, onOpenChange, defaultTab = "whatsapp", empresaNombre }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"whatsapp" | "email">(defaultTab);
  useEffect(() => { setTab(defaultTab); }, [defaultTab, open]);

  // Contactos de la empresa
  const { data: contactos } = useQuery({
    queryKey: ["cobranza-comm-contactos", factura?.empresa_id],
    enabled: !!factura?.empresa_id && open,
    queryFn: async () => {
      // RPC con SECURITY DEFINER: devuelve los contactos activos de la empresa
      // aunque el usuario no tenga acceso al Directorio (necesario para cobranza).
      const { data, error } = await supabase
        .rpc("get_company_contacts_for_cobranza", { p_company_id: factura!.empresa_id });
      if (error) console.warn("[cobranza contactos]", error);
      return (data || []) as any[];
    },
  });

  // Otras facturas pendientes del cliente
  const { data: otrasFacturas } = useQuery({
    queryKey: ["cobranza-comm-otras", factura?.empresa_id, factura?.id],
    enabled: !!factura?.empresa_id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("documentos")
        .select("id, numero_factura, fecha_vencimiento, saldo_pendiente_cobranza, total, pdf_url")
        .eq("tipo_documento", "factura")
        .eq("empresa_id", factura!.empresa_id)
        .neq("id", factura!.id)
        .neq("estatus_factura", "cancelada")
        .neq("estatus_factura", "pagada")
        .gt("saldo_pendiente_cobranza", 0)
        .order("fecha_vencimiento");
      return (data || []) as any[];
    },
  });

  // PDF de la factura actual
  const { data: facturaPdfUrl } = useQuery({
    queryKey: ["cobranza-comm-factura-pdf", factura?.id],
    enabled: !!factura?.id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("documentos")
        .select("pdf_url")
        .eq("id", factura!.id)
        .maybeSingle();
      return (data?.pdf_url as string | null) || null;
    },
  });

  // Plantillas
  const { data: waTemplates } = useQuery({
    queryKey: ["cobranza-comm-templates-wa"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("templates")
        .select("id, name, body")
        .eq("type", "whatsapp")
        .eq("category", "cobranza")
        .eq("is_active", true)
        .order("name");
      return (data || []) as any[];
    },
  });
  const { data: emailTemplates } = useQuery({
    queryKey: ["cobranza-comm-templates-email"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("templates")
        .select("id, name, subject, body")
        .eq("type", "email")
        .eq("category", "cobranza")
        .eq("is_active", true)
        .order("name");
      return (data || []) as any[];
    },
  });

  // WhatsApp accounts y plantillas Meta
  const { data: waAccounts } = useQuery({
    queryKey: ["cobranza-comm-wa-accounts"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_accounts")
        .select("business_phone_number_id, label, display_phone, waba_id, is_active")
        .eq("is_active", true);
      return (data || []) as any[];
    },
  });
  const { data: metaTemplates } = useQuery({
    queryKey: ["cobranza-comm-meta-templates"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_templates")
        .select("id, name, language, body, status, business_phone_number_id")
        .eq("status", "APPROVED")
        .order("name");
      return (data || []) as any[];
    },
  });

  // Estado del form
  const [contactoId, setContactoId] = useState<string>("");
  const [telefonoManual, setTelefonoManual] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [incEstadoCuenta, setIncEstadoCuenta] = useState(true);
  const [incEstaFactura, setIncEstaFactura] = useState(true);
  const [incOtras, setIncOtras] = useState(false);
  const [otrasOpen, setOtrasOpen] = useState(false);
  const [otrasSel, setOtrasSel] = useState<Record<string, boolean>>({});

  const [waMetodo, setWaMetodo] = useState<"api" | "local">("local");
  const [waTemplateId, setWaTemplateId] = useState<string>("");
  const [waMsg, setWaMsg] = useState("");
  const [waAccountId, setWaAccountId] = useState<string>("");
  const [metaTemplateId, setMetaTemplateId] = useState<string>("");

  const [emailTemplateId, setEmailTemplateId] = useState<string>("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  // Contacto temporal (solo para este envío, no se guarda en la empresa)
  const [adHocContacto, setAdHocContacto] = useState<{ nombre: string; phone: string; email: string } | null>(null);

  const contactoSel = useMemo(
    () => (contactos || []).find((c) => c.id === contactoId) || null,
    [contactos, contactoId],
  );

  useEffect(() => {
    if (!open || !contactos) return;
    if (!contactoId && contactos.length > 0) setContactoId(contactos[0].id);
  }, [open, contactos, contactoId]);

  useEffect(() => {
    if (adHocContacto?.email) setEmailTo(adHocContacto.email);
    else if (contactoSel?.email) setEmailTo(contactoSel.email);
  }, [contactoSel, adHocContacto]);

  // Reset al cambiar de factura
  useEffect(() => {
    if (!open) {
      setContactoId(""); setTelefonoManual(""); setEmailTo(""); setEmailCc("");
      setIncEstadoCuenta(true); setIncEstaFactura(true); setIncOtras(false); setOtrasSel({});
      setWaMetodo("local"); setWaTemplateId(""); setWaMsg(""); setWaAccountId(""); setMetaTemplateId("");
      setEmailTemplateId(""); setEmailSubject(""); setEmailBody("");
      setAdHocContacto(null);
    }
  }, [open]);

  const vars = useMemo<Record<string, string>>(() => {
    const saldo = Number(factura?.saldo_pendiente_cobranza || 0);
    const nombreContacto = adHocContacto?.nombre
      || (contactoSel ? `${contactoSel.first_name || ""} ${contactoSel.last_name || ""}`.trim() : "");
    return {
      nombre_contacto: nombreContacto,
      contacto_nombre: nombreContacto,
      empresa_nombre: empresaNombre || "",
      numero_factura: factura?.numero_factura || "",
      folio_cotizacion: factura?.numero_factura || "",
      saldo_pendiente: fmtMoney(saldo),
      total_factura: fmtMoney(Number(factura?.total || 0)),
      fecha_vencimiento: factura?.fecha_vencimiento || "",
    };
  }, [factura, contactoSel, empresaNombre]);

  const onSelectWaTemplate = (id: string) => {
    setWaTemplateId(id);
    const t = (waTemplates || []).find((x) => x.id === id);
    if (t) setWaMsg(renderPlaceholders(t.body || "", vars));
  };
  const onSelectEmailTemplate = (id: string) => {
    setEmailTemplateId(id);
    const t = (emailTemplates || []).find((x) => x.id === id);
    if (t) {
      setEmailSubject(renderPlaceholders(t.subject || "", vars));
      setEmailBody(renderPlaceholders(t.body || "", vars));
    }
  };

  const telefonoDestino = useMemo(() => {
    const raw = telefonoManual || adHocContacto?.phone || contactoSel?.whatsapp_phone || contactoSel?.mobile || contactoSel?.phone || "";
    return normalizePhoneForWhatsApp(raw) || "";
  }, [telefonoManual, contactoSel, adHocContacto]);

  async function registrarActividad(canal: "whatsapp" | "email", descripcion: string) {
    if (!user || !factura) return;
    try {
      await supabase.from("crm_activities").insert({
        company_id: factura.empresa_id,
        contact_id: adHocContacto ? null : (contactoSel?.id || null),
        user_id: user.id,
        type: canal,
        title: `Cobranza · Factura ${factura.numero_factura || ""}`.trim(),
        description: adHocContacto
          ? `${descripcion} · Contacto temporal: ${adHocContacto.nombre}${adHocContacto.phone ? ` (${adHocContacto.phone})` : ""}${adHocContacto.email ? ` <${adHocContacto.email}>` : ""}`
          : descripcion,
        activity_date: new Date().toISOString(),
        documento_id: factura.id,
      });
    } catch (e) {
      console.warn("[CobranzaComunicacion] no se pudo registrar actividad", e);
    }
  }

  const otrasIncluidas = useMemo(
    () => (incOtras ? (otrasFacturas || []).filter((f) => otrasSel[f.id]) : []),
    [incOtras, otrasFacturas, otrasSel],
  );

  const docsResumen = (): string => {
    const partes: string[] = [];
    if (incEstadoCuenta) partes.push("Estado de cuenta (PDF)");
    if (incEstaFactura) partes.push(`Factura ${factura?.numero_factura || ""} (datos)`);
    if (otrasIncluidas.length > 0) partes.push(`+${otrasIncluidas.length} factura(s) adicionales (datos)`);
    return partes.join(" · ");
  };

  const fmtFechaCorta = (f: string | null | undefined) =>
    f ? new Date(f).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

  /** Resumen de facturas (no PDF) para incluir en el cuerpo de WhatsApp. */
  const facturasResumenTexto = (): string => {
    const lineas: string[] = [];
    if (incEstaFactura && factura) {
      lineas.push(
        `• Factura ${factura.numero_factura || ""} · vence ${fmtFechaCorta(factura.fecha_vencimiento)} · total ${fmtMoney(Number(factura.total || 0))}`,
      );
    }
    for (const o of otrasIncluidas) {
      lineas.push(
        `• Factura ${o.numero_factura || ""} · vence ${fmtFechaCorta(o.fecha_vencimiento)} · total ${fmtMoney(Number(o.total || 0))}`,
      );
    }
    return lineas.length ? `\n\n🧾 Facturas:\n${lineas.join("\n")}` : "";
  };

  // ---- Envíos ----
  const enviarWaLocal = async () => {
    if (!telefonoDestino) { toast.error("Falta teléfono del destinatario"); return; }
    if (!waMsg.trim()) { toast.error("El mensaje está vacío"); return; }
    const enlaces = await prepararEnlaces();
    const sufijoPdf = enlaces.length
      ? `\n\n📎 Documentos (válidos 7 días):\n${enlaces.map(e => `• ${e.label}: ${e.url}`).join("\n")}`
      : "";
    const mensajeFinal = waMsg + facturasResumenTexto() + sufijoPdf;
    await copyMessage(mensajeFinal);
    window.location.href = buildWaMeLink(telefonoDestino, mensajeFinal);
    await registrarActividad("whatsapp", `WhatsApp local a ${telefonoDestino}. ${docsResumen()}${enlaces.length ? ` · ${enlaces.length} enlace(s) PDF` : ""}`);
    toast.success("Mensaje copiado y WhatsApp abierto");
    onOpenChange(false);
  };

  const enviarWaApi = async () => {
    if (!telefonoDestino) { toast.error("Falta teléfono del destinatario"); return; }
    if (!waAccountId) { toast.error("Selecciona la cuenta de WhatsApp"); return; }
    if (!metaTemplateId) { toast.error("Selecciona una plantilla aprobada por Meta"); return; }
    const tpl = (metaTemplates || []).find((t) => t.id === metaTemplateId);
    try {
      const { error } = await supabase.functions.invoke("whatsapp-send-message", {
        body: {
          business_phone_number_id: waAccountId,
          to: telefonoDestino,
          type: "template",
          template: { name: tpl?.name, language: tpl?.language || "es_MX" },
          company_id: factura?.empresa_id,
          contact_id: contactoSel?.id || null,
          documento_id: factura?.id,
        },
      });
      if (error) throw error;
      await registrarActividad("whatsapp", `WhatsApp API · plantilla "${tpl?.name}" a ${telefonoDestino}. ${docsResumen()}`);
      toast.success("Mensaje enviado por API");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Error al enviar: ${e?.message || e}`);
    }
  };

  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [generandoEnlaces, setGenerandoEnlaces] = useState(false);
  const [editandoContacto, setEditandoContacto] = useState(false);

  /** Genera/garantiza los PDFs y devuelve enlaces firmados con validez de 7 días. */
  async function prepararEnlaces(): Promise<{ label: string; url: string }[]> {
    if (!factura) return [];
    const enlaces: { label: string; url: string }[] = [];
    const expiraSeg = 60 * 60 * 24 * 7; // 7 días
    setGenerandoEnlaces(true);
    try {
      // Estado de cuenta: generar siempre que esté seleccionado
      if (incEstadoCuenta && factura.empresa_id) {
        try {
          const { blob, fileName } = await generateCompanyCreditoCobranzaPdfArtifact(factura.empresa_id);
          const safeName = fileName.replace(/[^A-Za-z0-9.:_-]+/g, "_");
          const key = `cobranza-estados-cuenta/${factura.empresa_id}/${Date.now()}-${safeName}`;
          const up = await supabase.storage
            .from("document-files")
            .upload(key, blob, { contentType: "application/pdf", upsert: false });
          if (up.error) throw up.error;
          const { data: signed, error: serr } = await supabase.storage
            .from("document-files")
            .createSignedUrl(key, expiraSeg);
          if (serr) throw serr;
          if (signed?.signedUrl) enlaces.push({ label: "Estado de cuenta", url: signed.signedUrl });
        } catch (e: any) {
          console.error("[prepararEnlaces] estado de cuenta", e);
          toast.error("No se pudo generar el estado de cuenta: " + (e?.message || e));
        }
      }

      // Las facturas NO se envían como PDF: solo se muestran sus datos (número, fecha, total)
      // en el cuerpo del mensaje/correo. No generamos enlaces firmados para ellas.
    } finally {
      setGenerandoEnlaces(false);
    }
    return enlaces;
  }

  const enviarEmail = async () => {
    if (!emailTo.trim()) { toast.error("Falta el correo destinatario"); return; }
    if (!emailSubject.trim()) { toast.error("Falta el asunto"); return; }
    setEnviandoEmail(true);
    try {
      const enlaces = await prepararEnlaces();
      const fmtFecha = (f: string | null | undefined) =>
        f ? new Date(f).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

      // Obtener fecha de factura (fecha_documento) para la factura principal y las otras
      let fechaDocPrincipal: string | null = null;
      const otrasIds = otrasIncluidas.map((f: any) => f.id).filter(Boolean);
      const idsToFetch = [factura.id, ...otrasIds];
      const fechaDocMap: Record<string, string | null> = {};
      if (idsToFetch.length > 0) {
        const { data: docs } = await supabase
          .from("documentos")
          .select("id, fecha_documento")
          .in("id", idsToFetch);
        (docs || []).forEach((d: any) => { fechaDocMap[d.id] = d.fecha_documento; });
        fechaDocPrincipal = fechaDocMap[factura.id] ?? null;
      }

      const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
      const lineaFactura = (numero: string, fechaDoc: string | null, fechaVenc: string | null, total: number) =>
        `Factura ${numero} — Fecha: ${fmtFecha(fechaDoc)} — Vence: ${fmtFecha(fechaVenc)} — Total: ${fmtMoney(total)}`;

      const lineas: string[] = [];
      if (incEstaFactura) {
        lineas.push(lineaFactura(factura.numero_factura || "", fechaDocPrincipal, factura.fecha_vencimiento, Number(factura.total || 0)));
      }
      otrasIncluidas.forEach((f: any) => {
        lineas.push(lineaFactura(f.numero_factura || "", fechaDocMap[f.id] ?? null, f.fecha_vencimiento, Number(f.total || 0)));
      });

      const facturasHtml = lineas.length
        ? lineas.map((l) => `<p style="margin:4px 0;">${esc(l)}</p>`).join("")
        : "";
      const enlacesHtml = enlaces.length
        ? enlaces.map((e) => `<p style="margin:4px 0;"><a href="${e.url}">${esc(e.label)}</a></p>`).join("")
        : "";

      const bodyHtml = (emailBody || "").trim()
        ? `<div>${esc(emailBody).replace(/\n/g, "<br/>")}</div>`
        : "";

      const cuerpoHtml = [bodyHtml, facturasHtml, enlacesHtml].filter(Boolean).join("");

      const textoLineas = [
        emailBody || "",
        lineas.join("\n"),
        enlaces.map((e) => `${e.label}: ${e.url}`).join("\n"),
      ].filter((s) => s && s.trim().length > 0).join("\n\n");

      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: emailTo.trim(),
          cc: emailCc.trim() || undefined,
          subject: emailSubject,
          html: cuerpoHtml,
          text: textoLineas,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await registrarActividad(
        "email",
        `Email enviado a ${emailTo}${emailCc ? ` (cc: ${emailCc})` : ""}. Asunto: "${emailSubject}". ${docsResumen()}`,
      );
      toast.success(`Correo enviado correctamente a ${emailTo}`);
      onOpenChange(false);
    } catch (e: any) {
      console.error("Error enviando email:", e);
      toast.error("Error al enviar: " + (e?.message || "Verifica la configuración de Resend"));
    } finally {
      setEnviandoEmail(false);
    }
  };

  if (!factura) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4 border-b shrink-0">
          <DialogTitle className="text-lg font-semibold tracking-tight">
            Comunicación de cobranza
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground font-light">
            {empresaNombre ? <>{empresaNombre} · </> : null}
            Factura <span className="font-mono">{factura.numero_factura || factura.id.slice(0, 8)}</span> · Saldo {fmtMoney(Number(factura.saldo_pendiente_cobranza || 0))}
          </DialogDescription>
          {factura.empresa_id && (
            <a
              href={`/directory?tab=companies&select=${factura.empresa_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1 w-fit"
            >
              <ExternalLink className="h-3 w-3" /> Ver perfil de empresa
            </a>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="whatsapp"><MessageCircle className="h-4 w-4 mr-1.5 text-green-600" /> WhatsApp</TabsTrigger>
              <TabsTrigger value="email"><Mail className="h-4 w-4 mr-1.5 text-blue-600" /> Correo electrónico</TabsTrigger>
            </TabsList>

            {/* ============ WHATSAPP ============ */}
            <TabsContent value="whatsapp" className="space-y-5 mt-0">
              <section className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Método de envío</Label>
                <RadioGroup value={waMetodo} onValueChange={(v) => setWaMetodo(v as any)} className="grid sm:grid-cols-2 gap-2">
                  <label className="flex items-start gap-2 border rounded-md p-3 cursor-pointer hover:bg-muted/40">
                    <RadioGroupItem value="local" className="mt-0.5" />
                    <div className="text-sm font-light">
                      <div className="font-medium">Abrir en WhatsApp local</div>
                      <div className="text-xs text-muted-foreground">Genera link wa.me y abre el navegador</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 border rounded-md p-3 cursor-pointer hover:bg-muted/40">
                    <RadioGroupItem value="api" className="mt-0.5" />
                    <div className="text-sm font-light">
                      <div className="font-medium">Enviar por API (Business)</div>
                      <div className="text-xs text-muted-foreground">Envía desde el número oficial</div>
                    </div>
                  </label>
                </RadioGroup>
              </section>

              <ContactoSelector
                contactos={contactos || []}
                contactoId={contactoId}
                onChange={setContactoId}
                modo="phone"
                telefonoManual={telefonoManual}
                setTelefonoManual={setTelefonoManual}
                empresaId={factura.empresa_id}
                onContactCreated={(id) => {
                  setContactoId(id);
                  queryClient.invalidateQueries({ queryKey: ["cobranza-comm-contactos", factura.empresa_id] });
                }}
                onEditContacto={() => setEditandoContacto(true)}
                adHocContacto={adHocContacto}
                onAdHocContacto={(c) => {
                  setAdHocContacto(c);
                  if (c?.phone) setTelefonoManual(c.phone);
                }}
              />

              <DocumentosSection
                factura={factura}
                otrasFacturas={otrasFacturas || []}
                incEstadoCuenta={incEstadoCuenta} setIncEstadoCuenta={setIncEstadoCuenta}
                incEstaFactura={incEstaFactura} setIncEstaFactura={setIncEstaFactura}
                incOtras={incOtras} setIncOtras={setIncOtras}
                otrasOpen={otrasOpen} setOtrasOpen={setOtrasOpen}
                otrasSel={otrasSel} setOtrasSel={setOtrasSel}
              />

              <section className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Plantilla</Label>
                <Select value={waTemplateId} onValueChange={onSelectWaTemplate}>
                  <SelectTrigger className="h-9 font-light"><SelectValue placeholder="Selecciona plantilla (opcional)" /></SelectTrigger>
                  <SelectContent>
                    {(waTemplates || []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                    {(waTemplates || []).length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">Sin plantillas</div>}
                  </SelectContent>
                </Select>
                <Textarea
                  value={waMsg}
                  onChange={(e) => setWaMsg(e.target.value)}
                  placeholder="Escribe el mensaje…"
                  className="min-h-[140px] font-light"
                />
              </section>

              {waMetodo === "api" && (
                <section className="space-y-2 border-t pt-4">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cuenta de envío</Label>
                  <Select value={waAccountId} onValueChange={setWaAccountId}>
                    <SelectTrigger className="h-9 font-light"><SelectValue placeholder="Selecciona cuenta" /></SelectTrigger>
                    <SelectContent>
                      {(waAccounts || []).map((a) => (
                        <SelectItem key={a.business_phone_number_id} value={a.business_phone_number_id}>
                          {a.label} {a.display_phone ? `· ${a.display_phone}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Plantilla Meta (aprobada)</Label>
                  <Select value={metaTemplateId} onValueChange={setMetaTemplateId}>
                    <SelectTrigger className="h-9 font-light"><SelectValue placeholder="Selecciona plantilla" /></SelectTrigger>
                    <SelectContent>
                      {(metaTemplates || [])
                        .filter((t) => !waAccountId || !t.business_phone_number_id || t.business_phone_number_id === waAccountId)
                        .map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name} <Badge variant="outline" className="ml-2 text-[10px]">{t.language}</Badge></SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </section>
              )}
            </TabsContent>

            {/* ============ EMAIL ============ */}
            <TabsContent value="email" className="space-y-5 mt-0">
              <ContactoSelector
                contactos={contactos || []}
                contactoId={contactoId}
                onChange={setContactoId}
                modo="email"
                empresaId={factura.empresa_id}
                onContactCreated={(id) => {
                  setContactoId(id);
                  queryClient.invalidateQueries({ queryKey: ["cobranza-comm-contactos", factura.empresa_id] });
                }}
                onEditContacto={() => setEditandoContacto(true)}
                adHocContacto={adHocContacto}
                onAdHocContacto={(c) => {
                  setAdHocContacto(c);
                  if (c?.email) setEmailTo(c.email);
                }}
              />
              <section className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Para</Label>
                  <Input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} className="h-9 font-light" placeholder="cliente@correo.com" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">CC (opcional)</Label>
                  <Input value={emailCc} onChange={(e) => setEmailCc(e.target.value)} className="h-9 font-light" placeholder="cc@correo.com" />
                </div>
              </section>

              <DocumentosSection
                factura={factura}
                otrasFacturas={otrasFacturas || []}
                incEstadoCuenta={incEstadoCuenta} setIncEstadoCuenta={setIncEstadoCuenta}
                incEstaFactura={incEstaFactura} setIncEstaFactura={setIncEstaFactura}
                incOtras={incOtras} setIncOtras={setIncOtras}
                otrasOpen={otrasOpen} setOtrasOpen={setOtrasOpen}
                otrasSel={otrasSel} setOtrasSel={setOtrasSel}
              />

              <section className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Plantilla</Label>
                <Select value={emailTemplateId} onValueChange={onSelectEmailTemplate}>
                  <SelectTrigger className="h-9 font-light"><SelectValue placeholder="Selecciona plantilla (opcional)" /></SelectTrigger>
                  <SelectContent>
                    {(emailTemplates || []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                    {(emailTemplates || []).length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">Sin plantillas</div>}
                  </SelectContent>
                </Select>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Asunto</Label>
                  <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="h-9 font-light" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cuerpo</Label>
                  <Textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} className="min-h-[180px] font-light" />
                </div>
              </section>
            </TabsContent>
          </Tabs>
        </div>

        <div className="border-t bg-muted/30 px-5 py-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {tab === "whatsapp" && waMetodo === "local" && (
            <Button onClick={enviarWaLocal} disabled={generandoEnlaces} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <ExternalLink className="h-4 w-4 mr-1.5" /> {generandoEnlaces ? "Generando…" : "Abrir WhatsApp"}
            </Button>
          )}
          {tab === "whatsapp" && waMetodo === "api" && (
            <Button onClick={enviarWaApi} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Send className="h-4 w-4 mr-1.5" /> Enviar por API
            </Button>
          )}
          {tab === "email" && (
            <Button onClick={enviarEmail} disabled={enviandoEmail || generandoEnlaces}>
              <Mail className="h-4 w-4 mr-1.5" /> {enviandoEmail || generandoEnlaces ? "Enviando…" : "Enviar correo"}
            </Button>
          )}
        </div>
      </DialogContent>
      {editandoContacto && contactoSel && (
        <ContactFormDialog
          open={editandoContacto}
          onOpenChange={setEditandoContacto}
          editData={{
            id: contactoSel.id,
            first_name: contactoSel.first_name || "",
            last_name: contactoSel.last_name || "",
            email: contactoSel.email || null,
            email2: contactoSel.email2 || null,
            phone: contactoSel.phone || null,
            mobile: contactoSel.mobile || null,
            whatsapp_phone: contactoSel.whatsapp_phone || null,
            job_title: null,
            department: null,
            company_id: factura.empresa_id,
            notes: null,
          } as ContactEditData}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["cobranza-comm-contactos", factura.empresa_id] });
            setEditandoContacto(false);
          }}
        />
      )}
    </Dialog>
  );
}

// ============================================================
function ContactoSelector({
  contactos, contactoId, onChange, modo, telefonoManual, setTelefonoManual,
  empresaId, onContactCreated, onEditContacto, adHocContacto, onAdHocContacto,
}: {
  contactos: any[];
  contactoId: string;
  onChange: (id: string) => void;
  modo: "phone" | "email";
  telefonoManual?: string;
  setTelefonoManual?: (v: string) => void;
  empresaId?: string;
  onContactCreated?: (id: string) => void;
  onEditContacto?: () => void;
  adHocContacto?: { nombre: string; phone: string; email: string } | null;
  onAdHocContacto?: (c: { nombre: string; phone: string; email: string } | null) => void;
}) {
  const sel = contactos.find((c) => c.id === contactoId);
  const phone = sel?.whatsapp_phone || sel?.mobile || sel?.phone || "";
  const email = sel?.email || "";
  const nombreCompleto = sel ? `${sel.first_name || ""} ${sel.last_name || ""}`.trim() : "";

  const [modoVista, setModoVista] = useState<"ver" | "cambiar" | "nuevo">("ver");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTel, setNuevoTel] = useState("");
  const [nuevoWa, setNuevoWa] = useState("");
  const [nuevoEmail, setNuevoEmail] = useState("");
  const [persistir, setPersistir] = useState<"empresa" | "ad_hoc">("empresa");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (sel && !adHocContacto) setModoVista((m) => (m === "nuevo" ? "ver" : m));
  }, [sel?.id, adHocContacto]);

  const guardarNuevo = async () => {
    if (!nuevoNombre.trim()) { toast.error("Ingresa el nombre"); return; }
    // Solo esta ocasión: NO se guarda en la base de datos
    if (persistir === "ad_hoc") {
      onAdHocContacto?.({
        nombre: nuevoNombre.trim(),
        phone: (nuevoWa.trim() || nuevoTel.trim()),
        email: nuevoEmail.trim(),
      });
      toast.success("Contacto temporal listo (solo este envío)");
      setNuevoNombre(""); setNuevoTel(""); setNuevoWa(""); setNuevoEmail("");
      setModoVista("ver");
      return;
    }
    if (!empresaId) { toast.error("Falta empresa"); return; }
    setGuardando(true);
    const parts = nuevoNombre.trim().split(/\s+/);
    const first_name = parts[0];
    const last_name = parts.slice(1).join(" ");
    const { data, error } = await supabase.from("contacts").insert({
      first_name,
      last_name,
      phone: nuevoTel || null,
      mobile: nuevoTel || null,
      whatsapp_phone: nuevoWa || null,
      email: nuevoEmail || null,
      company_id: empresaId,
      is_active: true,
    }).select().single();
    setGuardando(false);
    if (error) { toast.error(`Error al crear contacto: ${error.message}`); return; }
    toast.success("Contacto creado correctamente");
    setNuevoNombre(""); setNuevoTel(""); setNuevoWa(""); setNuevoEmail("");
    onAdHocContacto?.(null);
    onContactCreated?.(data.id);
    setModoVista("ver");
  };

  return (
    <section className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Contacto destinatario</Label>

      {/* Card del contacto temporal (ad hoc) */}
      {modoVista === "ver" && adHocContacto && (
        <div className="border border-amber-300 rounded-md p-3 bg-amber-50 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-medium flex items-center gap-2">
              {adHocContacto.nombre || "(sin nombre)"}
              <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700">Solo este envío</Badge>
            </div>
            <div className="flex gap-1">
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs"
                onClick={() => { onAdHocContacto?.(null); setModoVista("ver"); }}>
                <X className="h-3 w-3 mr-1" /> Quitar
              </Button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            {adHocContacto.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {adHocContacto.phone}</div>}
            {adHocContacto.email && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> {adHocContacto.email}</div>}
            <div className="italic text-amber-700">No se agregará al directorio de la empresa.</div>
          </div>
        </div>
      )}

      {/* Card del contacto seleccionado */}
      {modoVista === "ver" && sel && !adHocContacto && (
        <div className="border rounded-md p-3 bg-muted/20 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-medium">{nombreCompleto || "(sin nombre)"}</div>
            <div className="flex gap-1">
              {sel && onEditContacto && (
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onEditContacto}>
                  <Pencil className="h-3 w-3 mr-1" /> Editar
                </Button>
              )}
              {contactos.length > 1 && (
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setModoVista("cambiar")}>
                  <ExternalLink className="h-3 w-3 mr-1" /> Cambiar
                </Button>
              )}
              {empresaId && (
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setModoVista("nuevo")}>
                  <UserPlus className="h-3 w-3 mr-1" /> Nuevo contacto
                </Button>
              )}
            </div>
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            {phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {phone}</div>}
            {email && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> {email}</div>}
            {!phone && !email && <div className="italic">Sin datos de contacto</div>}
          </div>
        </div>
      )}

      {/* Sin contactos: ofrece crear */}
      {modoVista === "ver" && !sel && !adHocContacto && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-300 rounded-md px-3 py-2 flex items-center justify-between gap-2">
          <span>Esta empresa no tiene contactos activos registrados.</span>
          {empresaId && (
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setModoVista("nuevo")}>
              <UserPlus className="h-3 w-3 mr-1" /> Nuevo contacto
            </Button>
          )}
        </div>
      )}

      {/* Modo cambiar */}
      {modoVista === "cambiar" && (
        <div className="space-y-2">
          <Select value={contactoId} onValueChange={(v) => { onChange(v); setModoVista("ver"); }}>
            <SelectTrigger className="h-9 font-light"><SelectValue placeholder="Selecciona contacto" /></SelectTrigger>
            <SelectContent>
              {contactos.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {(`${c.first_name || ""} ${c.last_name || ""}`).trim() || "(sin nombre)"} —{" "}
                  <span className="text-muted-foreground">
                    {modo === "phone" ? (c.whatsapp_phone || c.mobile || c.phone || "sin teléfono") : (c.email || "sin email")}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setModoVista("ver")}>
            <X className="h-3 w-3 mr-1" /> Cancelar
          </Button>
        </div>
      )}

      {/* Modo nuevo */}
      {modoVista === "nuevo" && (
        <div className="border rounded-md p-3 space-y-2 bg-muted/10">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nuevo contacto</div>
          <Input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="Nombre completo" className="h-9 font-light" />
          {modo === "phone" ? (
            <>
              <Input value={nuevoWa} onChange={(e) => setNuevoWa(e.target.value)} placeholder="WhatsApp (ej. +52 871 123 4567)" className="h-9 font-light" />
              <Input value={nuevoTel} onChange={(e) => setNuevoTel(e.target.value)} placeholder="Teléfono (opcional)" className="h-9 font-light" />
              <Input value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)} placeholder="Email (opcional)" className="h-9 font-light" />
            </>
          ) : (
            <>
              <Input value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)} placeholder="Email" className="h-9 font-light" />
              <Input value={nuevoWa} onChange={(e) => setNuevoWa(e.target.value)} placeholder="WhatsApp (opcional)" className="h-9 font-light" />
              <Input value={nuevoTel} onChange={(e) => setNuevoTel(e.target.value)} placeholder="Teléfono (opcional)" className="h-9 font-light" />
            </>
          )}
          <RadioGroup value={persistir} onValueChange={(v) => setPersistir(v as any)} className="grid sm:grid-cols-2 gap-2 pt-1">
            <label className="flex items-start gap-2 border rounded-md p-2 cursor-pointer hover:bg-muted/40">
              <RadioGroupItem value="empresa" className="mt-0.5" />
              <div className="text-xs font-light">
                <div className="font-medium">Agregar a la empresa</div>
                <div className="text-[11px] text-muted-foreground">Queda registrado en el directorio para usos futuros.</div>
              </div>
            </label>
            <label className="flex items-start gap-2 border rounded-md p-2 cursor-pointer hover:bg-muted/40">
              <RadioGroupItem value="ad_hoc" className="mt-0.5" />
              <div className="text-xs font-light">
                <div className="font-medium">Solo para esta ocasión</div>
                <div className="text-[11px] text-muted-foreground">Se usa solo en este envío y no se guarda.</div>
              </div>
            </label>
          </RadioGroup>
          <div className="flex gap-2 justify-end">
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setModoVista("ver")} disabled={guardando}>
              <X className="h-3 w-3 mr-1" /> Cancelar
            </Button>
            <Button type="button" size="sm" className="h-7 px-3 text-xs" onClick={guardarNuevo} disabled={guardando}>
              {guardando ? "Guardando…" : persistir === "ad_hoc" ? "Usar solo este envío" : "Guardar en empresa"}
            </Button>
          </div>
        </div>
      )}

      {modo === "phone" && sel && !phone && setTelefonoManual && modoVista === "ver" && (
        <div className="space-y-1.5">
          <div className="text-xs text-amber-700">Este contacto no tiene teléfono. Ingrésalo manualmente:</div>
          <Input
            value={telefonoManual || ""}
            onChange={(e) => setTelefonoManual(e.target.value)}
            placeholder="55 1234 5678"
            className="h-9 font-light"
          />
        </div>
      )}
      {modo === "email" && sel && !email && modoVista === "ver" && (
        <div className="text-xs text-amber-700">Este contacto no tiene correo. Edita el campo "Para" abajo.</div>
      )}
    </section>
  );
}

function DocumentosSection({
  factura, otrasFacturas,
  incEstadoCuenta, setIncEstadoCuenta,
  incEstaFactura, setIncEstaFactura,
  incOtras, setIncOtras,
  otrasOpen, setOtrasOpen,
  otrasSel, setOtrasSel,
}: {
  factura: FacturaLite;
  otrasFacturas: any[];
  incEstadoCuenta: boolean; setIncEstadoCuenta: (v: boolean) => void;
  incEstaFactura: boolean; setIncEstaFactura: (v: boolean) => void;
  incOtras: boolean; setIncOtras: (v: boolean) => void;
  otrasOpen: boolean; setOtrasOpen: (v: boolean) => void;
  otrasSel: Record<string, boolean>; setOtrasSel: (v: Record<string, boolean>) => void;
}) {
  return (
    <section className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Documentos a incluir</Label>
      <div className="space-y-2 border rounded-md p-3">
        <label className="flex items-start gap-2 cursor-pointer">
          <Checkbox checked={incEstadoCuenta} onCheckedChange={(v) => setIncEstadoCuenta(!!v)} className="mt-0.5" />
          <div className="text-sm font-light">
            <div className="font-medium flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Estado de cuenta</div>
            <div className="text-xs text-muted-foreground">El PDF se generará y se enviará como adjunto.</div>
          </div>
        </label>
        <label className="flex items-start gap-2 cursor-pointer">
          <Checkbox checked={incEstaFactura} onCheckedChange={(v) => setIncEstaFactura(!!v)} className="mt-0.5" />
          <div className="text-sm font-light">
            <div className="font-medium">Esta factura (solo datos)</div>
            <div className="text-xs text-muted-foreground">
              {factura.numero_factura || factura.id.slice(0, 8)} · Total {fmtMoney(Number(factura.total || 0))} · vence {factura.fecha_vencimiento || "—"}
            </div>
            <div className="text-[11px] text-muted-foreground italic">Se incluye número, fecha y total (no se envía PDF).</div>
          </div>
        </label>
        <div>
          <label className="flex items-start gap-2 cursor-pointer">
            <Checkbox checked={incOtras} onCheckedChange={(v) => setIncOtras(!!v)} className="mt-0.5" />
            <div className="text-sm font-light flex-1">
              <div className="font-medium flex items-center justify-between">
                <span>Otras facturas pendientes ({otrasFacturas.length}) — solo datos</span>
                {otrasFacturas.length > 0 && (
                  <button type="button" onClick={(e) => { e.preventDefault(); setOtrasOpen(!otrasOpen); }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    {otrasOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {otrasOpen ? "Ocultar" : "Ver lista"}
                  </button>
                )}
              </div>
            </div>
          </label>
          {incOtras && otrasOpen && otrasFacturas.length > 0 && (
            <div className="mt-2 ml-6 max-h-40 overflow-y-auto border rounded-md divide-y">
              {otrasFacturas.map((f) => (
                <label key={f.id} className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-muted/40">
                  <Checkbox checked={!!otrasSel[f.id]} onCheckedChange={(v) => setOtrasSel({ ...otrasSel, [f.id]: !!v })} />
                  <span className="font-mono">{f.numero_factura || f.id.slice(0, 8)}</span>
                  <span className="text-muted-foreground">vence {f.fecha_vencimiento || "—"}</span>
                  <span className="ml-auto font-medium">{fmtMoney(Number(f.saldo_pendiente_cobranza || 0))}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

const fmtMoneyHelper = fmtMoney; // re-export to avoid TS unused warnings
export default CobranzaComunicacionDialog;