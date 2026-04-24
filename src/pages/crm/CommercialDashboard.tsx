import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCommercialDashboard, type CommercialFilters } from "@/hooks/useCommercialDashboard";
import { useAuth } from "@/contexts/AuthContext";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown, Users, Target, DollarSign, Activity, Repeat, Award, AlertTriangle, Zap } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { startOfMonth, endOfMonth, format } from "date-fns";

function fmtNum(n: number) {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(n);
}

function KpiCard({
  label, value, icon: Icon, color, hint,
}: { label: string; value: string; icon: any; color: string; hint?: string }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: color }} />
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4" style={{ color }} />
      </CardHeader>
      <CardContent>
        <div className="text-xl font-semibold">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function CommercialDashboard() {
  const { user } = useAuth();
  const access = useModuleAccess("crm_chevron");
  const isPrivileged = access.accessLevel === "todos";

  const today = new Date();
  const [from, setFrom] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(today), "yyyy-MM-dd"));
  const [ejecutivoId, setEjecutivoId] = useState<string>("all");
  const [plazaId, setPlazaId] = useState<string>("all");
  const [segmentoId, setSegmentoId] = useState<string>("all");
  const [tipoClienteId, setTipoClienteId] = useState<string>("all");

  // Datos de filtros
  const { data: ejecutivos = [] } = useQuery({
    queryKey: ["dashboard_ejecutivos"],
    enabled: isPrivileged,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("is_active", true)
        .order("full_name");
      return (data || []).filter((p: any) => p.full_name);
    },
  });

  const { data: plazas = [] } = useQuery({
    queryKey: ["dashboard_plazas"],
    queryFn: async () => {
      const { data } = await supabase.from("plazas").select("id, nombre").eq("is_active", true).order("nombre");
      return data || [];
    },
  });

  const { data: segmentos = [] } = useQuery({
    queryKey: ["dashboard_segmentos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_option_values")
        .select("id, value")
        .eq("option_type", "segmento_cliente" as any)
        .eq("is_active", true)
        .order("value");
      return data || [];
    },
  });

  const { data: tiposCliente = [] } = useQuery({
    queryKey: ["dashboard_tipos_cliente"],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_option_values")
        .select("id, value")
        .eq("option_type", "tipo_cliente" as any)
        .eq("is_active", true)
        .order("value");
      return data || [];
    },
  });

  const filters: CommercialFilters = useMemo(() => ({
    from: new Date(from + "T00:00:00").toISOString(),
    to: new Date(to + "T23:59:59").toISOString(),
    ejecutivoId: isPrivileged ? ejecutivoId : (user?.id || "all"),
    plazaId, segmentoId, tipoClienteId,
  }), [from, to, ejecutivoId, plazaId, segmentoId, tipoClienteId, isPrivileged, user?.id]);

  const { data, isLoading } = useCommercialDashboard(filters);

  if (access.isLoading) return <div className="p-6"><Skeleton className="h-96" /></div>;
  if (!access.canView) return <div className="p-6 text-muted-foreground">Sin acceso al dashboard comercial.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" /> Dashboard Comercial
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Desempeño de ejecutivos en unidades equivalentes. {!isPrivileged && "Mostrando solo tus datos."}
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
            <div>
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            {isPrivileged && (
              <div>
                <Label className="text-xs">Ejecutivo</Label>
                <Select value={ejecutivoId} onValueChange={setEjecutivoId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {ejecutivos.map((e: any) => (
                      <SelectItem key={e.user_id} value={e.user_id}>{e.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">Plaza</Label>
              <Select value={plazaId} onValueChange={setPlazaId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {plazas.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Segmento</Label>
              <Select value={segmentoId} onValueChange={setSegmentoId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {segmentos.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.value}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo cliente</Label>
              <Select value={tipoClienteId} onValueChange={setTipoClienteId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {tiposCliente.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.value}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <>
          {/* SECCIÓN: PROSPECTOS */}
          <section className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Target className="h-4 w-4" /> Negocios nuevos (prospectos)</h3>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Prospectos nuevos" value={fmtNum(data.prospectosNuevos)} icon={Users} color="hsl(210 70% 55%)" />
              <KpiCard label="Negocios primera compra" value={fmtNum(data.negociosNuevos)} icon={Target} color="hsl(262 60% 55%)" />
              <KpiCard label="Cotizaciones a prospectos" value={fmtNum(data.cotizacionesProspectos)} icon={Activity} color="hsl(170 50% 45%)" />
              <KpiCard
                label="Conversión"
                value={`${fmtNum(data.tasaConversion)}%`}
                icon={TrendingUp} color="hsl(140 55% 45%)"
                hint={`${data.prospectosConvertidos} convertidos · ${fmtNum(data.tiempoConversionPromedio)} días promedio`}
              />
            </div>
          </section>

          {/* SECCIÓN: VENTAS */}
          <section className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4" /> Ventas (unidades equivalentes)</h3>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Volumen total (uds eq.)" value={fmtNum(data.volumenTotal)} icon={DollarSign} color="hsl(14 98% 60%)" />
              <KpiCard label="Ticket promedio" value={formatCurrency(data.ticketPromedio)} icon={TrendingUp} color="hsl(210 70% 55%)" />
              <KpiCard label="Volumen prom./cliente" value={fmtNum(data.volumenPromedioCliente)} icon={Users} color="hsl(262 60% 55%)" />
              <KpiCard label="Clientes con compra" value={fmtNum(data.topClientes.length)} icon={Award} color="hsl(170 50% 45%)" />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-sm">Volumen por ejecutivo</CardTitle></CardHeader>
                <CardContent>
                  {data.volumenPorEjecutivo.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">Sin ventas en el periodo</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={data.volumenPorEjecutivo} layout="vertical" margin={{ left: 80 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: any) => fmtNum(Number(v))} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                        <Bar dataKey="uds" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Volumen por segmento</CardTitle></CardHeader>
                <CardContent>
                  {data.volumenPorSegmento.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">Sin datos</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={data.volumenPorSegmento}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: any) => fmtNum(Number(v))} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                        <Bar dataKey="uds" fill="hsl(170 50% 45%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>

          {/* SECCIÓN: RECOMPRA */}
          <section className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Repeat className="h-4 w-4" /> Recompra</h3>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
              <KpiCard label="Clientes activos" value={fmtNum(data.clientesActivos)} icon={Users} color="hsl(140 55% 45%)" />
              <KpiCard label="Con recompra" value={fmtNum(data.clientesConRecompra)} icon={Repeat} color="hsl(210 70% 55%)" />
              <KpiCard label="Volumen recompra" value={fmtNum(data.volumenRecompra)} icon={DollarSign} color="hsl(14 98% 60%)" />
              <KpiCard label="Tasa recompra" value={`${fmtNum(data.tasaRecompra)}%`} icon={TrendingUp} color="hsl(262 60% 55%)" />
              <KpiCard label="En riesgo" value={fmtNum(data.clientesRiesgo)} icon={AlertTriangle} color="hsl(35 90% 55%)" />
              <KpiCard label="Dormidos" value={fmtNum(data.clientesDormidos)} icon={TrendingDown} color="hsl(0 75% 55%)" />
            </div>
          </section>

          {/* SECCIÓN: EXPANSIÓN */}
          <section className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Award className="h-4 w-4" /> Expansión por cliente</h3>
            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader><CardTitle className="text-sm">Top clientes (uds eq.)</CardTitle></CardHeader>
                <CardContent>
                  {data.topClientes.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">Sin datos</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={data.topClientes} layout="vertical" margin={{ left: 100 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: any) => fmtNum(Number(v))} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                        <Bar dataKey="uds" fill="hsl(262 60% 55%)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-sm">Resumen de expansión</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Oportunidades de recompra abiertas</span>
                    <span className="font-semibold">{fmtNum(data.oportunidadesExpansion)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Volumen promedio por cliente</span>
                    <span className="font-semibold">{fmtNum(data.volumenPromedioCliente)} uds eq.</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Clientes con compra en el periodo</span>
                    <span className="font-semibold">{fmtNum(data.topClientes.length)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* SECCIÓN: ACTIVIDAD */}
          <section className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Activity className="h-4 w-4" /> Actividad comercial</h3>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Tareas creadas" value={fmtNum(data.totalTareas)} icon={Activity} color="hsl(210 70% 55%)" />
              <KpiCard label="Tareas completadas" value={fmtNum(data.tareasCompletadas)} icon={TrendingUp} color="hsl(140 55% 45%)" />
              <KpiCard label="Tareas vencidas" value={fmtNum(data.tareasVencidas)} icon={AlertTriangle} color="hsl(0 75% 55%)" />
              <KpiCard label="Actividades registradas" value={fmtNum(data.actividadesPorTipo.reduce((s, a) => s + a.count, 0))} icon={Zap} color="hsl(262 60% 55%)" />
            </div>
            {data.actividadesPorTipo.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Actividades por tipo</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.actividadesPorTipo}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Bar dataKey="count" fill="hsl(170 50% 45%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </section>

          {/* SECCIÓN: EMBUDOS */}
          <section className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Target className="h-4 w-4" /> Embudos de conversión</h3>
            <Tabs defaultValue="primera">
              <TabsList>
                <TabsTrigger value="primera">Primera compra</TabsTrigger>
                <TabsTrigger value="recompra">Recompra</TabsTrigger>
              </TabsList>
              <TabsContent value="primera">
                <FunnelView stages={data.embudoPrimera} />
              </TabsContent>
              <TabsContent value="recompra">
                <FunnelView stages={data.embudoRecompra} />
              </TabsContent>
            </Tabs>
          </section>

          {/* SECCIÓN: RANKING */}
          <section className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Award className="h-4 w-4" /> Ranking de ejecutivos</h3>
            <Card>
              <CardContent className="pt-6 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Ejecutivo</TableHead>
                      <TableHead className="text-right">Prospectos</TableHead>
                      <TableHead className="text-right">Negocios</TableHead>
                      <TableHead className="text-right">Conversiones</TableHead>
                      <TableHead className="text-right">% Conv.</TableHead>
                      <TableHead className="text-right">Volumen (uds eq.)</TableHead>
                      <TableHead className="text-right">Vol. recompra</TableHead>
                      <TableHead className="text-right">En riesgo</TableHead>
                      <TableHead className="text-right">Tareas ✓</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead>Desempeño</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.ranking.length === 0 ? (
                      <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">Sin datos en el periodo</TableCell></TableRow>
                    ) : data.ranking.map((r, idx) => (
                      <TableRow key={r.user_id}>
                        <TableCell className="font-medium">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{r.full_name}</TableCell>
                        <TableCell className="text-right">{fmtNum(r.prospectos_nuevos)}</TableCell>
                        <TableCell className="text-right">{fmtNum(r.negocios_nuevos)}</TableCell>
                        <TableCell className="text-right">{fmtNum(r.conversiones)}</TableCell>
                        <TableCell className="text-right">{fmtNum(r.conversion_pct)}%</TableCell>
                        <TableCell className="text-right font-semibold">{fmtNum(r.volumen_uds)}</TableCell>
                        <TableCell className="text-right">{fmtNum(r.volumen_recompra_uds)}</TableCell>
                        <TableCell className="text-right">{fmtNum(r.clientes_riesgo)}</TableCell>
                        <TableCell className="text-right">{fmtNum(r.tareas_completadas)}</TableCell>
                        <TableCell className="text-right font-bold">{r.score}</TableCell>
                        <TableCell>
                          <Badge variant={r.desempeno === "alto" ? "default" : r.desempeno === "medio" ? "secondary" : "outline"}>
                            {r.desempeno === "alto" ? "Alto" : r.desempeno === "medio" ? "Medio" : "Bajo"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

function FunnelView({ stages }: { stages: { stage: string; count: number; color: string }[] }) {
  if (stages.length === 0) return (
    <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Sin etapas definidas</CardContent></Card>
  );
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        {stages.map((s, idx) => {
          const width = (s.count / max) * 100;
          const prev = idx > 0 ? stages[idx - 1].count : null;
          const conv = prev !== null && prev > 0 ? (s.count / prev) * 100 : null;
          return (
            <div key={s.stage}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium">{s.stage}</span>
                <span className="text-muted-foreground">
                  {fmtNum(s.count)}{conv !== null ? ` · ${fmtNum(conv)}% vs etapa previa` : ""}
                </span>
              </div>
              <div className="h-7 rounded-md bg-muted overflow-hidden">
                <div
                  className="h-full rounded-md transition-all"
                  style={{ width: `${Math.max(width, 2)}%`, backgroundColor: s.color || "hsl(var(--primary))" }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}