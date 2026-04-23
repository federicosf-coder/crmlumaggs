import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Bot, Plus, Trash2, Pencil } from "lucide-react";

type Rule = {
  id: string;
  keyword: string;
  match_type: string;
  reply_text: string | null;
  reply_template_name: string | null;
  reply_template_language: string | null;
  is_active: boolean;
  priority: number;
};

type Template = { name: string; language: string; status: string };

const empty: Partial<Rule> = {
  keyword: "",
  match_type: "contains",
  reply_text: "",
  reply_template_name: null,
  reply_template_language: "es_MX",
  is_active: true,
  priority: 0,
};

export default function WhatsAppRules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Rule>>(empty);
  const [mode, setMode] = useState<"text" | "template">("text");

  const load = async () => {
    const { data } = await supabase
      .from("whatsapp_keyword_rules")
      .select("*")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });
    setRules((data ?? []) as Rule[]);
  };

  useEffect(() => {
    load();
    supabase
      .from("whatsapp_templates")
      .select("name,language,status")
      .eq("status", "APPROVED")
      .then(({ data }) => setTemplates((data ?? []) as Template[]));
  }, []);

  const openNew = () => {
    setDraft(empty);
    setMode("text");
    setOpen(true);
  };

  const openEdit = (r: Rule) => {
    setDraft(r);
    setMode(r.reply_template_name ? "template" : "text");
    setOpen(true);
  };

  const save = async () => {
    if (!draft.keyword?.trim()) {
      toast.error("La palabra clave es obligatoria");
      return;
    }
    const payload = {
      keyword: draft.keyword.trim(),
      match_type: draft.match_type ?? "contains",
      is_active: draft.is_active ?? true,
      priority: draft.priority ?? 0,
      reply_text: mode === "text" ? draft.reply_text || null : null,
      reply_template_name: mode === "template" ? draft.reply_template_name || null : null,
      reply_template_language: mode === "template" ? draft.reply_template_language || "es_MX" : null,
    };
    if (mode === "text" && !payload.reply_text) {
      toast.error("Falta el texto de respuesta");
      return;
    }
    if (mode === "template" && !payload.reply_template_name) {
      toast.error("Selecciona una plantilla");
      return;
    }
    const q = draft.id
      ? supabase.from("whatsapp_keyword_rules").update(payload).eq("id", draft.id)
      : supabase.from("whatsapp_keyword_rules").insert(payload);
    const { error } = await q;
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Regla guardada");
    setOpen(false);
    load();
  };

  const del = async (id: string) => {
    if (!confirm("¿Eliminar esta regla?")) return;
    const { error } = await supabase.from("whatsapp_keyword_rules").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    load();
  };

  const toggle = async (r: Rule) => {
    await supabase.from("whatsapp_keyword_rules").update({ is_active: !r.is_active }).eq("id", r.id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" /> Reglas del Bot
          </h1>
          <p className="text-sm text-muted-foreground">
            Respuesta automática cuando un mensaje entrante coincide con una palabra clave.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Nueva regla</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{draft.id ? "Editar regla" : "Nueva regla"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Palabra clave</Label>
                <Input
                  value={draft.keyword ?? ""}
                  onChange={(e) => setDraft({ ...draft, keyword: e.target.value })}
                  placeholder="precio, catálogo, horario…"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Coincidencia</Label>
                  <Select value={draft.match_type ?? "contains"} onValueChange={(v) => setDraft({ ...draft, match_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contains">Contiene</SelectItem>
                      <SelectItem value="exact">Exacta</SelectItem>
                      <SelectItem value="starts_with">Empieza con</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prioridad</Label>
                  <Input
                    type="number"
                    value={draft.priority ?? 0}
                    onChange={(e) => setDraft({ ...draft, priority: parseInt(e.target.value || "0", 10) })}
                  />
                </div>
              </div>
              <div>
                <Label>Tipo de respuesta</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as "text" | "template")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto libre (solo dentro de ventana 24h)</SelectItem>
                    <SelectItem value="template">Plantilla aprobada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {mode === "text" ? (
                <div>
                  <Label>Texto de respuesta</Label>
                  <Textarea
                    value={draft.reply_text ?? ""}
                    onChange={(e) => setDraft({ ...draft, reply_text: e.target.value })}
                    rows={3}
                  />
                </div>
              ) : (
                <div>
                  <Label>Plantilla</Label>
                  <Select
                    value={draft.reply_template_name ?? ""}
                    onValueChange={(v) => {
                      const t = templates.find((x) => x.name === v);
                      setDraft({ ...draft, reply_template_name: v, reply_template_language: t?.language ?? "es_MX" });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.name} value={t.name}>{t.name} ({t.language})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center justify-between">
                <Label>Activa</Label>
                <Switch
                  checked={draft.is_active ?? true}
                  onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="divide-y">
        {rules.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Sin reglas. Crea la primera para que el bot responda automáticamente.
          </div>
        ) : rules.map((r) => (
          <div key={r.id} className="p-3 flex items-center gap-3">
            <Switch checked={r.is_active} onCheckedChange={() => toggle(r)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{r.keyword}</span>
                <Badge variant="outline" className="text-[10px]">{r.match_type}</Badge>
                <Badge variant="secondary" className="text-[10px]">prio {r.priority}</Badge>
                {r.reply_template_name && <Badge className="text-[10px]">📋 {r.reply_template_name}</Badge>}
              </div>
              <div className="text-sm text-muted-foreground truncate">
                {r.reply_text || `Plantilla: ${r.reply_template_name}`}
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => del(r.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </Card>
    </div>
  );
}