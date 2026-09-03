import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarIcon,
  ClipboardCopy,
  FileText,
  CheckCircle2,
  DollarSign,
  UserPlus,
  Activity,
  Check,
  Mail,
  MessageCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageBanner } from "@/components/PageBanner";
import { BackButton } from "@/components/BackButton";
import { openWhatsApp } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SellerOption {
  user_id: string;
  full_name: string | null;
  plaza_id: string | null;
}

interface ActivityRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  description: string | null;
  company_name: string | null;
  contact_name: string | null;
}

interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  company_name: string | null;
  contact_name: string | null;
}

interface QuoteRow {
  id: string;
  created_by: string;
  total: number;
  company_name: string | null;
}

interface CompanyRow {
  id: string;
  created_by: string;
  name: string;
}

interface ContactRow {
  id: string;
  created_by: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
}

type Periodo = "dia" | "semana" | "mes";
type Alcance = "individual" | "equipo";

function toRangeISO(d: Date, periodo: Periodo) {
  if (periodo === "semana") {
    return {
      start: startOfWeek(d, { weekStartsOn: 1 }).toISOString(),
      end: endOfWeek(d, { weekStartsOn: 1 }).toISOString(),
    };
  }
  if (periodo === "mes") {
    return { start: startOfMonth(d).toISOString(), end: endOfMonth(d).toISOString() };
  }
  return { start: startOfDay(d).toISOString(), end: endOfDay(d).toISOString() };
}

const PERIODO_TITULO: Record<Periodo, string> = {
  dia: "*REPORTE DIARIO DE ACTIVIDADES*",
  semana: "*REPORTE SEMANAL DE ACTIVIDADES*",
  mes: "*REPORTE MENSUAL DE ACTIVIDADES*",
};

const ACTIVITY_LABELS: Record<string, string> = {
  call: "Llamada",
  email: "Correo",
  meeting: "Reunión",
  note: "Nota",
  field_visit: "Visita de Campo",
  whatsapp: "WhatsApp",
  follow_up: "Seguimiento",
  task: "Tarea",
};

export default function DailyActivityReport() {
  const { user, profile, hasRole, hasAnyRole } = useAuth();
  const isAdminOrManager = hasAnyRole(["admin", "manager"]);

  const [date, setDate] = useState<Date>(new Date());
  const [periodo, setPeriodo] = useState<Periodo>("dia");
  const [alcance, setAlcance] = useState<Alcance>("individual");
  const [selectedSellerId, setSelectedSellerId] = useState<string>(user?.id || "");
  const [reportText, setReportText] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [destinatarioEmail, setDestinatarioEmail] = useState<string>("");
  const [destinatarioTelefono, setDestinatarioTelefono] = useState<string>("");
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  useEffect(() => {
    if (profile?.email) setDestinatarioEmail((prev) => prev || profile.email || "");
    if (profile?.phone) setDestinatarioTelefono((prev) => prev || profile.phone || "");
  }, [profile?.email, profile?.phone]);

  const { start, end } = useMemo(() => toRangeISO(date, periodo), [date, periodo]);

  // Fetch sellers for admin/manager dropdown
  const { data: sellers = [] } = useQuery<SellerOption[]>({
    queryKey: ["report-sellers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, plaza_id")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return (data || []) as SellerOption[];
    },
    enabled: isAdminOrManager,
  });

  // Team sellers (only when alcance = equipo)
  const { data: teamSellerIds = [] } = useQuery<{ user_id: string; full_name: string }[]>({
    queryKey: ["report-team-sellers", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: myTeams, error: e1 } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id);
      if (e1) throw e1;
      const teamIds = (myTeams || []).map((t: any) => t.team_id);
      if (teamIds.length === 0) return [];

      const { data: members, error: e2 } = await supabase
        .from("team_members")
        .select("user_id")
        .in("team_id", teamIds);
      if (e2) throw e2;
      const memberIds = Array.from(new Set((members || []).map((m: any) => m.user_id)));
      if (memberIds.length === 0) return [];

      const [{ data: roles }, { data: profs }] = await Promise.all([
        supabase.from("user_roles").select("user_id, role").in("user_id", memberIds),
        supabase.from("profiles").select("user_id, full_name, is_active").in("user_id", memberIds),
      ]);
      const salesIds = new Set((roles || []).filter((r: any) => r.role === "sales").map((r: any) => r.user_id));
      return (profs || [])
        .filter((p: any) => p.is_active && salesIds.has(p.user_id))
        .map((p: any) => ({ user_id: p.user_id, full_name: p.full_name || "Usuario" }));
    },
    enabled: isAdminOrManager && alcance === "equipo" && !!user?.id,
  });

  const targetIds = useMemo(() => {
    if (isAdminOrManager && alcance === "equipo") return teamSellerIds.map((t) => t.user_id);
    return selectedSellerId ? [selectedSellerId] : [];
  }, [isAdminOrManager, alcance, teamSellerIds, selectedSellerId]);

  const targetsEnabled = targetIds.length > 0;
  const targetKey = targetIds.join(",");

  // Fetch plaza name
  const { data: plazaName } = useQuery<string | null>({
    queryKey: ["plaza-name", selectedSellerId, sellers],
    queryFn: async () => {
      const seller = sellers.find((s) => s.user_id === selectedSellerId);
      const plazaId = seller?.plaza_id || profile?.plaza_id;
      if (!plazaId) return null;
      const { data, error } = await supabase.from("plazas").select("nombre").eq("id", plazaId).single();
      if (error) return null;
      return data?.nombre || null;
    },
    enabled: !!selectedSellerId,
  });

  // Fetch seller name
  const sellerName = useMemo(() => {
    if (user?.id === selectedSellerId) return profile?.full_name || "Usuario";
    const seller = sellers.find((s) => s.user_id === selectedSellerId);
    return seller?.full_name || "Usuario";
  }, [selectedSellerId, user, profile, sellers]);

  // Fetch activities
  const { data: activities = [] } = useQuery<ActivityRow[]>({
    queryKey: ["daily-activities", targetKey, start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_activities")
        .select("id, user_id, type, title, description, companies(name), contacts(first_name, last_name)")
        .in("user_id", targetIds)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []).map((a: any) => ({
        id: a.id,
        user_id: a.user_id,
        type: a.type,
        title: a.title,
        description: a.description,
        company_name: a.companies?.name || null,
        contact_name: a.contacts ? `${a.contacts.first_name} ${a.contacts.last_name}` : null,
      }));
    },
    enabled: targetsEnabled,
  });

  // Fetch completed tasks
  const { data: tasks = [] } = useQuery<TaskRow[]>({
    queryKey: ["daily-tasks", targetKey, start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_tasks")
        .select("id, user_id, title, description, companies(name), contacts(first_name, last_name)")
        .in("user_id", targetIds)
        .eq("completed", true)
        .gte("completed_at", start)
        .lt("completed_at", end)
        .order("completed_at", { ascending: true });
      if (error) throw error;
      return (data || []).map((t: any) => ({
        id: t.id,
        user_id: t.user_id,
        title: t.title,
        description: t.description,
        company_name: t.companies?.name || null,
        contact_name: t.contacts ? `${t.contacts.first_name} ${t.contacts.last_name}` : null,
      }));
    },
    enabled: targetsEnabled,
  });

  // Fetch cotizaciones
  const { data: quotes = [] } = useQuery<QuoteRow[]>({
    queryKey: ["daily-quotes", targetKey, start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos")
        .select("id, created_by, total, companies(name)")
        .in("created_by", targetIds)
        .eq("tipo_documento", "cotizacion")
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        id: d.id,
        created_by: d.created_by,
        total: Number(d.total),
        company_name: d.companies?.name || null,
      }));
    },
    enabled: targetsEnabled,
  });

  // Fetch new companies
  const { data: newCompanies = [] } = useQuery<CompanyRow[]>({
    queryKey: ["daily-companies", targetKey, start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, created_by, name")
        .in("created_by", targetIds)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as CompanyRow[];
    },
    enabled: targetsEnabled,
  });

  // Fetch new contacts
  const { data: newContacts = [] } = useQuery<ContactRow[]>({
    queryKey: ["daily-contacts", targetKey, start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, created_by, first_name, last_name, job_title")
        .in("created_by", targetIds)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as ContactRow[];
    },
    enabled: targetsEnabled,
  });

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

  const buildSellerBlock = (uid: string): string[] => {
    const lines: string[] = [];

    const allActivities: string[] = [];
    activities
      .filter((a) => a.user_id === uid)
      .forEach((a) => {
        const label = ACTIVITY_LABELS[a.type] || a.type;
        let line = `${label}: ${a.title}`;
        if (a.description) line += ` (${a.description})`;
        if (a.company_name) line += ` — ${a.company_name}`;
        allActivities.push(line);
      });
    tasks
      .filter((t) => t.user_id === uid)
      .forEach((t) => {
        let line = `Tarea completada: ${t.title}`;
        if (t.description) line += ` (${t.description})`;
        if (t.company_name) line += ` — ${t.company_name}`;
        allActivities.push(line);
      });

    lines.push("✅ ACTIVIDADES Y SEGUIMIENTOS");
    lines.push("");
    if (allActivities.length === 0) {
      lines.push("Sin actividades registradas.");
    } else {
      allActivities.forEach((a) => lines.push(a));
    }
    lines.push("");

    lines.push("💰 COTIZACIONES ENVIADAS");
    lines.push("");
    const sellerQuotes = quotes.filter((q) => q.created_by === uid);
    if (sellerQuotes.length === 0) {
      lines.push("Sin cotizaciones enviadas.");
    } else {
      sellerQuotes.forEach((q) => {
        lines.push(`${q.company_name || "Sin empresa"}: ${fmtCurrency(q.total)}`);
      });
    }
    lines.push("");

    lines.push("👤 NUEVOS PROSPECTOS");
    lines.push("");
    const prospectLines: string[] = [];
    newCompanies
      .filter((c) => c.created_by === uid)
      .forEach((c) => {
        prospectLines.push(`Registro de empresa: ${c.name}`);
      });
    newContacts
      .filter((c) => c.created_by === uid)
      .forEach((c) => {
        const name = `${c.first_name} ${c.last_name}`;
        const job = c.job_title ? ` (${c.job_title})` : "";
        prospectLines.push(`Nuevo contacto: ${name}${job}`);
      });
    if (prospectLines.length === 0) {
      lines.push("Sin prospectos nuevos.");
    } else {
      prospectLines.forEach((p) => lines.push(p));
    }

    return lines;
  };

  const rangoLabel = useMemo(() => {
    if (periodo === "semana") {
      return `${format(startOfWeek(date, { weekStartsOn: 1 }), "dd/MM/yyyy")} - ${format(
        endOfWeek(date, { weekStartsOn: 1 }),
        "dd/MM/yyyy",
      )}`;
    }
    if (periodo === "mes") return format(date, "MMMM yyyy", { locale: es });
    return format(date, "dd/MM/yyyy");
  }, [date, periodo]);

  const buildReport = () => {
    const lines: string[] = [];
    lines.push(PERIODO_TITULO[periodo]);
    lines.push("");

    const esEquipo = isAdminOrManager && alcance === "equipo";

    if (esEquipo) {
      lines.push(`Fecha: ${rangoLabel}`);
      lines.push("");
      if (teamSellerIds.length === 0) {
        lines.push("Sin vendedores en el equipo.");
      } else {
        teamSellerIds.forEach((s) => {
          lines.push(`═══ ${s.full_name} ═══`);
          lines.push("");
          buildSellerBlock(s.user_id).forEach((l) => lines.push(l));
          lines.push("");
        });
      }
    } else {
      lines.push(`Vendedor: ${sellerName}`);
      lines.push(`Plaza: ${plazaName || "—"}`);
      lines.push(`Fecha: ${rangoLabel}`);
      lines.push("");
      buildSellerBlock(selectedSellerId).forEach((l) => lines.push(l));
    }

    setReportText(lines.join("\n").trimEnd());
  };

  const handleCopy = async () => {
    if (!reportText) return;
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      toast.success("¡Copiado al portapapeles!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar automáticamente.");
    }
  };

  const handleSendEmail = async () => {
    if (!reportText) return;
    if (!destinatarioEmail) {
      toast.error("Indica un correo destinatario.");
      return;
    }
    setEnviandoEmail(true);
    try {
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          to: destinatarioEmail,
          subject: `Reporte de actividades — ${
            isAdminOrManager && alcance === "equipo" ? "Equipo" : sellerName || "Equipo"
          } (${format(date, "dd/MM/yyyy")})`,
          html: `<pre style="font-family:monospace;white-space:pre-wrap">${reportText}</pre>`,
          text: reportText,
        },
      });
      if (error) throw error;
      toast.success("Reporte enviado por correo.");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo enviar el correo.");
    } finally {
      setEnviandoEmail(false);
    }
  };

  const handleSendWhatsApp = () => {
    if (!reportText) return;
    if (!destinatarioTelefono) {
      toast.error("Indica un teléfono destinatario.");
      return;
    }
    openWhatsApp(destinatarioTelefono, reportText);
  };

  const hasData = activities.length > 0 || tasks.length > 0 || quotes.length > 0 || newCompanies.length > 0 || newContacts.length > 0;

  return (
    <>
      <div className="container mx-auto px-4 pt-4">
        <BackButton fallback="/reports" label="Volver a Reportes" />
      </div>
      <PageBanner title="Reporte Diario de Actividades" description="Genera un resumen de texto para copiar y pegar en correo." />
      <div className="container mx-auto p-4 space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="mb-1 block">Fecha *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(date, "PPP", { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label className="mb-1 block">Periodo</Label>
              <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
                <TabsList className="w-full">
                  <TabsTrigger value="dia" className="flex-1">Día</TabsTrigger>
                  <TabsTrigger value="semana" className="flex-1">Semana</TabsTrigger>
                  <TabsTrigger value="mes" className="flex-1">Mes</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {isAdminOrManager && (
              <div>
                <Label className="mb-1 block">Alcance</Label>
                <Tabs value={alcance} onValueChange={(v) => setAlcance(v as Alcance)}>
                  <TabsList className="w-full">
                    <TabsTrigger value="individual" className="flex-1">Individual</TabsTrigger>
                    <TabsTrigger value="equipo" className="flex-1">Equipo</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            {isAdminOrManager && alcance === "individual" && (
              <div>
                <Label className="mb-1 block">Vendedor</Label>
                <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sellers.map((s) => (
                      <SelectItem key={s.user_id} value={s.user_id}>
                        {s.full_name || s.user_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-end">
              <Button onClick={buildReport} className="w-full md:w-auto">
                <FileText className="mr-2 h-4 w-4" />
                Generar Reporte de Texto
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* KPI summary */}
        {hasData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard icon={<Activity className="h-5 w-5" />} label="Actividades" value={String(activities.length)} />
            <KpiCard icon={<CheckCircle2 className="h-5 w-5" />} label="Tareas Completadas" value={String(tasks.length)} />
            <KpiCard icon={<DollarSign className="h-5 w-5" />} label="Cotizaciones" value={String(quotes.length)} />
            <KpiCard icon={<UserPlus className="h-5 w-5" />} label="Prospectos Nuevos" value={String(newCompanies.length + newContacts.length)} />
          </div>
        )}

        {/* Report output */}
        {reportText && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Reporte Generado</CardTitle>
              <Button size="sm" variant="secondary" onClick={handleCopy} className="gap-1">
                {copied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
                {copied ? "¡Copiado!" : "Copiar al portapapeles"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <div className="flex gap-2 items-center flex-1">
                  <Input
                    value={destinatarioEmail}
                    onChange={(e) => setDestinatarioEmail(e.target.value)}
                    placeholder="correo o teléfono"
                    className="sm:max-w-[240px]"
                  />
                  <Button size="sm" variant="outline" onClick={handleSendEmail} disabled={enviandoEmail} className="gap-1 shrink-0">
                    <Mail className="h-4 w-4" />
                    Enviar por correo
                  </Button>
                </div>
                <div className="flex gap-2 items-center flex-1">
                  <Input
                    value={destinatarioTelefono}
                    onChange={(e) => setDestinatarioTelefono(e.target.value)}
                    placeholder="correo o teléfono"
                    className="sm:max-w-[240px]"
                  />
                  <Button size="sm" variant="outline" onClick={handleSendWhatsApp} className="gap-1 shrink-0">
                    <MessageCircle className="h-4 w-4" />
                    Enviar por WhatsApp
                  </Button>
                </div>
              </div>
              <Textarea
                value={reportText}
                readOnly
                className="min-h-[300px] font-mono text-sm whitespace-pre-wrap"
              />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
