import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Settings as SettingsIcon, Plus, Trash2, Zap } from "lucide-react";

type DaySetting = { enabled: boolean; start: string; end: string };
type BusinessHours = Record<
  "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday",
  DaySetting
> & { timezone: string };

type Settings = {
  id: number;
  business_hours: BusinessHours;
  away_template_name: string | null;
  away_template_language: string | null;
  bot_enabled: boolean;
  away_enabled: boolean;
};

type QuickReply = {
  id: string;
  shortcut: string;
  content: string;
  is_global: boolean;
  user_id: string | null;
};

type Template = { name: string; language: string; status: string };

const dayLabels: Record<string, string> = {
  monday: "Lunes", tuesday: "Martes", wednesday: "Miércoles", thursday: "Jueves",
  friday: "Viernes", saturday: "Sábado", sunday: "Domingo",
};

export default function WhatsAppSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [saving, setSaving] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDraft, setQrDraft] = useState<Partial<QuickReply>>({ shortcut: "", content: "", is_global: false });

  useEffect(() => {
    supabase
      .from("whatsapp_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => setSettings(data as unknown as Settings | null));
    supabase
      .from("whatsapp_templates")
      .select("name,language,status")
      .eq("status", "APPROVED")
      .then(({ data }) => setTemplates((data ?? []) as Template[]));
    loadQR();
  }, []);

  const loadQR = async () => {
    const { data } = await supabase
      .from("whatsapp_quick_replies")
      .select("*")
      .order("shortcut", { ascending: true });
    setQuickReplies((data ?? []) as QuickReply[]);
  };

  const updateDay = (day: keyof BusinessHours, patch: Partial<DaySetting>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      business_hours: {
        ...settings.business_hours,
        [day]: { ...(settings.business_hours[day as keyof BusinessHours] as DaySetting), ...patch },
      },
    });
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const { data: ures } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("whatsapp_settings")
      .update({
        business_hours: settings.business_hours,
        away_template_name: settings.away_template_name,
        away_template_language: settings.away_template_language,
        bot_enabled: settings.bot_enabled,
        away_enabled: settings.away_enabled,
        updated_by: ures.user?.id,
      })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Configuración guardada");
  };

  const saveQR = async () => {
    if (!qrDraft.shortcut?.trim() || !qrDraft.content?.trim()) {
      toast.error("Atajo y contenido son obligatorios");
      return;
    }
    const { data: ures } = await supabase.auth.getUser();
    const payload = {
      shortcut: qrDraft.shortcut.trim(),
      content: qrDraft.content.trim(),
      is_global: qrDraft.is_global ?? false,
      user_id: qrDraft.is_global ? null : ures.user?.id,
    };
    const q = qrDraft.id
      ? supabase.from("whatsapp_quick_replies").update(payload).eq("id", qrDraft.id)
      : supabase.from("whatsapp_quick_replies").insert(payload);
    const { error } = await q;
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Respuesta rápida guardada");
    setQrOpen(false);
    setQrDraft({ shortcut: "", content: "", is_global: false });
    loadQR();
  };

  const delQR = async (id: string) => {
    if (!confirm("¿Eliminar esta respuesta rápida?")) return;
    await supabase.from("whatsapp_quick_replies").delete().eq("id", id);
    loadQR();
  };

  if (!settings) {
    return <div className="text-muted-foreground">Cargando configuración…</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-primary" /> Configuración WhatsApp
        </h1>
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Horario laboral</h2>
            <p className="text-xs text-muted-foreground">Zona horaria: {settings.business_hours.timezone}</p>
          </div>
        </div>
        <div className="space-y-2">
          {(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const).map((d) => {
            const day = settings.business_hours[d];
            return (
              <div key={d} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-3 flex items-center gap-2">
                  <Switch checked={day.enabled} onCheckedChange={(v) => updateDay(d, { enabled: v })} />
                  <span className="text-sm">{dayLabels[d]}</span>
                </div>
                <Input
                  type="time"
                  className="col-span-3"
                  value={day.start}
                  onChange={(e) => updateDay(d, { start: e.target.value })}
                  disabled={!day.enabled}
                />
                <span className="col-span-1 text-center text-muted-foreground">a</span>
                <Input
                  type="time"
                  className="col-span-3"
                  value={day.end}
                  onChange={(e) => updateDay(d, { end: e.target.value })}
                  disabled={!day.enabled}
                />
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <h2 className="font-semibold">Auto-respuesta fuera de horario</h2>
        <div className="flex items-center justify-between">
          <Label>Activar auto-ausente</Label>
          <Switch checked={settings.away_enabled} onCheckedChange={(v) => setSettings({ ...settings, away_enabled: v })} />
        </div>
        <div>
          <Label>Plantilla a enviar</Label>
          <Select
            value={settings.away_template_name ?? ""}
            onValueChange={(v) => {
              const t = templates.find((x) => x.name === v);
              setSettings({ ...settings, away_template_name: v, away_template_language: t?.language ?? "es_MX" });
            }}
          >
            <SelectTrigger><SelectValue placeholder="Selecciona plantilla aprobada…" /></SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.name} value={t.name}>{t.name} ({t.language})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Solo se envía 1 vez cada 4h por contacto para no spamear.
          </p>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Bot por palabras clave</h2>
          <Switch checked={settings.bot_enabled} onCheckedChange={(v) => setSettings({ ...settings, bot_enabled: v })} />
        </div>
        <p className="text-xs text-muted-foreground">
          Si está apagado, las reglas configuradas no responderán automáticamente.
        </p>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar configuración"}</Button>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Respuestas rápidas
            </h2>
            <p className="text-xs text-muted-foreground">Frases frecuentes para insertar con un clic en el chat.</p>
          </div>
          <Dialog open={qrOpen} onOpenChange={setQrOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setQrDraft({ shortcut: "", content: "", is_global: false })}>
                <Plus className="h-4 w-4 mr-1" /> Nueva
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Respuesta rápida</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Atajo</Label>
                  <Input
                    value={qrDraft.shortcut ?? ""}
                    onChange={(e) => setQrDraft({ ...qrDraft, shortcut: e.target.value })}
                    placeholder="saludo, gracias, horario…"
                  />
                </div>
                <div>
                  <Label>Contenido</Label>
                  <Textarea
                    rows={4}
                    value={qrDraft.content ?? ""}
                    onChange={(e) => setQrDraft({ ...qrDraft, content: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Compartir con todo el equipo</Label>
                  <Switch
                    checked={qrDraft.is_global ?? false}
                    onCheckedChange={(v) => setQrDraft({ ...qrDraft, is_global: v })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setQrOpen(false)}>Cancelar</Button>
                <Button onClick={saveQR}>Guardar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="divide-y">
          {quickReplies.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-6">Sin respuestas rápidas.</div>
          ) : quickReplies.map((q) => (
            <div key={q.id} className="py-2 flex items-center gap-3">
              <code className="px-2 py-0.5 rounded bg-muted text-xs">/{q.shortcut}</code>
              <span className="flex-1 text-sm truncate">{q.content}</span>
              {q.is_global && <span className="text-[10px] text-primary">global</span>}
              <Button size="icon" variant="ghost" onClick={() => delQR(q.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}