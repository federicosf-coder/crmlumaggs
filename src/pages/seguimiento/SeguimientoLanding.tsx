import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { PageBanner } from "@/components/PageBanner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { TASK_TYPE_LABEL } from "@/lib/taskTypes";
import type { TaskTypeKey } from "@/lib/taskTypes";
import { QuickActivityDialog } from "@/components/seguimiento/QuickActivityDialog";
import { TrendingUp, ArrowUp, ArrowDown, CalendarIcon, ChevronDown, ChevronUp, Check, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import { es as esLocale } from "date-fns/locale";
import {
  startOfYesterday,
  endOfYesterday,
  startOfToday,
  endOfToday,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from "date-fns";
import {
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useVentasCharts } from "@/hooks/useVentasCharts";
import { useVentasMensual, reporteMes } from "@/hooks/useVentasMensual";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import {
  useSeguimientoVentas,
  useSeguimientoEstatusCatalogo,
} from "@/hooks/useSeguimientoVentas";
import type { EmpresaVendedora, SeguimientoVentasRow } from "@/hooks/useSeguimientoVentas";

const PALETTES: Record<EmpresaVendedora, { bar: string; line?: string; bars: string[]; ring: string; text: string }> = {
  lumaggs_chevron: {
    bar: "#2563eb",
    line: "#0f172a",
    bars: ["#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#0ea5e9", "#0284c7"],
    ring: "border-blue-200",
    text: "text-blue-900",
  },
  galsa_phillips66: {
    bar: "#dc2626",
    line: "#7f1d1d",
    bars: ["#991b1b", "#b91c1c", "#dc2626", "#ef4444", "#f87171", "#fca5a5", "#f43f5e", "#e11d48"],
    ring: "border-red-200",
    text: "text-red-900",
  },
};

function currentYm() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function colorAvance(pct: number): string {
  if (pct < 20) return "bg-red-500";
  if (pct < 40) return "bg-orange-500";
  if (pct < 60) return "bg-yellow-500";
  if (pct < 90) return "bg-green-500";
  return "bg-blue-500";
}

function VentasMensualSection({ empresa, label }: { empresa: EmpresaVendedora; label: string }) {
  const { data, isLoading } = useVentasMensual(empresa);
  const palette = PALETTES[empresa];
  const [mes, setMes] = useState<string>(currentYm());

  const mesData = useMemo(() => {
    const r = reporteMes(data, mes);
    return [{ plaza: "Total", unidades: r.total }, ...r.porPlaza];
  }, [data, mes]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-6 text-center">Cargando reportes mensuales de {label}…</div>;
  }
  if (!data) return null;

  return (
    <div className="mt-4 space-y-4">
      <Card className={`border ${palette.ring}`}>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h3 className={`text-sm font-semibold ${palette.text}`}>Ventas del Mes</h3>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Mes" /></SelectTrigger>
              <SelectContent>
                {data.mesesDisponibles.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mesData} margin={{ top: 8, right: 12, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="plaza" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => Number(v).toLocaleString("es-MX")} />
                <Bar dataKey="unidades" fill={palette.bar} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className={`border ${palette.ring}`}>
        <CardContent className="p-4">
          <h3 className={`text-sm font-semibold mb-3 ${palette.text}`}>Total mensual</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.porMesTotal} margin={{ top: 8, right: 12, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => Number(v).toLocaleString("es-MX")} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="unidades" name="Unidades" fill={palette.bar} radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="unidades" name="Tendencia" stroke={palette.line || palette.bar} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function VentasChartsSection({ empresa, label }: { empresa: EmpresaVendedora; label: string }) {
  const { data, isLoading } = useVentasCharts(empresa);
  const palette = PALETTES[empresa];

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">Cargando gráficas de {label}…</div>
    );
  }
  if (!data || data.total === 0) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">Sin ventas registradas para {label}.</div>
    );
  }

  const plazaData = [{ plaza: "Total", unidades: data.total }, ...data.porPlaza];

  return (
    <div className="mt-4">
      <Card className={`border ${palette.ring}`}>
        <CardContent className="p-4">
          <h3 className={`text-sm font-semibold mb-3 ${palette.text}`}>Unidades vendidas — Total y por plaza</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={plazaData} margin={{ top: 8, right: 12, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="plaza" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => Number(v).toLocaleString("es-MX")} />
                <Bar dataKey="unidades" fill={palette.bar} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const PILL: Record<EmpresaVendedora, { active: string; idle: string }> = {
  lumaggs_chevron: {
    active: "bg-blue-600 text-white border-blue-600",
    idle: "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100",
  },
  galsa_phillips66: {
    active: "bg-red-600 text-white border-red-600",
    idle: "bg-red-50 text-red-700 border-red-300 hover:bg-red-100",
  },
};

function toggleInArray(arr: string[], v: string) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

const PLAZA_TIJUANA = "86162f44-2b70-4f06-b6ae-51bc79103c75";
const PLAZA_ENSENADA = "1508a15f-5048-4f89-a665-ca51566e4200";
const PLAZA_MEXICALI = "3e9284e9-d3e2-4ed2-843a-bd4c27cb003f";
const PLAZA_MORELOS = "12a112e3-656a-4033-926b-3de65c9c33d1";
const PLAZA_SAN_LUIS = "2408d959-f3e4-47d5-a1f8-8ac635818844";
const PLAZA_SAN_QUINTIN = "c31388e5-1b3d-4853-a34a-8fe80b7e3953";
const ZONA_COSTA_PLAZA_IDS = [PLAZA_TIJUANA, PLAZA_ENSENADA, PLAZA_SAN_QUINTIN];
const PLAZA_GROUPS: { name: string; plazaIds: string[] }[] = [
  { name: "Zona Costa", plazaIds: [PLAZA_TIJUANA, PLAZA_ENSENADA] },
  { name: "Tijuana", plazaIds: [PLAZA_TIJUANA] },
  { name: "Ensenada", plazaIds: [PLAZA_ENSENADA] },
  { name: "Mexicali", plazaIds: [PLAZA_MEXICALI] },
  { name: "Morelos", plazaIds: [PLAZA_MORELOS] },
  { name: "San Luis", plazaIds: [PLAZA_SAN_LUIS] },
];
const KNOWN_PLAZA_IDS = new Set([
  PLAZA_TIJUANA,
  PLAZA_ENSENADA,
  PLAZA_MEXICALI,
  PLAZA_MORELOS,
  PLAZA_SAN_LUIS,
]);

const CHIP_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed",
  "#0891b2", "#db2777", "#ea580c", "#65a30d", "#9333ea",
];

const FILTROS_KEY = "seguimiento_filtros_v1";

type Periodo = "ayer" | "hoy" | "semana" | "mes" | "año" | "custom";

function loadFiltrosGuardados(): Partial<{
  empresaSel: EmpresaVendedora;
  periodo: Periodo;
  customStart: string;
  customEnd: string;
  fEjecutivo: string[];
  fPlaza: string[];
}> {
  try {
    const raw = localStorage.getItem(FILTROS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const filtrosGuardados = loadFiltrosGuardados();

export default function SeguimientoLanding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [empresaSel, setEmpresaSel] = useState<EmpresaVendedora>(() => filtrosGuardados.empresaSel ?? "lumaggs_chevron");
  const [activityOpen, setActivityOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<{ id: string; company_id: string; type: string; description: string | null } | null>(null);
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null);
  const [deletingActivity, setDeletingActivity] = useState(false);
  const [fEjecutivo, setFEjecutivo] = useState<string[]>(() => filtrosGuardados.fEjecutivo ?? []);
  const [fPlaza, setFPlaza] = useState<string[]>(() => filtrosGuardados.fPlaza ?? []);
  const [ejOpen, setEjOpen] = useState(false);
  const [ejSearch, setEjSearch] = useState("");
  const qpFiltros =
    (fEjecutivo.length > 0 ? `&ejecutivo=${fEjecutivo.join(",")}` : "") +
    (fPlaza.length > 0 ? `&plaza=${fPlaza.join(",")}` : "");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState<boolean>(false);
  const [periodo, setPeriodo] = useState<Periodo>(() => filtrosGuardados.periodo ?? "hoy");
  const [customStart, setCustomStart] = useState<Date | undefined>(() =>
    filtrosGuardados.customStart ? new Date(filtrosGuardados.customStart) : undefined
  );
  const [customEnd, setCustomEnd] = useState<Date | undefined>(() =>
    filtrosGuardados.customEnd ? new Date(filtrosGuardados.customEnd) : undefined
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        FILTROS_KEY,
        JSON.stringify({
          empresaSel,
          periodo,
          customStart: customStart ? customStart.toISOString() : undefined,
          customEnd: customEnd ? customEnd.toISOString() : undefined,
          fEjecutivo,
          fPlaza,
        })
      );
    } catch {
      // ignore
    }
  }, [empresaSel, periodo, customStart, customEnd, fEjecutivo, fPlaza]);

  const restablecerFiltros = () => {
    try {
      localStorage.removeItem(FILTROS_KEY);
    } catch {
      // ignore
    }
    setEmpresaSel("lumaggs_chevron");
    setPeriodo("hoy");
    setCustomStart(undefined);
    setCustomEnd(undefined);
    setFEjecutivo([]);
    setFPlaza([]);
  };

  const { periodoStart, periodoEnd } = useMemo(() => {
    switch (periodo) {
      case "ayer":
        return { periodoStart: startOfYesterday(), periodoEnd: endOfYesterday() };
      case "semana":
        return {
          periodoStart: startOfWeek(new Date(), { weekStartsOn: 1 }),
          periodoEnd: endOfWeek(new Date(), { weekStartsOn: 1 }),
        };
      case "mes":
        return { periodoStart: startOfMonth(new Date()), periodoEnd: endOfMonth(new Date()) };
      case "año":
        return { periodoStart: startOfYear(new Date()), periodoEnd: endOfYear(new Date()) };
      case "custom":
        return {
          periodoStart: customStart ?? startOfToday(),
          periodoEnd: customEnd ?? endOfToday(),
        };
      default:
        return { periodoStart: startOfToday(), periodoEnd: endOfToday() };
    }
  }, [periodo, customStart, customEnd]);

  const pill = PILL[empresaSel];
  const access = useModuleAccess("seguimiento_ventas");
  const { data: catalogo = [] } = useSeguimientoEstatusCatalogo();
  const { data: prospectosRaw = [] } = useSeguimientoVentas({ empresaVendedora: empresaSel, tieneVenta: false });
  const { data: clientesRaw = [] } = useSeguimientoVentas({ empresaVendedora: empresaSel, tieneVenta: true });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, plaza_id")
        .eq("is_active", true);
      if (error) throw error;
      return (data || []) as { user_id: string; full_name: string | null; plaza_id: string | null }[];
    },
    staleTime: 5 * 60_000,
  });
  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) m.set(p.user_id, p.full_name || "—");
    return m;
  }, [profiles]);
  const profilePlazaMap = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const p of profiles) m.set(p.user_id, p.plaza_id ?? null);
    return m;
  }, [profiles]);

  const { data: companyCreatedMap = new Map<string, string>() } = useQuery({
    queryKey: ["companies_created_min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, created_at")
        .eq("is_active", true);
      if (error) throw error;
      const m = new Map<string, string>();
      for (const c of data || []) if (c.id && c.created_at) m.set(c.id, c.created_at);
      return m;
    },
    staleTime: 5 * 60_000,
  });

  const { data: plazasData = [] } = useQuery({
    queryKey: ["plazas_min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plazas").select("id, nombre").eq("is_active", true).order("nombre");
      if (error) throw error;
      return (data || []) as { id: string; nombre: string }[];
    },
    staleTime: 5 * 60_000,
  });
  const { data: companyPlazas = [] } = useQuery({
    queryKey: ["company_plazas_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_plazas").select("company_id, plaza_id");
      if (error) throw error;
      return (data || []) as { company_id: string; plaza_id: string }[];
    },
    staleTime: 5 * 60_000,
  });
  const plazaNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of plazasData) m.set(p.id, p.nombre);
    return m;
  }, [plazasData]);
  const companyPlazaMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const cp of companyPlazas) {
      const arr = m.get(cp.company_id) || [];
      arr.push(cp.plaza_id);
      m.set(cp.company_id, arr);
    }
    return m;
  }, [companyPlazas]);

  const applyAccess = useMemo(() => {
    return (rows: SeguimientoVentasRow[]) => {
      if (access.accessLevel === "ninguno") return [];
      if (access.accessLevel === "propio") return rows.filter((r) => r.owner_id && r.owner_id === access.userId);
      if (access.accessLevel === "equipo") {
        const allowed = new Set(access.teamMemberIds);
        return rows.filter((r) => r.owner_id && allowed.has(r.owner_id));
      }
      return rows;
    };
  }, [access.accessLevel, access.userId, access.teamMemberIds]);

  const prospectosAcc = useMemo(() => applyAccess(prospectosRaw), [applyAccess, prospectosRaw]);
  const clientesAcc = useMemo(() => applyAccess(clientesRaw), [applyAccess, clientesRaw]);

  const ejecutivoOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const r of [...prospectosAcc, ...clientesAcc]) if (r.owner_id) ids.add(r.owner_id);
    return Array.from(ids)
      .map((id, i) => ({ id, name: profileMap.get(id) || "—", color: CHIP_COLORS[i % CHIP_COLORS.length] }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [prospectosAcc, clientesAcc, profileMap]);

  const ejecutivoGroups = useMemo(() => {
    const groups = PLAZA_GROUPS.map((g) => ({
      name: g.name,
      options: ejecutivoOptions.filter((o) => {
        const pid = profilePlazaMap.get(o.id) ?? null;
        return pid !== null && g.plazaIds.includes(pid);
      }),
    }));
    const otras = ejecutivoOptions.filter((o) => {
      const pid = profilePlazaMap.get(o.id) ?? null;
      return pid === null || !KNOWN_PLAZA_IDS.has(pid);
    });
    if (otras.length > 0) groups.push({ name: "Otras plazas", options: otras });
    return groups.filter((g) => g.options.length > 0);
  }, [ejecutivoOptions, profilePlazaMap]);

  const plazaOptions = useMemo(() => {
    const used = new Set<string>();
    for (const r of [...prospectosAcc, ...clientesAcc]) {
      for (const pid of companyPlazaMap.get(r.company_id) || []) used.add(pid);
    }
    const real = plazasData
      .filter((p) => used.has(p.id))
      .map((p, i) => ({ id: p.id, name: p.nombre, color: CHIP_COLORS[(i + 3) % CHIP_COLORS.length] }));
    const hayZonaCosta = ZONA_COSTA_PLAZA_IDS.some((pid) => used.has(pid));
    return hayZonaCosta
      ? [{ id: "zona_costa", name: "Zona Costa", color: CHIP_COLORS[0] }, ...real]
      : real;
  }, [prospectosAcc, clientesAcc, plazasData, companyPlazaMap]);

  const applyChips = useMemo(() => {
    return (rows: SeguimientoVentasRow[]) => {
      let base = rows;
      if (fEjecutivo.length > 0) base = base.filter((r) => (r.owner_id ? fEjecutivo.includes(r.owner_id) : false));
      if (fPlaza.length > 0) {
        const fPlazaEf = fPlaza.flatMap((id) => (id === "zona_costa" ? ZONA_COSTA_PLAZA_IDS : [id]));
        base = base.filter((r) => (companyPlazaMap.get(r.company_id) || []).some((pid) => fPlazaEf.includes(pid)));
      }
      return base;
    };
  }, [fEjecutivo, fPlaza, companyPlazaMap]);

  const prospectos = useMemo(() => applyChips(prospectosAcc), [applyChips, prospectosAcc]);
  const clientes = useMemo(
    () => applyChips(clientesAcc).filter((c) => !c.ignorado),
    [applyChips, clientesAcc]
  );

  const clientesIgnorados = useMemo(
    () => clientesAcc.filter((c) => c.ignorado === true),
    [clientesAcc]
  );

  const dormidoIds = useMemo(
    () => new Set(catalogo.filter((c) => c.nombre === "Dormido").map((c) => c.id)),
    [catalogo]
  );
  const sumaMes = clientes.reduce((s, c) => s + (c.acum_mes || 0), 0);
  const sumaMesAnterior = clientes.reduce((s, c) => s + (c.acum_mes_anterior || 0), 0);
  const sumaMesAnteriorMismoDia = clientes.reduce(
    (s, c) => s + (c.acum_mes_anterior_mismo_dia || 0),
    0
  );
  const importeMes = clientes.reduce((s, c) => s + (c.importe_mes || 0), 0);
  const importeMesAnterior = clientes.reduce((s, c) => s + (c.importe_mes_anterior || 0), 0);
  const importeMesAnteriorMismoDia = clientes.reduce(
    (s, c) => s + (c.importe_mes_anterior_mismo_dia || 0),
    0
  );
  const kpis = useMemo(
    () => ({
      prospectos: prospectos.length,
      clientes: clientes.length,
      nuevos: clientes.filter((c) => c.es_nuevo_cliente === true).length,
      dormidos: clientes.filter((c) => c.estatus_riesgo_id && dormidoIds.has(c.estatus_riesgo_id)).length,
      sumaMes,
      sumaMesAnterior,
      sumaMesAnteriorMismoDia,
      importeMes,
      importeMesAnterior,
      importeMesAnteriorMismoDia,
      pct:
        importeMesAnteriorMismoDia > 0
          ? ((importeMes - importeMesAnteriorMismoDia) / importeMesAnteriorMismoDia) * 100
          : null,
    }),
    [
      prospectos,
      clientes,
      dormidoIds,
      sumaMes,
      sumaMesAnterior,
      sumaMesAnteriorMismoDia,
      importeMes,
      importeMesAnterior,
      importeMesAnteriorMismoDia,
    ]
  );

  const alcanzadoPct =
    importeMesAnterior > 0 ? Math.min(100, (importeMes / importeMesAnterior) * 100) : null;

  const prospectosNuevosPeriodo = useMemo(
    () =>
      prospectos.filter((p) => {
        const c = companyCreatedMap.get(p.company_id);
        if (!c) return false;
        const d = new Date(c);
        return d >= periodoStart && d <= periodoEnd;
      }).length,
    [prospectos, companyCreatedMap, periodoStart, periodoEnd]
  );

  const convertidosPeriodo = useMemo(
    () =>
      clientes.filter((c) => {
        if (!c.fecha_conversion) return false;
        const d = new Date(c.fecha_conversion);
        return d >= periodoStart && d <= periodoEnd;
      }).length,
    [clientes, periodoStart, periodoEnd]
  );


  const etapasProspecto = useMemo(
    () => catalogo.filter((c) => c.ambito === "sin_venta" && c.familia === "etapa_prospecto").sort((a, b) => a.orden - b.orden),
    [catalogo]
  );
  const etapasRiesgo = useMemo(
    () => catalogo.filter((c) => c.ambito === "con_venta" && c.familia === "riesgo").sort((a, b) => a.orden - b.orden),
    [catalogo]
  );

  const brandPath = empresaSel === "lumaggs_chevron" ? "/seguimiento/chevron" : "/seguimiento/phillips66";

  const renderChips = (
    label: string,
    options: { id: string; name: string; color: string }[],
    selected: string[],
    setSelected: (fn: (arr: string[]) => string[]) => void
  ) => (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground w-16">{label}</span>
      {options.length === 0 ? (
        <span className="text-xs text-muted-foreground italic">Sin opciones</span>
      ) : (
        options.map((o) => {
          const sel = selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setSelected((arr) => toggleInArray(arr, o.id))}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-all"
              style={
                sel
                  ? { backgroundColor: o.color, color: "white", borderColor: o.color }
                  : { backgroundColor: `${o.color}14`, color: o.color, borderColor: `${o.color}55` }
              }
              aria-pressed={sel}
            >
              {o.name}
            </button>
          );
        })
      )}
    </div>
  );

  const kanbanProspectoCols = useMemo(() => {
    const cols = etapasProspecto.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      color: e.color,
      count: prospectos.filter((r) => (r as any).etapa_prospecto_id === e.id).length,
    }));
    const clasificados = cols.reduce((s, c) => s + c.count, 0);
    const sinClasificar = prospectos.length - clasificados;
    if (sinClasificar > 0) {
      cols.push({ id: "sin-clasificar", nombre: "Sin clasificar", color: "#94a3b8", count: sinClasificar });
    }
    return cols;
  }, [etapasProspecto, prospectos]);
  const kanbanClienteCols = useMemo(() => {
    const udsPromEsperado = (r: any) =>
      r.es_nuevo_cliente
        ? (r.companies?.volumen_mensual_estimado || 0)
        : (r.promedio_historico_mensual || 0);
    const cols: { id: string; nombre: string; color: string; count: number; unidades: number; totalHistoricoUnidades?: number }[] =
      etapasRiesgo.map((e) => {
        const rows = clientes.filter((r) => r.estatus_riesgo_id === e.id);
        return {
          id: e.id,
          nombre: e.nombre,
          color: e.color,
          count: rows.length,
          unidades: rows.reduce((s, r) => s + udsPromEsperado(r), 0),
        };
      });
    const etapaIds = new Set(etapasRiesgo.map((e) => e.id));
    const sinClasificarRows = clientes.filter((r) => !etapaIds.has(r.estatus_riesgo_id as string));
    if (sinClasificarRows.length > 0) {
      cols.push({
        id: "sin-clasificar",
        nombre: "Sin clasificar",
        color: "#94a3b8",
        count: sinClasificarRows.length,
        unidades: sinClasificarRows.reduce((s, r) => s + udsPromEsperado(r), 0),
      });
    }
    cols.push({
      id: "ignorados",
      nombre: "Ignorados",
      color: "#64748b",
      count: clientesIgnorados.length,
      unidades: clientesIgnorados.reduce((s, r) => s + udsPromEsperado(r), 0),
      totalHistoricoUnidades: clientesIgnorados.reduce((s, r) => s + (r.total_historico_unidades || 0), 0),
    });
    return cols;
  }, [etapasRiesgo, clientes, clientesIgnorados]);

  const segMap = useMemo(
    () => new Map([...prospectos, ...clientes].map((r) => [r.company_id, r])),
    [prospectos, clientes]
  );

  // Universo de empresas visibles: prospectos + clientes ya vienen filtrados por
  // access.accessLevel y por los chips de Ejecutivo/Plaza, así que representan
  // exactamente lo que este usuario puede ver con los filtros actuales.
  const visibleCompanyIds = useMemo(
    () =>
      Array.from(
        new Set(
          [...prospectos, ...clientes]
            .map((r) => r.company_id)
            .filter(Boolean)
        )
      ) as string[],
    [prospectos, clientes]
  );
  const visibleCompanyIdsKey = useMemo(
    () => [...visibleCompanyIds].sort().join(","),
    [visibleCompanyIds]
  );
  // Sin restricción real: acceso "todos" y sin chips de Ejecutivo/Plaza activos.
  // En ese caso las 4 queries de periodo omiten el .in(...) para no mandar
  // cientos/ miles de ids en la URL de cada consulta.
  const sinRestriccion = access.accessLevel === "todos" && fEjecutivo.length === 0 && fPlaza.length === 0;

  const periodoStartIso = periodoStart.toISOString();
  const periodoEndIso = periodoEnd.toISOString();

  const { data: actividades = [] } = useQuery({
    queryKey: ["seg_actividades_periodo", periodoStartIso, periodoEndIso, sinRestriccion, visibleCompanyIdsKey],
    enabled: sinRestriccion || visibleCompanyIds.length > 0,
    queryFn: async () => {
      if (!sinRestriccion && visibleCompanyIds.length === 0) return [];
      let q = supabase
        .from("crm_activities")
        .select("id, type, title, description, activity_date, company_id, user_id, companies:company_id(id, name, volumen_mensual_estimado)")
        .gte("activity_date", periodoStartIso)
        .lte("activity_date", periodoEndIso)
        .not("title", "ilike", "%Solicitud de validación de pago%")
        .not("title", "ilike", "%Aplicación de pago%")
        .not("title", "ilike", "%Cobranza ·%");
      if (!sinRestriccion) q = q.in("company_id", visibleCompanyIds);
      const { data, error } = await q.order("activity_date", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const actividadCompanyIds = useMemo(
    () => Array.from(new Set(actividades.map((a) => a.company_id).filter(Boolean))) as string[],
    [actividades]
  );

  const { data: siguientePasoMap = new Map<string, any>() } = useQuery({
    queryKey: ["seg_actividades_siguiente_paso", actividadCompanyIds],
    enabled: actividadCompanyIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_tasks")
        .select("company_id, title, description, due_date")
        .eq("completed", false)
        .not("due_date", "is", null)
        .in("company_id", actividadCompanyIds)
        .order("due_date", { ascending: true });
      if (error) throw error;
      const m = new Map<string, any>();
      for (const t of data || []) {
        if (t.company_id && !m.has(t.company_id)) m.set(t.company_id, t);
      }
      return m;
    },
  });

  const periodoStartDate = format(periodoStart, "yyyy-MM-dd");
  const periodoEndDate = format(periodoEnd, "yyyy-MM-dd");

  const { data: ventasPeriodoMap = new Map<string, number>() } = useQuery({
    queryKey: ["seg_ventas_periodo", periodoStartDate, periodoEndDate, empresaSel, actividadCompanyIds],
    enabled: actividadCompanyIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documento_productos")
        .select(
          "cantidad, documentos!inner(id, empresa_id, empresa_vendedora, fecha_documento, tipo_documento, is_active, estatus_factura), productos!inner(presentacion_id, presentaciones!inner(unidades_equivalentes))"
        )
        .eq("documentos.tipo_documento", "factura")
        .eq("documentos.is_active", true)
        .eq("documentos.empresa_vendedora", empresaSel)
        .in("documentos.empresa_id", actividadCompanyIds)
        .gte("documentos.fecha_documento", periodoStartDate)
        .lte("documentos.fecha_documento", periodoEndDate);
      if (error) throw error;
      const m = new Map<string, number>();
      for (const r of (data || []) as any[]) {
        const doc = r.documentos;
        if (!doc?.empresa_id) continue;
        if (doc.estatus_factura === "cancelada") continue;
        const ue = Number(r.productos?.presentaciones?.unidades_equivalentes ?? 1) || 1;
        const uds = Number(r.cantidad || 0) * ue;
        m.set(doc.empresa_id, (m.get(doc.empresa_id) || 0) + uds);
      }
      return m;
    },
  });

  const { data: cotizacionesPeriodo = [] } = useQuery({
    queryKey: ["seg_cotizaciones_periodo", periodoStartDate, periodoEndDate, empresaSel, sinRestriccion, visibleCompanyIdsKey],
    enabled: sinRestriccion || visibleCompanyIds.length > 0,
    queryFn: async () => {
      if (!sinRestriccion && visibleCompanyIds.length === 0) return [];
      let q = supabase
        .from("documentos")
        .select("id, numero_cotizacion, fecha_documento, companies:empresa_id(name)")
        .eq("empresa_vendedora", empresaSel)
        .eq("tipo_documento", "cotizacion")
        .eq("is_active", true)
        .gte("fecha_documento", periodoStartDate)
        .lte("fecha_documento", periodoEndDate);
      if (!sinRestriccion) q = q.in("empresa_id", visibleCompanyIds);
      const { data, error } = await q.order("fecha_documento", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: facturasPeriodo = [] } = useQuery({
    queryKey: ["seg_facturas_periodo", periodoStartDate, periodoEndDate, empresaSel, sinRestriccion, visibleCompanyIdsKey],
    enabled: sinRestriccion || visibleCompanyIds.length > 0,
    queryFn: async () => {
      if (!sinRestriccion && visibleCompanyIds.length === 0) return [];
      let q = supabase
        .from("documentos")
        .select("id, numero_factura, fecha_documento, companies:empresa_id(name)")
        .eq("empresa_vendedora", empresaSel)
        .eq("tipo_documento", "factura")
        .eq("is_active", true)
        .neq("estatus_factura", "cancelada")
        .gte("fecha_documento", periodoStartDate)
        .lte("fecha_documento", periodoEndDate);
      if (!sinRestriccion) q = q.in("empresa_id", visibleCompanyIds);
      const { data, error } = await q.order("fecha_documento", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: cobranzaPagosPeriodo = [] } = useQuery({
    queryKey: ["seg_cobranza_pagos_periodo", periodoStartDate, periodoEndDate, empresaSel, sinRestriccion, visibleCompanyIdsKey],
    enabled: sinRestriccion || visibleCompanyIds.length > 0,
    queryFn: async () => {
      if (!sinRestriccion && visibleCompanyIds.length === 0) return [];
      let q = supabase
        .from("cobranza_pagos")
        .select("id, monto_total, fecha_pago, empresa_id, companies:empresa_id(name)")
        .eq("empresa_vendedora", empresaSel)
        .gte("fecha_pago", periodoStartDate)
        .lte("fecha_pago", periodoEndDate);
      if (!sinRestriccion) q = q.in("empresa_id", visibleCompanyIds);
      const { data, error } = await q.order("fecha_pago", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const cobranzaPagoIds = useMemo(
    () => cobranzaPagosPeriodo.map((p: any) => p.id).filter(Boolean) as string[],
    [cobranzaPagosPeriodo]
  );

  const { data: cobranzaAplicaciones = [] } = useQuery({
    queryKey: ["seg_cobranza_aplicaciones_periodo", empresaSel, cobranzaPagoIds],
    enabled: cobranzaPagoIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cobranza_aplicaciones")
        .select("pago_id, documento_id, documentos:documento_id(numero_factura)")
        .in("pago_id", cobranzaPagoIds)
        .neq("estatus_aplicacion", "cancelada");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const cobranzaFacturasMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const a of cobranzaAplicaciones) {
      const num = a.documentos?.numero_factura;
      if (!a.pago_id || !num) continue;
      const arr = m.get(a.pago_id) || [];
      if (!arr.includes(num)) arr.push(num);
      m.set(a.pago_id, arr);
    }
    return m;
  }, [cobranzaAplicaciones]);

  const periodoDocIds = useMemo(
    () =>
      Array.from(
        new Set([...cotizacionesPeriodo, ...facturasPeriodo].map((d: any) => d.id).filter(Boolean))
      ) as string[],
    [cotizacionesPeriodo, facturasPeriodo]
  );

  const { data: docUnidadesMap = new Map<string, number>() } = useQuery({
    queryKey: ["seg_docs_unidades_periodo", periodoStartDate, periodoEndDate, empresaSel, periodoDocIds],
    enabled: periodoDocIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documento_productos")
        .select(
          "cantidad, documentos!inner(id, empresa_vendedora, fecha_documento, tipo_documento, is_active, estatus_factura), productos!inner(presentacion_id, presentaciones!inner(unidades_equivalentes))"
        )
        .in("documentos.tipo_documento", ["cotizacion", "factura"])
        .eq("documentos.is_active", true)
        .eq("documentos.empresa_vendedora", empresaSel)
        .in("documentos.id", periodoDocIds)
        .gte("documentos.fecha_documento", periodoStartDate)
        .lte("documentos.fecha_documento", periodoEndDate);
      if (error) throw error;
      const m = new Map<string, number>();
      for (const r of (data || []) as any[]) {
        const doc = r.documentos;
        if (!doc?.id) continue;
        if (doc.tipo_documento === "factura" && doc.estatus_factura === "cancelada") continue;
        const ue = Number(r.productos?.presentaciones?.unidades_equivalentes ?? 1) || 1;
        const uds = Number(r.cantidad || 0) * ue;
        m.set(doc.id, (m.get(doc.id) || 0) + uds);
      }
      return m;
    },
  });

  const exportarActividades = () => {
    const rows = actividades.map((a) => {
      const seg = a.company_id ? segMap.get(a.company_id) : undefined;
      const esCliente = !!seg?.tiene_venta;
      const usaPromedio = esCliente && seg?.es_nuevo_cliente === false;
      const valor = usaPromedio ? seg?.promedio_historico_mensual : a.companies?.volumen_mensual_estimado;
      const etiqueta = usaPromedio ? "Promedio mensual" : "Volumen estimado";
      const tarea = a.company_id ? siguientePasoMap.get(a.company_id) : undefined;
      const ventasPeriodo = a.company_id ? ventasPeriodoMap.get(a.company_id) : undefined;
      const acumMes = seg?.acum_mes;
      return {
        Empresa: a.companies?.name || "",
        Tipo: esCliente ? "Cliente" : "Prospecto",
        "Potencial o Promedio": valor ? Math.round(Number(valor)) : "",
        Etiqueta: etiqueta,
        "Ventas en el periodo (uds)": ventasPeriodo ? Math.round(ventasPeriodo) : "",
        "Acumulado en el mes (uds)": acumMes ? Math.round(Number(acumMes)) : "",
        "Tipo de actividad": TASK_TYPE_LABEL[a.type as TaskTypeKey] || a.type || "",
        "Descripción": a.description || a.title || "",
        "Siguiente paso": tarea?.title || "",
      };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Actividades");
    XLSX.writeFile(wb, `actividades_periodo_${periodoStartDate}_a_${periodoEndDate}.xlsx`);
  };

  const invalidateActividades = () => {
    queryClient.invalidateQueries({ queryKey: ["seg_actividades_periodo"], exact: false });
    queryClient.invalidateQueries({ queryKey: ["seg_actividades_siguiente_paso"], exact: false });
  };

  const handleDeleteActividad = async () => {
    if (!deletingActivityId) return;
    setDeletingActivity(true);
    const { error } = await supabase.from("crm_activities").delete().eq("id", deletingActivityId);
    setDeletingActivity(false);
    if (error) {
      toast.error("No se pudo eliminar la actividad: " + error.message);
      return;
    }
    toast.success("Actividad eliminada");
    setDeletingActivityId(null);
    invalidateActividades();
  };

  return (
    <div className="space-y-6">
      <PageBanner
        title="Seguimiento a Ventas"
        description="Selecciona la marca para dar seguimiento a tus clientes"
        avatar={
          <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <TrendingUp className="h-5 w-5" />
          </div>
        }
      />

      {/* Toggle de marca */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full border overflow-hidden">
          <button
            type="button"
            onClick={() => setEmpresaSel("lumaggs_chevron")}
            className={`px-4 py-1.5 text-xs font-semibold border-r transition-all ${
              empresaSel === "lumaggs_chevron" ? PILL.lumaggs_chevron.active : PILL.lumaggs_chevron.idle
            }`}
          >
            Chevron
          </button>
          <button
            type="button"
            onClick={() => setEmpresaSel("galsa_phillips66")}
            className={`px-4 py-1.5 text-xs font-semibold transition-all ${
              empresaSel === "galsa_phillips66" ? PILL.galsa_phillips66.active : PILL.galsa_phillips66.idle
            }`}
          >
            Phillips 66
          </button>
        </div>
        <Button size="sm" variant="outline" onClick={() => setActivityOpen(true)}>
          Registrar actividad
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigate("/seguimiento/reporte-diario")}>
          Reporte diario
        </Button>
      </div>

      {/* Selector de periodo */}
      <div className="flex flex-wrap items-center gap-2">
        {([
          { id: "ayer", label: "Ayer" },
          { id: "hoy", label: "Hoy" },
          { id: "semana", label: "Esta Semana" },
          { id: "mes", label: "Este Mes" },
          { id: "año", label: "Este Año" },
          { id: "custom", label: "Especificar periodo" },
        ] as const).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriodo(p.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition-all",
              periodo === p.id ? pill.active : pill.idle
            )}
            aria-pressed={periodo === p.id}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={restablecerFiltros}
          className="text-[11px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Restablecer filtros
        </button>
        {periodo === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs font-normal">
                  <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                  {customStart ? format(customStart, "d MMM yyyy", { locale: esLocale }) : "Inicio"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customStart}
                  onSelect={setCustomStart}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs font-normal">
                  <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                  {customEnd ? format(customEnd, "d MMM yyyy", { locale: esLocale }) : "Fin"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customEnd}
                  onSelect={setCustomEnd}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      <QuickActivityDialog
        open={activityOpen}
        onOpenChange={(o) => {
          setActivityOpen(o);
          if (!o) setEditingActivity(null);
        }}
        defaultBrand={empresaSel}
        editActivity={editingActivity}
        onSaved={() => {
          setEditingActivity(null);
          invalidateActividades();
        }}
      />

      <AlertDialog open={!!deletingActivityId} onOpenChange={(o) => { if (!o) setDeletingActivityId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar actividad</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. ¿Deseas eliminar esta actividad?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteActividad} disabled={deletingActivity}>
              {deletingActivity ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltrosAbiertos((v) => !v)}
              className="inline-flex items-center gap-1 text-sm font-bold text-foreground hover:text-muted-foreground transition-colors"
              aria-expanded={filtrosAbiertos}
            >
              Filtros
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border">
                {filtrosAbiertos ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            </button>
            {!filtrosAbiertos && fEjecutivo.length > 0 && (
              <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {fEjecutivo.length} ejecutivo{fEjecutivo.length === 1 ? "" : "s"}
              </span>
            )}
            {!filtrosAbiertos && fPlaza.length > 0 && (
              <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {fPlaza.length} plaza{fPlaza.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          {filtrosAbiertos && (
            <div className="space-y-2 mt-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground w-16">Ejecutivo</span>
                {ejecutivoGroups.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">Sin opciones</span>
                ) : (
                  <Popover open={ejOpen} onOpenChange={setEjOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {fEjecutivo.length > 0 ? `Ejecutivo (${fEjecutivo.length})` : "Ejecutivo"}
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput placeholder="Buscar ejecutivo..." value={ejSearch} onValueChange={setEjSearch} />
                        <CommandList>
                          <CommandEmpty>Sin resultados.</CommandEmpty>
                          {(() => {
                            const q = ejSearch.trim().toLowerCase();
                            const visGroups = ejecutivoGroups
                              .map((g) => ({ ...g, options: g.options.filter((o) => !q || o.name.toLowerCase().includes(q)) }))
                              .filter((g) => g.options.length > 0);
                            const visIds = visGroups.flatMap((g) => g.options.map((o) => o.id));
                            return (
                              <>
                                <CommandGroup>
                                  <CommandItem onSelect={() => setFEjecutivo((arr) => Array.from(new Set([...arr, ...visIds])))}>
                                    <span className="text-xs font-semibold">Seleccionar todos los visibles</span>
                                  </CommandItem>
                                  {fEjecutivo.length > 0 && (
                                    <CommandItem onSelect={() => setFEjecutivo([])}>
                                      <span className="text-xs font-semibold">Limpiar selección</span>
                                    </CommandItem>
                                  )}
                                </CommandGroup>
                                {visGroups.map((g) => (
                                  <CommandGroup key={g.name} heading={g.name}>
                                    {g.options.map((o) => {
                                      const sel = fEjecutivo.includes(o.id);
                                      return (
                                        <CommandItem
                                          key={o.id}
                                          value={o.id}
                                          onSelect={() => setFEjecutivo((arr) => toggleInArray(arr, o.id))}
                                        >
                                          <span
                                            className="mr-2 inline-flex h-4 w-4 items-center justify-center rounded-sm border"
                                            style={sel ? { backgroundColor: o.color, borderColor: o.color } : {}}
                                          >
                                            {sel && <Check className="h-3 w-3" style={{ color: "white" }} />}
                                          </span>
                                          <span className="text-xs">{o.name}</span>
                                        </CommandItem>
                                      );
                                    })}
                                  </CommandGroup>
                                ))}
                              </>
                            );
                          })()}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
              {renderChips("Plaza", plazaOptions, fPlaza, setFPlaza)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ventas del periodo */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardContent className="p-4 flex flex-col h-full">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Este periodo
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <p className="text-3xl font-bold">
                {ventasPeriodoActual.unidades.toLocaleString("es-MX", { maximumFractionDigits: 0 })} uds
              </p>
              {pctVariacionImporte !== null && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                    pctVariacionImporte >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  )}
                >
                  {pctVariacionImporte >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  {Math.abs(pctVariacionImporte).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{formatCurrency(ventasPeriodoActual.importe)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{rangoActualLabel}</p>
            <div className="mt-auto pt-3 space-y-2">
              {pctUnidadesComp !== null && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground w-16 shrink-0">Unidades</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", colorAvance(pctUnidadesComp))}
                      style={{ width: `${Math.min(100, pctUnidadesComp)}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground w-9 text-right">
                    {pctUnidadesComp.toFixed(0)}%
                  </span>
                </div>
              )}
              {pctImporteComp !== null && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground w-16 shrink-0">Importe</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", colorAvance(pctImporteComp))}
                      style={{ width: `${Math.min(100, pctImporteComp)}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground w-9 text-right">
                    {pctImporteComp.toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex flex-col h-full">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Periodo anterior
            </p>
            <p className="text-3xl font-bold mt-2 text-muted-foreground">
              {ventasPeriodoAnterior.unidades.toLocaleString("es-MX", { maximumFractionDigits: 0 })} uds
            </p>
            <p className="text-sm text-muted-foreground mt-1">{formatCurrency(ventasPeriodoAnterior.importe)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{rangoAnteriorLabel}</p>
          </CardContent>
        </Card>
      </div>


      {/* Kanban */}
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-semibold">Pipeline Prospectos</h3>
            <Card className="min-w-[180px]">
              <CardContent className="px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Prospectos activos
                </p>
                <p className="text-xl font-bold">{prospectos.length.toLocaleString("es-MX")}</p>
              </CardContent>
            </Card>
            <Card className="min-w-[180px]">
              <CardContent className="px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Prospectos nuevos registrados en el periodo
                </p>
                <p className="text-xl font-bold">{prospectosNuevosPeriodo.toLocaleString("es-MX")}</p>
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `${brandPath}?tab=sin_venta&registro_from=${format(periodoStart, "yyyy-MM-dd")}&registro_to=${format(periodoEnd, "yyyy-MM-dd")}${qpFiltros}`
                    )
                  }
                  className="text-[11px] font-semibold underline text-muted-foreground hover:text-foreground"
                >
                  Ver empresas
                </button>
              </CardContent>
            </Card>
          </div>
          {kanbanProspectoCols.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin etapas configuradas.</p>
          ) : (
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
              {kanbanProspectoCols.map((c) => (
                <Card key={c.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="text-xs font-semibold uppercase tracking-wide truncate">{c.nombre}</span>
                    </div>
                    <p className="text-3xl font-bold" style={{ color: c.color }}>
                      {c.count.toLocaleString("es-MX")}
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate(`${brandPath}?tab=sin_venta${qpFiltros}`)}
                      className="text-[11px] font-semibold underline text-muted-foreground hover:text-foreground"
                    >
                      Ver empresas
                    </button>
                    {c.nombre === "Propuesta" && (
                      <div className="flex flex-col items-start gap-1 pt-1">
                        <button
                          type="button"
                          onClick={() => navigate(`/documents?tipo=cotizacion&empresa=${empresaSel}&revision=no`)}
                          className="text-[11px] font-semibold underline text-muted-foreground hover:text-foreground"
                        >
                          Esperando respuesta ({prospectos.filter((r) => (r as any).avance_cotizacion === "esperando").length})
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/documents?tipo=cotizacion&empresa=${empresaSel}&revision=si`)}
                          className="text-[11px] font-semibold underline text-muted-foreground hover:text-foreground"
                        >
                          En negociación ({prospectos.filter((r) => (r as any).avance_cotizacion === "negociacion").length})
                        </button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-semibold">Pipeline Clientes</h3>
            {[
              { label: "Clientes activos", value: kpis.clientes },
              { label: "Nuevos (120 días)", value: kpis.nuevos },
              { label: "Dormidos", value: kpis.dormidos },
              { label: "Convertidos a clientes en periodo", value: convertidosPeriodo },
            ].map((k) => (
              <Card key={k.label} className="min-w-[160px]">
                <CardContent className="px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {k.label}
                  </p>
                  <p className="text-xl font-bold">{k.value.toLocaleString("es-MX")}</p>
                  {k.label === "Convertidos a clientes en periodo" && (
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `${brandPath}?tab=con_venta&conversion_from=${format(periodoStart, "yyyy-MM-dd")}&conversion_to=${format(periodoEnd, "yyyy-MM-dd")}${qpFiltros}`
                        )
                      }
                      className="text-[11px] font-semibold underline text-muted-foreground hover:text-foreground"
                    >
                      Ver empresas
                    </button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          {kanbanClienteCols.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin etapas configuradas.</p>
          ) : (
            <div className="grid gap-2 grid-cols-2 md:grid-cols-4 xl:grid-cols-6">
              {kanbanClienteCols.map((c) => (
                <Card key={c.id}>
                  <CardContent className="px-3 py-2 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="text-[10px] font-semibold uppercase tracking-wide truncate">{c.nombre}</span>
                    </div>
                    <p className="text-2xl font-bold leading-tight" style={{ color: c.color }}>
                      {c.count.toLocaleString("es-MX")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Unidades prom./esperado:{" "}
                      <span className="font-semibold text-foreground">
                        {Math.round(c.unidades).toLocaleString("es-MX")} uds
                      </span>
                    </p>
                    {c.id === "ignorados" && (
                      <p className="text-[10px] text-muted-foreground">
                        Total histórico:{" "}
                        <span className="font-semibold text-foreground">
                          {Math.round(c.totalHistoricoUnidades || 0).toLocaleString("es-MX")} uds
                        </span>
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate(`${brandPath}?tab=${c.id === "ignorados" ? "ignorados" : "con_venta"}${qpFiltros}`)}
                      className="text-[10px] font-semibold underline text-muted-foreground hover:text-foreground"
                    >
                      Ver empresas
                    </button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>


      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Actividades del periodo</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => { setEditingActivity(null); setActivityOpen(true); }}>
              Registrar actividad
            </Button>
            {actividades.length > 0 && (
              <Button size="sm" variant="outline" onClick={exportarActividades}>
                Exportar a Excel
              </Button>
            )}
          </div>
        </div>
        {actividades.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin actividades en este periodo.</p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Realizó</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Potencial / Promedio</TableHead>
                    <TableHead>Ventas en el periodo</TableHead>
                    <TableHead>Acumulado en el mes</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actividades.map((a) => {
                    const seg = a.company_id ? segMap.get(a.company_id) : undefined;
                    const esCliente = !!seg?.tiene_venta;
                    const usaPromedio = esCliente && seg?.es_nuevo_cliente === false;
                    const valor = usaPromedio
                      ? seg?.promedio_historico_mensual
                      : a.companies?.volumen_mensual_estimado;
                    const etiqueta = usaPromedio ? "Promedio mensual" : "Volumen estimado";
                    const tarea = a.company_id ? siguientePasoMap.get(a.company_id) : undefined;
                    const ventasPeriodo = a.company_id ? ventasPeriodoMap.get(a.company_id) : undefined;
                    const acumMes = seg?.acum_mes;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="align-top text-sm">
                          {a.user_id ? profileMap.get(a.user_id) || "—" : "—"}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{a.companies?.name || "—"}</span>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                esCliente ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"
                              )}
                            >
                              {esCliente ? "Cliente" : "Prospecto"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <p className="font-medium">
                            {valor ? `${Math.round(Number(valor)).toLocaleString("es-MX")} uds` : "—"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{etiqueta}</p>
                        </TableCell>
                        <TableCell className="align-top text-sm font-medium">
                          {ventasPeriodo ? `${Math.round(ventasPeriodo).toLocaleString("es-MX")} uds` : "—"}
                        </TableCell>
                        <TableCell className="align-top text-sm font-medium">
                          {acumMes ? `${Math.round(Number(acumMes)).toLocaleString("es-MX")} uds` : "—"}
                        </TableCell>
                        <TableCell className="align-top text-sm">
                          {TASK_TYPE_LABEL[a.type as TaskTypeKey] || a.type || "—"}
                        </TableCell>
                        <TableCell className="align-top text-sm">
                          <p>{a.description || a.title || "—"}</p>
                          {tarea?.title && (
                            <p className="text-[11px] italic text-muted-foreground mt-1">
                              Siguiente paso: {tarea.title}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              title="Editar actividad"
                              onClick={() => {
                                setEditingActivity({
                                  id: a.id,
                                  company_id: a.company_id,
                                  type: a.type,
                                  description: a.description ?? null,
                                });
                                setActivityOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-600 hover:text-red-700"
                              title="Eliminar actividad"
                              onClick={() => setDeletingActivityId(a.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Cotizaciones del periodo</h3>
        {cotizacionesPeriodo.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin cotizaciones en este periodo.</p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Nombre Comercial</TableHead>
                    <TableHead>Unidades equivalentes</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cotizacionesPeriodo.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm">
                        {c.fecha_documento ? format(new Date(c.fecha_documento), "d MMM yyyy", { locale: esLocale }) : "—"}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{c.numero_cotizacion || "—"}</TableCell>
                      <TableCell className="text-sm">{c.companies?.name || "—"}</TableCell>
                      <TableCell className="text-sm font-medium">
                        {(() => {
                          const uds = docUnidadesMap.get(c.id);
                          return uds !== undefined
                            ? `${Math.round(uds).toLocaleString("es-MX")} uds`
                            : "—";
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/documents/${c.id}`)}
                          className="text-[11px] font-semibold underline text-muted-foreground hover:text-foreground"
                        >
                          Ver / Editar
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Facturas del periodo</h3>
        {facturasPeriodo.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin facturas en este periodo.</p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Nombre Comercial</TableHead>
                    <TableHead>Unidades equivalentes</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {facturasPeriodo.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="text-sm">
                        {f.fecha_documento ? format(new Date(f.fecha_documento), "d MMM yyyy", { locale: esLocale }) : "—"}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{f.numero_factura || "—"}</TableCell>
                      <TableCell className="text-sm">{f.companies?.name || "—"}</TableCell>
                      <TableCell className="text-sm font-medium">
                        {(() => {
                          const uds = docUnidadesMap.get(f.id);
                          return uds !== undefined
                            ? `${Math.round(uds).toLocaleString("es-MX")} uds`
                            : "—";
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/documents/${f.id}`)}
                          className="text-[11px] font-semibold underline text-muted-foreground hover:text-foreground"
                        >
                          Ver / Editar
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Cobranza del periodo</h3>
        {cobranzaPagosPeriodo.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin cobranza en este periodo.</p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Nombre Comercial</TableHead>
                    <TableHead>Importe pagado</TableHead>
                    <TableHead>Facturas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cobranzaPagosPeriodo.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">
                        {p.fecha_pago ? format(new Date(p.fecha_pago), "d MMM yyyy", { locale: esLocale }) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{p.companies?.name || "—"}</TableCell>
                      <TableCell className="text-sm font-medium">{formatCurrency(Number(p.monto_total || 0))}</TableCell>
                      <TableCell className="text-sm">
                        {cobranzaFacturasMap.get(p.id)?.length
                          ? cobranzaFacturasMap.get(p.id)!.join(", ")
                          : "Sin aplicar"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}