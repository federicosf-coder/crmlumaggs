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
import { Copy, Send, MessageCircle, AlertTriangle } from "lucide-react";
import {
  WhatsAppMessageTemplate, WhatsAppTemplateType, WhatsAppVariables,
  copyMessage, logWhatsAppActivity, normalizePhoneForWhatsApp, openWhatsApp, renderTemplate,
} from "@/lib/whatsapp";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  phone?: string | null;
  variables: WhatsAppVariables;
  templateType?: WhatsAppTemplateType;
  defaultMessage?: string;
  context: { company_id?: string | null; contact_id?: string | null; deal_id?: string | null };
  onSent?: () => void;
}

export function WhatsAppActionDialog({
  open, onOpenChange, phone, variables, templateType, defaultMessage, context, onSent,
}: Props) {
  const { user } = useAuth();
  const [selectedTplId, setSelectedTplId] = useState<string>("custom");
  const [message, setMessage] = useState<string>(defaultMessage || "");

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

  const finishLog = async (result: "enviado" | "pendiente") => {
    if (!user) return;
    await logWhatsAppActivity({
      user_id: user.id, message, ...context, result,
      title: `WhatsApp · ${variables.empresa_nombre || ""}`.trim(),
    });
    onSent?.();
  };

  const handleSend = async () => {
    if (!normalized) { toast.error("Sin teléfono válido"); return; }
    openWhatsApp(normalized, message);
    await finishLog("enviado");
    toast.success("WhatsApp abierto. Recuerda enviar el mensaje.");
    onOpenChange(false);
  };

  const handleCopy = async () => {
    const ok = await copyMessage(message);
    if (ok) { await finishLog("pendiente"); toast.success("Mensaje copiado"); }
    else toast.error("No se pudo copiar");
  };

  const handleSendApi = async () => {
    if (!normalized) { toast.error("Sin teléfono válido"); return; }
    const { error } = await supabase.functions.invoke("whatsapp-send-message", {
      body: { to: normalized, message },
    });
    if (error) { toast.error(error.message); return; }
    await finishLog("enviado");
    toast.success("Mensaje enviado por API");
    onOpenChange(false);
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
    </Dialog>
  );
}
