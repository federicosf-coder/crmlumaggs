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
  previouslySentEmails?: string[];
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
  previouslySentEmails = [],
}: Props) {
  const [emails, setEmails] = useState<string[]>(defaultEmails.filter(isValidEmail));
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmingResend, setConfirmingResend] = useState(false);

  useEffect(() => {
    if (open) {
      setEmails(defaultEmails.filter(isValidEmail));
      setConfirmingResend(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultEmails.join(",")]);

  const addEmail = (raw?: string) => {
    const value = (raw ?? input).trim().replace(/,$/, "");
    if (!value) return;
    if (!isValidEmail(value)) {
      toast.error("Correo inválido");
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

  const handleSend = async () => {
    // Make sure pending input is added
    let finalEmails = emails;
    if (input.trim()) {
      const value = input.trim();
      if (isValidEmail(value) && !finalEmails.includes(value)) {
        finalEmails = [...finalEmails, value];
        setEmails(finalEmails);
      }
    }
    if (finalEmails.length === 0) {
      toast.error("Agrega al menos un correo");
      return;
    }
    setSending(true);
    try {
      const results = await Promise.allSettled(
        finalEmails.map((email) =>
          supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "pago-confirmation",
              recipientEmail: email,
              idempotencyKey: `pago-confirm-${pagoId}-${email}`,
              templateData: {
                empresa,
                fechaPago,
                montoTotal,
                moneda,
                observaciones,
                documentos,
                comprobantes,
                registradoPor,
              },
            },
          })
        )
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed === 0) {
        toast.success(
          `Confirmación enviada a ${finalEmails.length} ${
            finalEmails.length === 1 ? "destinatario" : "destinatarios"
          }`
        );
        onOpenChange(false);
      } else {
        toast.error(`Falló el envío a ${failed} de ${finalEmails.length}`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Error al enviar");
    } finally {
      setSending(false);
    }
  };

  const handleSkip = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Enviar confirmación
          </DialogTitle>
          <DialogDescription>
            ¿Deseas enviar un correo de confirmación de este pago? Agrega los
            destinatarios o omite este paso.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Empresa</span>
              <span className="font-medium">{empresa}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monto</span>
              <span className="font-semibold">
                {montoTotal} {moneda}
              </span>
            </div>
          </div>

          <div>
            <Label>Correos destinatarios</Label>
            <div className="flex flex-wrap gap-1 mb-2 mt-1 min-h-[28px]">
              {emails.map((e) => (
                <Badge key={e} variant="secondary" className="gap-1">
                  {e}
                  <button
                    type="button"
                    onClick={() => removeEmail(e)}
                    className="hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleSkip} disabled={sending}>
            Omitir
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? "Enviando..." : "Enviar correo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
