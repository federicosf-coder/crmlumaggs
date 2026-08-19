import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Truck, Clock, Route as RouteIcon, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageBanner } from "@/components/PageBanner";
import { BackButton } from "@/components/BackButton";
import { cn } from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Plaza = { id: string; nombre: string };
type Repartidor = { id: string; nombre: string };

type RowData = {
  repartidor_id: string;
  repartidor_nombre: string;
  plaza_id: string;
  plaza_nombre: string;
  total_entregas: number;
  total_horas: number;
  total_km: number;
  total_rutas: number;
};

type RutaDetail = {
  entrega_id: string;
  ruta_id: string;
  repartidor_ids: string[];
  fecha_entrega: string;
  fecha_real: string | null;
  plaza_nombre: string;
  repartidor_nombre: string;
  cliente: string;
  km: number;
  minutos: number;
};

const ALL = "__ALL__";

const fmt = (n: number, d = 2) =>
  new Intl.NumberFormat("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n || 0);

export default function DailyDeliveryReport() {
  const { profile } = useAuth();
  const [dateFrom, setDateFrom] = useState<Date>(new Date());
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [plazaIds, setPlazaIds] = useState<string[]>([]);
  const [repartidorIds, setRepartidorIds] = useState<string[]>([]);
  const [defaulted, setDefaulted] = useState(false);

  const { data: plazas = [] } = useQuery<Plaza[]>({
    queryKey: ["plazas-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plazas").select("id,nombre").eq("is_active", true).order("nombre");
      if (error) throw error;
      return (data || []) as Plaza[];
    },
  });

  const { data: repartidores = [] } = useQuery<Repartidor[]>({
    queryKey: ["repartidores-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("repartidores").select("id,nombre").eq("is_active", true).order("nombre");
      if (error) throw error;
      return (data || []) as Repartidor[];
    },
  });

  // Set default plaza from profile (only once)
  useEffect(() => {
    if (!defaulted && profile?.plaza_id && plazas.length > 0) {
      const found = plazas.find((p) => p.id === profile.plaza_id);
      if (found) setPlazaIds([found.id]);
      setDefaulted(true);
    }
  }, [profile?.plaza_id, plazas, defaulted]);

  const dateFromStr = format(dateFrom, "yyyy-MM-dd");
  const dateToStr = format(dateTo, "yyyy-MM-dd");

  const { data: queryData, isLoading } = useQuery<{ rows: RowData[]; details: RutaDetail[] }>({
    queryKey: ["daily-delivery-report", dateFromStr, dateToStr, plazaIds.join(","), repartidorIds.join(",")],
    queryFn: async () => {
      let q = supabase
        .from("rutas_entrega")
        .select("id, fecha_entrega, plaza_id, repartidor_id, ruta_started_at, ruta_finished_at, km_recorridos")
        .gte("fecha_entrega", dateFromStr)
        .lte("fecha_entrega", dateToStr);
      if (plazaIds.length > 0) q = q.in("plaza_id", plazaIds);
      const { data: rutas, error } = await q;
      if (error) throw error;
      const rutaIds = (rutas || []).map((r) => r.id);
      if (rutaIds.length === 0) return { rows: [], details: [] };

      const { data: extras } = await supabase
        .from("ruta_repartidores")
        .select("ruta_id, repartidor_id")
        .in("ruta_id", rutaIds);

      const { data: entregas } = await supabase
        .from("entregas_programadas")
        .select("id, ruta_id, repartidor_id, fecha_entrega, fecha_entrega_real, km_desde_anterior, tiempo_real_min, documento_id")
        .in("ruta_id", rutaIds);

      const docIds = Array.from(new Set((entregas || []).map((e) => e.documento_id).filter(Boolean)));
      let empresaByDoc = new Map<string, string>();
      if (docIds.length > 0) {
        const { data: docs } = await supabase
          .from("documentos")
          .select("id, empresa_id")
          .in("id", docIds);
        const empIds = Array.from(new Set((docs || []).map((d) => d.empresa_id).filter(Boolean)));
        const empNames = new Map<string, string>();
        if (empIds.length > 0) {
        const { data: emps } = await supabase
            .from("companies")
            .select("id, name, razon_social")
            .in("id", empIds);
          (emps || []).forEach((e: any) => empNames.set(e.id, e.name || e.razon_social || "—"));
        }
        (docs || []).forEach((d: any) => {
          empresaByDoc.set(d.id, empNames.get(d.empresa_id) || "—");
        });
      }

      const deliveredByRuta = new Map<string, number>();
      (entregas || []).forEach((e) => {
        if (!e.ruta_id || !e.fecha_entrega_real) return;
        deliveredByRuta.set(e.ruta_id, (deliveredByRuta.get(e.ruta_id) || 0) + 1);
      });

      const repNames = new Map(repartidores.map((r) => [r.id, r.nombre]));
      const plazaNames = new Map(plazas.map((p) => [p.id, p.nombre]));

      const agg = new Map<string, RowData>();
      const ensure = (rid: string, pid: string): RowData => {
        const key = `${rid}__${pid}`;
        let row = agg.get(key);
        if (!row) {
          row = {
            repartidor_id: rid,
            repartidor_nombre: repNames.get(rid) || "—",
            plaza_id: pid,
            plaza_nombre: plazaNames.get(pid) || "—",
            total_entregas: 0,
            total_horas: 0,
            total_km: 0,
            total_rutas: 0,
          };
          agg.set(key, row);
        }
        return row;
      };

      const details: RutaDetail[] = [];

      for (const r of rutas || []) {
        const drivers = new Set<string>();
        if (r.repartidor_id) drivers.add(r.repartidor_id);
        (extras || []).filter((e) => e.ruta_id === r.id).forEach((e) => drivers.add(e.repartidor_id));
        if (drivers.size === 0) continue;

        const horas =
          r.ruta_started_at && r.ruta_finished_at
            ? Math.max(0, (new Date(r.ruta_finished_at).getTime() - new Date(r.ruta_started_at).getTime()) / 3600000)
            : 0;
        const km = Number(r.km_recorridos || 0);
        const entregasCount = deliveredByRuta.get(r.id) || 0;
        const share = 1 / drivers.size;

        for (const did of drivers) {
          if (repartidorIds.length > 0 && !repartidorIds.includes(did)) continue;
          const row = ensure(did, r.plaza_id);
          row.total_entregas += entregasCount * share;
          row.total_horas += horas * share;
          row.total_km += km * share;
          row.total_rutas += share;
        }
      }

      const rutaById = new Map((rutas || []).map((r) => [r.id, r]));
      const driversByRuta = new Map<string, string[]>();
      for (const r of rutas || []) {
        const ds = new Set<string>();
        if (r.repartidor_id) ds.add(r.repartidor_id);
        (extras || []).filter((e) => e.ruta_id === r.id).forEach((e) => ds.add(e.repartidor_id));
        driversByRuta.set(r.id, Array.from(ds));
      }
      for (const e of entregas || []) {
        const r = rutaById.get(e.ruta_id);
        if (!r) continue;
        const rDrivers = driversByRuta.get(r.id) || [];
        if (repartidorIds.length > 0 && !rDrivers.some((d) => repartidorIds.includes(d))) continue;
        details.push({
          entrega_id: e.id,
          ruta_id: e.ruta_id,
          repartidor_ids: rDrivers,
          fecha_entrega: r.fecha_entrega,
          fecha_real: e.fecha_entrega_real,
          plaza_nombre: plazaNames.get(r.plaza_id) || "—",
          repartidor_nombre: rDrivers.map((d) => repNames.get(d) || "—").join(", "),
          cliente: empresaByDoc.get(e.documento_id) || "—",
          km: Number(e.km_desde_anterior || 0),
          minutos: Number(e.tiempo_real_min || 0),
        });
      }
      details.sort((a, b) => {
        const ka = a.fecha_real || a.fecha_entrega;
        const kb = b.fecha_real || b.fecha_entrega;
        return ka.localeCompare(kb);
      });
      return { rows: Array.from(agg.values()), details };
    },
    enabled: !!dateFromStr && !!dateToStr,
  });

  const rows = queryData?.rows ?? [];
  const details = queryData?.details ?? [];

  // Aggregate per driver from actual deliveries (attribute each delivery to every driver on the route)
  const repNamesMap = useMemo(() => new Map(repartidores.map((r) => [r.id, r.nombre])), [repartidores]);
  const perDriver = useMemo(() => {
    const m = new Map<string, { repartidor_id: string; repartidor_nombre: string; total_entregas: number; total_horas: number; total_km: number; rutas: Set<string> }>();
    details.forEach((d) => {
      const drivers = d.repartidor_ids.length > 0 ? d.repartidor_ids : ["__none__"];
      drivers.forEach((did) => {
        if (repartidorIds.length > 0 && !repartidorIds.includes(did)) return;
        let ex = m.get(did);
        if (!ex) {
          ex = { repartidor_id: did, repartidor_nombre: repNamesMap.get(did) || "—", total_entregas: 0, total_horas: 0, total_km: 0, rutas: new Set() };
          m.set(did, ex);
        }
        ex.total_entregas += 1;
        ex.total_horas += (d.minutos || 0) / 60;
        ex.total_km += d.km || 0;
        if (d.ruta_id) ex.rutas.add(d.ruta_id);
      });
    });
    return Array.from(m.values())
      .map((r) => ({ ...r, total_rutas: r.rutas.size }))
      .sort((a, b) => b.total_entregas - a.total_entregas);
  }, [details, repartidorIds, repNamesMap]);

  const chartData = useMemo(
    () =>
      perDriver.map((r) => ({
        name: r.repartidor_nombre,
        Entregas: Number(r.total_entregas.toFixed(0)),
        Horas: Number(r.total_horas.toFixed(2)),
        Km: Number(r.total_km.toFixed(1)),
        Rutas: r.total_rutas,
      })),
    [perDriver],
  );

  const totals = useMemo(() => {
    const rutas = new Set(details.map((d) => d.ruta_id).filter(Boolean));
    return {
      tEntregas: details.length,
      tHoras: details.reduce((a, d) => a + (d.minutos || 0) / 60, 0),
      tKm: details.reduce((a, d) => a + (d.km || 0), 0),
      tRutas: rutas.size,
    };
  }, [details]);

  return (
    <>
      <div className="container mx-auto px-4 pt-4">
        <BackButton fallback="/reports" label="Volver a Reportes" />
      </div>
      <PageBanner title="Reporte Diario Entregas Básico" />
      <div className="container mx-auto p-4 space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              {(() => {
                const today = new Date();
                const presets = [
                  { key: "ayer", label: "Ayer", from: startOfDay(subDays(today, 1)), to: endOfDay(subDays(today, 1)) },
                  { key: "hoy", label: "Hoy", from: startOfDay(today), to: endOfDay(today) },
                  { key: "semana", label: "Semana", from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfDay(today) },
                  { key: "mes", label: "Mes", from: startOfMonth(today), to: endOfDay(today) },
                ];
                const isSameDay = (a: Date, b: Date) => format(a, "yyyy-MM-dd") === format(b, "yyyy-MM-dd");
                const activeKey = presets.find((p) => isSameDay(p.from, dateFrom) && isSameDay(p.to, dateTo))?.key;
                return presets.map((p) => (
                  <Button
                    key={p.key}
                    size="sm"
                    variant={activeKey === p.key ? "default" : "outline"}
                    onClick={() => { setDateFrom(p.from); setDateTo(p.to); }}
                  >
                    {p.label}
                  </Button>
                ));
              })()}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="mb-1 block">Desde *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateFrom, "PPP", { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="mb-1 block">Hasta *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateTo, "PPP", { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={dateTo} onSelect={(d) => d && setDateTo(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            </div>
            <div className="space-y-2">
              <Label className="block">Plazas</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPlazaIds([])}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs border transition-colors",
                    plazaIds.length === 0
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-input"
                  )}
                >
                  Todas
                </button>
                {plazas.map((p) => {
                  const active = plazaIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setPlazaIds((prev) =>
                          prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                        )
                      }
                      className={cn(
                        "px-3 py-1 rounded-full text-xs border transition-colors",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted border-input"
                      )}
                    >
                      {p.nombre}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="block">Repartidores</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setRepartidorIds([])}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs border transition-colors",
                    repartidorIds.length === 0
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-input"
                  )}
                >
                  Todos
                </button>
                {repartidores.map((r) => {
                  const active = repartidorIds.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() =>
                        setRepartidorIds((prev) =>
                          prev.includes(r.id) ? prev.filter((x) => x !== r.id) : [...prev, r.id]
                        )
                      }
                      className={cn(
                        "px-3 py-1 rounded-full text-xs border transition-colors",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted border-input"
                      )}
                    >
                      {r.nombre}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Header KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={<Truck className="h-5 w-5" />} label="Total Entregas" value={fmt(totals.tEntregas, 0)} className="bg-blue-600 text-white" />
          <KpiCard icon={<Clock className="h-5 w-5" />} label="Total Horas" value={fmt(totals.tHoras, 2)} className="bg-purple-600 text-white" />
          <KpiCard icon={<RouteIcon className="h-5 w-5" />} label="Total Km" value={fmt(totals.tKm, 1)} className="bg-orange-500 text-white" />
          <KpiCard icon={<ListChecks className="h-5 w-5" />} label="Total Rutas" value={fmt(totals.tRutas, 0)} className="bg-emerald-600 text-white" />
        </div>

        {/* Comparativo Repartidores */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Comparativo por Repartidor</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos para los filtros seleccionados.</p>
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Entregas" fill="hsl(217 91% 60%)" />
                    <Bar dataKey="Horas" fill="hsl(262 83% 58%)" />
                    <Bar dataKey="Km" fill="hsl(25 95% 53%)" />
                    <Bar dataKey="Rutas" fill="hsl(160 84% 39%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Desglose por ruta — orden ascendente por fecha */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Desglose por Ruta</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : details.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin rutas para los filtros seleccionados.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha entrega</TableHead>
                    <TableHead>Plaza</TableHead>
                    <TableHead>Repartidor</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Km</TableHead>
                    <TableHead className="text-right">Minutos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {details.map((d) => (
                    <TableRow key={d.entrega_id}>
                      <TableCell>
                        {d.fecha_real
                          ? format(new Date(d.fecha_real), "dd MMM yyyy HH:mm", { locale: es })
                          : format(new Date(d.fecha_entrega + "T00:00:00"), "dd MMM yyyy", { locale: es })}
                      </TableCell>
                      <TableCell>{d.plaza_nombre}</TableCell>
                      <TableCell>{d.repartidor_nombre}</TableCell>
                      <TableCell className="font-medium">{d.cliente}</TableCell>
                      <TableCell className="text-right">{fmt(d.km, 1)}</TableCell>
                      <TableCell className="text-right">{fmt(d.minutos, 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function KpiCard({ icon, label, value, className }: { icon: React.ReactNode; label: string; value: string; className?: string }) {
  return (
    <Card className={cn("shadow-sm", className)}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs opacity-90">{icon}<span>{label}</span></div>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}