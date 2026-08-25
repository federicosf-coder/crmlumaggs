import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { X, Mail, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DocumentoLigado {
  tipo: string;
  numero: string;
  monto: string;
}

interface Comprobante {
  nombre: string;
  url: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pagoId: string;
  empresa: string;
  fechaPago: string;
  montoTotal: string;
  moneda: string;
  observaciones?: string;
  documentos: DocumentoLigado[];
  comprobantes?: Comprobante[];
  registradoPor?: string;
  defaultEmails?: string[];
  /** Lista de correos PROHIBIDOS (empresa, cliente, contactos). Se filtran al inicializar y se bloquean al agregar manualmente. */
  blockedEmails?: string[];
  previouslySentEmails?: string[];
  templateName?: string;
  extraTemplateData?: Record<string, any>;
  subjectOverride?: string;
  htmlOverride?: string;
  ccEmails?: string[];
  bccEmails?: string[];
  replyTo?: string;
  title?: string;
  description?: string;
  /** Contexto opcional para registrar la actividad en el historial del CRM */
  logContext?: {
    company_id?: string | null;
    contact_id?: string | null;
    documento_id?: string | null;
    user_id?: string | null;
  };
  onSent?: () => void;
}

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export function EnviarConfirmacionPagoDialog({
  open,
  onOpenChange,
  pagoId,
  empresa,
  fechaPago,
  montoTotal,
  moneda,
  observaciones,
  documentos,
  comprobantes = [],
  registradoPor,
  defaultEmails = [],
  blockedEmails = [],
  previouslySentEmails = [],
  templateName = "pago-confirmation",
  extraTemplateData,
  subjectOverride,
  htmlOverride,
  ccEmails,
  bccEmails,
  replyTo,
  title,
  description,
  logContext,
  onSent,
}: Props) {
  const blockedSet = new Set(blockedEmails.map((e) => e.toLowerCase()));
  const isBlocked = (e: string) => blockedSet.has(e.toLowerCase());
  const sanitize = (list: string[]) =>
    list.filter((e) => isValidEmail(e) && !isBlocked(e));

  const [emails, setEmails] = useState<string[]>(sanitize(defaultEmails));
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmingResend, setConfirmingResend] = useState(false);

  useEffect(() => {
    if (open) {
      setEmails(sanitize(defaultEmails));
      setConfirmingResend(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultEmails.join(","), blockedEmails.join(",")]);

  const addEmail = (raw?: string) => {
    const value = (raw ?? input).trim().replace(/,$/, "");
    if (!value) return;
    if (!isValidEmail(value)) {
      toast.error("Correo inválido");
      return;
    }
    if (isBlocked(value)) {
      toast.error("Este correo está bloqueado (cliente, empresa o contacto). No se permite para este envío.");
      setInput("");
      return;
    }
    if (emails.includes(value)) {
      setInput("");
      return;
    }
    setEmails((p) => [...p, value]);
    setInput("");
  };

  const removeEmail = (e: string) =>
    setEmails((p) => p.filter((x) => x !== e));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      addEmail();
    } else if (e.key === "Backspace" && !input && emails.length > 0) {
      setEmails((p) => p.slice(0, -1));
    }
  };

  const computeFinalEmails = () => {
    let finalEmails = emails;
    if (input.trim()) {
      const value = input.trim();
      if (isValidEmail(value) && !isBlocked(value) && !finalEmails.includes(value)) {
        finalEmails = [...finalEmails, value];
        setEmails(finalEmails);
      }
    }
    // Defensa: nunca enviar a correos bloqueados
    return finalEmails.filter((e) => !isBlocked(e));
  };

  const alreadySentMatches = (list: string[]) =>
    list.filter((e) => previouslySentEmails.includes(e.toLowerCase()));

  const doSend = async (finalEmails: string[]) => {
    console.log("DOSEND finalEmails:", finalEmails);
    setSending(true);
    try {
      const ts = Date.now();
      const toAddr = finalEmails[0];
      // Unificar TODOS los destinatarios en TO/CC para que el receptor pueda
      // "Responder a todos" desde su cliente de correo. Movemos también los
      // que venían como BCC a CC, e incluimos los CC propios del template.
      const toLower = toAddr.toLowerCase();
      const merged = [
        ...finalEmails.slice(1),
        ...((ccEmails || []) as string[]),
        ...((bccEmails || []) as string[]),
      ]
        .filter((e) => typeof e === "string" && e)
        .filter((e) => e.toLowerCase() !== toLower);
      const ccAddrs = Array.from(new Set(merged));
      const results = await Promise.allSettled([
        supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName,
            recipientEmail: toAddr,
            idempotencyKey: `${templateName}-${pagoId}-${toAddr}-${ts}`,
            subjectOverride,
            htmlOverride,
            to: [toAddr],
            cc: ccAddrs.length ? ccAddrs : undefined,
            // Intencionalmente sin BCC: todos visibles para Reply-All
            bcc: undefined,
            replyTo: replyTo || undefined,
            templateData: {
              empresa,
              fechaPago,
              montoTotal,
              moneda,
              observaciones,
              documentos,
              comprobantes,
              registradoPor,
              destinatarios: [toAddr, ...ccAddrs],
              respuestaA: replyTo || undefined,
              ...(extraTemplateData || {}),
            },
          },
        })
      ]);
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed === 0) {
        // Log al historial CRM (no bloquea la UX)
        if (logContext?.user_id) {
          try {
            const subject = subjectOverride || title || `Correo · ${templateName}`;
            const description = `Correo enviado a: ${finalEmails.join(", ")}${
              ccEmails && ccEmails.length ? ` · CC: ${ccEmails.join(", ")}` : ""
            }${bccEmails && bccEmails.length ? ` · CCO: ${bccEmails.join(", ")}` : ""}`;
            await supabase.from("crm_activities").insert({
              user_id: logContext.user_id,
              type: "email",
              title: subject,
              description,
              company_id: logContext.company_id ?? null,
              contact_id: logContext.contact_id ?? null,
              documento_id: logContext.documento_id ?? null,
            } as any);
          } catch (e) {
            console.warn("[email] log activity failed", e);
          }
        }
        toast.success(
          `Correo enviado a ${finalEmails.length} ${
            finalEmails.length === 1 ? "destinatario" : "destinatarios"
          }`
        );
        onSent?.();
        onOpenChange(false);
      } else {
        toast.error(`Falló el envío a ${failed} de ${finalEmails.length}`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Error al enviar");
    } finally {
      setSending(false);
      setConfirmingResend(false);
    }
  };

  const handleSend = async () => {
    const finalEmails = computeFinalEmails();
    if (finalEmails.length === 0) {
      toast.error("Agrega al menos un correo");
      return;
    }
    const dupes = alreadySentMatches(finalEmails);
    if (dupes.length > 0 && !confirmingResend) {
      setConfirmingResend(true);
      return;
    }
    await doSend(finalEmails);
  };

  const handleSkip = () => onOpenChange(false);

  const finalEmailsPreview = computeFinalEmails();
  const dupes = alreadySentMatches(finalEmailsPreview);
  const hasPrevious = previouslySentEmails.length > 0;
  const buttonLabel = sending
    ? "Enviando..."
    : confirmingResend
    ? "Sí, reenviar"
    : hasPrevious
    ? "Reenviar correo"
    : "Enviar correo";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          htmlOverride
            ? "max-w-3xl max-h-[90vh] overflow-y-auto"
            : "max-w-md"
        }
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />{" "}
            {title || (hasPrevious ? "Reenviar confirmación" : "Enviar confirmación")}
          </DialogTitle>
          <DialogDescription>
            {description ||
              (hasPrevious
                ? "Este pago ya tiene correos enviados. Puedes reenviar a los mismos destinatarios o agregar nuevos."
                : "Agrega los destinatarios o omite este paso.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {montoTotal ? (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monto</span>
                <span className="font-semibold">
                  {montoTotal} {moneda}
                </span>
              </div>
            </div>
          ) : null}

          {htmlOverride && (
            <div className="rounded-md border overflow-hidden">
              <div className="bg-gradient-to-r from-violet-50 to-blue-50 px-3 py-2 border-b">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                  Vista previa del correo
                </p>
                {subjectOverride && (
                  <p className="text-sm font-light truncate">
                    <span className="text-muted-foreground">Asunto: </span>
                    {subjectOverride}
                  </p>
                )}
              </div>
              <iframe
                title="Vista previa del correo"
                srcDoc={htmlOverride}
                className="w-full h-[380px] bg-white"
                sandbox=""
              />
              {comprobantes.length > 0 && (
                <div className="border-t px-3 py-2 bg-muted/20">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
                    Archivos incluidos ({comprobantes.length})
                  </p>
                  <ul className="space-y-0.5">
                    {comprobantes.map((c) => (
                      <li key={c.url} className="text-xs font-light truncate">
                        {c.nombre}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}


          {confirmingResend && dupes.length > 0 && (
            <Alert variant="default" className="border-amber-500/50 bg-amber-500/5">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm">
                <p className="font-medium mb-1">
                  Este correo ya aparece registrado como enviado a:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  {dupes.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
                <p className="mt-2">¿Deseas proceder con el reenvío? Se generará un nuevo registro.</p>
              </AlertDescription>
            </Alert>
          )}

          <div>
            <Label>Correos destinatarios</Label>
            <div className="flex flex-wrap gap-1 mb-2 mt-1 min-h-[28px]">
              {emails.map((e) => {
                const wasSent = previouslySentEmails.includes(e.toLowerCase());
                return (
                  <Badge
                    key={e}
                    variant={wasSent ? "outline" : "secondary"}
                    className="gap-1"
                  >
                    {e}
                    {wasSent && (
                      <span className="text-[10px] text-amber-600 font-medium">
                        (enviado)
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeEmail(e)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="correo@ejemplo.com"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => input.trim() && addEmail()}
              />
              <Button type="button" variant="outline" onClick={() => addEmail()}>
                Agregar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Presiona Enter o coma para agregar varios.
            </p>
          </div>
          {ccEmails && ccEmails.filter((e) => !emails.map((x) => x.toLowerCase()).includes(e.toLowerCase())).length > 0 && (
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">En copia (CC)</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {Array.from(new Set(ccEmails))
                  .filter((e) => !emails.map((x) => x.toLowerCase()).includes(e.toLowerCase()))
                  .map((e) => (
                    <Badge key={`cc-${e}`} variant="outline" className="text-xs font-normal">
                      {e}
                    </Badge>
                  ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Estos destinatarios reciben el correo en copia (CC) para que cualquiera pueda usar "Responder a todos".
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {confirmingResend ? (
            <Button
              variant="outline"
              onClick={() => setConfirmingResend(false)}
              disabled={sending}
            >
              Cancelar
            </Button>
          ) : (
            <Button variant="outline" onClick={handleSkip} disabled={sending}>
              Omitir
            </Button>
          )}
          <Button onClick={handleSend} disabled={sending}>
            {buttonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
