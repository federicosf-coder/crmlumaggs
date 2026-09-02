import { useState, useEffect } from "react";
import { localInputToIso } from "@/lib/formatters";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateCrmTask, useUpdateCrmTask, type CrmTask } from "@/hooks/useCrmTasks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase as _supabaseTyped } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _supabaseTyped;
import { fetchAllRows } from "@/lib/supabasePagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DictationButton } from "@/components/ui/dictation-button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar as CalendarIcon, MapPin, Crosshair, Mail, UserPlus, Save, Phone, Copy, Send as SendIcon, Paperclip, FileText, X, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ACTION_TASK_TYPES, PARENT_CATEGORIES, ParentCategoryKey, TaskTypeKey } from "@/lib/taskTypes";
import { cn } from "@/lib/utils";
import { MessageCircle, Send } from "lucide-react";
import { normalizePhoneForWhatsApp, openWhatsApp, logWhatsAppActivity } from "@/lib/whatsapp";
import { WhatsAppActionDialog } from "@/components/whatsapp/WhatsAppActionDialog";
import { RescheduleActivityDialog, type RescheduleContext } from "@/components/crm/RescheduleActivityDialog";
import { CompanyFormDialog } from "@/components/CompanyFormDialog";
import { ContactFormDialog } from "@/components/ContactFormDialog";

interface CreateCrmTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultContactId?: string;
  defaultCompanyId?: string;
  /** Si se define, la nueva tarea se crea como sub-tarea (paso) de esta tarea padre. */
  parentTaskId?: string | null;
  /** Categoría padre (Seguimiento / Cobranza) cuando se crea como cabecera. */
  defaultParentCategory?: ParentCategoryKey | null;
  /** Tipo de acción concreta sugerido (call, email, etc.). */
  defaultTaskType?: TaskTypeKey | null;
  /** Título sugerido. */
  defaultTitle?: string;
  /** Si se define, el diálogo opera en modo edición sobre esta tarea existente. */
  editTask?: CrmTask | null;
  /** Marcas pre-seleccionadas (uno o ambos). */
  defaultBrands?: Array<"lumaggs_chevron" | "galsa_phillips66">;
}

type Brand = "lumaggs_chevron" | "galsa_phillips66";

export function CreateCrmTaskDialog({
  open, onOpenChange, defaultContactId, defaultCompanyId,
  parentTaskId = null, defaultParentCategory = null, defaultTaskType = null, defaultTitle = "",
  editTask = null, defaultBrands,
}: CreateCrmTaskDialogProps) {
  const { session } = useAuth();
  const createTask = useCreateCrmTask();
  const updateTask = useUpdateCrmTask();
  const isEditing = !!editTask;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contacts } = useQuery({
    queryKey: ["contacts-picker"],
    queryFn: async () => {
      const data = await fetchAllRows<any>((from, to) => supabase.from("contacts").select("id, first_name, last_name, company_id").eq("is_active", true).order("first_name").range(from, to));
      return data;
    },
  });

  const { data: companies } = useQuery({
    queryKey: ["companies-picker"],
    queryFn: async () => {
      const data = await fetchAllRows<any>((from, to) => supabase.from("companies").select("id, name").eq("is_active", true).order("name").range(from, to));
      return data;
    },
  });

  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState("medium");
  const [contactId, setContactId] = useState(defaultContactId || "");
  const [companyId, setCompanyId] = useState(defaultCompanyId || "");
  const [parentCategory, setParentCategory] = useState<ParentCategoryKey | null>(defaultParentCategory);
  const [taskType, setTaskType] = useState<TaskTypeKey | null>(defaultTaskType);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [location, setLocation] = useState("");
  const [locating, setLocating] = useState(false);
  // Email composer state
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailBcc, setEmailBcc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [savingContactEmail, setSavingContactEmail] = useState(false);
  // Call state
  const [callPhone, setCallPhone] = useState("");
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleCtx, setRescheduleCtx] = useState<RescheduleContext | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  // Adjuntos (links a documentos de la empresa)
  const [attachedDocs, setAttachedDocs] = useState<Array<{ id: string; label: string; url: string }>>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  // Diálogos "+ Nuevo" para Empresa y Contacto
  const [companyFormOpen, setCompanyFormOpen] = useState(false);
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [brands, setBrands] = useState<Brand[]>(defaultBrands || []);

  const toggleBrand = (b: Brand) => {
    setBrands((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));
  };

  const linkSeguimientos = async (taskId: string, companyIdFinal: string) => {
    for (const ev of brands) {
      try {
        await supabase.rpc("recompute_seguimiento_ventas", { _company_id: companyIdFinal, _ev: ev });
        const { data: seg } = await supabase
          .from("seguimiento_ventas")
          .select("id")
          .eq("company_id", companyIdFinal)
          .eq("empresa_vendedora", ev)
          .maybeSingle();
        if (seg?.id) {
          await supabase
            .from("crm_task_seguimiento")
            .upsert({ task_id: taskId, seguimiento_venta_id: seg.id }, { onConflict: "task_id,seguimiento_venta_id" });
        }
      } catch (err) {
        console.warn("[seguimiento link] failed", ev, err);
      }
    }
    queryClient.invalidateQueries({ queryKey: ["seguimiento_ventas"] });
  };

  const validateBrandAndCompany = (): { ok: true; companyId: string } | { ok: false } => {
    if (brands.length === 0) {
      toast({ title: "Selecciona al menos una marca", description: "Marca Lumaggs y/o Galsa antes de guardar.", variant: "destructive" });
      return { ok: false };
    }
    const cid = companyId && companyId !== "none" ? companyId : "";
    if (!cid) {
      toast({ title: "Selecciona una empresa", description: "Se requiere para vincular el seguimiento por marca.", variant: "destructive" });
      return { ok: false };
    }
    return { ok: true, companyId: cid };
  };

  const isWhatsApp = taskType === "whatsapp";
  const isVisit = taskType === "field_visit";
  const isEmail = taskType === "email";
  const isCall = taskType === "call";

  const userEmail = session?.user?.email || "";

  // Contactos filtrados por empresa seleccionada (si hay)
  const filteredContacts = (contacts || []).filter((c: any) =>
    companyId ? c.company_id === companyId : true
  );

  const persistEmailTask = (sentOk: boolean) => {
    if (!session?.user) return;
    const v = validateBrandAndCompany();
    if (!v.ok) return;
    const subject = emailSubject || "(sin asunto)";
    const finalTitle = `Email · ${subject}`;
    const header = [
      `Para: ${emailTo || "—"}`,
      emailCc ? `CC: ${emailCc}` : null,
      emailBcc ? `CCO: ${emailBcc}` : null,
      `Responder a: ${userEmail}`,
      `Asunto: ${subject}`,
      sentOk ? "[Enviado desde la app]" : null,
    ].filter(Boolean).join("\n");
    const finalDescription = `${header}\n\n${emailBody}`;
    createTask.mutate(
      {
        user_id: session.user.id,
        title: finalTitle,
        description: finalDescription,
        due_date: localInputToIso(dueDate ? (dueTime ? `${dueDate}T${dueTime}:00` : dueDate) : null) || new Date().toISOString(),
        priority,
        contact_id: contactId && contactId !== "none" ? contactId : null,
        company_id: companyId && companyId !== "none" ? companyId : null,
        task_type: "email",
        parent_task_id: parentTaskId || null,
        parent_category: parentTaskId ? null : parentCategory,
        completed: sentOk,
        completed_at: sentOk ? new Date().toISOString() : null,
      } as any,
      { onSuccess: async (data: any) => {
          if (data?.id) await linkSeguimientos(data.id, v.companyId);
          onOpenChange(false);
        } }
    );
  };

  const handleSendEmail = async () => {
    if (!session?.user) return;
    if (!emailTo || !emailSubject || !emailBody.trim()) {
      toast({ title: "Faltan datos", description: "Completa Para, Asunto y Mensaje.", variant: "destructive" });
      return;
    }
    setSendingEmail(true);
    const escapedBody = emailBody.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const attachmentsHtml = attachedDocs.length
      ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-family:Arial,sans-serif;font-size:14px;color:#333">
          <div style="font-weight:600;margin-bottom:10px;color:#111">📎 Documentos adjuntos</div>
          <ul style="padding-left:18px;margin:0">
            ${attachedDocs.map((d) => `<li style="margin:4px 0"><a href="${d.url}" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:underline">${d.label.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</a></li>`).join("")}
          </ul>
        </div>`
      : "";
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#333;line-height:1.6;white-space:pre-wrap">${escapedBody}</div>${attachmentsHtml}`;
    const ccList = emailCc.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    const bccList = emailBcc.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    if (userEmail) bccList.push(userEmail); // copia al usuario
    try {
      const { data, error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "raw-html",
          recipientEmail: emailTo.trim(),
          idempotencyKey: `crm-email-${session.user.id}-${Date.now()}`,
          subjectOverride: emailSubject,
          htmlOverride: html,
          cc: ccList,
          bcc: bccList,
          replyTo: userEmail || undefined,
          templateData: { __subject: emailSubject, __html: html },
        },
      });
      if (error) throw error;
      if ((data as any)?.success === false) {
        toast({ title: "No enviado", description: (data as any)?.reason || "Suprimido o rechazado", variant: "destructive" });
        setSendingEmail(false);
        return;
      }
      toast({ title: "Correo enviado", description: `Se envió a ${emailTo}${userEmail ? ` (con copia a ${userEmail})` : ""}.` });
      persistEmailTask(true);
    } catch (e: any) {
      toast({ title: "Error al enviar", description: e?.message || "Intenta de nuevo", variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  // Resolver datos del contacto cuando es Llamada
  const { data: callContact } = useQuery({
    queryKey: ["call-create-task-ctx", contactId],
    queryFn: async () => {
      if (!contactId) return null;
      const { data } = await supabase
        .from("contacts")
        .select("first_name,last_name,phone,mobile,whatsapp_phone,tel_emp,comm_tel,comm_tel_emp")
        .eq("id", contactId)
        .maybeSingle();
      return data as any;
    },
    enabled: open && isCall && !!contactId,
  });

  const callContactName = callContact ? `${callContact.first_name || ""} ${callContact.last_name || ""}`.trim() : "";
  const callPhoneOptions = callContact
    ? ([
        { label: "Móvil", value: callContact.mobile },
        { label: "Principal", value: callContact.phone },
        { label: "Empresa", value: callContact.tel_emp },
        { label: "WhatsApp", value: callContact.whatsapp_phone },
        { label: "Comunicación", value: callContact.comm_tel },
        { label: "Comm. empresa", value: callContact.comm_tel_emp },
      ].filter((o) => o.value && String(o.value).trim() !== ""))
    : [];
  const callDefaultPhone = callPhoneOptions[0]?.value || "";

  // Pre-llenar teléfono al cambiar contacto / al activar llamada
  useEffect(() => {
    if (!isCall) return;
    if (callDefaultPhone && !callPhone) setCallPhone(String(callDefaultPhone));
  }, [isCall, callDefaultPhone]); // eslint-disable-line react-hooks/exhaustive-deps

  const copyPhone = async () => {
    if (!callPhone) return;
    try {
      await navigator.clipboard.writeText(callPhone);
      toast({ title: "Teléfono copiado" });
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    }
  };

  const captureLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocalización no disponible", variant: "destructive" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const url = `https://maps.google.com/?q=${latitude},${longitude}`;
        setLocation(url);
        setLocating(false);
        toast({ title: "Ubicación capturada" });
      },
      (err) => {
        setLocating(false);
        toast({ title: "No se pudo obtener la ubicación", description: err.message, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Resolver teléfono y nombres para envío local / API
  const { data: waContext } = useQuery({
    queryKey: ["wa-create-task-ctx", contactId, companyId],
    queryFn: async () => {
      const [c, co] = await Promise.all([
        contactId
          ? supabase.from("contacts").select("first_name,last_name,phone,mobile,whatsapp_phone").eq("id", contactId).maybeSingle()
          : Promise.resolve({ data: null } as any),
        companyId
          ? supabase.from("companies").select("name,phone").eq("id", companyId).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      return { contact: (c as any).data, company: (co as any).data };
    },
    enabled: open && isWhatsApp && (!!contactId || !!companyId),
  });

  // Resolver email del contacto cuando es tipo Correo
  const { data: emailContact, refetch: refetchEmailContact } = useQuery({
    queryKey: ["email-create-task-ctx", contactId],
    queryFn: async () => {
      if (!contactId) return null;
      const { data } = await supabase
        .from("contacts")
        .select("first_name,last_name,email,comm_email,email2,comm_email2")
        .eq("id", contactId)
        .maybeSingle();
      return data as any;
    },
    enabled: open && isEmail && !!contactId,
  });

  const contactEmail = emailContact?.email || emailContact?.comm_email || emailContact?.email2 || emailContact?.comm_email2 || "";
  const contactName = emailContact ? `${emailContact.first_name || ""} ${emailContact.last_name || ""}`.trim() : "";

  // Documentos de la empresa para adjuntar como liga en el correo
  const { data: companyDocs, isLoading: loadingDocs } = useQuery({
    queryKey: ["email-attach-docs", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from("documentos")
        .select("id,tipo_documento,numero_cotizacion,numero_pedido,numero_factura,fecha_documento,total,pdf_url")
        .eq("empresa_id", companyId)
        .eq("is_active", true)
        .not("pdf_url", "is", null)
        .order("fecha_documento", { ascending: false })
        .limit(200);
      return (data || []) as any[];
    },
    enabled: open && isEmail && attachOpen && !!companyId,
  });

  const docLabel = (d: any) => {
    const tipo = String(d.tipo_documento || "").toUpperCase();
    const num = d.numero_factura || d.numero_pedido || d.numero_cotizacion || d.id?.slice(0, 6);
    const fecha = d.fecha_documento ? format(parseISO(d.fecha_documento), "dd/MM/yyyy") : "";
    return `${tipo} ${num}${fecha ? ` · ${fecha}` : ""}`;
  };

  const toggleAttachDoc = (d: any) => {
    setAttachedDocs((prev) => {
      const exists = prev.find((x) => x.id === d.id);
      if (exists) return prev.filter((x) => x.id !== d.id);
      return [...prev, { id: d.id, label: docLabel(d), url: d.pdf_url }];
    });
  };

  // Pre-llenar Para con email del contacto
  useEffect(() => {
    if (!isEmail) return;
    if (contactEmail && !emailTo) setEmailTo(contactEmail);
  }, [isEmail, contactEmail]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveEmailToContact = async () => {
    if (!contactId || !emailTo) return;
    setSavingContactEmail(true);
    const { error } = await supabase.from("contacts").update({ email: emailTo }).eq("id", contactId);
    setSavingContactEmail(false);
    if (error) {
      toast({ title: "No se pudo guardar el correo", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Correo guardado en el contacto" });
    refetchEmailContact();
  };

  const waPhone = waContext?.contact?.whatsapp_phone || waContext?.contact?.mobile || waContext?.contact?.phone || waContext?.company?.phone || null;
  const waNormalized = normalizePhoneForWhatsApp(waPhone);
  const waContactName = waContext?.contact ? `${waContext.contact.first_name || ""} ${waContext.contact.last_name || ""}`.trim() : "";
  const waCompanyName = waContext?.company?.name || "";

  // Re-inicializa el formulario sólo cuando el diálogo PASA a abierto (no en cada render
  // donde cambien props o el padre, para no borrar lo que el usuario está escribiendo).
  useEffect(() => {
    if (!open) return;
    if (editTask) {
      const cleanTitle = (editTask.title || "").replace(/^\[[^\]]+\]\s*/, "");
      setTitle(cleanTitle);
      setDescription(editTask.description || "");
      setParentCategory(((editTask as any).parent_category as ParentCategoryKey) || null);
      setTaskType(((editTask as any).task_type as TaskTypeKey) || null);
      setContactId(editTask.contact_id || "");
      setCompanyId(editTask.company_id || "");
      setPriority(editTask.priority || "medium");
      if (editTask.due_date) {
        const d = editTask.due_date;
        setDueDate(d.slice(0, 10));
        setDueTime(d.length >= 16 ? d.slice(11, 16) : "");
      } else {
        setDueDate(""); setDueTime("");
      }
      setWhatsappOpen(false);
      setLocation("");
      setEmailTo(""); setEmailCc(""); setEmailBcc(""); setEmailSubject(""); setEmailBody("");
      setShowCc(false); setShowBcc(false);
      setCallPhone("");
    } else {
      setTitle(defaultTitle);
      setParentCategory(defaultParentCategory);
      setTaskType(defaultTaskType);
      setContactId(defaultContactId || "");
      setCompanyId(defaultCompanyId || "");
      setDueTime("");
      setWhatsappOpen(false);
      setLocation("");
      setEmailTo(""); setEmailCc(""); setEmailBcc(""); setEmailSubject(""); setEmailBody("");
      setShowCc(false); setShowBcc(false);
      setCallPhone("");
    }
    setBrands(defaultBrands || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const buildWhatsAppTitle = () =>
    `WhatsApp${waContactName ? ` · ${waContactName}` : waCompanyName ? ` · ${waCompanyName}` : ""}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;
    submitWithStatus("default");
  };

  type ActStatus =
    | "default"
    | "programada"
    | "realizada"
    | "no_contesto"
    | "reagendada"
    | "reprogramada"
    | "enviado"
    | "programado_envio"
    | "guardado";

  const STATUS_LABEL: Record<ActStatus, string> = {
    default: "",
    programada: "Programada",
    realizada: "Realizada",
    no_contesto: "No contestó",
    reagendada: "Reagendada",
    reprogramada: "Reprogramada",
    enviado: "Enviado",
    programado_envio: "Programado",
    guardado: "Guardado",
  };

  const STATUS_TO_TASK_STATUS: Partial<Record<ActStatus, string>> = {
    no_contesto: "no_answered",
    reagendada: "rescheduled",
    reprogramada: "reprogrammed",
    realizada: "done",
    enviado: "done",
    guardado: "done",
    programada: "planned",
    programado_envio: "planned",
  };

  const submitWithStatus = async (status: ActStatus) => {
    if (!session?.user) return;
    const needsDate = status === "programada" || status === "programado_envio";
    if (needsDate && !dueDate) {
      toast({ title: "Falta fecha", description: "Selecciona la fecha (y hora) para programar.", variant: "destructive" });
      return;
    }
    const v = validateBrandAndCompany();
    if (!v.ok) return;
    const reopenForNew = status === "no_contesto" || status === "reagendada" || status === "reprogramada";
    const completed = status === "realizada" || status === "enviado" || status === "guardado" || reopenForNew;
    const statusLabel = STATUS_LABEL[status];
    const taskStatusValue = STATUS_TO_TASK_STATUS[status] || "planned";
    let finalTitle = isWhatsApp ? (title || buildWhatsAppTitle()) : title;
    let finalDescription = isVisit && location
      ? `📍 Ubicación: ${location}${description ? `\n\n${description}` : ""}`
      : description;
    if (isEmail) {
      finalTitle = emailSubject || `Email${contactName ? ` · ${contactName}` : ""}`;
      const header = [
        `Para: ${emailTo || "—"}`,
        emailCc ? `CC: ${emailCc}` : null,
        emailBcc ? `CCO: ${emailBcc}` : null,
        `Asunto: ${emailSubject || "(sin asunto)"}`,
      ].filter(Boolean).join("\n");
      finalDescription = `${header}\n\n${emailBody}`;
    }
    if (isCall && callPhone) {
      finalDescription = `📞 Tel: ${callPhone}${description ? `\n\n${description}` : ""}`;
    }
    if (statusLabel) {
      finalTitle = `[${statusLabel}] ${finalTitle || ""}`.trim();
    }
    try {
      const payload: any = {
        title: finalTitle,
        description: finalDescription || null,
        due_date: localInputToIso(dueDate ? (dueTime ? `${dueDate}T${dueTime}:00` : dueDate) : null),
        priority,
        contact_id: contactId && contactId !== "none" ? contactId : null,
        company_id: companyId && companyId !== "none" ? companyId : null,
        task_type: taskType || null,
        parent_category: parentTaskId ? null : parentCategory,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        task_status: taskStatusValue,
      };
      let created: any;
      if (isEditing && editTask) {
        created = await updateTask.mutateAsync({ id: editTask.id, ...payload } as any);
      } else {
        created = await createTask.mutateAsync({
          user_id: session.user.id,
          parent_task_id: parentTaskId || null,
          ...payload,
        } as any);
      }
      if (created?.id) {
        await linkSeguimientos(created.id, v.companyId);
      }
      toast({ title: statusLabel ? `Actividad ${statusLabel}` : (isEditing ? "Cambios guardados" : "Tarea creada") });
      if (reopenForNew) {
        setRescheduleCtx({
          origenTareaId: created?.id || null,
          taskType,
          parentCategory,
          parentTaskId,
          contactId,
          companyId,
          baseTitle: title || finalTitle.replace(/^\[[^\]]+\]\s*/, ""),
          description: finalDescription || null,
          priority,
          reasonLabel: statusLabel,
        });
        onOpenChange(false);
        setRescheduleOpen(true);
        return;
      }
      onOpenChange(false);
      setTitle(""); setDescription(""); setDueDate(""); setDueTime(""); setPriority("medium");
      setContactId(defaultContactId || ""); setCompanyId(defaultCompanyId || "");
      setParentCategory(defaultParentCategory); setTaskType(defaultTaskType);
    } catch (e: any) {
      toast({ title: "No se pudo guardar", description: e?.message, variant: "destructive" });
    }
  };

  // Crea la tarea de WhatsApp registrando el mensaje y la marca como completada
  const persistWhatsAppTask = (channel: "wa_me" | "api") => {
    if (!session?.user) return;
    const v = validateBrandAndCompany();
    if (!v.ok) return;
    const finalTitle = title || buildWhatsAppTitle();
    const channelLabel = channel === "api" ? "API" : "Local";
    createTask.mutate(
      {
        user_id: session.user.id,
        title: finalTitle,
        description: `[${channelLabel}] ${description}`,
        due_date: localInputToIso(dueDate ? (dueTime ? `${dueDate}T${dueTime}:00` : dueDate) : null) || new Date().toISOString(),
        priority,
        contact_id: contactId && contactId !== "none" ? contactId : null,
        company_id: companyId && companyId !== "none" ? companyId : null,
        task_type: taskType || "whatsapp",
        parent_task_id: parentTaskId || null,
        parent_category: parentTaskId ? null : parentCategory,
        completed: true,
        completed_at: new Date().toISOString(),
      } as any,
      {
        onSuccess: async (data: any) => {
          if (data?.id) await linkSeguimientos(data.id, v.companyId);
          toast({ title: "Mensaje registrado", description: `WhatsApp enviado vía ${channelLabel}.` });
          onOpenChange(false);
        },
        onError: (e: any) => {
          toast({ title: "No se pudo registrar la tarea", description: e?.message, variant: "destructive" });
        },
      }
    );
  };

  // Enviar por wa.me (Local) y registrar la tarea
  const handleSendLocal = async () => {
    if (!session?.user) return;
    if (!waNormalized) {
      toast({ title: "Sin teléfono válido", description: "Captura un teléfono en la ficha del contacto.", variant: "destructive" });
      return;
    }
    if (!description.trim()) {
      toast({ title: "Mensaje vacío", description: "Escribe el mensaje a enviar.", variant: "destructive" });
      return;
    }
    openWhatsApp(waNormalized, description);
    try {
      await logWhatsAppActivity({
        user_id: session.user.id,
        message: description,
        company_id: companyId || null,
        contact_id: contactId || null,
        result: "enviado",
        title: buildWhatsAppTitle(),
        destinatario_phone: waNormalized,
        message_type: "texto",
        channel: "wa_me",
      });
    } catch (err) {
      console.warn("[wa] log failed", err);
    }
    persistWhatsAppTask("wa_me");
  };

  // Abrir el flujo por API (plantillas aprobadas)
  const handleSendApi = () => {
    if (!description.trim()) {
      toast({ title: "Mensaje vacío", description: "Escribe el mensaje o selecciona una plantilla.", variant: "destructive" });
      return;
    }
    setWhatsappOpen(true);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header con gradiente como el modal de detalle */}
        <div className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4 border-b shrink-0">
          <DialogTitle className="text-lg font-semibold tracking-tight">
            {isEditing ? "Editar actividad" : (parentTaskId ? "Agregar paso a la secuencia" : "Crear Actividad / Tarea")}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5 font-light">
            Completa los datos para registrar la nueva actividad.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5 overflow-y-auto flex-1">
          {!parentTaskId && (
            <section className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Categoría</div>
              <div className="grid grid-cols-3 gap-2">
                {PARENT_CATEGORIES.map(({ key, label, Icon, soft, active }) => {
                  const sel = parentCategory === key;
                  return (
                    <button key={key} type="button" onClick={() => setParentCategory(key)}
                      className={cn("flex items-center justify-center gap-1.5 rounded-md border p-2 text-sm font-medium transition-all",
                        sel ? active : soft)}>
                      <Icon className="h-4 w-4" /> {label}
                    </button>
                  );
                })}
                <button type="button" onClick={() => setParentCategory(null)}
                  className={cn("rounded-md border p-2 text-sm font-medium transition-all",
                    parentCategory === null
                      ? "bg-slate-700 text-white border-slate-700"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100")}>
                  Otra
                </button>
              </div>
            </section>
          )}
          <section className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Tipo de actividad</div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {ACTION_TASK_TYPES.map(({ key, label, Icon, soft, active }) => {
                const sel = taskType === key;
                return (
                  <button key={key} type="button" onClick={() => setTaskType(sel ? null : key)} title={label}
                    className={cn("flex flex-col items-center justify-center gap-0.5 rounded-md border p-2 transition-all",
                      sel ? active : soft)}>
                    <Icon className="h-4 w-4" />
                    <span className="text-[10px] font-medium leading-tight">{label}</span>
                  </button>
                );
              })}
            </div>
          </section>
          <section className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Marca * (puede seleccionar una o ambas)</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "lumaggs_chevron" as Brand, label: "Lumaggs (Chevron)", soft: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100", active: "bg-blue-600 text-white border-blue-600 hover:bg-blue-600" },
                { key: "galsa_phillips66" as Brand, label: "Galsa (Phillips 66)", soft: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100", active: "bg-red-600 text-white border-red-600 hover:bg-red-600" },
              ].map((b) => {
                const sel = brands.includes(b.key);
                return (
                  <button key={b.key} type="button" onClick={() => toggleBrand(b.key)} aria-pressed={sel}
                    className={cn("rounded-md border px-3 py-2 text-sm font-medium transition-all", sel ? b.active : b.soft)}>
                    {b.label}
                  </button>
                );
              })}
            </div>
          </section>
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Empresa</div>
                <button
                  type="button"
                  onClick={() => setCompanyFormOpen(true)}
                  className="text-[10px] uppercase tracking-wide text-primary hover:underline flex items-center gap-0.5"
                >
                  <Plus className="h-3 w-3" /> Nueva
                </button>
              </div>
              <SearchableSelect
                value={companyId || "none"}
                onValueChange={(v) => setCompanyId(v === "none" ? "" : v)}
                options={[
                  { value: "none", label: "Ninguna" },
                  ...((companies || []).map((c: any) => ({ value: c.id, label: c.name }))),
                ]}
                placeholder="Buscar empresa..."
                className="font-light text-sm"
              />
            </div>
            <div className="space-y-2 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Contacto
                  {companyId && (
                    <span className="ml-1 normal-case text-[10px] text-muted-foreground/70 font-light">(filtrado por empresa)</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setContactFormOpen(true)}
                  className="text-[10px] uppercase tracking-wide text-primary hover:underline flex items-center gap-0.5"
                >
                  <Plus className="h-3 w-3" /> Nuevo
                </button>
              </div>
              <SearchableSelect
                value={contactId || "none"}
                onValueChange={(v) => setContactId(v === "none" ? "" : v)}
                options={[
                  { value: "none", label: "Ninguno" },
                  ...(filteredContacts.map((c: any) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` }))),
                ]}
                placeholder={companyId ? "Buscar contacto de la empresa..." : "Buscar contacto..."}
                className="font-light text-sm"
              />
            </div>
          </section>
          {!isWhatsApp && !isEmail && (
          <>
          {isCall && (
            <section className="space-y-2 rounded-lg border bg-muted/30 p-3">
              {!contactId && (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs font-light text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <UserPlus className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Selecciona un contacto en <strong>Contacto</strong> para autollenar el teléfono.</span>
                </div>
              )}
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-12 sm:col-span-6 space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Contacto a llamar</Label>
                  <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-background font-light text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{callContactName || "—"}</span>
                  </div>
                </div>
                <div className="col-span-12 sm:col-span-6 space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Teléfono usado</Label>
                  <div className="flex gap-1">
                    {callPhoneOptions.length > 1 ? (
                      <Select value={callPhone} onValueChange={setCallPhone}>
                        <SelectTrigger className="h-9 font-light flex-1 min-w-0">
                          <SelectValue placeholder="Selecciona teléfono" />
                        </SelectTrigger>
                        <SelectContent>
                          {callPhoneOptions.map((o, i) => (
                            <SelectItem key={`${o.label}-${i}`} value={String(o.value)}>
                              <span className="font-light">{o.label}: {o.value}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={callPhone}
                        onChange={(e) => setCallPhone(e.target.value)}
                        placeholder="Captura el teléfono"
                        className="font-light h-9 flex-1 min-w-0"
                      />
                    )}
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={copyPhone} title="Copiar teléfono" disabled={!callPhone}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="icon" className="h-9 w-9 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white" asChild disabled={!callPhone}>
                      <a href={callPhone ? `tel:${callPhone}` : undefined} title="Llamar">
                        <Phone className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          )}
          <section className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Título *</div>
            <div className="flex gap-2">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Dar seguimiento al cliente"
                required={!isWhatsApp}
                maxLength={200}
                className="flex-1 text-base font-light"
              />
              <DictationButton currentText={title} onTranscript={setTitle} />
            </div>
          </section>
          </>
          )}
          {isEmail && (
            <section className="space-y-3 rounded-lg border bg-muted/30 p-3">
              {!contactId && (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs font-light text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <UserPlus className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    Selecciona un contacto en <strong>Vincular a Contacto</strong> para usar su correo automáticamente.
                  </span>
                </div>
              )}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Para *</Label>
                  <div className="flex gap-2 text-[11px]">
                    {!showCc && (
                      <button type="button" onClick={() => setShowCc(true)} className="text-primary hover:underline">+ CC</button>
                    )}
                    {!showBcc && (
                      <button type="button" onClick={() => setShowBcc(true)} className="text-primary hover:underline">+ CCO</button>
                    )}
                  </div>
                </div>
                <Input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder={contactId ? (contactEmail || "El contacto no tiene correo — captúralo aquí") : "destinatario@ejemplo.com"}
                  required
                  className="font-light h-9"
                />
                {contactId && emailTo && emailTo !== contactEmail && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={saveEmailToContact}
                    disabled={savingContactEmail}
                    className="h-7 text-xs gap-1.5"
                  >
                    {savingContactEmail ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Guardar correo en {contactName || "el contacto"}
                  </Button>
                )}
              </div>
              {showCc && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">CC</Label>
                    <button type="button" onClick={() => { setShowCc(false); setEmailCc(""); }} className="text-xs text-muted-foreground hover:text-destructive hover:underline">− CC</button>
                  </div>
                  <Input type="text" value={emailCc} onChange={(e) => setEmailCc(e.target.value)} placeholder="cc@ejemplo.com, otro@ejemplo.com" className="font-light h-9" />
                </div>
              )}
              {showBcc && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">CCO</Label>
                    <button type="button" onClick={() => { setShowBcc(false); setEmailBcc(""); }} className="text-xs text-muted-foreground hover:text-destructive hover:underline">− CCO</button>
                  </div>
                  <Input type="text" value={emailBcc} onChange={(e) => setEmailBcc(e.target.value)} placeholder="cco@ejemplo.com" className="font-light h-9" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Asunto *</Label>
                <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Asunto del correo" required maxLength={200} className="font-light h-9" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Mensaje</Label>
                  <DictationButton currentText={emailBody} onTranscript={setEmailBody} size="sm" className="h-7 px-2 text-xs gap-1" title="Dictar mensaje" />
                </div>
                <Textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={6} maxLength={4000} placeholder="Escribe tu correo..." className="font-light bg-background" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Adjuntos</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!companyId) {
                        toast({ title: "Vincula una empresa", description: "Selecciona una empresa para ver sus documentos.", variant: "destructive" });
                        return;
                      }
                      setAttachOpen(true);
                    }}
                    className="h-7 text-xs gap-1.5"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    Adjuntar documento
                  </Button>
                </div>
                {attachedDocs.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground font-light">
                    Se enviarán como liga de descarga al final del correo.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {attachedDocs.map((d) => (
                      <span key={d.id} className="inline-flex items-center gap-1 rounded-full border bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 text-[11px] text-blue-800 dark:text-blue-200">
                        <FileText className="h-3 w-3" />
                        {d.label}
                        <button
                          type="button"
                          onClick={() => setAttachedDocs((prev) => prev.filter((x) => x.id !== d.id))}
                          className="ml-0.5 rounded-full hover:bg-blue-200/60 dark:hover:bg-blue-800/40"
                          aria-label="Quitar"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 pt-1 border-t">
                <div className="text-[11px] text-muted-foreground font-light pt-2">
                  <span className="font-medium">Responder a:</span> {userEmail || "—"} · Se enviará una copia a tu correo.
                </div>
                <Button
                  type="button"
                  onClick={handleSendEmail}
                  disabled={sendingEmail || !emailTo || !emailSubject || !emailBody.trim()}
                  className="self-end bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                >
                  {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendIcon className="h-4 w-4" />}
                  Enviar Correo
                </Button>
              </div>
            </section>
          )}
          {!isEmail && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {isWhatsApp ? "Mensaje de WhatsApp" : "Descripción"}
              </div>
              <DictationButton
                currentText={description}
                onTranscript={setDescription}
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                title="Dictar descripción"
              />
            </div>
            {isWhatsApp ? (
              <div className="rounded-lg border bg-[#e7f6d5] dark:bg-emerald-900/20 p-2">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  maxLength={4000}
                  placeholder="Escribe el mensaje que enviarás por WhatsApp..."
                  className="font-light bg-white/70 dark:bg-background/40 border-0 focus-visible:ring-1"
                />
                <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-muted-foreground font-light">
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    Para: {waContactName || waCompanyName || "—"}
                    {waNormalized ? ` · +${waNormalized}` : " · sin teléfono"}
                  </span>
                  <span>{description.length}/4000</span>
                </div>
              </div>
            ) : (
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={2000}
                className="font-light"
              />
            )}
          </section>
          )}
          {isVisit && (
            <section className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Ubicación de la visita</div>
              <div className="flex gap-2">
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Dirección, referencia o link de Google Maps"
                  className="flex-1 text-base font-light"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={captureLocation}
                  disabled={locating}
                  title="Capturar ubicación actual"
                  className="shrink-0 gap-1.5"
                >
                  {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
                  <span className="hidden sm:inline text-xs">Mi ubicación</span>
                </Button>
              </div>
              {location && location.startsWith("http") && (
                <a href={location} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-light">
                  <MapPin className="h-3 w-3" /> Abrir en mapa
                </a>
              )}
            </section>
          )}
          <section className="grid grid-cols-12 gap-3">
            <div className="space-y-2 col-span-8">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Fecha</div>
              <div className="flex gap-2 min-w-0">
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "flex-1 min-w-0 justify-start text-left font-light h-9 px-3",
                        !dueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-60" />
                      <span className="truncate">
                        {dueDate
                          ? format(parseISO(dueDate.slice(0, 10)), "EEE d MMM yyyy", { locale: es })
                          : "Selecciona fecha"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate ? parseISO(dueDate.slice(0, 10)) : undefined}
                      onSelect={(d) => { setDueDate(d ? format(d, "yyyy-MM-dd") : ""); if (d) setDateOpen(false); }}
                      initialFocus
                      locale={es}
                      className={cn("p-3 pointer-events-auto font-light")}
                    />
                  </PopoverContent>
                </Popover>
                <Input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="w-[88px] shrink-0 h-9 px-2 text-xs font-light"
                />
              </div>
            </div>
            <div className="space-y-2 col-span-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Prioridad</div>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-9 font-light">
                  <SelectValue>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-block h-2.5 w-2.5 rounded-full",
                          priority === "low" && "bg-green-500",
                          priority === "medium" && "bg-yellow-500",
                          priority === "high" && "bg-red-500",
                        )}
                      />
                      <span className="capitalize">
                        {priority === "low" ? "Baja" : priority === "high" ? "Alta" : "Media"}
                      </span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                      Baja
                    </span>
                  </SelectItem>
                  <SelectItem value="medium">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-500" />
                      Media
                    </span>
                  </SelectItem>
                  <SelectItem value="high">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
                      Alta
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>
        </form>
        {/* Footer fijo, similar al detalle */}
        <div className="border-t bg-muted/30 px-4 py-3 flex flex-wrap gap-2 justify-end shrink-0">
            <Button size="sm" type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {isWhatsApp ? (
            <>
              <Button size="sm" type="button" variant="outline" onClick={() => submitWithStatus("guardado")} disabled={!description.trim() || createTask.isPending}>
                <Save className="h-4 w-4 mr-1" /> Guardar
              </Button>
              <Button size="sm" type="button" variant="outline" onClick={() => submitWithStatus("programado_envio")} disabled={createTask.isPending}>
                <CalendarIcon className="h-4 w-4 mr-1" /> Programado
              </Button>
              <Button size="sm" type="button" variant="secondary" onClick={handleSendApi} disabled={!description.trim()}>
                <Send className="h-4 w-4 mr-1" /> API
              </Button>
              <Button size="sm" type="button" onClick={handleSendLocal} disabled={!description.trim() || !waNormalized || createTask.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <MessageCircle className="h-4 w-4 mr-1" /> Local
              </Button>
            </>
          ) : isCall ? (
            <>
              <Button size="sm" type="button" variant="outline" onClick={() => submitWithStatus("programada")} disabled={createTask.isPending}>Programada</Button>
              <Button size="sm" type="button" onClick={() => submitWithStatus("realizada")} disabled={createTask.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">Realizada</Button>
            </>
          ) : isEmail ? (
            <>
              <Button size="sm" type="button" variant="outline" onClick={() => submitWithStatus("programado_envio")} disabled={createTask.isPending}>Programado</Button>
              <Button size="sm" type="button" onClick={() => submitWithStatus("enviado")} disabled={createTask.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">Enviado</Button>
            </>
          ) : taskType === "meeting" ? (
            <>
              <Button size="sm" type="button" variant="outline" onClick={() => submitWithStatus("programada")} disabled={createTask.isPending}>Programada</Button>
              <Button size="sm" type="button" onClick={() => submitWithStatus("realizada")} disabled={createTask.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">Realizada</Button>
            </>
          ) : isVisit ? (
            <>
              <Button size="sm" type="button" variant="outline" onClick={() => submitWithStatus("programada")} disabled={createTask.isPending}>Programada</Button>
              <Button size="sm" type="button" onClick={() => submitWithStatus("realizada")} disabled={createTask.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">Realizada</Button>
            </>
          ) : (
            <Button size="sm" type="submit" disabled={createTask.isPending} onClick={handleSubmit}>
              {createTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear Actividad / Tarea"}
            </Button>
          )}
        </div>
        {isWhatsApp && (
          <WhatsAppActionDialog
            open={whatsappOpen}
            onOpenChange={setWhatsappOpen}
            phone={waPhone}
            variables={{
              contacto_nombre: waContactName || null,
              empresa_nombre: waCompanyName || null,
              ejecutivo_nombre: null,
              folio_cotizacion: null,
            }}
            defaultMessage={description}
            context={{
              company_id: companyId || null,
              contact_id: contactId || null,
            }}
            onSent={() => {
              setWhatsappOpen(false);
              persistWhatsAppTask("api");
            }}
          />
        )}
      </DialogContent>
    </Dialog>
    <RescheduleActivityDialog open={rescheduleOpen} onOpenChange={setRescheduleOpen} context={rescheduleCtx} />
    <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 border-b">
          <DialogTitle className="text-base font-light tracking-wide flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Adjuntar documento de la empresa
          </DialogTitle>
        </DialogHeader>
        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          {loadingDocs ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando documentos...
            </div>
          ) : !companyDocs || companyDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground font-light text-center py-8">
              No hay documentos con PDF disponibles para esta empresa.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {companyDocs.map((d: any) => {
                const checked = !!attachedDocs.find((x) => x.id === d.id);
                return (
                  <li key={d.id}>
                    <label className={cn(
                      "flex items-center gap-3 p-2.5 rounded-md border cursor-pointer transition-colors",
                      checked ? "bg-blue-50 dark:bg-blue-950/30 border-blue-300" : "hover:bg-muted/50"
                    )}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAttachDoc(d)}
                        className="h-4 w-4"
                      />
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-light truncate">{docLabel(d)}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {Number(d.total || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
                        </div>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="border-t bg-muted/30 px-5 py-3 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setAttachOpen(false)}>Listo</Button>
        </div>
      </DialogContent>
    </Dialog>
    <CompanyFormDialog
      open={companyFormOpen}
      onOpenChange={setCompanyFormOpen}
      onCreated={(newId) => {
        queryClient.invalidateQueries({ queryKey: ["companies-picker"] });
        setCompanyId(newId);
      }}
    />
    <ContactFormDialog
      open={contactFormOpen}
      onOpenChange={setContactFormOpen}
      defaultCompanyId={companyId || undefined}
      onCreated={(newId) => {
        queryClient.invalidateQueries({ queryKey: ["contacts-picker"] });
        setContactId(newId);
      }}
    />
    </>
  );
}
