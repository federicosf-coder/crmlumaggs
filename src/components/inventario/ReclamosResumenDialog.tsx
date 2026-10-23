import { useEffect, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Download, Mail, FileText } from "lucide-react";
import { toast } from "sonner";
import { EmailChips, attachmentsExceedLimit, uniqueEmails } from "./ReclamoCorreoDialog";
import { generateReclamosResumenPdf, type ReclamoResumenFila } from "@/lib/generateReclamosResumenPdf";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  reclamos: ReclamoResumenFila[];
  empaques: Record<string, string>;
  estatus: Record<string, string>;
  filtros: string;
}

const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function ReclamosResumenDialog({ open, onOpenChange, reclamos, empaques, estatus, filtros }: Props) {
  const { user } = useAuth();
  const [pdf, setPdf] = useState<{ blob: Blob; fileName: string; url: string } | null>(null);
  const [error, setError] = useState("");
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [subject, setSubject] = useState("Resumen de reclamos de pedidos");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPdf(null); setError(""); setSent(false); setTo([]);
    setCc(user?.email ? [user.email] : []);
    setSubject("Resumen de reclamos de pedidos");
    setMessage(`Buen día,\n\nAdjunto el resumen de ${reclamos.length} reclamo(s).\n${filtros}\n\nSaludos.`);
    let url: string | undefined;
    try {
      const generated = generateReclamosResumenPdf(reclamos, empaques, estatus, filtros);
      url = URL.createObjectURL(generated.blob);
      setPdf({ ...generated, url });
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo generar el resumen"); }
    return () => { if (url) URL.revokeObjectURL(url); };
    // Freeze the current filtered list while the user reviews and sends its PDF.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const download = async () => {
    if (!pdf) return;
    const file = new File([pdf.blob], pdf.fileName, { type: "application/pdf" });
    if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: pdf.fileName }); return; }
      catch (e) { if (e instanceof DOMException && e.name === "AbortError") return; }
    }
    const url = URL.createObjectURL(pdf.blob);
    const link = document.createElement("a");
    link.href = url; link.download = pdf.fileName;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const send = async () => {
    if (!pdf || sending || sent) return;
    if (!to.length) { toast.error("Agrega al menos un destinatario"); return; }
    if (!subject.trim() || !message.trim()) { toast.error("Completa el asunto y el mensaje"); return; }
    if (attachmentsExceedLimit(pdf.blob.size)) { toast.error("El resumen supera 35 MB; reduce los reclamos usando los filtros"); return; }
    setSending(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user?.email) throw new Error("Inicia sesión para enviar el resumen");
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
        reader.onerror = () => reject(new Error("No se pudo leer el PDF"));
        reader.readAsDataURL(pdf.blob);
      });
      const { data, error: deliveryError } = await supabase.functions.invoke("send-email", { body: {
        from: "Lumaggs Reclamos <reclamos@correo.lumaggs.com.mx>",
        to: uniqueEmails(to), cc: uniqueEmails(cc), reply_to: [auth.user.email],
        subject: subject.trim(), text: message,
        html: `<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${escape(message)}</div>`,
        attachments: [{ filename: pdf.fileName, content }],
      } });
      if (deliveryError) {
        let detail = deliveryError.message;
        if (deliveryError instanceof FunctionsHttpError) {
          const response = await deliveryError.context.json().catch(() => null);
          detail = response?.error || detail;
        }
        throw new Error(detail);
      }
      if (!data?.success || !data?.id) throw new Error(data?.error || "No se confirmó el envío");
      setSent(true); toast.success("Resumen enviado por correo");
    } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo enviar el resumen"); }
    finally { setSending(false); }
  };

  return <Dialog open={open} onOpenChange={(value) => { if (!sending) onOpenChange(value); }}>
    <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden" onEscapeKeyDown={(event) => { if (sending) event.preventDefault(); }} onPointerDownOutside={(event) => { if (sending) event.preventDefault(); }}>
      <DialogHeader className="border-b bg-muted px-5 py-4 shrink-0">
        <DialogTitle>Resumen de reclamos</DialogTitle>
        <DialogDescription>{filtros} · {reclamos.length} reclamo(s)</DialogDescription>
      </DialogHeader>
      <div className="flex-1 overflow-y-auto px-5 py-5 grid gap-5 lg:grid-cols-[1fr_340px] font-light">
        <div className="min-w-0">
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {pdf && <iframe title="PDF del resumen de reclamos" src={pdf.url} className="w-full h-[460px] border rounded bg-background" />}
        </div>
        <div className="space-y-4 min-w-0">
          <EmailChips label="Para" value={to} onChange={setTo} disabled={sending || sent} />
          <EmailChips label="CC" value={cc} onChange={setCc} disabled={sending || sent} />
          <div className="space-y-2"><Label htmlFor="resumen-asunto" className="text-xs uppercase text-muted-foreground">Asunto</Label><Input id="resumen-asunto" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={sending || sent} /></div>
          <div className="space-y-2"><Label htmlFor="resumen-mensaje" className="text-xs uppercase text-muted-foreground">Mensaje</Label><Textarea id="resumen-mensaje" value={message} onChange={(e) => setMessage(e.target.value)} rows={6} disabled={sending || sent} /></div>
          {pdf && <div className="flex gap-2 text-xs text-muted-foreground"><FileText className="w-4 h-4 shrink-0" /><span className="break-all">{pdf.fileName} · {(pdf.blob.size / 1024).toFixed(0)} KB</span></div>}
          {sent && <p role="status" className="text-sm text-success">Resumen enviado por correo</p>}
        </div>
      </div>
      <DialogFooter className="border-t bg-muted/30 px-5 py-3 shrink-0 gap-2">
        <Button variant="outline" disabled={sending} onClick={() => onOpenChange(false)}>Cerrar</Button>
        <Button variant="outline" onClick={download} disabled={!pdf || sending}><Download className="h-4 w-4 mr-2" />Descargar PDF</Button>
        <Button onClick={send} disabled={!pdf || sending || sent || !to.length}><Mail className="h-4 w-4 mr-2" />{sending ? "Enviando…" : sent ? "Enviado" : "Enviar resumen"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}