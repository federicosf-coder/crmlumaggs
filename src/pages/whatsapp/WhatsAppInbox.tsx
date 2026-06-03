import { useEffect, useMemo, useRef, useState } from "react";
import { supabase as _supabaseTyped } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _supabaseTyped;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Dialog as MediaDialog,
  DialogContent as MediaDialogContent,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  MessageCircle, Send, UserPlus, Lock, Zap, Inbox, Pencil, Building2, Eye, Briefcase, Plus,
  FileText, Search, Paperclip, Image as ImageIcon, File as FileIcon, Download, Play, X,
  FileSpreadsheet, FileType, AlertCircle, ArrowLeft, Info,
} from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { ContactFormDialog, type ContactEditData } from "@/components/ContactFormDialog";
import { CompanyFormDialog, type CompanyData } from "@/components/CompanyFormDialog";
import { TemplatePickerDialog } from "@/components/whatsapp/TemplatePickerDialog";
import { useNavigate } from "react-router-dom";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { Lock as LockIcon } from "lucide-react";

// Descarga un archivo del bucket privado evitando bloqueos del navegador / ad-blockers.
async function downloadMediaFile(storagePath: string | null | undefined, filename?: string | null) {
  if (!storagePath) {
    toast.error("El enlace de descarga ha expirado, por favor intenta abrirlo de nuevo");
    return;
  }
  try {
    const { data, error } = await supabase.storage.from("whatsapp-media").download(storagePath);
    if (error || !data) throw error ?? new Error("No data");
    const blobUrl = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename || storagePath.split("/").pop() || "archivo";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (e) {
    console.error("download error", e);
    toast.error("El enlace de descarga ha expirado, por favor intenta abrirlo de nuevo");
  }
}

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
const IMG_MIMES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_MIMES = ["video/mp4", "video/3gpp", "video/quicktime"];
const DOC_MIMES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv", "application/zip",
];

type MediaCategory = "image" | "video" | "document";

function categorizeFile(file: File): MediaCategory | null {
  if (IMG_MIMES.includes(file.type)) return "image";
  if (VIDEO_MIMES.includes(file.type)) return "video";
  if (DOC_MIMES.includes(file.type)) return "document";
  return null;
}

function formatBytes(n: number | null | undefined): string {
  if (!n || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function docIconFor(mime?: string | null) {
  const m = (mime || "").toLowerCase();
  if (m.includes("excel") || m.includes("spreadsheet") || m.includes("csv")) return FileSpreadsheet;
  if (m.includes("pdf")) return FileType;
  return FileIcon;
}

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
  assigned_to: string | null;
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
  media_type?: string | null;
  media_url?: string | null;
  media_storage_path?: string | null;
  media_filename?: string | null;
  media_mime_type?: string | null;
  media_size_bytes?: number | null;
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
  const access = useModuleAccess("whatsapp");
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
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  // Media (outbound)
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [pendingCaption, setPendingCaption] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [accept, setAccept] = useState<string>("");
  // Lightbox
  const [lightbox, setLightbox] = useState<{ url: string; type: "image" | "video"; name?: string; storagePath?: string | null } | null>(null);
  // Cache de URLs firmadas frescas por id de mensaje
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  // Vista móvil: 'list' (lista de chats a pantalla completa) o 'chat' (chat activo a pantalla completa)
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  // Drawer/Sheet con detalles del contacto en móvil
  const [infoOpen, setInfoOpen] = useState(false);

  // Limpia object URL al cambiar archivo
  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  const clearPending = () => {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(null);
    setPendingPreviewUrl(null);
    setPendingCaption("");
    setUploadError(null);
    setUploadProgress(null);
  };

  const handleFilePicked = (file: File | null) => {
    if (!file) return;
    const cat = categorizeFile(file);
    if (!cat) {
      toast.error(`Formato no compatible: ${file.type || file.name}`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error(`El archivo supera el límite de 25 MB (${formatBytes(file.size)})`);
      return;
    }
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(file);
    setUploadError(null);
    setUploadProgress(null);
    setPendingCaption("");
    if (cat === "image" || cat === "video") {
      setPendingPreviewUrl(URL.createObjectURL(file));
    } else {
      setPendingPreviewUrl(null);
    }
  };

  const openFilePicker = (mode: "media" | "document") => {
    setAccept(mode === "media" ? "image/*,video/*" : DOC_MIMES.join(","));
    setTimeout(() => fileInputRef.current?.click(), 0);
  };

  // Drag & Drop sobre el área del chat
  const onChatDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer?.types?.includes("Files")) {
      e.preventDefault();
      setDragOver(true);
    }
  };
  const onChatDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };
  const onChatDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) handleFilePicked(f);
  };

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
    let list = conversations;
    if (selectedPhoneId) {
      list = list.filter((c) => c.business_phone_number_id === selectedPhoneId);
    }
    if (access.accessLevel === "propio" && access.userId) {
      list = list.filter((c) => c.assigned_to === access.userId);
    } else if (access.accessLevel === "equipo") {
      const allowed = new Set(access.teamMemberIds);
      list = list.filter((c) => c.assigned_to && allowed.has(c.assigned_to));
    } else if (access.accessLevel === "ninguno") {
      list = [];
    }
    return list;
  }, [conversations, selectedPhoneId, access.accessLevel, access.userId, access.teamMemberIds]);

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
        .select("id,conversation_id,sender_phone,message_body,direction,status,template_name,created_at,media_type,media_url,media_storage_path,media_filename,media_mime_type,media_size_bytes")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true })
        .limit(500);
      setMessages((data ?? []) as Message[]);
    };
    loadMsgs();
    // mark read
    supabase.from("whatsapp_conversations").update({ unread_count: 0, unread_alert_sent_at: null }).eq("id", activeId).then(() => {});
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
            .update({ unread_count: 0, unread_alert_sent_at: null })
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

  // Auto-scroll al fondo cuando cambian los mensajes o la conversación activa
  useEffect(() => {
    if (!activeId) return;
    const t = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 50);
    return () => clearTimeout(t);
  }, [messages, activeId]);

  // Resolver URLs firmadas frescas para mensajes con archivos
  useEffect(() => {
    const pending = messages.filter(
      (m) => m.media_storage_path && !mediaUrls[m.id],
    );
    if (pending.length === 0) return;
    let cancelled = false;
    (async () => {
      const updates: Record<string, string> = {};
      for (const m of pending) {
        try {
          const { data } = await supabase.storage
            .from("whatsapp-media")
            .createSignedUrl(m.media_storage_path!, 60 * 60 * 6);
          if (data?.signedUrl) updates[m.id] = data.signedUrl;
          else if (m.media_url) updates[m.id] = m.media_url;
        } catch {
          if (m.media_url) updates[m.id] = m.media_url;
        }
      }
      if (!cancelled && Object.keys(updates).length > 0) {
        setMediaUrls((prev) => ({ ...prev, ...updates }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [messages, mediaUrls]);

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

  const sendMedia = async () => {
    if (!active || !pendingFile) return;
    if (!active.business_phone_number_id) {
      toast.error("Esta conversación no tiene línea asociada");
      return;
    }
    const cat = categorizeFile(pendingFile);
    if (!cat) {
      setUploadError("Formato no compatible");
      return;
    }
    setUploadError(null);
    setSending(true);
    setUploadProgress(10);
    try {
      const safeName = pendingFile.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
      const path = `${active.id}/out_${Date.now()}_${safeName}`;
      // 1) Subir al bucket
      setUploadProgress(35);
      const { error: upErr } = await supabase.storage
        .from("whatsapp-media")
        .upload(path, pendingFile, { contentType: pendingFile.type, upsert: false });
      if (upErr) throw new Error(upErr.message);
      setUploadProgress(70);
      // 2) Llamar al edge function que sube a Meta y envía
      const { error: fnErr } = await supabase.functions.invoke("whatsapp-send-message", {
        body: {
          to_phone: active.wa_phone,
          conversation_id: active.id,
          kind: "media",
          business_phone_number_id: active.business_phone_number_id,
          media_storage_path: path,
          media_category: cat,
          media_mime_type: pendingFile.type,
          media_filename: pendingFile.name,
          caption: pendingCaption.trim() || undefined,
        },
      });
      if (fnErr) throw new Error(fnErr.message ?? "No se pudo enviar el archivo");
      setUploadProgress(100);
      toast.success("Archivo enviado");
      clearPending();
    } catch (e: any) {
      setUploadError(e?.message ?? "Error al enviar el archivo");
      toast.error(e?.message ?? "Error al enviar el archivo");
    } finally {
      setSending(false);
      setTimeout(() => setUploadProgress(null), 800);
    }
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
    access.accessLevel === "ninguno" && !access.isLoading ? (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] text-center gap-3">
        <LockIcon className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Acceso Denegado</h2>
        <p className="text-muted-foreground max-w-md">
          No tienes permisos para ver el módulo de WhatsApp. Contacta a un administrador si necesitas acceso.
        </p>
      </div>
    ) : (
    <div className="flex flex-col md:grid md:grid-cols-12 md:gap-4 h-[calc(100vh-8rem)] overflow-hidden">
      {/* Conversaciones */}
      <Card
        className={`${mobileView === "list" ? "flex" : "hidden"} md:flex md:col-span-3 flex-col h-full w-full overflow-hidden`}
      >
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
                const unread = conversations
                  .filter((c) => c.business_phone_number_id === a.business_phone_number_id)
                  .reduce((acc, c) => acc + (c.unread_count || 0), 0);
                const hasAlert = !isSelected && unread > 0;
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelectedPhoneId(a.business_phone_number_id)}
                    className={`relative flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-semibold transition ${
                      isSelected
                        ? "shadow-sm text-white"
                        : "text-muted-foreground hover:bg-background"
                    }`}
                    style={isSelected ? { backgroundColor: a.color } : undefined}
                  >
                    <Inbox className="h-3 w-3" />
                    <span className="uppercase tracking-wide">{a.label}</span>
                    {unread > 0 && (
                      <span
                        className={`rounded-full px-1.5 text-[10px] font-bold ${
                          isSelected
                            ? "bg-white/25 text-white"
                            : "bg-destructive text-destructive-foreground"
                        }`}
                      >
                        {unread}
                      </span>
                    )}
                    {hasAlert && (
                      <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <ScrollArea className="flex-1 min-h-0">
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              Sin conversaciones en esta línea.
            </div>
          ) : (
            filteredConversations.map((c) => {
              const isUnread = c.unread_count > 0;
              return (
              <button
                key={c.id}
                onClick={() => { setActiveId(c.id); setMobileView("chat"); }}
                className={`relative w-full text-left p-3 pl-4 border-b hover:bg-accent transition ${activeId === c.id ? "bg-accent" : ""} ${isUnread ? "bg-destructive/5" : ""}`}
              >
                {isUnread && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-destructive" />
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm truncate flex-1 flex items-center gap-1.5 ${isUnread ? "font-bold text-foreground" : "font-medium"}`}>
                    {isUnread && <MessageCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                    {c.wa_profile_name || c.wa_phone}
                  </span>
                  {isUnread && (
                    <span className="shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold">
                      {c.unread_count}
                    </span>
                  )}
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
                <div className={`text-xs truncate ${isUnread ? "text-foreground font-medium" : "text-muted-foreground"}`}>{c.last_message_preview || "—"}</div>
              </button>
              );
            })
          )}
        </ScrollArea>
      </Card>

      {/* Chat */}
      <Card
        className={`${mobileView === "chat" ? "flex" : "hidden"} md:flex md:col-span-6 flex-col h-full w-full overflow-hidden`}
      >
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Selecciona una conversación
          </div>
        ) : (
          <>
            <div className="p-3 border-b shrink-0 bg-card">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-8 w-8 -ml-1 shrink-0"
                  onClick={() => setMobileView("list")}
                  title="Volver"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium truncate">{contactName || active.wa_profile_name || active.wa_phone}</div>
                    {activeAccount && (
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0"
                        style={{ backgroundColor: `${activeAccount.color}22`, color: activeAccount.color }}
                      >
                        {activeAccount.label}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">+{active.wa_phone}</div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-8 w-8 shrink-0"
                  onClick={() => setInfoOpen(true)}
                  title="Detalles"
                >
                  <Info className="h-4 w-4" />
                </Button>
              </div>
              {activeAccount && (
                <div className="mt-1 text-[10px] text-muted-foreground hidden md:block">
                  Respondiendo desde <strong className="text-foreground">{activeAccount.label}</strong>
                </div>
              )}
            </div>
            <div
              className="relative flex-1 min-h-0"
              onDragOver={onChatDragOver}
              onDragLeave={onChatDragLeave}
              onDrop={onChatDrop}
            >
              <ScrollArea className="h-full p-3">
                <div className="space-y-2">
                  {messages.map((m) => {
                    const isOut = m.direction === "outbound";
                    const url = mediaUrls[m.id] ?? m.media_url ?? null;
                    const mt = (m.media_type || "").toLowerCase();
                    const isImg = mt === "image" || mt === "sticker";
                    const isVid = mt === "video";
                    const isAud = mt === "audio";
                    const isDoc = mt === "document";
                    const DocIcon = docIconFor(m.media_mime_type);
                    return (
                      <div
                        key={m.id}
                        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                          isOut ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"
                        }`}
                      >
                        {m.template_name && (
                          <div className="text-[10px] uppercase opacity-70">📋 {m.template_name}</div>
                        )}
                        {/* Media */}
                        {isImg && url && (
                          <button
                            type="button"
                            onClick={() => setLightbox({ url, type: "image", name: m.media_filename ?? undefined, storagePath: m.media_storage_path })}
                            className="block w-full max-w-[260px] mb-1 rounded overflow-hidden focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            <img src={url} alt={m.media_filename ?? "imagen"} className="w-full h-auto object-cover" loading="lazy" />
                          </button>
                        )}
                        {isVid && url && (
                          <button
                            type="button"
                            onClick={() => setLightbox({ url, type: "video", name: m.media_filename ?? undefined, storagePath: m.media_storage_path })}
                            className="relative block w-full max-w-[260px] mb-1 rounded overflow-hidden bg-black/40"
                          >
                            <video src={url} className="w-full h-auto" preload="metadata" />
                            <span className="absolute inset-0 flex items-center justify-center">
                              <span className="bg-black/60 text-white rounded-full p-3">
                                <Play className="h-6 w-6" />
                              </span>
                            </span>
                          </button>
                        )}
                        {isAud && url && (
                          <audio controls src={url} className="w-full max-w-[240px] mb-1" />
                        )}
                        {isDoc && (
                          <button
                            type="button"
                            onClick={() => downloadMediaFile(m.media_storage_path, m.media_filename)}
                            className={`flex items-center gap-2 mb-1 rounded-md p-2 w-full text-left ${
                              isOut ? "bg-primary-foreground/10 hover:bg-primary-foreground/20" : "bg-background hover:bg-accent"
                            }`}
                          >
                            <DocIcon className="h-8 w-8 shrink-0 opacity-80" />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium truncate">{m.media_filename ?? "archivo"}</div>
                              <div className="text-[10px] opacity-70">{formatBytes(m.media_size_bytes)}</div>
                            </div>
                            <Download className="h-4 w-4 opacity-70" />
                          </button>
                        )}
                        {/* Texto / caption */}
                        {m.message_body && !(isDoc && !url && m.message_body === m.media_filename) && (
                          <div className="whitespace-pre-wrap">{m.message_body}</div>
                        )}
                        <div className="flex items-center gap-1 text-[10px] opacity-70 mt-1">
                          <span>{new Date(m.created_at).toLocaleString()}</span>
                          {isOut && m.status && <span>· {m.status}</span>}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              {dragOver && (
                <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary flex items-center justify-center pointer-events-none">
                  <div className="bg-card rounded-lg px-4 py-3 shadow-lg flex items-center gap-2 text-sm font-medium">
                    <Paperclip className="h-4 w-4" /> Suelta el archivo para adjuntar
                  </div>
                </div>
              )}
            </div>
            <div className="p-3 border-t space-y-2 shrink-0 bg-card">
              {!windowOpen && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-2 rounded">
                  <Lock className="h-3 w-3" />
                  Ventana de atención cerrada (24h). Use una plantilla para reanudar.
                </div>
              )}
              {/* Vista previa de archivo a enviar */}
              {pendingFile && (
                <div className="rounded-md border bg-muted/40 p-2">
                  <div className="flex items-start gap-3">
                    {pendingPreviewUrl && categorizeFile(pendingFile) === "image" ? (
                      <img src={pendingPreviewUrl} alt="preview" className="h-16 w-16 object-cover rounded" />
                    ) : pendingPreviewUrl && categorizeFile(pendingFile) === "video" ? (
                      <video src={pendingPreviewUrl} className="h-16 w-16 object-cover rounded bg-black" />
                    ) : (
                      <div className="h-16 w-16 rounded bg-background flex items-center justify-center">
                        {(() => {
                          const I = docIconFor(pendingFile.type);
                          return <I className="h-8 w-8 text-muted-foreground" />;
                        })()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{pendingFile.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {formatBytes(pendingFile.size)} · {pendingFile.type || "—"}
                      </div>
                      <Input
                        value={pendingCaption}
                        onChange={(e) => setPendingCaption(e.target.value)}
                        placeholder="Añadir un comentario (opcional)"
                        className="h-8 text-sm mt-1"
                        disabled={sending}
                      />
                      {uploadProgress !== null && (
                        <Progress value={uploadProgress} className="h-1.5 mt-2" />
                      )}
                      {uploadError && (
                        <div className="flex items-center gap-1 text-[11px] text-destructive mt-1">
                          <AlertCircle className="h-3 w-3" /> {uploadError}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button size="sm" onClick={sendMedia} disabled={sending || !windowOpen}>
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={clearPending} disabled={sending}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex gap-2 items-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" disabled={!windowOpen || sending} title="Adjuntar" className="shrink-0">
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => openFilePicker("media")}>
                      <ImageIcon className="h-4 w-4 mr-2" /> Imagen y Video
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openFilePicker("document")}>
                      <FileIcon className="h-4 w-4 mr-2" /> Documento
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={accept}
                  className="hidden"
                  onChange={(e) => {
                    handleFilePicked(e.target.files?.[0] ?? null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                />
                <Textarea
                  placeholder={windowOpen ? "Escribe un mensaje..." : "Bloqueado — usa una plantilla"}
                  value={draft}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraft(v);
                    if (v.endsWith("/") && quickReplies.length > 0) setQrOpen(true);
                  }}
                  disabled={!windowOpen || sending}
                  className="min-h-[44px] md:min-h-[60px] flex-1 resize-none"
                />
                <Popover open={qrOpen} onOpenChange={setQrOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={!windowOpen || quickReplies.length === 0}
                      className="shrink-0 hidden sm:inline-flex"
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
                <Button onClick={sendText} disabled={!windowOpen || sending || !draft.trim()} size="icon" className="shrink-0">
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

      {/* Lateral (desktop) + Sheet (móvil) */}
      {(() => {
        const sidePanelContent = !active ? (
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
        );
        return (
          <>
            <Card className="hidden md:flex md:col-span-3 flex-col h-full overflow-hidden">
              <div className="p-3 overflow-y-auto flex-1 min-h-0">
                {sidePanelContent}
              </div>
            </Card>
            <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
              <SheetContent side="bottom" className="md:hidden h-[85vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Detalles</SheetTitle>
                </SheetHeader>
                <div className="mt-4">{sidePanelContent}</div>
              </SheetContent>
            </Sheet>
          </>
        );
      })()}

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

      {/* Lightbox para imágenes y video */}
      <MediaDialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <MediaDialogContent className="max-w-5xl p-2 bg-background">
          {lightbox?.type === "image" && (
            <img src={lightbox.url} alt={lightbox.name ?? "imagen"} className="w-full max-h-[85vh] object-contain" />
          )}
          {lightbox?.type === "video" && (
            <video src={lightbox.url} controls autoPlay className="w-full max-h-[85vh]" />
          )}
          {lightbox && (
            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadMediaFile(lightbox.storagePath, lightbox.name)}
              >
                <Download className="h-4 w-4 mr-1" /> Descargar
              </Button>
            </div>
          )}
        </MediaDialogContent>
      </MediaDialog>
    </div>
    )
  );
}
