import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Save, X, Copy, AlertTriangle } from "lucide-react";
import {
  CATEGORY_LABELS, Template, TemplateCategory, TemplatePlaceholder, TemplateType,
  unknownPlaceholders,
} from "@/lib/templates";
import { TemplateAttachmentsManager } from "@/components/templates/TemplateAttachmentsManager";
import { EmailRecipientsInput } from "@/components/templates/EmailRecipientsInput";
import { RichTextEditor } from "@/components/templates/RichTextEditor";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Template | null;
  onSaved: () => void;
}

const schema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(120),
  type: z.enum(["email", "whatsapp"]),
  category: z.string().min(1, "Categoría requerida"),
  subject: z.string().max(200).optional().nullable(),
  body: z.string().trim().min(1, "Mensaje requerido").max(8000),
  description: z.string().max(500).optional().nullable(),
  is_active: z.boolean(),
}).refine(d => d.type !== "email" || (!!d.subject && d.subject.trim().length > 0), {
  message: "Asunto requerido para email", path: ["subject"],
});

const empty = (): Partial<Template> => ({
  name: "", type: "whatsapp", category: "general",
  subject: "", body: "", description: "", is_active: true,
  to_emails: [], cc_emails: [], bcc_emails: [], reply_to: "",
});

export function TemplateFormDialog({ open, onOpenChange, editing, onSaved }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState<Partial<Template>>(empty());
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      ...editing,
      to_emails: (editing as any).to_emails || [],
      cc_emails: (editing as any).cc_emails || [],
      bcc_emails: (editing as any).bcc_emails || [],
      reply_to: (editing as any).reply_to || "",
    } : empty());
    setCreatedId(editing?.id || null);
  }, [open, editing]);

  const { data: placeholders } = useQuery({
    queryKey: ["template-placeholders"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("template_placeholders").select("*")
        .eq("is_active", true).order("sort_order");
      if (error) throw error;
      return (data || []) as TemplatePlaceholder[];
    },
    enabled: open,
  });

  const visiblePlaceholders = useMemo(
    () => (placeholders || []).filter(p => p.applies_to === "ambos" || p.applies_to === form.type),
    [placeholders, form.type]
  );

  const unknown = useMemo(
    () => unknownPlaceholders(form.body || "", placeholders || []),
    [form.body, placeholders]
  );

  const insertPlaceholder = (key: string) => {
    setForm(f => ({ ...f, body: (f.body || "") + " " + key }));
  };

  const handleSave = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Datos inválidos");
      return;
    }
    if (!user) return;
    setSaving(true);
    const payload: any = {
      name: parsed.data.name,
      type: parsed.data.type,
      category: parsed.data.category,
      subject: parsed.data.type === "email" ? parsed.data.subject : null,
      body: parsed.data.body,
      description: parsed.data.description || null,
      is_active: parsed.data.is_active,
      updated_by: user.id,
      to_emails: parsed.data.type === "email" ? (form.to_emails || []) : [],
      cc_emails: parsed.data.type === "email" ? (form.cc_emails || []) : [],
      bcc_emails: parsed.data.type === "email" ? (form.bcc_emails || []) : [],
      reply_to: parsed.data.type === "email" ? (form.reply_to?.trim() || null) : null,
    };
    let error;
    let savedId = editing?.id || createdId;
    if (editing) {
      ({ error } = await (supabase as any).from("templates").update(payload).eq("id", editing.id));
    } else if (createdId) {
      ({ error } = await (supabase as any).from("templates").update(payload).eq("id", createdId));
    } else {
      payload.created_by = user.id;
      const ins = await (supabase as any).from("templates").insert(payload).select("id").single();
      error = ins.error;
      if (!error) {
        savedId = ins.data?.id || null;
        setCreatedId(savedId);
      }
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing || createdId ? "Plantilla actualizada" : "Plantilla creada. Ya puedes agregar adjuntos.");
    onSaved();
    // Keep dialog open if it's a new template so the user can add attachments
    if (editing || createdId) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{editing ? "Editar" : "Nueva"} plantilla</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-6 pb-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-3">
              <div className="space-y-1">
                <Label>Nombre *</Label>
                <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Tipo *</Label>
                  <Select value={form.type} onValueChange={(v: TemplateType) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Categoría *</Label>
                  <Select value={form.category} onValueChange={(v: TemplateCategory) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([k, l]) => (
                        <SelectItem key={k} value={k}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.type === "email" && (
                <div className="space-y-1">
                  <Label>Asunto *</Label>
                  <Input value={form.subject || ""} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={200} />
                </div>
              )}

              {form.type === "email" && (
                <div className="space-y-3 rounded-md border p-3 bg-muted/20">
                  <div className="space-y-1">
                    <Label>Para</Label>
                    <EmailRecipientsInput
                      value={(form.to_emails as any) || []}
                      onChange={(v) => setForm({ ...form, to_emails: v as any })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>CC</Label>
                    <EmailRecipientsInput
                      value={(form.cc_emails as any) || []}
                      onChange={(v) => setForm({ ...form, cc_emails: v as any })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>CCO</Label>
                    <EmailRecipientsInput
                      value={(form.bcc_emails as any) || []}
                      onChange={(v) => setForm({ ...form, bcc_emails: v as any })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Responder a</Label>
                    <Input
                      type="email"
                      placeholder="correo@empresa.com"
                      value={form.reply_to || ""}
                      onChange={(e) => setForm({ ...form, reply_to: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label>Mensaje *</Label>
                {form.type === "email" ? (
                  <RichTextEditor
                    value={form.body || ""}
                    onChange={(html) => setForm((f) => ({ ...f, body: html }))}
                    placeholders={visiblePlaceholders}
                  />
                ) : (
                  <Textarea
                    rows={10}
                    value={form.body || ""}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                    placeholder="Hola {nombre_contacto}, te comparto la cotización {folio_cotizacion}..."
                    maxLength={8000}
                  />
                )}
              </div>

              {unknown.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Placeholders no reconocidos: {unknown.map(k => `{${k}}`).join(", ")}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-1">
                <Label>Descripción</Label>
                <Textarea rows={2} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} />
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={!!form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>Activa</Label>
              </div>

              <div className="pt-3 border-t">
                <TemplateAttachmentsManager templateId={editing?.id || createdId} />
              </div>
            </div>

            <div className="md:col-span-1 space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Placeholders disponibles</Label>
              <ScrollArea className="h-[450px] rounded border bg-muted/30 p-2">
                <div className="space-y-1">
                  {visiblePlaceholders.map(p => (
                    <div key={p.id} className="group flex items-start gap-2 rounded p-2 hover:bg-background border border-transparent hover:border-border">
                      <div className="flex-1 min-w-0">
                        <code className="text-xs font-mono text-primary block truncate">{p.key}</code>
                        <p className="text-[11px] text-muted-foreground truncate">{p.label}</p>
                      </div>
                      <Button
                        type="button" size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={() => insertPlaceholder(p.key)} title="Insertar"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {visiblePlaceholders.length === 0 && (
                    <p className="text-xs text-muted-foreground p-2">Sin placeholders.</p>
                  )}
                </div>
              </ScrollArea>
              <p className="text-[11px] text-muted-foreground">Click en <Badge variant="outline" className="px-1 text-[10px]">copiar</Badge> para insertar al final del mensaje.</p>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 pb-6 pt-2 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-1" /> Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}