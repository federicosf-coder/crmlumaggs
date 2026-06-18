import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Copy, Send, MessageCircle, AlertTriangle, Paperclip, Eye, Download, Link2 } from "lucide-react";
import {
  WhatsAppMessageTemplate, WhatsAppTemplateType, WhatsAppVariables,
  copyMessage, logWhatsAppActivity, normalizePhoneForWhatsApp, openWhatsApp, renderTemplate,
} from "@/lib/whatsapp";
import { getAttachmentPublicUrl, isImageMime, listTemplateAttachments } from "@/lib/templates";
import { Badge } from "@/components/ui/badge";
import { useResolvedTemplate } from "@/hooks/useResolvedTemplate";
import { TemplatePickerDialog, WaPickerTemplate } from "@/components/whatsapp/TemplatePickerDialog";
import { Input } from "@/components/ui/input";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  phone?: string | null;
  variables: WhatsAppVariables;
  templateType?: WhatsAppTemplateType;
  defaultMessage?: string;
  context: { company_id?: string | null; contact_id?: string | null };
  onSent?: () => void;
  /** Optional: id from public.templates to load saved attachments. */
  templateId?: string | null;
}

export function WhatsAppActionDialog({
  open, onOpenChange, phone, variables, templateType, defaultMessage, context, onSent, templateId,
}: Props) {
  const { user } = useAuth();
  const [selectedTplId, setSelectedTplId] = useState<string>("custom");
  const [message, setMessage] = useState<string>(defaultMessage || "");

  // ─── Envío por API mediante plantilla aprobada (Meta Cloud) ───
  const [tplPickerOpen, setTplPickerOpen] = useState(false);
  const [pickedTpl, setPickedTpl] = useState<{ id: string; name: string; language: string | null; body: string | null; business_phone_number_id: string | null } | null>(null);
  const [tplVars, setTplVars] = useState<string[]>([]);
  const [sendingApi, setSendingApi] = useState(false);

  const { data: metaTemplates = [] } = useQuery({
    queryKey: ["wa-meta-templates-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates" as any)
        .select("id,name,language,status,category,body,business_phone_number_id")
        .eq("status", "APPROVED");
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: open,
  });

  const pickerTemplates: WaPickerTemplate[] = useMemo(
    () => metaTemplates.map((t: any) => ({
      id: t.id, name: t.name, language: t.language, category: t.category, status: t.status, body: t.body,
    })),
    [metaTemplates]
  );

  const expectedVars = useMemo(() => {
    const body = pickedTpl?.body || "";
    const matches = body.match(/\{\{\s*(\d+)\s*\}\}/g) || [];
    let max = 0;
    for (const m of matches) {
      const n = parseInt(m.replace(/[^\d]/g, ""), 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
    return max;
  }, [pickedTpl]);

  const { data: templates } = useQuery({
    queryKey: ["whatsapp-msg-templates", templateType],
    queryFn: async () => {
      let q = supabase.from("whatsapp_message_templates" as any)
        .select("id,nombre,tipo,mensaje,meta_template_id,activo,orden")
        .eq("activo", true).order("orden");
      if (templateType) q = q.eq("tipo", templateType);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as WhatsAppMessageTemplate[];
    },
    enabled: open,
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ["template-attachments", templateId],
    queryFn: () => (templateId ? listTemplateAttachments(templateId) : Promise.resolve([])),
    enabled: open && !!templateId,
  });

  const selectedTpl = templates?.find(t => t.id === selectedTplId);
  const rawTplBody = selectedTpl?.mensaje || "";
  const { data: resolvedTpl } = useResolvedTemplate({
    body: rawTplBody,
    contactoId: context.contact_id ?? undefined,
    enabled: open && !!rawTplBody,
  });

  useEffect(() => {
    if (!open || selectedTplId === "custom") return;
    if (!resolvedTpl?.resolvedBody) return;
    setMessage(renderTemplate(resolvedTpl.resolvedBody, variables));
  }, [resolvedTpl?.resolvedBody, selectedTplId, open]); // eslint-disable-line

  const [includeLinks, setIncludeLinks] = useState(true);

  const messageWithLinks = useMemo(() => {
    if (!includeLinks || attachments.length === 0) return message;
    const links = attachments.map(a => `• ${a.file_name}: ${getAttachmentPublicUrl(a.file_path)}`).join("\n");
    return `${message}\n\n📎 Archivos adjuntos:\n${links}`;
  }, [message, attachments, includeLinks]);

  useEffect(() => {
    if (!open) return;
    if (defaultMessage) { setMessage(defaultMessage); return; }
    const first = templates?.[0];
    if (first) {
      setSelectedTplId(first.id);
      setMessage(renderTemplate(first.mensaje, variables));
    }
  }, [open, templates, defaultMessage]); // eslint-disable-line

  const normalized = useMemo(() => normalizePhoneForWhatsApp(phone), [phone]);

  const handleSelectTemplate = (id: string) => {
    setSelectedTplId(id);
    if (id === "custom") return;
    const tpl = templates?.find(t => t.id === id);
    if (tpl) setMessage(renderTemplate(tpl.mensaje, variables));
  };

  const finishLog = async (
    result: "enviado" | "pendiente",
    extras?: { channel?: "api" | "wa_me"; wa_message_id?: string | null },
  ) => {
    if (!user) return;
    try {
      await logWhatsAppActivity({
        user_id: user.id,
        message: messageWithLinks,
        ...context,
        result,
        title: `WhatsApp · ${variables.empresa_nombre || ""}`.trim(),
        destinatario_phone: normalized ?? null,
        message_type: selectedTplId !== "custom" ? "plantilla" : "texto",
        channel: extras?.channel ?? null,
        wa_message_id: extras?.wa_message_id ?? null,
      });
    } catch (e) {
      console.warn("[whatsapp] log activity failed", e);
      toast.warning("No se pudo registrar la actividad, pero el envío continúa.");
    }
    onSent?.();
  };

  const handleSend = async () => {
    if (!normalized) { toast.error("Sin teléfono válido"); return; }
    await copyMessage(messageWithLinks);
    openWhatsApp(normalized, messageWithLinks);
    await finishLog("enviado", { channel: "wa_me" });
    toast.success("Mensaje copiado y WhatsApp abierto");
    onOpenChange(false);
  };

  const handleCopy = async () => {
    const ok = await copyMessage(messageWithLinks);
    if (ok) { await finishLog("pendiente"); toast.success("Mensaje copiado"); }
    else toast.error("No se pudo copiar");
  };

  const handleSendApi = async () => {
    if (!normalized) { toast.error("Sin teléfono válido"); return; }
    setTplPickerOpen(true);
  };

  const onPickTemplate = (id: string) => {
    const tpl = metaTemplates.find((t: any) => t.id === id);
    if (!tpl) return;
    setPickedTpl({
      id: tpl.id, name: tpl.name, language: tpl.language ?? "es_MX",
      body: tpl.body, business_phone_number_id: tpl.business_phone_number_id ?? null,
    });
    const body = (tpl.body || "") as string;
    const matches = body.match(/\{\{\s*(\d+)\s*\}\}/g) || [];
    let max = 0;
    for (const m of matches) {
      const n = parseInt(m.replace(/[^\d]/g, ""), 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
    // Prefill primera variable con nombre del contacto / empresa si existe
    const prefill = Array(max).fill("");
    if (max >= 1) prefill[0] = variables.contacto_nombre || variables.empresa_nombre || "";
    setTplVars(prefill);
    setTplPickerOpen(false);
  };

  const sendApiTemplate = async () => {
    if (!normalized || !pickedTpl) return;
    if (expectedVars > 0 && tplVars.slice(0, expectedVars).some((v) => !v?.trim())) {
      toast.error(`Esta plantilla requiere ${expectedVars} variable(s). Completa todos los campos.`);
      return;
    }
    const components = expectedVars > 0
      ? [{ type: "body", parameters: tplVars.slice(0, expectedVars).map((v) => ({ type: "text", text: v.trim() })) }]
      : undefined;
    setSendingApi(true);
    const { data, error } = await supabase.functions.invoke("whatsapp-send-message", {
      body: {
        to_phone: normalized,
        kind: "template",
        template_name: pickedTpl.name,
        template_language: pickedTpl.language ?? "es_MX",
        ...(pickedTpl.business_phone_number_id ? { business_phone_number_id: pickedTpl.business_phone_number_id } : {}),
        ...(components ? { template_components: components } : {}),
      },
    });
    setSendingApi(false);
    if (error) { toast.error(error.message ?? "No se pudo enviar plantilla"); return; }
    const waMessageId = (data as any)?.wa_message_id ?? (data as any)?.messages?.[0]?.id ?? null;
    await finishLog("enviado", { channel: "api", wa_message_id: waMessageId });
    toast.success("Plantilla enviada por API");
    setPickedTpl(null);
    setTplVars([]);
    onOpenChange(false);
  };

  const copyAttachmentLink = async (url: string) => {
    const ok = await copyMessage(url);
    if (ok) toast.success("Link copiado"); else toast.error("No se pudo copiar");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-primary" /> Enviar WhatsApp</DialogTitle>
        </DialogHeader>

        {!normalized && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Este contacto no tiene teléfono registrado. Captura un teléfono en su ficha o usa "Copiar mensaje".</AlertDescription>
          </Alert>
        )}

        {(templates?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <Label>Plantilla</Label>
            <Select value={selectedTplId} onValueChange={handleSelectTemplate}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Mensaje personalizado</SelectItem>
                {templates!.map(t => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>Mensaje</Label>
          <Textarea rows={6} value={message} onChange={(e) => { setMessage(e.target.value); setSelectedTplId("custom"); }} />
          <p className="text-xs text-muted-foreground">
            Para: {variables.contacto_nombre || "—"} {normalized ? `· +${normalized}` : ""}
          </p>
        </div>

        {attachments.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5"><Paperclip className="h-4 w-4" /> Adjuntos de la plantilla ({attachments.length})</Label>
              <label className="text-xs flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={includeLinks} onChange={(e) => setIncludeLinks(e.target.checked)} />
                Agregar links al mensaje
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              WhatsApp no permite enviar varios archivos por enlace. Comparte los links junto al mensaje o ábrelos para adjuntarlos manualmente.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {attachments.map(a => {
                const url = getAttachmentPublicUrl(a.file_path);
                return (
                  <div key={a.id} className="flex items-center gap-2 rounded border p-2 bg-card">
                    {isImageMime(a.mime_type) ? (
                      <img src={url} alt="" className="h-10 w-10 object-cover rounded" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate" title={a.file_name}>{a.file_name}</div>
                      <Badge variant="outline" className="text-[10px]">{a.mime_type.split("/").pop()?.toUpperCase()}</Badge>
                    </div>
                    <Button asChild type="button" variant="ghost" size="icon" className="h-7 w-7" title="Ver">
                      <a href={url} target="_blank" rel="noopener noreferrer"><Eye className="h-3.5 w-3.5" /></a>
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Copiar link"
                      onClick={() => copyAttachmentLink(url)}>
                      <Link2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button asChild type="button" variant="ghost" size="icon" className="h-7 w-7" title="Descargar">
                      <a href={url} download={a.file_name}><Download className="h-3.5 w-3.5" /></a>
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={handleCopy}><Copy className="h-4 w-4 mr-1" /> Copiar</Button>
          <Button variant="secondary" onClick={handleSendApi} disabled={!normalized}>
            <Send className="h-4 w-4 mr-1" /> Enviar por API
          </Button>
          <Button onClick={handleSend} disabled={!normalized}>
            <MessageCircle className="h-4 w-4 mr-1" /> Abrir WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>

      <TemplatePickerDialog
        open={tplPickerOpen}
        onOpenChange={setTplPickerOpen}
        templates={pickerTemplates}
        selectedId={pickedTpl?.id}
        onSelect={onPickTemplate}
      />

      <Dialog open={!!pickedTpl} onOpenChange={(o) => { if (!o) { setPickedTpl(null); setTplVars([]); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-primary" /> Enviar plantilla por API</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">
              <div className="font-medium">{pickedTpl?.name}</div>
              <div className="text-xs text-muted-foreground">{pickedTpl?.language}</div>
            </div>
            {pickedTpl?.body && (
              <div className="rounded-lg bg-[#dcf8c6] dark:bg-emerald-900/40 text-foreground p-3 text-sm whitespace-pre-wrap shadow-sm">
                {pickedTpl.body}
              </div>
            )}
            {expectedVars > 0 && (
              <div className="space-y-2">
                <Label>Variables ({expectedVars})</Label>
                {Array.from({ length: expectedVars }).map((_, i) => (
                  <Input
                    key={i}
                    placeholder={`{{${i + 1}}}`}
                    value={tplVars[i] || ""}
                    onChange={(e) => {
                      const next = [...tplVars];
                      next[i] = e.target.value;
                      setTplVars(next);
                    }}
                  />
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Para: {normalized ? `+${normalized}` : "—"}</p>
          </div>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setTplPickerOpen(true)}>Cambiar plantilla</Button>
            <Button onClick={sendApiTemplate} disabled={sendingApi}>
              <Send className="h-4 w-4 mr-1" /> {sendingApi ? "Enviando…" : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
