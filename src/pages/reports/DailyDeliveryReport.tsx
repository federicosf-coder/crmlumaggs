import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Truck, Clock, Route as RouteIcon, Gauge, BarChart3, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageBanner } from "@/components/PageBanner";
import { cn } from "@/lib/utils";

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
};

const ALL = "__ALL__";

function scoreFor(entregasHora: number, kmEntrega: number): number {
  // Simple weighted score: more entregas/hora = better; lower km/entrega = better.
  // Normalize against soft thresholds.
  const eff = Math.min(entregasHora / 3, 1) * 60; // 3 entregas/hora => 60 pts
  const route = (kmEntrega > 0 ? Math.max(0, 1 - Math.min(kmEntrega / 30, 1)) : 0.5) * 40; // <= ~30 km/entrega
  return Math.round(eff + route);
}

function scoreColor(score: number): { label: string; className: string } {
  if (score >= 70) return { label: "Alto", className: "bg-green-600 text-white hover:bg-green-700" };
  if (score >= 40) return { label: "Medio", className: "bg-yellow-500 text-black hover:bg-yellow-600" };
  return { label: "Bajo", className: "bg-red-600 text-white hover:bg-red-700" };
}

const fmt = (n: number, d = 2) =>
  new Intl.NumberFormat("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n || 0);

export default function DailyDeliveryReport() {
  const { profile } = useAuth();
  const [date, setDate] = useState<Date>(new Date());
  const [plazaId, setPlazaId] = useState<string>(ALL);
  const [repartidorId, setRepartidorId] = useState<string>(ALL);
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
      if (found) setPlazaId(found.id);
      setDefaulted(true);
    }
  }, [profile?.plaza_id, plazas, defaulted]);

  const dateStr = format(date, "yyyy-MM-dd");

  const { data: rows = [], isLoading } = useQuery<RowData[]>({
    queryKey: ["daily-delivery-report", dateStr, plazaId, repartidorId],
    queryFn: async () => {
      // Load routes for the day (with optional filters)
      let q = supabase
        .from("rutas_entrega")
        .select("id, fecha_entrega, plaza_id, repartidor_id, ruta_started_at, ruta_finished_at, km_recorridos")
        .eq("fecha_entrega", dateStr);
      if (plazaId !== ALL) q = q.eq("plaza_id", plazaId);
      if (repartidorId !== ALL) q = q.eq("repartidor_id", repartidorId);
      const { data: rutas, error } = await q;
      if (error) throw error;
      const rutaIds = (rutas || []).map((r) => r.id);
      if (rutaIds.length === 0) return [];

      // Co-drivers (extra) per route
      const { data: extras } = await supabase
        .from("ruta_repartidores")
        .select("ruta_id, repartidor_id")
        .in("ruta_id", rutaIds);

      // Delivered counts per route
      const { data: entregas } = await supabase
        .from("entregas_programadas")
        .select("ruta_id, fecha_entrega_real")
        .in("ruta_id", rutaIds);

      const deliveredByRuta = new Map<string, number>();
      (entregas || []).forEach((e) => {
        if (!e.ruta_id || !e.fecha_entrega_real) return;
        deliveredByRuta.set(e.ruta_id, (deliveredByRuta.get(e.ruta_id) || 0) + 1);
      });

      const repNames = new Map(repartidores.map((r) => [r.id, r.nombre]));
      const plazaNames = new Map(plazas.map((p) => [p.id, p.nombre]));

      // Build per-driver aggregates. A driver = primary + extras of ruta_repartidores.
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
          };
          agg.set(key, row);
        }
        return row;
      };

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
          // optional repartidor filter: skip drivers not matching when filter is set
          if (repartidorId !== ALL && did !== repartidorId) continue;
          const row = ensure(did, r.plaza_id);
          row.total_entregas += entregasCount * share;
          row.total_horas += horas * share;
          row.total_km += km * share;
        }
      }

      return Array.from(agg.values());
    },
    enabled: !!dateStr,
  });

  const enriched = useMemo(() => {
    return rows
      .map((r) => {
        const entregasHora = r.total_horas > 0 ? r.total_entregas / r.total_horas : 0;
        const kmEntrega = r.total_entregas > 0 ? r.total_km / r.total_entregas : 0;
        const score = scoreFor(entregasHora, kmEntrega);
        return { ...r, entregasHora, kmEntrega, score };
      })
      .sort((a, b) => b.score - a.score);
  }, [rows]);

  // Group by Plaza → Driver (keep score order within plaza)
  const grouped = useMemo(() => {
    const map = new Map<string, { plaza_nombre: string; rows: typeof enriched }>();
    enriched.forEach((r) => {
      const k = r.plaza_id;
      if (!map.has(k)) map.set(k, { plaza_nombre: r.plaza_nombre, rows: [] });
      map.get(k)!.rows.push(r);
    });
    return Array.from(map.entries()).map(([plaza_id, v]) => ({ plaza_id, ...v }));
  }, [enriched]);

  const totals = useMemo(() => {
    const tEntregas = enriched.reduce((a, r) => a + r.total_entregas, 0);
    const tHoras = enriched.reduce((a, r) => a + r.total_horas, 0);
    const tKm = enriched.reduce((a, r) => a + r.total_km, 0);
    return {
      tEntregas,
      tHoras,
      tKm,
      entregasHora: tHoras > 0 ? tEntregas / tHoras : 0,
      kmEntrega: tEntregas > 0 ? tKm / tEntregas : 0,
    };
  }, [enriched]);

  return (
    <>
      <PageBanner title="Reporte Diario Entregas Básico" />
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
              <Label className="mb-1 block">Plaza</Label>
              <Select value={plazaId} onValueChange={setPlazaId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas las plazas</SelectItem>
                  {plazas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block">Repartidor</Label>
              <Select value={repartidorId} onValueChange={setRepartidorId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos los repartidores</SelectItem>
                  {repartidores.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Header KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard icon={<Truck className="h-5 w-5" />} label="Total Entregas" value={fmt(totals.tEntregas, 0)} className="bg-blue-600 text-white" />
          <KpiCard icon={<Clock className="h-5 w-5" />} label="Total Horas" value={fmt(totals.tHoras, 2)} className="bg-purple-600 text-white" />
          <KpiCard icon={<RouteIcon className="h-5 w-5" />} label="Total Km" value={fmt(totals.tKm, 1)} className="bg-orange-500 text-white" />
          <KpiCard icon={<Gauge className="h-5 w-5" />} label="Entregas / Hora" value={fmt(totals.entregasHora, 2)} className="bg-card text-foreground border" />
          <KpiCard icon={<BarChart3 className="h-5 w-5" />} label="Km / Entrega" value={fmt(totals.kmEntrega, 2)} className="bg-card text-foreground border" />
        </div>

        {/* Ranking */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-base">Ranking por Score</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : enriched.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos para los filtros seleccionados.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {enriched.slice(0, 6).map((r, idx) => {
                  const sc = scoreColor(r.score);
                  return (
                    <div key={r.repartidor_id + r.plaza_id} className="flex items-center justify-between border rounded-md p-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-muted-foreground">#{idx + 1}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{r.repartidor_nombre}</p>
                          <p className="text-xs text-muted-foreground truncate">{r.plaza_nombre}</p>
                        </div>
                      </div>
                      <Badge className={cn(sc.className, "shrink-0")}>{r.score}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grouped tables */}
        {grouped.map((g) => (
          <Card key={g.plaza_id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Plaza: {g.plaza_nombre}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Repartidor</TableHead>
                    <TableHead>Plaza</TableHead>
                    <TableHead className="text-right">Total Entregas</TableHead>
                    <TableHead className="text-right">Horas Totales</TableHead>
                    <TableHead className="text-right">Km Totales</TableHead>
                    <TableHead className="text-right">Entregas / Hora</TableHead>
                    <TableHead className="text-right">Km / Entrega</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.rows.map((r) => {
                    const sc = scoreColor(r.score);
                    return (
                      <TableRow key={r.repartidor_id + r.plaza_id}>
                        <TableCell className="font-medium">{r.repartidor_nombre}</TableCell>
                        <TableCell>{r.plaza_nombre}</TableCell>
                        <TableCell className="text-right">{fmt(r.total_entregas, 1)}</TableCell>
                        <TableCell className="text-right">{fmt(r.total_horas, 2)}</TableCell>
                        <TableCell className="text-right">{fmt(r.total_km, 1)}</TableCell>
                        <TableCell className="text-right">{fmt(r.entregasHora, 2)}</TableCell>
                        <TableCell className="text-right">{fmt(r.kmEntrega, 2)}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={sc.className}>{r.score} · {sc.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
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