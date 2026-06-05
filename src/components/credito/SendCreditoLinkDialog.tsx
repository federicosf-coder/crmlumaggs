import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Send } from "lucide-react";
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
}

function renderVars(s: string, vars: Record<string, string>) {
  if (!s) return "";
  let out = s;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v ?? "");
  }
  return out;
}

function textToHtml(text: string, linkUrl?: string) {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let html = escape(text).replace(/\r?\n/g, "<br/>");
  if (linkUrl) {
    const esc = escape(linkUrl);
    html = html.split(esc).join(`<a href="${esc}" target="_blank" rel="noopener">${esc}</a>`);
  }
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;line-height:1.55">${html}</div>`;
}

export function SendCreditoLinkDialog({ open, onOpenChange, portalUrl, folio, empresa, contactoNombre, contactoEmail, creditRequestId }: Props) {
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
      const { data, error } = await (supabase as any)
        .from("templates")
        .select("subject, body")
        .eq("type", "email")
        .ilike("name", "Enviar Link de Solicitud")
        .eq("is_active", true)
        .maybeSingle();
      if (cancel) return;
      const vars: Record<string, string> = {
        liga_solicitud_credito: portalUrl,
        folio_solicitud: folio || "",
        nombre_contacto: contactoNombre || "Cliente",
        nombre_empresa: empresa || "",
      };
      if (error || !data) {
        setSubject(renderVars(`Solicitud de Crédito {folio_solicitud}`, vars));
        setBody(renderVars(
          `Estimado(a) {nombre_contacto}:\n\nLe compartimos el enlace para completar la Solicitud de Crédito de {nombre_empresa} (folio {folio_solicitud}).\n\nAcceda aquí: {liga_solicitud_credito}\n\nSaludos cordiales.`,
          vars,
        ));
      } else {
        setSubject(renderVars(data.subject || "", vars));
        setBody(renderVars(data.body || "", vars));
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [open, portalUrl, folio, empresa, contactoNombre, contactoEmail]);

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
          htmlOverride: textToHtml(body, portalUrl),
          to: [toAddr],
          templateData: { __subject: subject, __html: textToHtml(body, portalUrl) },
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="bg-gradient-to-br from-violet-50 to-blue-50 px-6 py-4 border-b">
          <DialogTitle className="text-base font-semibold tracking-tight">Enviar liga por correo</DialogTitle>
          <DialogDescription className="text-xs">
            Plantilla "Enviar Link de Solicitud". Revisa y edita antes de enviar.
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
              <p className="text-[11px] text-muted-foreground">
                La liga se enviará como enlace activo dentro del cuerpo del correo.
              </p>
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