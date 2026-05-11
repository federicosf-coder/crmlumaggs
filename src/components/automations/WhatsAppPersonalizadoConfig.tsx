import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Settings2, Smartphone, Cloud, Search, FileText } from "lucide-react";
import { TemplatePickerDialog } from "@/components/whatsapp/TemplatePickerDialog";

type WaTemplate = { id: string; name: string; language: string | null; category: string | null; status: string | null; body: string | null };

type Mode = "api" | "local";

export interface WhatsAppPersonalizadoConfig {
  mode: Mode;
  template_id?: string | null;
  template_name?: string | null;
  default_message?: string;
  to_type?: "contacto_principal" | "campo_telefono";
  phone_field?: string;
  require_confirmation?: boolean;
}

export function WhatsAppPersonalizadoEditor({
  cfg, setCfg,
}: {
  cfg: WhatsAppPersonalizadoConfig;
  setCfg: (patch: Partial<WhatsAppPersonalizadoConfig>) => void;
}) {
  const [open, setOpen] = useState(false);
  const summary = cfg?.mode
    ? cfg.mode === "api"
      ? `Mensaje API · ${cfg.template_name || "(sin plantilla)"}`
      : `Mensaje Local · ${(cfg.default_message || "").slice(0, 40) || "(sin mensaje)"}${(cfg.default_message || "").length > 40 ? "…" : ""}`
    : "Sin configurar";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">Configuración</div>
          <div className="text-sm font-medium truncate flex items-center gap-1.5">
            {cfg?.mode === "local" ? <Smartphone className="h-3.5 w-3.5 text-primary" /> : cfg?.mode === "api" ? <Cloud className="h-3.5 w-3.5 text-primary" /> : <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className="truncate">{summary}</span>
            {cfg?.require_confirmation !== false && (
              <Badge variant="outline" className="text-[10px] ml-1">Confirmar antes de enviar</Badge>
            )}
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Settings2 className="h-3.5 w-3.5 mr-1" /> Configurar
        </Button>
      </div>
      <ConfigDialog open={open} onOpenChange={setOpen} cfg={cfg} setCfg={setCfg} />
    </div>
  );
}

function ConfigDialog({
  open, onOpenChange, cfg, setCfg,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cfg: WhatsAppPersonalizadoConfig;
  setCfg: (patch: Partial<WhatsAppPersonalizadoConfig>) => void;
}) {
  const [mode, setMode] = useState<Mode>(cfg?.mode || "local");
  const [templateId, setTemplateId] = useState<string>(cfg?.template_id || "");
  const [defaultMessage, setDefaultMessage] = useState<string>(cfg?.default_message || "");
  const [toType, setToType] = useState<"contacto_principal" | "campo_telefono">(cfg?.to_type || "contacto_principal");
  const [phoneField, setPhoneField] = useState<string>(cfg?.phone_field || "");
  const [requireConfirm, setRequireConfirm] = useState<boolean>(cfg?.require_confirmation !== false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("whatsapp_templates")
        .select("id,name,language,category,status,body")
        .order("name", { ascending: true });
      setTemplates((data || []) as WaTemplate[]);
    })();
  }, [open]);

  useEffect(() => {
    if (open) {
      setMode(cfg?.mode || "local");
      setTemplateId(cfg?.template_id || "");
      setDefaultMessage(cfg?.default_message || "");
      setToType(cfg?.to_type || "contacto_principal");
      setPhoneField(cfg?.phone_field || "");
      setRequireConfirm(cfg?.require_confirmation !== false);
    }
  }, [open]); // eslint-disable-line

  const selectedTpl = templates.find((t) => t.id === templateId);

  const handleSave = () => {
    setCfg({
      mode,
      template_id: mode === "api" ? templateId || null : null,
      template_name: mode === "api" ? selectedTpl?.name || null : null,
      default_message: mode === "local" ? defaultMessage : undefined,
      to_type: toType,
      phone_field: toType === "campo_telefono" ? phoneField : undefined,
      require_confirmation: requireConfirm,
    });
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" /> Enviar WhatsApp personalizado
            </DialogTitle>
            <DialogDescription>
              Configura el modo de envío. Antes de ejecutarse se solicitará confirmación.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm">Tipo de mensaje</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="grid grid-cols-2 gap-2 mt-1.5">
                <label className={`flex items-start gap-2 rounded-md border p-3 cursor-pointer ${mode === "api" ? "border-primary bg-primary/5" : ""}`}>
                  <RadioGroupItem value="api" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium flex items-center gap-1"><Cloud className="h-3.5 w-3.5" /> API</div>
                    <div className="text-xs text-muted-foreground">Envío por la API oficial usando una plantilla aprobada.</div>
                  </div>
                </label>
                <label className={`flex items-start gap-2 rounded-md border p-3 cursor-pointer ${mode === "local" ? "border-primary bg-primary/5" : ""}`}>
                  <RadioGroupItem value="local" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium flex items-center gap-1"><Smartphone className="h-3.5 w-3.5" /> Local</div>
                    <div className="text-xs text-muted-foreground">Abre WhatsApp Web/móvil con el mensaje precargado.</div>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {mode === "api" && (
              <div className="space-y-2">
                <Label className="text-sm">Plantilla</Label>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="w-full flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">
                      {selectedTpl
                        ? <>{selectedTpl.name}{selectedTpl.language ? <span className="text-muted-foreground"> · {selectedTpl.language}</span> : null}{selectedTpl.status ? <span className="text-muted-foreground"> · {selectedTpl.status}</span> : null}</>
                        : <span className="text-muted-foreground">Selecciona una plantilla...</span>}
                    </span>
                  </span>
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              </div>
            )}

            {mode === "local" && (
              <div className="space-y-2">
                <Label className="text-sm">Mensaje predeterminado</Label>
                <Textarea
                  rows={5}
                  value={defaultMessage}
                  onChange={(e) => setDefaultMessage(e.target.value)}
                  placeholder="Hola {{contacto_nombre}}, te escribo de {{empresa_vendedora}}..."
                />
                <p className="text-xs text-muted-foreground">
                  Puedes usar variables como {`{{contacto_nombre}}`}, {`{{empresa_nombre}}`}, {`{{folio_cotizacion}}`}.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm">Destinatario</Label>
              <Select value={toType} onValueChange={(v) => setToType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contacto_principal">Contacto principal</SelectItem>
                  <SelectItem value="campo_telefono">Campo de teléfono</SelectItem>
                </SelectContent>
              </Select>
              {toType === "campo_telefono" && (
                <Input
                  value={phoneField}
                  onChange={(e) => setPhoneField(e.target.value)}
                  placeholder="ej. company.phone o contact.mobile"
                />
              )}
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={requireConfirm}
                onChange={(e) => setRequireConfirm(e.target.checked)}
              />
              Confirmar antes de enviar
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar configuración</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TemplatePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        templates={templates}
        selectedId={templateId}
        onSelect={(id) => { setTemplateId(id); setPickerOpen(false); }}
      />
    </>
  );
}

