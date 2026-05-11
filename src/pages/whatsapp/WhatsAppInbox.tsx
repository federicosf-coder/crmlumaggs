import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { MessageCircle, Send, UserPlus, Lock, Zap, Inbox, Pencil, Building2, Eye, Briefcase, Plus, FileText, Search } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ContactFormDialog, type ContactEditData } from "@/components/ContactFormDialog";
import { CompanyFormDialog, type CompanyData } from "@/components/CompanyFormDialog";
import { CreateCrmDealDialog } from "@/components/crm/CreateCrmDealDialog";
import { TemplatePickerDialog } from "@/components/whatsapp/TemplatePickerDialog";
import { useNavigate } from "react-router-dom";

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
  whatsapp_account_id: string | null;
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
type Account = { id: string; business_phone_number_id: string; label: string; color: string; waba_id: string | null };
type TemplateWithAccount = Template & { business_phone_number_id: string | null; waba_id: string | null };
type QuickReply = { id: string; shortcut: string; content: string };

function extractTemplateVars(body: string): number {
  const matches = body.match(/\{\{\s*(\d+)\s*\}\}/g) || [];
  let max = 0;
  for (const m of matches) {
    const n = parseInt(m.replace(/[^\d]/g, ""), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max;
}

export default function WhatsAppInbox() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contactName, setContactName] = useState<string | null>(null);
  const [contactData, setContactData] = useState<ContactEditData | null>(null);
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [editContactOpen, setEditContactOpen] = useState(false);
  const [editCompanyOpen, setEditCompanyOpen] = useState(false);
  const [createCompanyOpen, setCreateCompanyOpen] = useState(false);
  const [createDealOpen, setCreateDealOpen] = useState(false);
  const [openDeals, setOpenDeals] = useState<Array<{ id: string; title: string; pipeline_nombre: string | null; pipeline_marca: string | null; pipeline_type: string | null; brand: "chevron" | "phillips66" }>>([]);
  const [defaultPipelineId, setDefaultPipelineId] = useState<string>("");
  const [defaultPipelineStages, setDefaultPipelineStages] = useState<any[]>([]);
  const [templates, setTemplates] = useState<TemplateWithAccount[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [qrOpen, setQrOpen] = useState(false);
  const [tplPickerOpen, setTplPickerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [tplName, setTplName] = useState("");
  const [tplVars, setTplVars] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  // Inbox seleccionado por línea (business_phone_number_id). null = aún no inicializado
  const [selectedPhoneId, setSelectedPhoneId] = useState<string | null>(null);

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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_messages" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // Load templates
  useEffect(() => {
    supabase
      .from("whatsapp_templates")
      .select("id,name,language,status,body,business_phone_number_id,waba_id")
      .eq("status", "APPROVED")
      .then(({ data }) => setTemplates((data ?? []) as TemplateWithAccount[]));
    supabase
      .from("whatsapp_quick_replies")
      .select("id,shortcut,content")
      .order("shortcut")
      .then(({ data }) => setQuickReplies((data ?? []) as QuickReply[]));
    supabase
      .from("whatsapp_accounts")
      .select("id,business_phone_number_id,label,color,waba_id")
      .eq("is_active", true)
      .then(({ data }) => {
        const list = (data ?? []) as Account[];
        setAccounts(list);
        // Inicializa el inbox por defecto a la primera línea activa
        setSelectedPhoneId((prev) => prev ?? list[0]?.business_phone_number_id ?? null);
      });
  }, []);

  const active = useMemo(() => conversations.find((c) => c.id === activeId) ?? null, [activeId, conversations]);

  // Cargar negocios abiertos de la empresa vinculada al contacto activo
  const loadOpenDeals = async (companyId: string | null | undefined) => {
    if (!companyId) { setOpenDeals([]); return; }
    const { data } = await supabase
      .from("crm_deals")
      .select("id, title, stage_id, pipeline_id, crm_pipelines(nombre, marca, pipeline_type), crm_pipeline_stages(name)")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false });
    const rows = (data || []).filter((d: any) => {
      const stageName = (d.crm_pipeline_stages?.name || "").toLowerCase();
      return !["ganado", "perdido", "cerrado ganado", "cerrado perdido"].includes(stageName);
    });
    setOpenDeals(rows.map((d: any) => ({
      id: d.id,
      title: d.title,
      pipeline_nombre: d.crm_pipelines?.nombre ?? null,
      pipeline_marca: d.crm_pipelines?.marca ?? null,
      pipeline_type: d.crm_pipelines?.pipeline_type ?? null,
      brand: (d.crm_pipelines?.marca === "phillips66" ? "phillips66" : "chevron") as "chevron" | "phillips66",
    })));
  };

  useEffect(() => {
    loadOpenDeals(companyData?.id ?? null);
  }, [companyData?.id]);

  // Refrescar lista cuando se cierra el diálogo de creación
  useEffect(() => {
    if (!createDealOpen) loadOpenDeals(companyData?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createDealOpen]);

  // Cargar pipeline por defecto (Primera Compra de Chevron) y sus etapas para el diálogo de creación
  useEffect(() => {
    (async () => {
      const { data: pipelines } = await supabase
        .from("crm_pipelines")
        .select("id, marca, pipeline_type")
        .order("created_at", { ascending: true });
      const list = pipelines || [];
      const pick = list.find((p: any) => p.marca === "chevron" && p.pipeline_type === "primera_compra")
        || list.find((p: any) => p.pipeline_type === "primera_compra")
        || list[0];
      if (!pick) return;
      setDefaultPipelineId(pick.id);
      const { data: st } = await supabase
        .from("crm_pipeline_stages")
        .select("id, name, color, position, pipeline_id")
        .eq("pipeline_id", pick.id)
        .order("position");
      setDefaultPipelineStages(st || []);
    })();
  }, []);

  // Cuenta seleccionada (id de whatsapp_accounts)
  const selectedAccount = useMemo(
    () => accounts.find((a) => a.business_phone_number_id === selectedPhoneId) ?? null,
    [accounts, selectedPhoneId],
  );
  // Conversaciones filtradas por línea seleccionada
  const filteredConversations = useMemo(() => {
    if (!selectedPhoneId) return conversations;
    return conversations.filter((c) => c.business_phone_number_id === selectedPhoneId);
  }, [conversations, selectedPhoneId]);

  // Realtime global por cuenta seleccionada — refresca el chat activo si llega un
  // mensaje nuevo para esta línea (Maggs o Chevron) aunque no sea la conversación abierta.
  useEffect(() => {
    if (!selectedAccount) return;
    const ch = supabase
      .channel(`wa-msg-account-${selectedAccount.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_messages",
          filter: `whatsapp_account_id=eq.${selectedAccount.id}`,
        },
        () => {
          // refresca lista de conversaciones para reflejar preview/unread
          supabase
            .from("whatsapp_conversations")
            .select("*")
            .order("last_inbound_at", { ascending: false, nullsFirst: false })
            .limit(200)
            .then(({ data }) => setConversations((data ?? []) as Conversation[]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [selectedAccount]);

  // Si la conversación activa ya no pertenece al inbox seleccionado, se deselecciona
  useEffect(() => {
    if (!active || !selectedPhoneId) return;
    if (active.business_phone_number_id !== selectedPhoneId) {
      setActiveId(null);
    }
  }, [selectedPhoneId, active]);

  const accountByPhoneId = useMemo(() => {
    const map = new Map<string, Account>();
    accounts.forEach((a) => map.set(a.business_phone_number_id, a));
    return map;
  }, [accounts]);
  const activeAccount = active?.business_phone_number_id
    ? accountByPhoneId.get(active.business_phone_number_id) ?? null
    : null;
  // Filter templates: las plantillas pertenecen al WABA, no al número.
  // Mostramos las que coincidan por waba_id de la cuenta activa.
  // Si una plantilla no tiene waba_id (legacy), se muestra siempre.
  const filteredTemplates = useMemo(() => {
    if (!active) return templates;
    const acct = activeAccount;
    const wabaId = acct?.waba_id ?? null;
    if (!wabaId) return templates;
    return templates.filter((t) => !t.waba_id || t.waba_id === wabaId);
  }, [templates, active, activeAccount]);

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
        .select("*")
        .eq("id", active.contact_id)
        .maybeSingle()
        .then(async ({ data }) => {
          if (!data) {
            setContactName(null); setContactData(null); setCompanyData(null);
            return;
          }
          setContactName(`${data.first_name ?? ""} ${data.last_name ?? ""}`.trim());
          setContactData(data as any);
          if ((data as any).company_id) {
            const { data: comp } = await supabase
              .from("companies").select("*").eq("id", (data as any).company_id).maybeSingle();
            setCompanyData((comp as any) ?? null);
          } else {
            setCompanyData(null);
          }
        });
    } else {
      setContactName(null);
      setContactData(null);
      setCompanyData(null);
    }
    const ch = supabase
      .channel(`wa-msg-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, m];
          });
          // marca como leído inmediato
          supabase
            .from("whatsapp_conversations")
            .update({ unread_count: 0 })
            .eq("id", activeId)
            .then(() => {});
        },
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
    if (!active.business_phone_number_id) {
      toast.error("Esta conversación no tiene línea asociada");
      return;
    }
    setSending(true);
    const { error } = await supabase.functions.invoke("whatsapp-send-message", {
      body: {
        to_phone: active.wa_phone,
        conversation_id: active.id,
        kind: "text",
        text: draft.trim(),
        business_phone_number_id: active.business_phone_number_id,
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
    if (!active.business_phone_number_id) {
      toast.error("Esta conversación no tiene línea asociada");
      return;
    }
    const tpl = templates.find((t) => t.name === tplName);
    const expected = tpl?.body ? extractTemplateVars(tpl.body) : 0;
    if (expected > 0 && tplVars.slice(0, expected).some((v) => !v?.trim())) {
      toast.error(`Esta plantilla requiere ${expected} variable(s). Completa todos los campos.`);
      return;
    }
    const components =
      expected > 0
        ? [
            {
              type: "body",
              parameters: tplVars.slice(0, expected).map((v) => ({ type: "text", text: v.trim() })),
            },
          ]
        : undefined;
    setSending(true);
    const { error } = await supabase.functions.invoke("whatsapp-send-message", {
      body: {
        to_phone: active.wa_phone,
        conversation_id: active.id,
        kind: "template",
        template_name: tpl?.name,
        template_language: tpl?.language ?? "es_MX",
        business_phone_number_id: active.business_phone_number_id,
        ...(components ? { template_components: components } : {}),
      },
    });
    setSending(false);
    if (error) {
      toast.error(error.message ?? "No se pudo enviar plantilla");
      return;
    }
    setTplName("");
    setTplVars([]);
    toast.success("Plantilla enviada");
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
        .select("id,name,language,status,body,business_phone_number_id,waba_id")
      .eq("status", "APPROVED");
    setTemplates((t ?? []) as TemplateWithAccount[]);
  };

  return (
    <div className="grid grid-cols-12 gap-4 h-[calc(100vh-8rem)]">
      {/* Conversaciones */}
      <Card className="col-span-3 flex flex-col">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium">
              <MessageCircle className="h-4 w-4 text-primary" /> WhatsApp
            </div>
            <Button size="sm" variant="outline" onClick={syncTemplates}>
              Sync templates
            </Button>
          </div>
          {/* Inbox tabs por línea */}
          {accounts.length > 0 && (
            <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
              {accounts.map((a) => {
                const isSelected = selectedPhoneId === a.business_phone_number_id;
                const count = conversations.filter(
                  (c) => c.business_phone_number_id === a.business_phone_number_id,
                ).length;
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelectedPhoneId(a.business_phone_number_id)}
                    className={`flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-semibold transition ${
                      isSelected
                        ? "shadow-sm text-white"
                        : "text-muted-foreground hover:bg-background"
                    }`}
                    style={isSelected ? { backgroundColor: a.color } : undefined}
                  >
                    <Inbox className="h-3 w-3" />
                    <span className="uppercase tracking-wide">{a.label}</span>
                    <span
                      className={`rounded-full px-1.5 text-[10px] ${
                        isSelected ? "bg-white/25" : "bg-muted-foreground/15"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <ScrollArea className="flex-1">
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              Sin conversaciones en esta línea.
            </div>
          ) : (
            filteredConversations.map((c) => (
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
              {activeAccount && (
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Respondiendo desde <strong className="text-foreground">{activeAccount.label}</strong>
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
                <button
                  type="button"
                  onClick={() => setTplPickerOpen(true)}
                  className="flex-1 flex items-center justify-between gap-2 h-9 rounded-md border border-input bg-background px-3 text-sm hover:bg-muted/50 transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">
                      {tplName
                        ? tplName
                        : <span className="text-muted-foreground">— Enviar plantilla {activeAccount ? `(${activeAccount.label})` : ""} —</span>}
                    </span>
                  </span>
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
                <Button variant="outline" size="sm" onClick={sendTemplate} disabled={!tplName || sending}>
                  Enviar plantilla
                </Button>
              </div>
              {tplVars.length > 0 && (
                <div className="flex flex-col gap-2 rounded-md border border-dashed p-2">
                  <div className="text-xs text-muted-foreground">
                    Esta plantilla tiene {tplVars.length} variable(s). Completa los valores:
                  </div>
                  {tplVars.map((v, i) => (
                    <Input
                      key={i}
                      value={v}
                      onChange={(e) => {
                        const next = [...tplVars];
                        next[i] = e.target.value;
                        setTplVars(next);
                      }}
                      placeholder={`Variable {{${i + 1}}}`}
                      className="h-8 text-sm"
                    />
                  ))}
                </div>
              )}
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
                <div className="flex items-center gap-2 mt-1">
                  <div className="text-sm font-medium text-primary truncate">{contactName}</div>
                  <Button size="sm" variant="outline" onClick={() => setEditContactOpen(true)}>
                    <Pencil className="h-3 w-3 mr-1" /> Abrir
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={createContact} className="mt-1">
                  <UserPlus className="h-3 w-3 mr-1" /> Crear contacto
                </Button>
              )}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Empresa</div>
              {companyData ? (
                <div className="flex items-center gap-2 mt-1">
                  <div className="text-sm font-medium truncate">{companyData.name}</div>
                  <Button size="sm" variant="outline" onClick={() => setEditCompanyOpen(true)}>
                    <Eye className="h-3 w-3 mr-1" /> Ver
                  </Button>
                </div>
              ) : contactData ? (
                <Button size="sm" variant="outline" onClick={() => setCreateCompanyOpen(true)} className="mt-1">
                  <Building2 className="h-3 w-3 mr-1" /> Agregar empresa
                </Button>
              ) : (
                <div className="text-sm text-muted-foreground">—</div>
              )}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Negocios abiertos</div>
              {companyData ? (
                <div className="space-y-1 mt-1">
                  {openDeals.length > 0 ? (
                    openDeals.map((d) => (
                      <div key={d.id} className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{d.title}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {(d.pipeline_marca === "phillips66" ? "Phillips 66" : "Chevron")}
                            {d.pipeline_type === "recompra" ? " · Recompra" : " · Primera Compra"}
                            {d.pipeline_nombre ? ` · ${d.pipeline_nombre}` : ""}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`/crm/${d.brand}/pipeline?deal=${d.id}`, "_blank")}
                        >
                          <Eye className="h-3 w-3 mr-1" /> Ver
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">Sin negocios abiertos</div>
                  )}
                  {defaultPipelineId && (
                    <Button size="sm" variant="outline" onClick={() => setCreateDealOpen(true)} className="mt-1">
                      <Plus className="h-3 w-3 mr-1" /> Agregar negocio
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">—</div>
              )}
            </div>
          </div>
        )}
      </Card>

      <ContactFormDialog
        open={editContactOpen}
        onOpenChange={setEditContactOpen}
        editData={contactData}
        onCreated={() => {
          if (active?.contact_id) {
            supabase.from("contacts").select("*").eq("id", active.contact_id).maybeSingle()
              .then(async ({ data }) => {
                if (data) {
                  setContactName(`${data.first_name ?? ""} ${data.last_name ?? ""}`.trim());
                  setContactData(data as any);
                  if ((data as any).company_id) {
                    const { data: comp } = await supabase
                      .from("companies").select("*").eq("id", (data as any).company_id).maybeSingle();
                    setCompanyData((comp as any) ?? null);
                  } else {
                    setCompanyData(null);
                  }
                }
              });
          }
        }}
      />

      <CompanyFormDialog
        open={editCompanyOpen}
        onOpenChange={setEditCompanyOpen}
        editData={companyData}
      />

      <CompanyFormDialog
        open={createCompanyOpen}
        onOpenChange={setCreateCompanyOpen}
        onCreated={async (newCompanyId: string) => {
          if (contactData?.id && newCompanyId) {
            await supabase.from("contacts").update({ company_id: newCompanyId }).eq("id", contactData.id);
            const { data: comp } = await supabase.from("companies").select("*").eq("id", newCompanyId).maybeSingle();
            setCompanyData((comp as any) ?? null);
            setContactData({ ...(contactData as any), company_id: newCompanyId });
            toast.success("Empresa vinculada al contacto");
          }
        }}
      />

      {defaultPipelineId && (
        <CreateCrmDealDialog
          open={createDealOpen}
          onOpenChange={setCreateDealOpen}
          pipelineId={defaultPipelineId}
          stages={defaultPipelineStages}
          defaultCompanyId={companyData?.id || ""}
          defaultContactId={contactData?.id || ""}
        />
      )}

      <TemplatePickerDialog
        open={tplPickerOpen}
        onOpenChange={setTplPickerOpen}
        templates={filteredTemplates}
        selectedId={filteredTemplates.find((t) => t.name === tplName)?.id}
        onSelect={(id) => {
          const tpl = filteredTemplates.find((t) => t.id === id);
          if (tpl) {
            setTplName(tpl.name);
            const n = tpl.body ? extractTemplateVars(tpl.body) : 0;
            setTplVars(Array(n).fill(""));
          }
          setTplPickerOpen(false);
        }}
      />
    </div>
  );
}
