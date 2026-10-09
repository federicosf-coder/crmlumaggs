import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Send, MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  portalUrl: string;
  folio: string;
  empresa: string;
  contactoNombre: string;
  contactoEmail: string;
  creditRequestId: string;
  avisoUrl?: string;
  tempPassword?: string;
}

const BUZON = "credito@correo.lumaggs.com.mx";

function mensajeBase(canal: "email" | "whatsapp") {
  const docsIntro = canal === "email"
    ? `3. Envíe sus documentos respondiendo este correo (o escribiendo a ${BUZON} con el folio {folio_solicitud} en el asunto). El sistema los identifica y los integra a su expediente automáticamente.`
    : `3. Envíe sus documentos por correo a ${BUZON} con el folio {folio_solicitud} en el asunto. El sistema los identifica y los integra a su expediente automáticamente.`;
  return `Estimado(a) {nombre_contacto}:

Para iniciar la Solicitud de Crédito de {nombre_empresa} (folio {folio_solicitud}) le pedimos lo siguiente:

1. Firme en pantalla el Aviso de Privacidad y Confidencialidad (requisito legal, no requiere contraseña):
{liga_aviso}

2. Ingrese al portal de su solicitud:
{liga_solicitud_credito}
Clave temporal: {clave_temporal}
(En el primer acceso le pedirá crear su propia contraseña.)

${docsIntro}

Documentos que necesitamos:
{lista_documentos}

4. En el portal puede autocompletar sus datos con los documentos, revisar la información, agregar referencias comerciales y bancarias, imprimir los formatos, firmarlos y subirlos. Al terminar, use el botón "Ya terminé: avisar a mi ejecutivo".

Quedamos atentos a cualquier duda.
Saludos cordiales.`;
}

function renderVars(s: string, vars: Record<string, string>) {
  if (!s) return "";
  let out = s;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v ?? "");
  }
  return out;
}

function textToHtml(text: string, linkUrl?: string, linkUrl2?: string) {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let html = escape(text).replace(/\r?\n/g, "<br/>");
  if (linkUrl2) {
    const esc2 = escape(linkUrl2);
    html = html.split(esc2).join(`<a href="${esc2}" target="_blank" rel="noopener">${esc2}</a>`);
  }
  if (linkUrl) {
    const esc = escape(linkUrl);
    html = html.split(esc).join(`<a href="${esc}" target="_blank" rel="noopener">${esc}</a>`);
  }
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;line-height:1.55">${html}</div>`;
}

export function SendCreditoLinkDialog({ open, onOpenChange, portalUrl, folio, empresa, contactoNombre, contactoEmail, creditRequestId, avisoUrl = "", tempPassword = "" }: Props) {
  const [phone, setPhone] = useState("");
  const [vars, setVars] = useState<Record<string, string>>({});
  const [to, setTo] = useState(contactoEmail || "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTo(contactoEmail || "");
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data: docs } = await supabase.from("credit_doc_types").select("nombre").eq("is_active", true).order("sort_order");
      if (cancel) return;
      const v: Record<string, string> = {
        liga_solicitud_credito: portalUrl,
        liga_aviso: avisoUrl || portalUrl,
        clave_temporal: tempPassword || "(la que ya creó)",
        folio_solicitud: folio || "",
        nombre_contacto: contactoNombre || "Cliente",
        nombre_empresa: empresa || "",
        lista_documentos: ((docs || []) as { nombre: string }[]).map((d) => `- ${d.nombre}`).join("\n") || "- Constancia de Situación Fiscal\n- Identificación del representante legal\n- Comprobante de domicilio",
      };
      setVars(v);
      setSubject(renderVars(`Solicitud de Crédito {folio_solicitud} – Aviso de privacidad y documentos`, v));
      setBody(renderVars(mensajeBase("email"), v));
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [open, portalUrl, avisoUrl, tempPassword, folio, empresa, contactoNombre, contactoEmail]);

  const handleSend = async () => {
    const toAddr = to.trim();
    if (!toAddr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toAddr)) {
      toast.error("Correo destinatario inválido");
      return;
    }
    setSending(true);
    try {
      const ts = Date.now();
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "raw-html",
          recipientEmail: toAddr,
          idempotencyKey: `credito-link-${creditRequestId}-${toAddr}-${ts}`,
          subjectOverride: subject,
          htmlOverride: textToHtml(body, portalUrl, avisoUrl),
          replyTo: BUZON,
          to: [toAddr],
          templateData: { __subject: subject, __html: textToHtml(body, portalUrl, avisoUrl) },
        },
      });
      if (error) throw error;
      toast.success("Correo enviado");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo enviar el correo");
    } finally {
      setSending(false);
    }
  };

  const abrirWhatsApp = () => {
    let d = phone.replace(/\D/g, "");
    if (d.length === 10) d = "52" + d;
    if (d.length < 11) { toast.error("Escribe el celular a 10 dígitos"); return; }
    const texto = renderVars(mensajeBase("whatsapp"), vars);
    window.open(`https://wa.me/${d}?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="bg-gradient-to-br from-violet-50 to-blue-50 px-6 py-4 border-b">
          <DialogTitle className="text-base font-semibold tracking-tight">Solicitar aviso de privacidad y documentos</DialogTitle>
          <DialogDescription className="text-xs">
            Correo y WhatsApp con la liga del aviso, el portal y la lista de documentos. Las respuestas por correo llegan a credito@correo.lumaggs.com.mx y se asignan solas.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-5 space-y-3 font-light max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando plantilla...
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Para</Label>
                <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="correo@empresa.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Asunto</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Mensaje</Label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="font-mono text-xs" />
              </div>
              <div className="space-y-1.5 pt-2 border-t">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">WhatsApp (celular)</Label>
                <div className="flex gap-2">
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="664 123 4567" />
                  <Button type="button" variant="outline" onClick={abrirWhatsApp}><MessageCircle className="h-4 w-4 mr-1.5" />Abrir WhatsApp</Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Abre tu WhatsApp con el mensaje listo para enviar.</p>
              </div>
            </>
          )}
        </div>
        <DialogFooter className="bg-muted/40 px-6 py-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancelar</Button>
          <Button onClick={handleSend} disabled={sending || loading}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}