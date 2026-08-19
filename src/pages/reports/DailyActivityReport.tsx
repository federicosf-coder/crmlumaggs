import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay } from "date-fns";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageBanner } from "@/components/PageBanner";
import { BackButton } from "@/components/BackButton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SellerOption {
  user_id: string;
  full_name: string | null;
  plaza_id: string | null;
}

interface ActivityRow {
  id: string;
  type: string;
  title: string;
  description: string | null;
  company_name: string | null;
  contact_name: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  company_name: string | null;
  contact_name: string | null;
}

interface QuoteRow {
  id: string;
  total: number;
  company_name: string | null;
}

interface CompanyRow {
  id: string;
  name: string;
}

interface ContactRow {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
}

function toISORange(d: Date) {
  return {
    start: startOfDay(d).toISOString(),
    end: endOfDay(d).toISOString(),
  };
}

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
  const [selectedSellerId, setSelectedSellerId] = useState<string>(user?.id || "");
  const [reportText, setReportText] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const { start, end } = useMemo(() => toISORange(date), [date]);

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
    queryKey: ["daily-activities", selectedSellerId, start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_activities")
        .select("id, type, title, description, companies(name), contacts(first_name, last_name)")
        .eq("user_id", selectedSellerId)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []).map((a: any) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        description: a.description,
        company_name: a.companies?.name || null,
        contact_name: a.contacts ? `${a.contacts.first_name} ${a.contacts.last_name}` : null,
      }));
    },
    enabled: !!selectedSellerId,
  });

  // Fetch completed tasks
  const { data: tasks = [] } = useQuery<TaskRow[]>({
    queryKey: ["daily-tasks", selectedSellerId, start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_tasks")
        .select("id, title, description, companies(name), contacts(first_name, last_name)")
        .eq("user_id", selectedSellerId)
        .eq("completed", true)
        .gte("completed_at", start)
        .lt("completed_at", end)
        .order("completed_at", { ascending: true });
      if (error) throw error;
      return (data || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        company_name: t.companies?.name || null,
        contact_name: t.contacts ? `${t.contacts.first_name} ${t.contacts.last_name}` : null,
      }));
    },
    enabled: !!selectedSellerId,
  });

  // Fetch cotizaciones
  const { data: quotes = [] } = useQuery<QuoteRow[]>({
    queryKey: ["daily-quotes", selectedSellerId, start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos")
        .select("id, total, companies(name)")
        .eq("created_by", selectedSellerId)
        .eq("tipo_documento", "cotizacion")
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        id: d.id,
        total: Number(d.total),
        company_name: d.companies?.name || null,
      }));
    },
    enabled: !!selectedSellerId,
  });

  // Fetch new companies
  const { data: newCompanies = [] } = useQuery<CompanyRow[]>({
    queryKey: ["daily-companies", selectedSellerId, start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .eq("created_by", selectedSellerId)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as CompanyRow[];
    },
    enabled: !!selectedSellerId,
  });

  // Fetch new contacts
  const { data: newContacts = [] } = useQuery<ContactRow[]>({
    queryKey: ["daily-contacts", selectedSellerId, start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, job_title")
        .eq("created_by", selectedSellerId)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as ContactRow[];
    },
    enabled: !!selectedSellerId,
  });

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

  const buildReport = () => {
    const lines: string[] = [];
    lines.push("*REPORTE DIARIO DE ACTIVIDADES*");
    lines.push("");
    lines.push(`Vendedor: ${sellerName}`);
    lines.push(`Plaza: ${plazaName || "—"}`);
    lines.push(`Fecha: ${format(date, "dd/MM/yyyy")}`);
    lines.push("");

    // Activities + Tasks merged
    const allActivities: string[] = [];
    activities.forEach((a) => {
      const label = ACTIVITY_LABELS[a.type] || a.type;
      let line = `${label}: ${a.title}`;
      if (a.description) line += ` (${a.description})`;
      if (a.company_name) line += ` — ${a.company_name}`;
      allActivities.push(line);
    });
    tasks.forEach((t) => {
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

    // Quotes
    lines.push("💰 COTIZACIONES ENVIADAS");
    lines.push("");
    if (quotes.length === 0) {
      lines.push("Sin cotizaciones enviadas.");
    } else {
      quotes.forEach((q) => {
        lines.push(`${q.company_name || "Sin empresa"}: ${fmtCurrency(q.total)}`);
      });
    }
    lines.push("");

    // Prospects
    lines.push("👤 NUEVOS PROSPECTOS");
    lines.push("");
    const prospectLines: string[] = [];
    newCompanies.forEach((c) => {
      prospectLines.push(`Registro de empresa: ${c.name}`);
    });
    newContacts.forEach((c) => {
      const name = `${c.first_name} ${c.last_name}`;
      const job = c.job_title ? ` (${c.job_title})` : "";
      prospectLines.push(`Nuevo contacto: ${name}${job}`);
    });
    if (prospectLines.length === 0) {
      lines.push("Sin prospectos nuevos.");
    } else {
      prospectLines.forEach((p) => lines.push(p));
    }

    const text = lines.join("\n");
    setReportText(text);
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

            {isAdminOrManager && (
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
            <CardContent>
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
