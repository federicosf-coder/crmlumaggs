import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { renderTemplate, resolveEmailRecipients, type EmailRecipientItem } from "@/lib/templates";
import { formatCurrency } from "@/lib/formatters";
import { generateCorteCajaPdf, type CorteCajaInput } from "@/lib/generateCorteCajaPdf";
import { generateCorteCajaXlsx } from "@/lib/generateCorteCajaXlsx";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  input: CorteCajaInput;
}

const FALLBACK_SUBJECT = "Corte de Caja {empresa} — {fecha}";
const FALLBACK_BODY = `<p>Buen día,</p>
<p>Adjunto el corte de caja de <strong>{empresa}</strong> correspondiente al <strong>{fecha}</strong>.</p>
<p>Total cobrado: <strong>{total_cobrado}</strong></p>
{resumen_metodos}
<p>Saludos.</p>`;

export function EnviarCorteCajaDialog({ open, onOpenChange, input }: Props) {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [destinatarios, setDestinatarios] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await (supabase as any)
          .from("templates")
          .select("subject, body, to_emails, cc_emails, bcc_emails, reply_to")
          .eq("system_key", "corte_caja_diario")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        const resumenMetodos =
          "<ul>" +
          input.porMetodo
            .map(([m, monto]) => `<li>${m}: ${formatCurrency(monto)}</li>`)
            .join("") +
          "</ul>";

        const vars = {
          empresa: input.empresaNombre,
          fecha: input.fecha,
          total_cobrado: formatCurrency(input.totalCobrado),
          resumen_metodos: resumenMetodos,
        };

        const tplSubject = data?.subject || FALLBACK_SUBJECT;
        const tplBody = data?.body || FALLBACK_BODY;
        const to = await resolveEmailRecipients((data?.to_emails as EmailRecipientItem[]) || []);

        if (cancelled) return;
        setSubject(renderTemplate(tplSubject, vars));
        setBodyHtml(renderTemplate(tplBody, vars));
        setDestinatarios(to.join(", "));
      } catch (e: any) {
        if (!cancelled) toast.error("No se pudo cargar la plantilla", { description: e?.message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, input]);

  const handleSend = async () => {
    const to = destinatarios.split(",").map((s) => s.trim()).filter(Boolean);
    if (to.length === 0) {
      toast.error("Agrega al menos un destinatario");
      return;
    }
    setSending(true);
    try {
      const pdfBase64 = generateCorteCajaPdf(input, { returnBase64: true }) as string;
      const xlsxBase64 = generateCorteCajaXlsx(input, { returnBase64: true }) as string;

      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          to,
          subject,
          html: bodyHtml,
          attachments: [
            {
              filename: `corte-caja-${input.fecha}.pdf`,
              content: pdfBase64,
              content_type: "application/pdf",
            },
            {
              filename: `corte-caja-${input.fecha}.xlsx`,
              content: xlsxBase64,
              content_type:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            },
          ],
        },
      });
      if (error) throw error;
      toast.success("Corte de caja enviado por correo");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("No se pudo enviar el correo", { description: e?.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="rounded-t-lg bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 -m-6 mb-0 p-6">
          <DialogTitle className="flex items-center gap-2 text-base font-light">
            <Mail className="h-4 w-4" />
            Enviar Corte de Caja por correo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Destinatarios (separados por coma)
            </Label>
            <Input
              value={destinatarios}
              onChange={(e) => setDestinatarios(e.target.value)}
              placeholder="correo1@empresa.com, correo2@empresa.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Asunto</Label>
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-light">
              {loading ? "Cargando…" : subject || "—"}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Vista previa</Label>
            <div
              className="max-h-64 overflow-auto rounded-md border bg-background p-3 text-sm font-light [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: loading ? "Cargando…" : bodyHtml }}
            />
            <p className="text-xs text-muted-foreground">
              Se adjuntarán el PDF y el Excel del corte de caja.
            </p>
          </div>
        </div>

        <DialogFooter className="-m-6 mt-0 bg-muted/40 p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={sending || loading}>
            {sending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Mail className="mr-1 h-4 w-4" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
