import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Megaphone, Play, Plus, AlertTriangle, CheckCircle2, Clock, CalendarIcon, Users, X } from "lucide-react";
import { MarketingPromoUpload, PromoPlaceholderHint } from "@/components/whatsapp/MarketingPromoUpload";
import { WhatsAppChatPreview } from "@/components/whatsapp/WhatsAppChatPreview";

type Campaign = {
  id: string;
  nombre: string;
  template_name: string;
  template_language: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  business_phone_number_id: string | null;
  scheduled_at?: string | null;
};

type Template = {
  id: string;
  name: string;
  language: string;
  status: string;
  body: string | null;
  source_body: string | null;
  variable_map: string[] | null;
  header_type: string | null;
  header_image_url: string | null;
  header_video_url: string | null;
  rejection_reason: string | null;
};

type Account = {
  id: string;
  business_phone_number_id: string;
  label: string;
  display_phone: string | null;
  is_active: boolean;
};

type Contact = {
  id: string;
  first_name: string;
  last_name: string;
  whatsapp_phone: string | null;
  mobile: string | null;
  company_id: string | null;
  plaza_id?: string | null;
  interes_ids?: string[];
  company_name?: string | null;
};

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "completed") return "default";
  if (s === "running") return "secondary";
  if (s === "failed") return "destructive";
  return "outline";
};

export default function WhatsAppCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [tplName, setTplName] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null);
  const [headerVideoUrl, setHeaderVideoUrl] = useState<string | null>(null);
  const [linePhoneId, setLinePhoneId] = useState<string>("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [plazaFilter, setPlazaFilter] = useState<string>("all");
  const [plazas, setPlazas] = useState<{ id: string; nombre: string }[]>([]);
  const [giroFilter, setGiroFilter] = useState<string[]>([]);
  const [intereses, setIntereses] = useState<{ id: string; nombre: string }[]>([]);
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState<string>("09:00");
  const [excludeRecent, setExcludeRecent] = useState<boolean>(true);
  const [recentContactIds, setRecentContactIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("whatsapp_campaigns")
      .select("id,nombre,template_name,template_language,status,total_recipients,sent_count,failed_count,skipped_count,created_at,started_at,finished_at,business_phone_number_id")
      .order("created_at", { ascending: false })
      .limit(100);
    setCampaigns((data ?? []) as Campaign[]);
  };

  useEffect(() => {
    load();
    const loadTpls = () =>
      supabase
        .from("whatsapp_templates")
        .select("id,name,language,status,body,source_body,variable_map,header_type,header_image_url,header_video_url,rejection_reason")
        .order("name")
        .then(({ data }) => setTemplates(((data ?? []) as unknown) as Template[]));
    loadTpls();
    supabase
      .from("whatsapp_accounts")
      .select("id,business_phone_number_id,label,display_phone,is_active")
      .eq("is_active", true)
      .order("label")
      .then(({ data }) => {
        const accs = ((data ?? []) as unknown) as Account[];
        setAccounts(accs);
        if (!linePhoneId && accs[0]) setLinePhoneId(accs[0].business_phone_number_id);
      });
    supabase
      .from("contacts")
      .select("id,first_name,last_name,whatsapp_phone,mobile,company_id,plaza_id,contacto_intereses(interes_id),companies(name)")
      .eq("is_active", true)
      .eq("no_contactar", false)
      .order("first_name")
      .limit(2000)
      .then(({ data }) => {
        const rows = ((data ?? []) as any[]).map((r) => ({
          ...r,
          interes_ids: (r.contacto_intereses || []).map((ci: any) => ci.interes_id),
          company_name: r.companies?.name ?? null,
        }));
        setContacts(rows as Contact[]);
      });

    (supabase as any)
      .from("intereses_giro")
      .select("id,nombre")
      .eq("is_active", true)
      .order("nombre")
      .then(({ data }: any) => setIntereses(data || []));

    supabase
      .from("plazas")
      .select("id,nombre")
      .eq("is_active", true)
      .order("nombre")
      .then(({ data }) => setPlazas((data || []) as any));

    // Cargar contactos con envíos en últimas 48h para filtro de exclusión
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    (supabase as any)
      .from("whatsapp_campaign_recipients")
      .select("contact_id")
      .gte("sent_at", since)
      .in("status", ["sent", "delivered", "read"])
      .limit(5000)
      .then(({ data }: any) => {
        const ids = new Set<string>((data || []).map((r: any) => r.contact_id).filter(Boolean));
        setRecentContactIds(ids);
      });

    const ch = supabase
      .channel("wa-campaigns")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_campaigns" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_templates" }, loadTpls)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eligible = useMemo(() => {
    return contacts.filter((c) => {
      if (!(c.whatsapp_phone || c.mobile)) return false;
      if (plazaFilter !== "all" && c.plaza_id !== plazaFilter) return false;
      if (giroFilter.length > 0) {
        const ids = c.interes_ids || [];
        // OR: contact must have AT LEAST ONE selected giro
        if (!giroFilter.some((g) => ids.includes(g))) return false;
      }
      if (excludeRecent && recentContactIds.has(c.id)) return false;
      return true;
    });
  }, [contacts, plazaFilter, giroFilter, excludeRecent, recentContactIds]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return eligible;
    return eligible.filter((c) =>
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(s) ||
      (c.company_name || "").toLowerCase().includes(s) ||
      (c.whatsapp_phone || c.mobile || "").toLowerCase().includes(s),
    );
  }, [eligible, search]);

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((c) => c.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const reset = () => {
    setName("");
    setTplName("");
    setSearch("");
    setSelected(new Set());
    setHeaderImageUrl(null);
    setHeaderVideoUrl(null);
    setVariables({});
    setScheduleMode("now");
    setScheduledAt(undefined);
    setScheduledTime("09:00");
    setExcludeRecent(true);
  };

  const selectedTpl = useMemo(
    () => templates.find((t) => t.name === tplName) || null,
    [templates, tplName],
  );
  const requiresImage = selectedTpl?.header_type === "IMAGE";
  const requiresVideo = selectedTpl?.header_type === "VIDEO";
  const isApproved = selectedTpl?.status === "APPROVED";
  const variableKeys: string[] = Array.isArray(selectedTpl?.variable_map)
    ? (selectedTpl!.variable_map as string[])
    : [];
  const missingVars = variableKeys.filter((k) => !(variables[k] ?? "").trim());
  const selectedLine = accounts.find((a) => a.business_phone_number_id === linePhoneId);

  // Vista previa con datos reales del primer destinatario seleccionado
  const previewContact = useMemo(() => {
    const firstId = Array.from(selected)[0];
    return firstId ? contacts.find((c) => c.id === firstId) || null : null;
  }, [selected, contacts]);

  const previewVariables: Record<string, string> = useMemo(() => {
    const base: Record<string, string> = { ...variables };
    const c = previewContact;
    if (c) {
      const fullName = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
      if (!base.nombre) base.nombre = fullName || "Cliente";
      if (!base.nombre_cliente) base.nombre_cliente = fullName || "Cliente";
      if (!base.empresa) base.empresa = c.company_name || "Su empresa";
      if (!base.nombre_empresa) base.nombre_empresa = c.company_name || "Su empresa";
    }
    return base;
  }, [variables, previewContact]);

  const isMassSend = selected.size >= 500;
  const computedScheduledAt = (): string | null => {
    if (scheduleMode !== "later" || !scheduledAt) return null;
    const [hh, mm] = (scheduledTime || "09:00").split(":").map((n) => parseInt(n, 10) || 0);
    const dt = new Date(scheduledAt);
    dt.setHours(hh, mm, 0, 0);
    return dt.toISOString();
  };

  const validateBeforeLaunch = (): boolean => {
    if (!name.trim() || !tplName) {
      toast.error("Nombre y plantilla son obligatorios");
      return false;
    }
    if (!isApproved) {
      toast.error("Solo puedes lanzar plantillas APROBADAS por Meta");
      return false;
    }
    if (requiresImage && !headerImageUrl) {
      toast.error("Esta plantilla requiere una imagen de encabezado");
      return false;
    }
    if (requiresVideo && !headerVideoUrl) {
      toast.error("Esta plantilla requiere un video de encabezado");
      return false;
    }
    if (missingVars.length > 0) {
      toast.error(`Faltan variables: ${missingVars.join(", ")}`);
      return false;
    }
    if (!linePhoneId) {
      toast.error("Selecciona la línea de salida");
      return false;
    }
    if (selected.size === 0) {
      toast.error("Selecciona al menos un destinatario");
      return false;
    }
    if (scheduleMode === "later") {
      const iso = computedScheduledAt();
      if (!iso) {
        toast.error("Selecciona fecha y hora para programar el envío");
        return false;
      }
      if (new Date(iso).getTime() <= Date.now()) {
        toast.error("La fecha programada debe ser en el futuro");
        return false;
      }
    }
    return true;
  };

  const createAndLaunch = async () => {
    if (!validateBeforeLaunch()) return;
    const tpl = selectedTpl;
    if (!tpl) {
      toast.error("Plantilla no encontrada");
      return;
    }
    const scheduleIso = computedScheduledAt();
    const isScheduled = !!scheduleIso;
    setCreating(true);
    const { data: ures } = await supabase.auth.getUser();
    const { data: camp, error: cErr } = await supabase
      .from("whatsapp_campaigns")
      .insert({
        nombre: name.trim(),
        template_id: tpl.id,
        template_name: tpl.name,
        template_language: tpl.language,
        status: isScheduled ? "scheduled" : "draft",
        scheduled_at: scheduleIso,
        total_recipients: selected.size,
        created_by: ures.user?.id,
        header_image_url: headerImageUrl,
        header_video_url: headerVideoUrl,
        business_phone_number_id: linePhoneId,
        template_variables: Object.keys(variables).length > 0 ? variables : null,
      })
      .select("id")
      .single();
    if (cErr || !camp) {
      setCreating(false);
      toast.error(cErr?.message ?? "No se pudo crear");
      return;
    }
    const recips = Array.from(selected).map((cid) => {
      const c = contacts.find((x) => x.id === cid)!;
      return {
        campaign_id: camp.id,
        contact_id: cid,
        wa_phone: (c.whatsapp_phone || c.mobile || "").replace(/\D/g, ""),
        status: "pending",
      };
    }).filter((r) => r.wa_phone);
    const { error: rErr } = await supabase.from("whatsapp_campaign_recipients").insert(recips);
    if (rErr) {
      setCreating(false);
      toast.error(rErr.message);
      return;
    }
    if (isScheduled) {
      setCreating(false);
      toast.success(`Campaña programada para ${format(new Date(scheduleIso!), "dd/MM/yyyy HH:mm")} con ${recips.length} destinatarios`);
      setOpen(false);
      reset();
      load();
      return;
    }
    const { error: lErr } = await supabase.functions.invoke("whatsapp-campaign-runner", {
      body: { campaign_id: camp.id },
    });
    setCreating(false);
    if (lErr) {
      toast.error(lErr.message ?? "No se pudo lanzar");
      return;
    }
    toast.success(`Campaña lanzada con ${recips.length} destinatarios`);
    setOpen(false);
    reset();
    load();
  };

  const tplStatusBadge = (s: string) => {
    if (s === "APPROVED") return <Badge className="bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" />Aprobada</Badge>;
    if (s === "REJECTED") return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Rechazada</Badge>;
    return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" /> Campañas WhatsApp
          </h1>
          <p className="text-sm text-muted-foreground">
            Envíos masivos con plantillas aprobadas. Solo plantillas — Meta no permite texto libre en masivos.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Nueva campaña</Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nueva campaña</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
              <div className="space-y-4">
              {/* Segmentación de audiencia */}
              <div className="rounded-md border p-3 space-y-3 bg-primary/5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase text-primary font-semibold">Segmentación de audiencia</Label>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={isMassSend ? "destructive" : "default"}
                      className="text-sm px-3 py-1 gap-1"
                    >
                      <Users className="h-3.5 w-3.5" />
                      {eligible.length} contactos coinciden
                    </Badge>
                    {eligible.length > 500 && (
                      <Badge variant="outline" className="border-orange-500 text-orange-600 gap-1">
                        <AlertTriangle className="h-3 w-3" /> Envío masivo detectado
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Plaza</Label>
                    <Select value={plazaFilter} onValueChange={(v) => { setPlazaFilter(v); setSelected(new Set()); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las plazas</SelectItem>
                        {plazas.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Giro (cumple cualquiera de los seleccionados)</Label>
                    <div className="flex flex-wrap gap-2 rounded-md border bg-background p-2 min-h-10">
                      {intereses.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sin giros</span>
                      ) : intereses.map((g) => {
                        const checked = giroFilter.includes(g.id);
                        return (
                          <label key={g.id} className="flex items-center gap-1 text-sm cursor-pointer">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                setGiroFilter((prev) => v ? [...prev, g.id] : prev.filter((x) => x !== g.id));
                                setSelected(new Set());
                              }}
                            />
                            {g.nombre}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={excludeRecent}
                    onCheckedChange={(v) => { setExcludeRecent(!!v); setSelected(new Set()); }}
                  />
                  Excluir contactos a los que se les envió una campaña en las últimas 48 horas
                  <Badge variant="outline" className="ml-1">{recentContactIds.size} excluibles</Badge>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Nombre</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Promo abril 2026" />
                </div>
                <div>
                  <Label>Plantilla</Label>
                  <Select value={tplName} onValueChange={(v) => { setTplName(v); setVariables({}); setHeaderImageUrl(null); setHeaderVideoUrl(null); }}>
                    <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                    <SelectContent>
                      {templates.length === 0 ? (
                        <div className="px-2 py-1 text-xs text-muted-foreground">Sin plantillas</div>
                      ) : templates.map((t) => (
                          <SelectItem key={t.id} value={t.name}>
                            {t.name} ({t.language}) — {t.status}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {selectedTpl && (
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {tplStatusBadge(selectedTpl.status)}
                      {selectedTpl.status === "REJECTED" && selectedTpl.rejection_reason && (
                        <span className="text-xs text-destructive">{selectedTpl.rejection_reason}</span>
                      )}
                      {selectedTpl.status === "PENDING" && (
                        <span className="text-xs text-muted-foreground">Meta está revisando esta plantilla. El envío se habilitará al aprobarse.</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <Label>Línea de salida</Label>
                {accounts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No hay líneas configuradas en Ajustes &gt; WhatsApp.</p>
                ) : (
                  <Select value={linePhoneId} onValueChange={setLinePhoneId}>
                    <SelectTrigger><SelectValue placeholder="Selecciona línea…" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.business_phone_number_id}>
                          {a.label}{a.display_phone ? ` · ${a.display_phone}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {requiresImage && (
                <div className="space-y-2">
                  <Label>Imagen del encabezado</Label>
                  <MarketingPromoUpload value={headerImageUrl} onChange={setHeaderImageUrl} />
                  <PromoPlaceholderHint />
                </div>
              )}

              {requiresVideo && (
                <div className="space-y-2">
                  <Label>Video del encabezado</Label>
                  <MarketingPromoUpload
                    value={headerVideoUrl}
                    onChange={setHeaderVideoUrl}
                    kind="video"
                    aspectRatio="16/9"
                  />
                  <p className="text-xs text-muted-foreground">MP4 · máx 16 MB.</p>
                </div>
              )}

              {/* Programación de envío */}
              <div className="rounded-md border p-3 space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">Programación</Label>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="schedule"
                      checked={scheduleMode === "now"}
                      onChange={() => setScheduleMode("now")}
                    />
                    Enviar ahora
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="schedule"
                      checked={scheduleMode === "later"}
                      onChange={() => setScheduleMode("later")}
                    />
                    Programar envío
                  </label>
                </div>
                {scheduleMode === "later" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn("justify-start text-left font-normal", !scheduledAt && "text-muted-foreground")}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {scheduledAt ? format(scheduledAt, "PPP") : "Selecciona fecha"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={scheduledAt}
                          onSelect={setScheduledAt}
                          disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {variableKeys.length > 0 && (
                <div className="space-y-2 rounded-md border p-3 bg-muted/20">
                  <Label className="text-xs uppercase text-muted-foreground">Variables del mensaje</Label>
                  {variableKeys.map((k) => (
                    <div key={k} className="grid grid-cols-[140px_1fr] items-center gap-2">
                      <span className="text-xs text-muted-foreground truncate">{k}</span>
                      <Input
                        placeholder={`Valor para ${k}`}
                        value={variables[k] ?? ""}
                        onChange={(e) => setVariables({ ...variables, [k]: e.target.value })}
                      />
                    </div>
                  ))}
                  <p className="text-[11px] text-muted-foreground">El sistema convierte estos campos a {`{{1}}, {{2}}…`} automáticamente al enviar a Meta.</p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Destinatarios ({selected.size} de {filtered.length})</Label>
                  <div className="flex gap-2">
                    {selected.size > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                        <X className="h-3 w-3 mr-1" /> Limpiar selección
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={toggleAll}>
                      {selected.size === filtered.length && filtered.length > 0 ? "Deseleccionar" : "Seleccionar todos"}
                    </Button>
                  </div>
                </div>
                <Input
                  placeholder="Buscar por nombre, empresa o teléfono…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="mb-2"
                />
                <ScrollArea className="h-72 border rounded">
                  {filtered.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      No hay contactos con WhatsApp/móvil.
                    </div>
                  ) : filtered.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 p-2 border-b cursor-pointer hover:bg-accent/40">
                      <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{c.first_name} {c.last_name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {c.company_name ? `${c.company_name} · ` : ""}
                          +{(c.whatsapp_phone || c.mobile || "").replace(/\D/g, "")}
                        </div>
                      </div>
                    </label>
                  ))}
                </ScrollArea>
              </div>
              </div>

              {/* Preview lateral */}
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">
                  Vista previa {previewContact && <span className="normal-case text-foreground">· {previewContact.first_name} {previewContact.last_name}</span>}
                </Label>
                <WhatsAppChatPreview
                  imageUrl={headerImageUrl}
                  bodyText={selectedTpl?.source_body || selectedTpl?.body || "Selecciona una plantilla para ver la vista previa…"}
                  variables={previewVariables}
                  contactName={previewContact ? `${previewContact.first_name} ${previewContact.last_name}` : "Cliente"}
                  linePhone={selectedLine?.label}
                />
                <p className="text-[11px] text-muted-foreground">
                  Soporta variables como {`{nombre}`} y {`{empresa}`}. La vista previa usa los datos del primer destinatario seleccionado.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => { if (validateBeforeLaunch()) setConfirmOpen(true); }}
                className="bg-orange-600 hover:bg-orange-700 text-white"
                disabled={
                  creating ||
                  !isApproved ||
                  (requiresImage && !headerImageUrl) ||
                  (requiresVideo && !headerVideoUrl) ||
                  missingVars.length > 0 ||
                  !linePhoneId ||
                  selected.size === 0
                }
              >
                <Play className="h-4 w-4 mr-2" />
                {creating
                  ? "Lanzando…"
                  : !isApproved
                  ? "Plantilla no aprobada"
                  : scheduleMode === "later"
                  ? `Programar envío a ${selected.size}`
                  : `Lanzar a ${selected.size} destinatarios`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {scheduleMode === "later" ? "Confirmar programación" : "Confirmar envío masivo"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {scheduleMode === "later" ? (
                  <>
                    Se programará la campaña <strong>{name || "(sin nombre)"}</strong> para
                    {" "}<strong>{scheduledAt ? format(scheduledAt, "dd/MM/yyyy") : ""} {scheduledTime}</strong>
                    {" "}con <strong>{selected.size}</strong> destinatarios.
                  </>
                ) : (
                  <>
                    Se enviará la campaña <strong>{name || "(sin nombre)"}</strong> a
                    {" "}<strong>{selected.size}</strong> destinatarios usando la línea
                    {" "}<strong>{selectedLine?.label || "—"}</strong>.
                    {isMassSend && (
                      <span className="block mt-2 text-orange-600 font-medium">
                        ⚠ Envío masivo: revisa que la plantilla cumpla las políticas de Meta para evitar bloqueos.
                      </span>
                    )}
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-orange-600 hover:bg-orange-700"
                onClick={() => { setConfirmOpen(false); createAndLaunch(); }}
              >
                {scheduleMode === "later" ? "Programar" : "Sí, lanzar ahora"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Plantilla</TableHead>
              <TableHead>Línea</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Enviados</TableHead>
              <TableHead className="text-right">Fallidos</TableHead>
              <TableHead className="text-right">Omitidos</TableHead>
              <TableHead>Creada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Aún no hay campañas.
                </TableCell>
              </TableRow>
            ) : campaigns.map((c) => {
              const acc = accounts.find((a) => a.business_phone_number_id === c.business_phone_number_id);
              return (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.nombre}</TableCell>
                <TableCell className="text-sm">{c.template_name} ({c.template_language})</TableCell>
                <TableCell className="text-xs">
                  {acc ? (
                    <span className="font-medium">{acc.label}</span>
                  ) : c.business_phone_number_id ? (
                    <code className="text-muted-foreground">{c.business_phone_number_id}</code>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell><Badge variant={statusVariant(c.status)}>{c.status}</Badge></TableCell>
                <TableCell className="text-right">{c.total_recipients}</TableCell>
                <TableCell className="text-right text-primary">{c.sent_count}</TableCell>
                <TableCell className="text-right text-destructive">{c.failed_count}</TableCell>
                <TableCell className="text-right text-muted-foreground">{c.skipped_count}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleString()}
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}