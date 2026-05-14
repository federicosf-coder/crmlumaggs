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
  notification_delay_minutes: number;
  unassigned_strategy: "notify_admin" | "round_robin" | "notify_team";
  // Nota: aunque el tipo conserva los valores antiguos para compatibilidad de
  // datos existentes, la nueva semántica solo distingue entre `notify_admin`
  // (alertar al admin cuando un mensaje sigue sin leer) y `none` (no hacer nada).
  admin_phone: string | null;
  critical_escalation_enabled: boolean;
  critical_escalation_hours: number;
  supervisor_phone: string | null;
  alert_template_name: string | null;
  alert_template_language: string | null;
};

type QuickReply = {
  id: string;
  shortcut: string;
  content: string;
  is_global: boolean;
  user_id: string | null;
};

type Template = { name: string; language: string; status: string };
type WhatsAppAccount = {
  id: string;
  business_phone_number_id: string;
  label: string;
  color: string;
  display_phone: string | null;
  is_active: boolean;
};

const dayLabels: Record<string, string> = {
  monday: "Lunes", tuesday: "Martes", wednesday: "Miércoles", thursday: "Jueves",
  friday: "Viernes", saturday: "Sábado", sunday: "Domingo",
};

export default function WhatsAppSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [acctDraft, setAcctDraft] = useState<Partial<WhatsAppAccount>>({
    label: "",
    business_phone_number_id: "",
    color: "#10b981",
    display_phone: "",
    is_active: true,
  });
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
    loadAccounts();
  }, []);

  const loadQR = async () => {
    const { data } = await supabase
      .from("whatsapp_quick_replies")
      .select("*")
      .order("shortcut", { ascending: true });
    setQuickReplies((data ?? []) as QuickReply[]);
  };

  const loadAccounts = async () => {
    const { data } = await supabase
      .from("whatsapp_accounts")
      .select("*")
      .order("label", { ascending: true });
    setAccounts((data ?? []) as WhatsAppAccount[]);
  };

  const saveAccount = async () => {
    if (!acctDraft.label?.trim() || !acctDraft.business_phone_number_id?.trim()) {
      toast.error("Etiqueta y phone_number_id son obligatorios");
      return;
    }
    const payload = {
      label: acctDraft.label!.trim(),
      business_phone_number_id: acctDraft.business_phone_number_id!.trim(),
      color: acctDraft.color || "#10b981",
      display_phone: acctDraft.display_phone?.trim() || null,
      is_active: acctDraft.is_active ?? true,
    };
    const { error } = acctDraft.id
      ? await supabase.from("whatsapp_accounts").update(payload).eq("id", acctDraft.id)
      : await supabase.from("whatsapp_accounts").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Cuenta guardada");
    setAcctDraft({ label: "", business_phone_number_id: "", color: "#10b981", display_phone: "", is_active: true });
    loadAccounts();
  };

  const delAccount = async (id: string) => {
    const { error } = await supabase.from("whatsapp_accounts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    loadAccounts();
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
        notification_delay_minutes: settings.notification_delay_minutes,
        unassigned_strategy: settings.unassigned_strategy,
        admin_phone: settings.admin_phone,
        critical_escalation_enabled: settings.critical_escalation_enabled,
        critical_escalation_hours: settings.critical_escalation_hours,
        supervisor_phone: settings.supervisor_phone,
        alert_template_name: settings.alert_template_name,
        alert_template_language: settings.alert_template_language,
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
        <div>
          <h2 className="font-semibold">Reglas de Respuesta y Alertas</h2>
          <p className="text-xs text-muted-foreground">
            Define cómo y cuándo se notifica por WhatsApp cuando un mensaje no es atendido a tiempo.
          </p>
        </div>

        <div>
          <Label>Tiempo sin leer antes de alertar</Label>
          <Select
            value={String(settings.notification_delay_minutes)}
            onValueChange={(v) => setSettings({ ...settings, notification_delay_minutes: Number(v) })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 minutos</SelectItem>
              <SelectItem value="15">15 minutos</SelectItem>
              <SelectItem value="30">30 minutos</SelectItem>
              <SelectItem value="60">60 minutos</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Si una conversación entrante permanece sin leer durante este tiempo,
            se considera vencida y se dispara la alerta.
          </p>
        </div>

        <div>
          <Label>Monitoreo de Mensajes Sin Leer</Label>
          <Select
            value={settings.unassigned_strategy}
            onValueChange={(v) => setSettings({ ...settings, unassigned_strategy: v as Settings["unassigned_strategy"] })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="notify_admin">Notificar al Administrador al expirar tiempo</SelectItem>
              <SelectItem value="none">No hacer nada</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Aplica a cualquier mensaje entrante (de contactos conocidos o no).
            El temporizador se cancela automáticamente si alguien abre o
            responde la conversación a tiempo.
          </p>
        </div>

        {settings.unassigned_strategy === "notify_admin" && (
          <div>
            <Label>Teléfono del Administrador</Label>
            <Input
              placeholder="+52 ..."
              value={settings.admin_phone ?? ""}
              onChange={(e) => setSettings({ ...settings, admin_phone: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Número al que se enviará la plantilla de alerta cuando una
              conversación quede sin leer más del tiempo configurado.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <div>
            <Label>Escalación Crítica</Label>
            <p className="text-xs text-muted-foreground">
              Avisar a un supervisor si pasa demasiado tiempo sin respuesta.
            </p>
          </div>
          <Switch
            checked={settings.critical_escalation_enabled}
            onCheckedChange={(v) => setSettings({ ...settings, critical_escalation_enabled: v })}
          />
        </div>

        {settings.critical_escalation_enabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Horas sin respuesta antes de escalar</Label>
              <Input
                type="number"
                min={1}
                value={settings.critical_escalation_hours}
                onChange={(e) => setSettings({ ...settings, critical_escalation_hours: Math.max(1, Number(e.target.value) || 1) })}
              />
            </div>
            <div>
              <Label>Teléfono del Supervisor</Label>
              <Input
                placeholder="+52 ..."
                value={settings.supervisor_phone ?? ""}
                onChange={(e) => setSettings({ ...settings, supervisor_phone: e.target.value })}
              />
            </div>
          </div>
        )}

        <div className="pt-2 border-t">
          <Label>Plantilla de alerta</Label>
          <Select
            value={settings.alert_template_name ?? ""}
            onValueChange={(v) => {
              const t = templates.find((x) => x.name === v);
              setSettings({ ...settings, alert_template_name: v, alert_template_language: t?.language ?? "es_MX" });
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
            Plantilla aprobada de Meta que se usará al enviar la alerta al usuario / administrador.
          </p>
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

      {/* Cuentas de WhatsApp (multi-número) */}
      <Card className="p-4 space-y-4">
        <div>
          <div className="flex items-center gap-2 font-medium">
            <SettingsIcon className="h-4 w-4 text-primary" /> Cuentas de WhatsApp (multi-número)
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Registra cada línea de Meta con su <code>phone_number_id</code> y una etiqueta visible (ej. "Maggs", "Chevron").
            Esto permite mostrar a qué cuenta pertenece cada chat y filtrar plantillas por cuenta.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
          <div className="md:col-span-1">
            <Label className="text-xs">Etiqueta</Label>
            <Input
              placeholder="Maggs"
              value={acctDraft.label ?? ""}
              onChange={(e) => setAcctDraft({ ...acctDraft, label: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">phone_number_id (Meta)</Label>
            <Input
              placeholder="123456789012345"
              value={acctDraft.business_phone_number_id ?? ""}
              onChange={(e) => setAcctDraft({ ...acctDraft, business_phone_number_id: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Teléfono visible</Label>
            <Input
              placeholder="+52 ..."
              value={acctDraft.display_phone ?? ""}
              onChange={(e) => setAcctDraft({ ...acctDraft, display_phone: e.target.value })}
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs">Color</Label>
              <Input
                type="color"
                value={acctDraft.color ?? "#10b981"}
                onChange={(e) => setAcctDraft({ ...acctDraft, color: e.target.value })}
                className="h-9 p-1"
              />
            </div>
            <Button onClick={saveAccount}>{acctDraft.id ? "Actualizar" : "Agregar"}</Button>
          </div>
        </div>

        <div className="divide-y">
          {accounts.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-6">Sin cuentas registradas.</div>
          ) : (
            accounts.map((a) => (
              <div key={a.id} className="py-2 flex items-center gap-3">
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded"
                  style={{ backgroundColor: `${a.color}22`, color: a.color }}
                >
                  {a.label}
                </span>
                <code className="text-xs text-muted-foreground">{a.business_phone_number_id}</code>
                {a.display_phone && <span className="text-xs">{a.display_phone}</span>}
                {!a.is_active && <span className="text-[10px] text-destructive">inactiva</span>}
                <div className="flex-1" />
                <Button size="sm" variant="ghost" onClick={() => setAcctDraft(a)}>
                  Editar
                </Button>
                <Button size="icon" variant="ghost" onClick={() => delAccount(a.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}