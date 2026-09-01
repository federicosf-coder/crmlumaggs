import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DictationButton } from "@/components/ui/dictation-button";
import {
  Loader2, Phone, Copy, Mail, UserPlus, Save, Send as SendIcon, Paperclip,
  FileText, X, MessageCircle, MapPin, Crosshair, Send, Plus,
} from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { TaskTypeKey } from "@/lib/taskTypes";
import { normalizePhoneForWhatsApp, openWhatsApp, logWhatsAppActivity } from "@/lib/whatsapp";
import { WhatsAppActionDialog } from "@/components/whatsapp/WhatsAppActionDialog";

interface TaskActionFieldsProps {
  taskType: TaskTypeKey | null;
  taskId?: string | null;
  contactId: string | null;
  companyId: string | null;
  description: string;
  setDescription: (v: string) => void;
  /** Llamado tras una acción de envío (email enviado, WA enviado, etc.) para que el padre marque la tarea como completada. */
  onSent?: (logLine: string) => void;
  /** Opciones de contacto para el selector inline (label/value). */
  contactOptions?: Array<{ label: string; value: string }>;
  /** Cambiar contacto vinculado desde el bloque de email/whatsapp. */
  onContactChange?: (contactId: string | null) => void;
  /** Abrir el diálogo para crear un nuevo contacto. */
  onOpenNewContact?: () => void;
}

export function TaskActionFields({
  taskType, taskId, contactId, companyId, description, setDescription, onSent,
  contactOptions, onContactChange, onOpenNewContact,
}: TaskActionFieldsProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const userEmail = session?.user?.email || "";

  const isWhatsApp = taskType === "whatsapp";
  const isVisit = taskType === "field_visit";
  const isEmail = taskType === "email";
  const isCall = taskType === "call";

  // ===== Email state =====
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailBcc, setEmailBcc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [savingContactEmail, setSavingContactEmail] = useState(false);
  const [attachedDocs, setAttachedDocs] = useState<Array<{ id: string; label: string; url: string }>>([]);
  const [attachOpen, setAttachOpen] = useState(false);

  // ===== Call state =====
  const [callPhone, setCallPhone] = useState("");

  // ===== Visit state =====
  const [location, setLocation] = useState("");
  const [locating, setLocating] = useState(false);

  // ===== WhatsApp state =====
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [waPhoneOverride, setWaPhoneOverride] = useState<string>("");

  // Reset al cambiar de tarea
  useEffect(() => {
    setEmailTo(""); setEmailCc(""); setEmailBcc(""); setEmailSubject(""); setEmailBody("");
    setShowCc(false); setShowBcc(false); setAttachedDocs([]); setAttachOpen(false);
    setCallPhone(""); setLocation(""); setWaPhoneOverride("");
  }, [taskId]);

  // ===== Queries =====
  const { data: emailContact, refetch: refetchEmailContact } = useQuery({
    queryKey: ["taskaction-email-ctx", contactId],
    queryFn: async () => {
      if (!contactId) return null;
      const { data } = await supabase
        .from("contacts")
        .select("first_name,last_name,email,comm_email,email2,comm_email2")
        .eq("id", contactId)
        .maybeSingle();
      return data as any;
    },
    enabled: isEmail && !!contactId,
  });
  const contactEmail = emailContact?.email || emailContact?.comm_email || emailContact?.email2 || emailContact?.comm_email2 || "";
  const contactName = emailContact ? `${emailContact.first_name || ""} ${emailContact.last_name || ""}`.trim() : "";

  const { data: callContact } = useQuery({
    queryKey: ["taskaction-call-ctx", contactId],
    queryFn: async () => {
      if (!contactId) return null;
      const { data } = await supabase
        .from("contacts")
        .select("first_name,last_name,phone,mobile,whatsapp_phone,tel_emp,comm_tel,comm_tel_emp")
        .eq("id", contactId)
        .maybeSingle();
      return data as any;
    },
    enabled: isCall && !!contactId,
  });
  const callContactName = callContact ? `${callContact.first_name || ""} ${callContact.last_name || ""}`.trim() : "";
  const callPhoneOptions = callContact
    ? ([
        { label: "Móvil", value: callContact.mobile },
        { label: "Principal", value: callContact.phone },
        { label: "Empresa", value: callContact.tel_emp },
        { label: "WhatsApp", value: callContact.whatsapp_phone },
        { label: "Comunicación", value: callContact.comm_tel },
        { label: "Comm. empresa", value: callContact.comm_tel_emp },
      ].filter((o) => o.value && String(o.value).trim() !== ""))
    : [];
  const callDefaultPhone = callPhoneOptions[0]?.value || "";

  useEffect(() => {
    if (!isCall) return;
    if (callDefaultPhone && !callPhone) setCallPhone(String(callDefaultPhone));
  }, [isCall, callDefaultPhone]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isEmail) return;
    if (contactEmail && !emailTo) setEmailTo(contactEmail);
  }, [isEmail, contactEmail]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: waContext } = useQuery({
    queryKey: ["taskaction-wa-ctx", contactId, companyId],
    queryFn: async () => {
      const [c, co] = await Promise.all([
        contactId
          ? supabase.from("contacts").select("first_name,last_name,phone,mobile,whatsapp_phone").eq("id", contactId).maybeSingle()
          : Promise.resolve({ data: null } as any),
        companyId
          ? supabase.from("companies").select("name,phone").eq("id", companyId).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      return { contact: (c as any).data, company: (co as any).data };
    },
    enabled: isWhatsApp && (!!contactId || !!companyId),
  });
  const waPhone = waContext?.contact?.whatsapp_phone || waContext?.contact?.mobile || waContext?.contact?.phone || waContext?.company?.phone || null;
  const effectiveWaPhone = waPhoneOverride.trim() || waPhone || "";
  const waNormalized = normalizePhoneForWhatsApp(effectiveWaPhone);
  const waContactName = waContext?.contact ? `${waContext.contact.first_name || ""} ${waContext.contact.last_name || ""}`.trim() : "";
  const waCompanyName = waContext?.company?.name || "";

  const { data: companyDocs } = useQuery({
    queryKey: ["taskaction-email-docs", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from("documentos")
        .select("id,tipo_documento,numero_cotizacion,numero_pedido,numero_factura,fecha_documento,total,pdf_url")
        .eq("empresa_id", companyId)
        .eq("is_active", true)
        .not("pdf_url", "is", null)
        .order("fecha_documento", { ascending: false })
        .limit(200);
      return (data || []) as any[];
    },
    enabled: isEmail && attachOpen && !!companyId,
  });

  const docLabel = (d: any) => {
    const tipo = String(d.tipo_documento || "").toUpperCase();
    const num = d.numero_factura || d.numero_pedido || d.numero_cotizacion || d.id?.slice(0, 6);
    const fecha = d.fecha_documento ? format(parseISO(d.fecha_documento), "dd/MM/yyyy") : "";
    return `${tipo} ${num}${fecha ? ` · ${fecha}` : ""}`;
  };

  const toggleAttachDoc = (d: any) => {
    setAttachedDocs((prev) => {
      const exists = prev.find((x) => x.id === d.id);
      if (exists) return prev.filter((x) => x.id !== d.id);
      return [...prev, { id: d.id, label: docLabel(d), url: d.pdf_url }];
    });
  };

  const copyPhone = async () => {
    if (!callPhone) return;
    try { await navigator.clipboard.writeText(callPhone); toast({ title: "Teléfono copiado" }); }
    catch { toast({ title: "No se pudo copiar", variant: "destructive" }); }
  };

  const captureLocation = () => {
    if (!navigator.geolocation) { toast({ title: "Geolocalización no disponible", variant: "destructive" }); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const url = `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
        setLocation(url); setLocating(false);
        setDescription(`📍 Ubicación: ${url}${description ? `\n\n${description.replace(/^📍 Ubicación: \S+\n\n/, "")}` : ""}`);
        toast({ title: "Ubicación capturada" });
      },
      (err) => { setLocating(false); toast({ title: "No se pudo obtener la ubicación", description: err.message, variant: "destructive" }); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const saveEmailToContact = async () => {
    if (!contactId || !emailTo) return;
    setSavingContactEmail(true);
    const { error } = await supabase.from("contacts").update({ email: emailTo }).eq("id", contactId);
    setSavingContactEmail(false);
    if (error) { toast({ title: "No se pudo guardar el correo", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Correo guardado en el contacto" });
    refetchEmailContact();
  };

  const handleSendEmail = async () => {
    if (!session?.user) return;
    if (!emailTo || !emailSubject || !emailBody.trim()) {
      toast({ title: "Faltan datos", description: "Completa Para, Asunto y Mensaje.", variant: "destructive" });
      return;
    }
    setSendingEmail(true);
    const escapedBody = emailBody.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const attachmentsHtml = attachedDocs.length
      ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-family:Arial,sans-serif;font-size:14px;color:#333">
          <div style="font-weight:600;margin-bottom:10px;color:#111">📎 Documentos adjuntos</div>
          <ul style="padding-left:18px;margin:0">
            ${attachedDocs.map((d) => `<li style="margin:4px 0"><a href="${d.url}" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:underline">${d.label.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</a></li>`).join("")}
          </ul>
        </div>`
      : "";
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#333;line-height:1.6;white-space:pre-wrap">${escapedBody}</div>${attachmentsHtml}`;
    const ccList = emailCc.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    const bccList = emailBcc.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    if (userEmail) bccList.push(userEmail);
    try {
      const { data, error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "raw-html",
          recipientEmail: emailTo.trim(),
          idempotencyKey: `crm-email-${session.user.id}-${Date.now()}`,
          subjectOverride: emailSubject,
          htmlOverride: html,
          cc: ccList,
          bcc: bccList,
          replyTo: userEmail || undefined,
          templateData: { __subject: emailSubject, __html: html },
        },
      });
      if (error) throw error;
      if ((data as any)?.success === false) {
        toast({ title: "No enviado", description: (data as any)?.reason || "Suprimido o rechazado", variant: "destructive" });
        setSendingEmail(false);
        return;
      }
      toast({ title: "Correo enviado", description: `Se envió a ${emailTo}` });
      const header = [
        `Para: ${emailTo}`,
        emailCc ? `CC: ${emailCc}` : null,
        emailBcc ? `CCO: ${emailBcc}` : null,
        `Asunto: ${emailSubject}`,
        "[Enviado desde la app]",
      ].filter(Boolean).join("\n");
      setDescription(`${header}\n\n${emailBody}`);
      onSent?.(`Email enviado a ${emailTo}`);
    } catch (e: any) {
      toast({ title: "Error al enviar", description: e?.message || "Intenta de nuevo", variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSendWhatsAppLocal = async () => {
    if (!session?.user) return;
    if (!waNormalized) { toast({ title: "Sin teléfono válido", variant: "destructive" }); return; }
    if (!description.trim()) { toast({ title: "Mensaje vacío", variant: "destructive" }); return; }
    openWhatsApp(waNormalized, description);
    try {
      await logWhatsAppActivity({
        user_id: session.user.id,
        message: description,
        company_id: companyId || null,
        contact_id: contactId || null,
        result: "enviado",
        title: `WhatsApp${waContactName ? ` · ${waContactName}` : waCompanyName ? ` · ${waCompanyName}` : ""}`,
        destinatario_phone: waNormalized,
        message_type: "texto",
        channel: "wa_me",
      });
    } catch (err) { console.warn("[wa] log failed", err); }
    onSent?.(`WhatsApp enviado a +${waNormalized}`);
  };

  if (!isEmail && !isCall && !isWhatsApp && !isVisit) return null;

  return (
    <section className="space-y-3">
      {isCall && (
        <div className="rounded-lg border overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 px-4 py-2.5 border-b flex items-center gap-2">
            <Phone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs uppercase tracking-wide font-semibold text-emerald-900 dark:text-emerald-100">Registro de llamada</span>
          </div>
          <div className="space-y-3 p-4 bg-background">
          {(onContactChange && contactOptions) && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Vincular a Contacto</Label>
              <div className="flex items-center gap-1">
                <div className="flex-1 min-w-0">
                  <SearchableSelect
                    value={contactId || "none"}
                    onValueChange={(v) => onContactChange(v === "none" ? null : v)}
                    options={contactOptions}
                    placeholder="Buscar contacto..."
                    className="font-light text-sm"
                  />
                </div>
                {onOpenNewContact && (
                  <Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0" title="Nuevo contacto" onClick={onOpenNewContact}>
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-12 sm:col-span-6 space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Contacto a llamar</Label>
              <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-background font-light text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{callContactName || "—"}</span>
              </div>
            </div>
            <div className="col-span-12 sm:col-span-6 space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Teléfono usado</Label>
              <div className="flex gap-1">
                {callPhoneOptions.length > 1 ? (
                  <Select value={callPhone} onValueChange={setCallPhone}>
                    <SelectTrigger className="h-9 font-light flex-1 min-w-0"><SelectValue placeholder="Selecciona teléfono" /></SelectTrigger>
                    <SelectContent>
                      {callPhoneOptions.map((o, i) => (
                        <SelectItem key={`${o.label}-${i}`} value={String(o.value)}>
                          <span className="font-light">{o.label}: {o.value}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={callPhone} onChange={(e) => setCallPhone(e.target.value)} placeholder="Captura el teléfono" className="font-light h-9 flex-1 min-w-0" />
                )}
                <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={copyPhone} disabled={!callPhone} title="Copiar"><Copy className="h-4 w-4" /></Button>
                <Button type="button" size="icon" className="h-9 w-9 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white" asChild disabled={!callPhone}>
                  <a href={callPhone ? `tel:${callPhone}` : undefined} title="Llamar"><Phone className="h-4 w-4" /></a>
                </Button>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {isEmail && (
        <div className="rounded-lg border overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-4 py-2.5 border-b flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs uppercase tracking-wide font-semibold text-blue-900 dark:text-blue-100">Redactar correo</span>
          </div>
          <div className="space-y-3 p-4 bg-background">
          {(onContactChange && contactOptions) && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Vincular a Contacto</Label>
              <div className="flex items-center gap-1">
                <div className="flex-1 min-w-0">
                  <SearchableSelect
                    value={contactId || "none"}
                    onValueChange={(v) => onContactChange(v === "none" ? null : v)}
                    options={contactOptions}
                    placeholder="Buscar contacto..."
                    className="font-light text-sm"
                  />
                </div>
                {onOpenNewContact && (
                  <Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0" title="Nuevo contacto" onClick={onOpenNewContact}>
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Para *</Label>
              <div className="flex gap-2 text-[11px]">
                {!showCc && <button type="button" onClick={() => setShowCc(true)} className="text-primary hover:underline">+ CC</button>}
                {!showBcc && <button type="button" onClick={() => setShowBcc(true)} className="text-primary hover:underline">+ CCO</button>}
              </div>
            </div>
            <Input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder={contactId ? (contactEmail || "El contacto no tiene correo — captúralo aquí") : "destinatario@ejemplo.com"} className="font-light h-9" />
            {contactId && emailTo && emailTo !== contactEmail && (
              <Button type="button" variant="outline" size="sm" onClick={saveEmailToContact} disabled={savingContactEmail} className="h-7 text-xs gap-1.5">
                {savingContactEmail ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Guardar correo en {contactName || "el contacto"}
              </Button>
            )}
          </div>
          {showCc && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">CC</Label>
                <button type="button" onClick={() => { setShowCc(false); setEmailCc(""); }} className="text-xs text-muted-foreground hover:text-destructive hover:underline">− CC</button>
              </div>
              <Input value={emailCc} onChange={(e) => setEmailCc(e.target.value)} placeholder="cc@ejemplo.com, otro@ejemplo.com" className="font-light h-9" />
            </div>
          )}
          {showBcc && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">CCO</Label>
                <button type="button" onClick={() => { setShowBcc(false); setEmailBcc(""); }} className="text-xs text-muted-foreground hover:text-destructive hover:underline">− CCO</button>
              </div>
              <Input value={emailBcc} onChange={(e) => setEmailBcc(e.target.value)} placeholder="cco@ejemplo.com" className="font-light h-9" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Asunto *</Label>
            <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Asunto del correo" maxLength={200} className="font-light h-9" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Mensaje</Label>
              <DictationButton currentText={emailBody} onTranscript={setEmailBody} size="sm" className="h-7 px-2 text-xs gap-1" title="Dictar mensaje" />
            </div>
            <Textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={6} maxLength={4000} placeholder="Escribe tu correo..." className="font-light bg-background" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Adjuntos</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => {
                if (!companyId) { toast({ title: "Vincula una empresa", description: "Selecciona una empresa para ver sus documentos.", variant: "destructive" }); return; }
                setAttachOpen((v) => !v);
              }} className="h-7 text-xs gap-1.5">
                <Paperclip className="h-3.5 w-3.5" /> {attachOpen ? "Cerrar lista" : "Seleccionar documento"}
              </Button>
            </div>
            {attachOpen && (
              <div className="border rounded-md p-2 bg-background max-h-44 overflow-y-auto space-y-1">
                {(companyDocs?.length ?? 0) === 0 ? (
                  <p className="text-xs text-muted-foreground font-light">Sin documentos con PDF para esta empresa.</p>
                ) : (
                  companyDocs!.map((d: any) => {
                    const sel = !!attachedDocs.find((x) => x.id === d.id);
                    return (
                      <button key={d.id} type="button" onClick={() => toggleAttachDoc(d)}
                        className={cn("w-full text-left text-xs px-2 py-1 rounded font-light flex items-center gap-2", sel ? "bg-blue-50 text-blue-900" : "hover:bg-muted")}>
                        <FileText className="h-3 w-3 shrink-0" /> {docLabel(d)}
                      </button>
                    );
                  })
                )}
              </div>
            )}
            {attachedDocs.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {attachedDocs.map((d) => (
                  <span key={d.id} className="inline-flex items-center gap-1 rounded-full border bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 text-[11px] text-blue-800 dark:text-blue-200">
                    <FileText className="h-3 w-3" /> {d.label}
                    <button type="button" onClick={() => setAttachedDocs((prev) => prev.filter((x) => x.id !== d.id))} className="ml-0.5 rounded-full hover:bg-blue-200/60 dark:hover:bg-blue-800/40" aria-label="Quitar">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 pt-1 border-t">
            <div className="text-[11px] text-muted-foreground font-light pt-2">
              <span className="font-medium">Responder a:</span> {userEmail || "—"} · Se enviará una copia a tu correo.
            </div>
            <Button type="button" onClick={handleSendEmail} disabled={sendingEmail || !emailTo || !emailSubject || !emailBody.trim()} className="self-end bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
              {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendIcon className="h-4 w-4" />} Enviar Correo
            </Button>
          </div>
          </div>
        </div>
      )}

      {isWhatsApp && (
        <div className="rounded-lg border overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 px-4 py-2.5 border-b flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs uppercase tracking-wide font-semibold text-emerald-900 dark:text-emerald-100">Mensaje de WhatsApp</span>
          </div>
          <div className="space-y-2 p-4 bg-background">
          {(onContactChange && contactOptions) && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Vincular a Contacto</Label>
              <div className="flex items-center gap-1">
                <div className="flex-1 min-w-0">
                  <SearchableSelect
                    value={contactId || "none"}
                    onValueChange={(v) => { onContactChange(v === "none" ? null : v); setWaPhoneOverride(""); }}
                    options={contactOptions}
                    placeholder="Buscar contacto..."
                    className="font-light text-sm"
                  />
                </div>
                {onOpenNewContact && (
                  <Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0" title="Nuevo contacto" onClick={onOpenNewContact}>
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Teléfono WhatsApp</Label>
            <div className="flex items-center gap-2">
              <Input
                value={waPhoneOverride || (waPhone ?? "")}
                onChange={(e) => setWaPhoneOverride(e.target.value)}
                placeholder="Captura o edita el teléfono"
                className="font-light h-9 flex-1"
              />
              {waNormalized && (
                <span className="text-[11px] text-muted-foreground font-light shrink-0">+{waNormalized}</span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground font-light">
              Contacto: {waContactName || waCompanyName || "—"}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Mensaje de WhatsApp</Label>
            <DictationButton currentText={description} onTranscript={setDescription} size="sm" className="h-7 px-2 text-xs gap-1" />
          </div>
          <div className="rounded-lg border bg-[#e7f6d5] dark:bg-emerald-900/20 p-2">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} maxLength={4000}
              placeholder="Escribe el mensaje que enviarás por WhatsApp..."
              className="font-light bg-white/70 dark:bg-background/40 border-0 focus-visible:ring-1" />
            <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-muted-foreground font-light">
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                Para: {waContactName || waCompanyName || "—"}
                {waNormalized ? ` · +${waNormalized}` : " · sin teléfono"}
              </span>
              <span>{description.length}/4000</span>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" size="sm" variant="secondary" onClick={() => setWhatsappOpen(true)} disabled={!description.trim()}>
              <Send className="h-4 w-4 mr-1" /> Enviar por API
            </Button>
            <Button type="button" size="sm" onClick={handleSendWhatsAppLocal} disabled={!description.trim() || !waNormalized} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <MessageCircle className="h-4 w-4 mr-1" /> Enviar Local
            </Button>
          </div>
          <WhatsAppActionDialog
            open={whatsappOpen}
            onOpenChange={setWhatsappOpen}
            phone={waNormalized}
            variables={{} as any}
            defaultMessage={description}
            context={{ contact_id: contactId, company_id: companyId }}
            onSent={() => onSent?.(`WhatsApp enviado (API) a +${waNormalized}`)}
          />
          </div>
        </div>
      )}

      {isVisit && (
        <div className="rounded-lg border overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 px-4 py-2.5 border-b flex items-center gap-2">
            <MapPin className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs uppercase tracking-wide font-semibold text-amber-900 dark:text-amber-100">Ubicación de la visita</span>
          </div>
          <div className="space-y-2 p-4 bg-background">
          <div className="flex gap-2">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Dirección, referencia o link de Google Maps" className="flex-1 text-base font-light" />
            <Button type="button" variant="outline" onClick={captureLocation} disabled={locating} className="shrink-0 gap-1.5">
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
              <span className="hidden sm:inline text-xs">Mi ubicación</span>
            </Button>
          </div>
          {location && location.startsWith("http") && (
            <a href={location} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-light">
              <MapPin className="h-3 w-3" /> Abrir en mapa
            </a>
          )}

          <div className="pt-3 mt-1 border-t space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Evidencia fotográfica</Label>
            {taskId ? (
              <VisitaEvidencias taskId={taskId} />
            ) : (
              <p className="text-[11px] text-muted-foreground font-light">
                Guarda la visita para poder subir imágenes de evidencia.
              </p>
            )}
          </div>
          </div>

        </div>
      )}
    </section>
  );
}
