import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { MessageCircle, Send, UserPlus, Lock, Zap } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

type Conversation = {
  id: string;
  wa_phone: string;
  contact_id: string | null;
  wa_profile_name: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  status: string;
  business_phone_number_id: string | null;
};

type Message = {
  id: string;
  conversation_id: string | null;
  sender_phone: string | null;
  message_body: string | null;
  direction: string;
  status: string | null;
  template_name: string | null;
  created_at: string;
};

type Template = { id: string; name: string; language: string; status: string; body: string | null };
type Account = { id: string; business_phone_number_id: string; label: string; color: string };
type TemplateWithAccount = Template & { business_phone_number_id: string | null };
type QuickReply = { id: string; shortcut: string; content: string };

export default function WhatsAppInbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contactName, setContactName] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateWithAccount[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [qrOpen, setQrOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [tplName, setTplName] = useState("");
  const [sending, setSending] = useState(false);

  // Load conversations + realtime
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("whatsapp_conversations")
        .select("*")
        .order("last_inbound_at", { ascending: false, nullsFirst: false })
        .limit(200);
      setConversations((data ?? []) as Conversation[]);
    };
    load();
    const ch = supabase
      .channel("wa-conv")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // Load templates
  useEffect(() => {
    supabase
      .from("whatsapp_templates")
      .select("id,name,language,status,body,business_phone_number_id")
      .eq("status", "APPROVED")
      .then(({ data }) => setTemplates((data ?? []) as TemplateWithAccount[]));
    supabase
      .from("whatsapp_quick_replies")
      .select("id,shortcut,content")
      .order("shortcut")
      .then(({ data }) => setQuickReplies((data ?? []) as QuickReply[]));
    supabase
      .from("whatsapp_accounts")
      .select("id,business_phone_number_id,label,color")
      .eq("is_active", true)
      .then(({ data }) => setAccounts((data ?? []) as Account[]));
  }, []);

  const active = useMemo(() => conversations.find((c) => c.id === activeId) ?? null, [activeId, conversations]);
  const accountByPhoneId = useMemo(() => {
    const map = new Map<string, Account>();
    accounts.forEach((a) => map.set(a.business_phone_number_id, a));
    return map;
  }, [accounts]);
  const activeAccount = active?.business_phone_number_id
    ? accountByPhoneId.get(active.business_phone_number_id) ?? null
    : null;
  // Filter templates: only show those authorized for the active conversation's line.
  // If template has no business_phone_number_id (legacy), show it for all.
  const filteredTemplates = useMemo(() => {
    if (!active) return templates;
    const convPhoneId = active.business_phone_number_id;
    if (!convPhoneId) return templates;
    return templates.filter(
      (t) => !t.business_phone_number_id || t.business_phone_number_id === convPhoneId,
    );
  }, [templates, active]);

  // Load messages for active + realtime
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setContactName(null);
      return;
    }
    const loadMsgs = async () => {
      const { data } = await supabase
        .from("whatsapp_messages")
        .select("id,conversation_id,sender_phone,message_body,direction,status,template_name,created_at")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true })
        .limit(500);
      setMessages((data ?? []) as Message[]);
    };
    loadMsgs();
    // mark read
    supabase.from("whatsapp_conversations").update({ unread_count: 0 }).eq("id", activeId).then(() => {});
    // contact name
    if (active?.contact_id) {
      supabase
        .from("contacts")
        .select("first_name,last_name")
        .eq("id", active.contact_id)
        .maybeSingle()
        .then(({ data }) => setContactName(data ? `${data.first_name} ${data.last_name}` : null));
    } else {
      setContactName(null);
    }
    const ch = supabase
      .channel(`wa-msg-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages", filter: `conversation_id=eq.${activeId}` },
        loadMsgs,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [activeId, active?.contact_id]);

  const windowOpen = useMemo(() => {
    if (!active?.last_inbound_at) return false;
    return Date.now() - new Date(active.last_inbound_at).getTime() < 24 * 60 * 60 * 1000;
  }, [active]);

  const sendText = async () => {
    if (!active || !draft.trim()) return;
    setSending(true);
    const { error } = await supabase.functions.invoke("whatsapp-send-message", {
      body: {
        to_phone: active.wa_phone,
        conversation_id: active.id,
        kind: "text",
        text: draft.trim(),
        business_phone_number_id: active.business_phone_number_id ?? undefined,
      },
    });
    setSending(false);
    if (error) {
      toast.error(error.message ?? "No se pudo enviar");
      return;
    }
    setDraft("");
  };

  const sendTemplate = async () => {
    if (!active || !tplName) return;
    const tpl = templates.find((t) => t.name === tplName);
    setSending(true);
    const { error } = await supabase.functions.invoke("whatsapp-send-message", {
      body: {
        to_phone: active.wa_phone,
        conversation_id: active.id,
        kind: "template",
        template_name: tpl?.name,
        template_language: tpl?.language ?? "es_MX",
        business_phone_number_id: active.business_phone_number_id ?? undefined,
      },
    });
    setSending(false);
    if (error) {
      toast.error(error.message ?? "No se pudo enviar plantilla");
      return;
    }
    setTplName("");
    toast.success("Plantilla enviada");
  };

  const changeAccount = async (newPhoneId: string) => {
    if (!active) return;
    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({ business_phone_number_id: newPhoneId })
      .eq("id", active.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setConversations((prev) =>
      prev.map((c) => (c.id === active.id ? { ...c, business_phone_number_id: newPhoneId } : c)),
    );
    const acct = accountByPhoneId.get(newPhoneId);
    toast.success(`Línea cambiada a ${acct?.label ?? newPhoneId}`);
  };

  const createContact = async () => {
    if (!active) return;
    const fullName = active.wa_profile_name?.trim() || `WhatsApp ${active.wa_phone}`;
    const [first, ...rest] = fullName.split(" ");
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        first_name: first || "WhatsApp",
        last_name: rest.join(" ") || active.wa_phone,
        whatsapp_phone: active.wa_phone,
        mobile: active.wa_phone,
      })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("whatsapp_conversations").update({ contact_id: data!.id }).eq("id", active.id);
    toast.success("Contacto creado");
  };

  const syncTemplates = async () => {
    const { data, error } = await supabase.functions.invoke("whatsapp-sync-templates", { body: {} });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${data?.upserted ?? 0} plantillas sincronizadas`);
    const { data: t } = await supabase
      .from("whatsapp_templates")
        .select("id,name,language,status,body,business_phone_number_id")
      .eq("status", "APPROVED");
    setTemplates((t ?? []) as TemplateWithAccount[]);
  };

  return (
    <div className="grid grid-cols-12 gap-4 h-[calc(100vh-8rem)]">
      {/* Conversaciones */}
      <Card className="col-span-3 flex flex-col">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <MessageCircle className="h-4 w-4 text-primary" /> WhatsApp
          </div>
          <Button size="sm" variant="outline" onClick={syncTemplates}>
            Sync templates
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {conversations.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Sin conversaciones aún.</div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full text-left p-3 border-b hover:bg-accent transition ${activeId === c.id ? "bg-accent" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">
                    {c.wa_profile_name || c.wa_phone}
                  </span>
                  {c.unread_count > 0 && <Badge variant="default">{c.unread_count}</Badge>}
                </div>
                {(() => {
                  const acct = c.business_phone_number_id
                    ? accountByPhoneId.get(c.business_phone_number_id)
                    : null;
                  return acct ? (
                    <span
                      className="inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: `${acct.color}22`, color: acct.color }}
                    >
                      {acct.label}
                    </span>
                  ) : null;
                })()}
                <div className="text-xs text-muted-foreground truncate">{c.last_message_preview || "—"}</div>
              </button>
            ))
          )}
        </ScrollArea>
      </Card>

      {/* Chat */}
      <Card className="col-span-6 flex flex-col">
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Selecciona una conversación
          </div>
        ) : (
          <>
            <div className="p-3 border-b">
              <div className="flex items-center gap-2">
                <div className="font-medium">{contactName || active.wa_profile_name || active.wa_phone}</div>
                {activeAccount && (
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: `${activeAccount.color}22`, color: activeAccount.color }}
                  >
                    {activeAccount.label}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">+{active.wa_phone}</div>
              {accounts.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] uppercase text-muted-foreground tracking-wide">
                    Enviar desde
                  </span>
                  <select
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                    value={active.business_phone_number_id ?? ""}
                    onChange={(e) => changeAccount(e.target.value)}
                  >
                    <option value="" disabled>
                      — Selecciona línea —
                    </option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.business_phone_number_id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-2">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                      m.direction === "outbound"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {m.template_name && <div className="text-[10px] uppercase opacity-70">📋 {m.template_name}</div>}
                    <div className="whitespace-pre-wrap">{m.message_body}</div>
                    <div className="text-[10px] opacity-70 mt-1">
                      {new Date(m.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="p-3 border-t space-y-2">
              {!windowOpen && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-2 rounded">
                  <Lock className="h-3 w-3" />
                  Ventana de atención cerrada (24h). Use una plantilla para reanudar.
                </div>
              )}
              <div className="flex gap-2">
                <Textarea
                  placeholder={windowOpen ? "Escribe un mensaje..." : "Bloqueado — usa una plantilla"}
                  value={draft}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraft(v);
                    if (v.endsWith("/") && quickReplies.length > 0) setQrOpen(true);
                  }}
                  disabled={!windowOpen || sending}
                  className="min-h-[60px]"
                />
                <Popover open={qrOpen} onOpenChange={setQrOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={!windowOpen || quickReplies.length === 0}
                      title="Respuestas rápidas"
                    >
                      <Zap className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 p-0">
                    <div className="p-2 text-xs text-muted-foreground border-b">
                      Respuestas rápidas
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {quickReplies.map((q) => (
                        <button
                          key={q.id}
                          className="w-full text-left p-2 hover:bg-accent text-sm border-b last:border-b-0"
                          onClick={() => {
                            const base = draft.endsWith("/") ? draft.slice(0, -1) : draft;
                            setDraft((base ? base + " " : "") + q.content);
                            setQrOpen(false);
                          }}
                        >
                          <div className="font-medium text-xs text-primary">/{q.shortcut}</div>
                          <div className="text-xs text-muted-foreground truncate">{q.content}</div>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Button onClick={sendText} disabled={!windowOpen || sending || !draft.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2">
                <select
                  className="flex-1 h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                >
                  <option value="">
                    — Enviar plantilla {activeAccount ? `(${activeAccount.label})` : ""} —
                  </option>
                  {filteredTemplates.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name} ({t.language})
                    </option>
                  ))}
                </select>
                <Button variant="outline" size="sm" onClick={sendTemplate} disabled={!tplName || sending}>
                  Enviar plantilla
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Lateral */}
      <Card className="col-span-3 p-3">
        {!active ? (
          <div className="text-sm text-muted-foreground">Datos del contacto</div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground">Nombre WhatsApp</div>
              <div className="text-sm font-medium">{active.wa_profile_name || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Teléfono</div>
              <div className="text-sm">+{active.wa_phone}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Contacto CRM</div>
              {contactName ? (
                <div className="text-sm font-medium text-primary">{contactName}</div>
              ) : (
                <Button size="sm" variant="outline" onClick={createContact} className="mt-1">
                  <UserPlus className="h-3 w-3 mr-1" /> Crear contacto
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
