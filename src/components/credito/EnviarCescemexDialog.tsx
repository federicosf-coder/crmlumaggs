import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Send, FileText } from "lucide-react";
import { toast } from "sonner";

interface MontoItem { label: string; monto: number | null | undefined }
interface DocIn { nombre_archivo: string; url_archivo: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  creditRequestId: string;
  folio: string;
  companyName: string;
  repLegalNombre?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  montosSolicitados: MontoItem[];
  promedioUnidades?: number | string | null;
  giroComercialLabels: string[];
  usoCfdiLabel?: string | null;
  remitenteNombre: string;
  ccDefault: string;
  docs: DocIn[];
}

function textToHtml(text: string) {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = escape(text).replace(/\r?\n/g, "<br/>");
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;line-height:1.55">${html}</div>`;
}

function fmtMoney(n: number | null | undefined) {
  if (n == null || isNaN(Number(n))) return "—";
  return `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function genToken() {
  const raw = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
  return raw;
}

export function EnviarCescemexDialog(props: Props) {
  const {
    open, onOpenChange, creditRequestId, folio, companyName,
    repLegalNombre, contactEmail, contactPhone,
    montosSolicitados, promedioUnidades, giroComercialLabels, usoCfdiLabel,
    remitenteNombre, ccDefault, docs,
  } = props;

  const [to, setTo] = useState("r.galvang@dagal.com.mx");
  const [cc, setCc] = useState(ccDefault || "");
  const [subject, setSubject] = useState("Solicitud credito Cescemex");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [signedDocs, setSignedDocs] = useState<{ nombre_archivo: string; signed_url: string }[]>([]);

  const descargasUrl = useMemo(
    () => (token ? `${window.location.origin}/credito/descargas/${token}` : ""),
    [token],
  );

  const defaultBody = useMemo(() => {
    const montosLines = (montosSolicitados || [])
      .map((m) => `- ${m.label}: ${fmtMoney(m.monto as any)}`)
      .join("\n");
    return [
      `NOMBRE EMPRESA: ${companyName || "—"}`,
      `Nombre representante: ${repLegalNombre || "—"}`,
      `Teléfono de Contacto: ${contactPhone || "—"}`,
      `Correo Electrónico Contacto: ${contactEmail || "—"}`,
      `Crédito Solicitado por Empresa y Monto:`,
      montosLines || "—",
      `Promedio Unidades Mensuales: ${promedioUnidades ?? "—"}`,
      `Giro Comercial: ${(giroComercialLabels || []).join(", ") || "—"}`,
      `Uso CFDI: ${usoCfdiLabel || "—"}`,
      ``,
      `Atentamente,`,
      remitenteNombre || "",
    ].join("\n");
  }, [companyName, repLegalNombre, contactPhone, contactEmail, montosSolicitados, promedioUnidades, giroComercialLabels, usoCfdiLabel, remitenteNombre]);

  useEffect(() => {
    if (!open) return;
    setCc(ccDefault || "");
    setSubject("Solicitud credito Cescemex");
    setBody(defaultBody);
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        // 1) Reutilizar o crear token
        const { data: cur } = await (supabase as any)
          .from("credit_requests")
          .select("cescemex_share_token, cescemex_share_expires_at")
          .eq("id", creditRequestId)
          .maybeSingle();
        let tk: string | null = cur?.cescemex_share_token || null;
        const exp = cur?.cescemex_share_expires_at ? new Date(cur.cescemex_share_expires_at).getTime() : 0;
        const now = Date.now();
        if (!tk || !exp || exp <= now) {
          tk = genToken();
          const expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
          const { error: upErr } = await (supabase as any)
            .from("credit_requests")
            .update({ cescemex_share_token: tk, cescemex_share_expires_at: expiresAt })
            .eq("id", creditRequestId);
          if (upErr) throw upErr;
        }
        if (cancel) return;
        setToken(tk);

        // 2) Firmar URLs individuales
        const out: { nombre_archivo: string; signed_url: string }[] = [];
        for (const d of docs || []) {
          if (!d?.url_archivo) continue;
          const { data: signed } = await supabase.storage
            .from("credit-docs")
            .createSignedUrl(d.url_archivo, 60 * 60 * 24 * 7);
          if (signed?.signedUrl) {
            out.push({ nombre_archivo: d.nombre_archivo || "archivo", signed_url: signed.signedUrl });
          }
        }
        if (cancel) return;
        setSignedDocs(out);
      } catch (e: any) {
        toast.error(e?.message || "No se pudo preparar el envío");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [open, creditRequestId, docs, ccDefault, defaultBody]);

  const handleSend = async () => {
    const toAddr = to.trim();
    if (!toAddr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toAddr)) {
      toast.error("Correo destinatario inválido");
      return;
    }
    const ccArr = cc.split(",").map((s) => s.trim()).filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
    setSending(true);
    try {
      const bodyHtml = textToHtml(body);
      const docsHtml = signedDocs.length
        ? `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;line-height:1.55;margin-top:16px">
             <p style="margin:0 0 6px 0;font-weight:600">Documentos:</p>
             <ul style="margin:0;padding-left:20px">
               ${signedDocs
                 .map((d) => `<li><a href="${d.signed_url}" target="_blank" rel="noopener">${d.nombre_archivo}</a></li>`)
                 .join("")}
             </ul>
             ${descargasUrl ? `<p style="margin:12px 0 0 0"><a href="${descargasUrl}" target="_blank" rel="noopener">Descargar todos</a></p>` : ""}
           </div>`
        : "";
      const html = bodyHtml + docsHtml;

      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "raw-html",
          recipientEmail: toAddr,
          cc: ccArr.length ? ccArr : undefined,
          subjectOverride: subject,
          htmlOverride: html,
          idempotencyKey: `cescemex-${creditRequestId}-${Date.now()}`,
          templateData: { __subject: subject, __html: html },
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
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="bg-gradient-to-br from-violet-50 to-blue-50 px-6 py-4 border-b">
          <DialogTitle className="text-base font-semibold tracking-tight">Enviar Solicitud Cescemex</DialogTitle>
          <DialogDescription className="text-xs">
            Revisa el contenido antes de enviar. Los documentos se compartirán mediante enlaces con vigencia de 7 días.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-5 space-y-3 font-light max-h-[65vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Preparando envío...
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Para</Label>
                <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="correo@empresa.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">CC</Label>
                <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="correo1@dominio.com, correo2@dominio.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Asunto</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Contenido</Label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={14} className="font-mono text-xs" />
              </div>

              <div className="space-y-2 pt-2">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Documentos que se incluirán ({signedDocs.length})
                </Label>
                <div className="divide-y border rounded-md bg-muted/20">
                  {signedDocs.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 text-xs">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1">{d.nombre_archivo}</span>
                      <a href={d.signed_url} target="_blank" rel="noopener" className="text-violet-700 hover:underline shrink-0">Abrir</a>
                    </div>
                  ))}
                  {signedDocs.length === 0 && (
                    <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                      No hay documentos cargados.
                    </div>
                  )}
                </div>
                {descargasUrl && (
                  <p className="text-[11px] text-muted-foreground">
                    Enlace "Descargar todos":{" "}
                    <a href={descargasUrl} target="_blank" rel="noopener" className="text-violet-700 hover:underline break-all">
                      {descargasUrl}
                    </a>
                  </p>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground pt-1">
                Folio {folio || "—"} · {companyName || "—"}
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