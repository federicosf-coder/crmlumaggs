import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { PageBanner } from "@/components/PageBanner";
import { TrendingUp, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

const CHIP_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed",
  "#0891b2", "#db2777", "#ea580c", "#65a30d", "#9333ea",
];

export default function SeguimientoLanding() {
  const navigate = useNavigate();
  const [empresaSel, setEmpresaSel] = useState<EmpresaVendedora>("lumaggs_chevron");
  const [fEjecutivo, setFEjecutivo] = useState<string[]>([]);
  const [fPlaza, setFPlaza] = useState<string[]>([]);

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
        .select("user_id, full_name")
        .eq("is_active", true);
      if (error) throw error;
      return (data || []) as { user_id: string; full_name: string | null }[];
    },
    staleTime: 5 * 60_000,
  });
  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) m.set(p.user_id, p.full_name || "—");
    return m;
  }, [profiles]);

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

  const plazaOptions = useMemo(() => {
    const used = new Set<string>();
    for (const r of [...prospectosAcc, ...clientesAcc]) {
      for (const pid of companyPlazaMap.get(r.company_id) || []) used.add(pid);
    }
    return plazasData
      .filter((p) => used.has(p.id))
      .map((p, i) => ({ id: p.id, name: p.nombre, color: CHIP_COLORS[(i + 3) % CHIP_COLORS.length] }));
  }, [prospectosAcc, clientesAcc, plazasData, companyPlazaMap]);

  const applyChips = useMemo(() => {
    return (rows: SeguimientoVentasRow[]) => {
      let base = rows;
      if (fEjecutivo.length > 0) base = base.filter((r) => (r.owner_id ? fEjecutivo.includes(r.owner_id) : false));
      if (fPlaza.length > 0) {
        base = base.filter((r) => (companyPlazaMap.get(r.company_id) || []).some((pid) => fPlaza.includes(pid)));
      }
      return base;
    };
  }, [fEjecutivo, fPlaza, companyPlazaMap]);

  const prospectos = useMemo(() => applyChips(prospectosAcc), [applyChips, prospectosAcc]);
  const clientes = useMemo(() => applyChips(clientesAcc), [applyChips, clientesAcc]);

  const dormidoIds = useMemo(
    () => new Set(catalogo.filter((c) => c.nombre === "Dormido").map((c) => c.id)),
    [catalogo]
  );
  const sumaMes = clientes.reduce((s, c) => s + (c.acum_mes || 0), 0);
  const sumaMesAnterior = clientes.reduce((s, c) => s + (c.acum_mes_anterior || 0), 0);
  const kpis = useMemo(
    () => ({
      prospectos: prospectos.length,
      clientes: clientes.length,
      nuevos: clientes.filter((c) => c.es_nuevo_cliente === true).length,
      dormidos: clientes.filter((c) => c.estatus_riesgo_id && dormidoIds.has(c.estatus_riesgo_id)).length,
      sumaMes,
      sumaMesAnterior,
      pct: sumaMesAnterior > 0 ? ((sumaMes - sumaMesAnterior) / sumaMesAnterior) * 100 : null,
    }),
    [prospectos, clientes, dormidoIds, sumaMes, sumaMesAnterior]
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

  const kanbanProspectoCols = useMemo(
    () =>
      etapasProspecto.map((e) => ({
        id: e.id,
        nombre: e.nombre,
        color: e.color,
        count: prospectos.filter((r) => (r as any).etapa_prospecto_id === e.id).length,
      })),
    [etapasProspecto, prospectos]
  );
  const kanbanClienteCols = useMemo(
    () =>
      etapasRiesgo.map((e) => ({
        id: e.id,
        nombre: e.nombre,
        color: e.color,
        count: clientes.filter((r) => r.estatus_riesgo_id === e.id).length,
      })),
    [etapasRiesgo, clientes]
  );

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

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 space-y-2">
          {renderChips("Ejecutivo", ejecutivoOptions, fEjecutivo, setFEjecutivo)}
          {renderChips("Plaza", plazaOptions, fPlaza, setFPlaza)}
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card className="col-span-2">
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Ventas del mes vs. mes anterior
            </p>
            <div className="flex flex-wrap items-end gap-4 mt-2">
              <div>
                <p className="text-[10px] text-muted-foreground">Este mes</p>
                <p className="text-2xl font-bold">{kpis.sumaMes.toLocaleString("es-MX")}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Mes anterior</p>
                <p className="text-2xl font-bold text-muted-foreground">
                  {kpis.sumaMesAnterior.toLocaleString("es-MX")}
                </p>
              </div>
              {kpis.pct !== null && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                    kpis.pct >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  )}
                >
                  {kpis.pct >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  {Math.abs(kpis.pct).toFixed(1)}%
                </span>
              )}
            </div>
          </CardContent>
        </Card>
        {[
          { label: "Prospectos activos", value: kpis.prospectos },
          { label: "Clientes activos", value: kpis.clientes },
          { label: "Nuevos (120 días)", value: kpis.nuevos },
          { label: "Dormidos", value: kpis.dormidos },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{k.label}</p>
              <p className="text-2xl font-bold mt-1">{k.value.toLocaleString("es-MX")}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Kanban */}
      <div className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Pipeline Prospectos</h3>
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
                      onClick={() => navigate(`${brandPath}?tab=sin_venta`)}
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
          <h3 className="text-sm font-semibold">Pipeline Clientes</h3>
          {kanbanClienteCols.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin etapas configuradas.</p>
          ) : (
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
              {kanbanClienteCols.map((c) => (
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
                      onClick={() => navigate(`${brandPath}?tab=con_venta`)}
                      className="text-[11px] font-semibold underline text-muted-foreground hover:text-foreground"
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

      <section>
        <VentasChartsSection
          empresa={empresaSel}
          label={empresaSel === "lumaggs_chevron" ? "Chevron" : "Phillips 66"}
        />
        <VentasMensualSection
          empresa={empresaSel}
          label={empresaSel === "lumaggs_chevron" ? "Chevron" : "Phillips 66"}
        />
      </section>
    </div>
  );
}