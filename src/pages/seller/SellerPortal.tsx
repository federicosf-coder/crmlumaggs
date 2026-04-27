import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, startOfDay, endOfDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, CheckCircle2, Clock, AlertCircle, FileText, ShoppingCart, Receipt, Wallet, UserPlus, RefreshCw, Plus, Download, ExternalLink, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const fmtMoney = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n || 0);
const fmtNum = (n: number) => new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(n || 0);

type Profile = { user_id: string; full_name: string | null };
type Plaza = { id: string; nombre: string };

export default function SellerPortal() {
  const { user, profile, hasAnyRole } = useAuth();
  const isManager = hasAnyRole(["admin", "manager"]);

  const [from, setFrom] = useState<Date>(startOfDay(new Date()));
  const [to, setTo] = useState<Date>(endOfDay(new Date()));
  const [ejecutivoId, setEjecutivoId] = useState<string>(user?.id || "");
  const [plazaId, setPlazaId] = useState<string>("all");
  const [pipelineMarca, setPipelineMarca] = useState<string>("all");

  const [ejecutivos, setEjecutivos] = useState<Profile[]>([]);
  const [plazas, setPlazas] = useState<Plaza[]>([]);
  const [loading, setLoading] = useState(false);

  const [tasks, setTasks] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);
  const [companyMap, setCompanyMap] = useState<Record<string, string>>({});

  // Load filter options
  useEffect(() => {
    if (!user) return;
    if (isManager) {
      supabase.from("profiles").select("user_id, full_name").eq("is_active", true).order("full_name").then(({ data }) => {
        setEjecutivos((data || []).sort((a: any, b: any) => (a.full_name || "").localeCompare(b.full_name || "", "es")) as any);
      });
    } else {
      setEjecutivos([{ user_id: user.id, full_name: profile?.full_name || "Yo" }]);
      setEjecutivoId(user.id);
    }
    supabase.from("plazas").select("id, nombre").eq("is_active", true).order("nombre").then(({ data }) => {
      setPlazas((data || []).sort((a: any, b: any) => (a.nombre || "").localeCompare(b.nombre || "", "es")) as any);
    });
  }, [user, isManager, profile]);

  const fetchData = async () => {
    if (!ejecutivoId) return;
    setLoading(true);
    try {
      const fromIso = from.toISOString();
      const toIso = to.toISOString();
      const fromDate = format(from, "yyyy-MM-dd");
      const toDate = format(to, "yyyy-MM-dd");

      // Tasks (mías o vencidas)
      let tq = supabase.from("crm_tasks").select("id, title, due_date, completed, priority, company_id, deal_id, contact_id, description, user_id").eq("user_id", ejecutivoId).order("due_date", { ascending: true, nullsFirst: false }).limit(200);
      const { data: tasksData } = await tq;

      // Deals - prospectos creados en rango
      let dq = supabase.from("crm_deals").select("id, title, created_at, company_id, value, stage_id, pipeline_id, pipeline_type, owner_id, tipo_negocio, potencial_unidades, cotizado_unidades, pedido_unidades, facturado_unidades, convertido_a_cliente").eq("owner_id", ejecutivoId).order("created_at", { ascending: false }).limit(500);
      const { data: dealsData } = await dq;

      // Documentos en rango (cot/ped/fact) por ejecutivo o creator
      let docQ = supabase.from("documentos").select("id, tipo_documento, fecha_documento, total, unidades_equivalentes_total, estatus_cotizacion, estatus_pedido, estatus_factura, empresa_id, plaza_id, ejecutivo_venta_id, created_by, numero_cotizacion, numero_pedido, numero_factura, saldo_pendiente_cobranza, estado_cobranza, empresa_vendedora").gte("fecha_documento", fromDate).lte("fecha_documento", toDate).eq("is_active", true).or(`ejecutivo_venta_id.eq.${ejecutivoId},created_by.eq.${ejecutivoId}`).limit(1000);
      if (plazaId !== "all") docQ = docQ.eq("plaza_id", plazaId);
      if (pipelineMarca !== "all") docQ = docQ.eq("empresa_vendedora", pipelineMarca === "chevron" ? "lumaggs_chevron" : "galsa_phillips66");
      const { data: docsData } = await docQ;

      // Pagos cobrados en rango
      let pq = supabase.from("cobranza_pagos").select("id, fecha_pago, monto_total, monto_aplicado, empresa_id, plaza_id, creado_por, estatus_pago").gte("fecha_pago", fromDate).lte("fecha_pago", toDate).eq("creado_por", ejecutivoId).limit(500);
      if (plazaId !== "all") pq = pq.eq("plaza_id", plazaId);
      const { data: pagosData } = await pq;

      // Company names
      const ids = new Set<string>();
      (tasksData || []).forEach((t: any) => t.company_id && ids.add(t.company_id));
      (dealsData || []).forEach((d: any) => d.company_id && ids.add(d.company_id));
      (docsData || []).forEach((d: any) => d.empresa_id && ids.add(d.empresa_id));
      (pagosData || []).forEach((p: any) => p.empresa_id && ids.add(p.empresa_id));
      const cmap: Record<string, string> = {};
      if (ids.size) {
        const { data: cs } = await supabase.from("companies").select("id, name").in("id", Array.from(ids));
        (cs || []).forEach((c: any) => { cmap[c.id] = c.name; });
      }

      setTasks(tasksData || []);
      setDeals(dealsData || []);
      setDocs(docsData || []);
      setPagos(pagosData || []);
      setCompanyMap(cmap);
    } catch (e: any) {
      toast.error("Error cargando datos: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [ejecutivoId, from, to, plazaId, pipelineMarca]);

  // Métricas
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const tasksVencidas = tasks.filter(t => !t.completed && t.due_date && new Date(t.due_date) < todayStart);
  const tasksHoyCompletadas = tasks.filter(t => t.completed && t.updated_at && new Date(t.updated_at) >= todayStart && new Date(t.updated_at) <= todayEnd);
  const tasksHoyPendientes = tasks.filter(t => !t.completed && t.due_date && new Date(t.due_date) >= todayStart && new Date(t.due_date) <= todayEnd);
  const misTareasHoy = [...tasksVencidas, ...tasksHoyPendientes, ...tasksHoyCompletadas].slice(0, 50);

  const fromTs = from.getTime();
  const toTs = to.getTime();
  const dealsEnRango = deals.filter(d => {
    const t = new Date(d.created_at).getTime();
    return t >= fromTs && t <= toTs;
  });

  const cotizaciones = docs.filter(d => d.tipo_documento === "cotizacion");
  const pedidos = docs.filter(d => d.tipo_documento === "pedido");
  const facturas = docs.filter(d => d.tipo_documento === "factura" && d.estatus_factura !== "cancelada");

  const sum = (arr: any[], key: string) => arr.reduce((a, b) => a + Number(b[key] || 0), 0);

  const totalFacturado = sum(facturas, "total");
  const unidadesFacturadas = sum(facturas, "unidades_equivalentes_total");
  const totalCobrado = sum(pagos, "monto_total");
  const saldoPendiente = sum(facturas, "saldo_pendiente_cobranza");

  // Conversiones por tipo de pipeline
  const dealsNuevos = deals.filter(d => d.pipeline_type === "primera_compra");
  const dealsRecompra = deals.filter(d => d.pipeline_type === "recompra");

  const sumDealsField = (arr: any[], key: string) => arr.reduce((a, b) => a + Number(b[key] || 0), 0);
  const convNuevos = {
    activos: dealsNuevos.length,
    cotizados: dealsNuevos.filter(d => Number(d.cotizado_unidades) > 0).length,
    pedidos: dealsNuevos.filter(d => Number(d.pedido_unidades) > 0).length,
    facturados: dealsNuevos.filter(d => Number(d.facturado_unidades) > 0).length,
    uCot: sumDealsField(dealsNuevos, "cotizado_unidades"),
    uPed: sumDealsField(dealsNuevos, "pedido_unidades"),
    uFac: sumDealsField(dealsNuevos, "facturado_unidades"),
  };
  const convRecompra = {
    activos: dealsRecompra.length,
    cotizados: dealsRecompra.filter(d => Number(d.cotizado_unidades) > 0).length,
    pedidos: dealsRecompra.filter(d => Number(d.pedido_unidades) > 0).length,
    facturados: dealsRecompra.filter(d => Number(d.facturado_unidades) > 0).length,
    uCot: sumDealsField(dealsRecompra, "cotizado_unidades"),
    uPed: sumDealsField(dealsRecompra, "pedido_unidades"),
    uFac: sumDealsField(dealsRecompra, "facturado_unidades"),
  };

  const clientesNuevosCompraron = new Set(facturas.filter(f => dealsNuevos.some(d => d.company_id === f.empresa_id)).map(f => f.empresa_id)).size;
  const clientesRecompraCompraron = new Set(facturas.filter(f => dealsRecompra.some(d => d.company_id === f.empresa_id)).map(f => f.empresa_id)).size;

  // Score
  const scoreTareas = tasksVencidas.length === 0 ? 20 : Math.max(0, 20 - tasksVencidas.length * 2);
  const scoreProspectos = Math.min(20, dealsEnRango.length * 5);
  const scoreCotPed = Math.min(20, (cotizaciones.length + pedidos.length) * 2);
  const scoreFact = Math.min(20, facturas.length * 4);
  const scoreCob = pagos.length > 0 ? 10 : 0;
  const scoreSeg = tasksHoyCompletadas.length >= 3 ? 10 : tasksHoyCompletadas.length * 3;
  const scoreTotal = scoreTareas + scoreProspectos + scoreCotPed + scoreFact + scoreCob + scoreSeg;

  const scoreColor = scoreTotal >= 80 ? "bg-green-600" : scoreTotal >= 60 ? "bg-yellow-500" : scoreTotal >= 40 ? "bg-orange-500" : "bg-red-600";
  const scoreText = scoreTotal >= 80 ? "Excelente" : scoreTotal >= 60 ? "Bueno" : scoreTotal >= 40 ? "Regular" : "Bajo";

  const completarTarea = async (id: string) => {
    await supabase.from("crm_tasks").update({ completed: true }).eq("id", id);
    toast.success("Tarea completada");
    fetchData();
  };
  const reprogramarTarea = async (id: string) => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + 1);
    await supabase.from("crm_tasks").update({ due_date: newDate.toISOString() }).eq("id", id);
    toast.success("Tarea reprogramada para mañana");
    fetchData();
  };

  const exportCsv = () => {
    const rows: string[] = ["Tipo,Folio,Cliente,Fecha,Estatus,Importe,Unidades"];
    docs.forEach(d => {
      const folio = d.numero_factura || d.numero_pedido || d.numero_cotizacion || d.id.slice(0, 8);
      const status = d.estatus_factura || d.estatus_pedido || d.estatus_cotizacion || "";
      rows.push([d.tipo_documento, folio, companyMap[d.empresa_id] || "", d.fecha_documento, status, d.total, d.unidades_equivalentes_total].join(","));
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `portal-vendedor-${format(now, "yyyyMMdd-HHmm")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const KpiCard = ({ title, value, sub, icon: Icon, color }: any) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={cn("p-2 rounded-md shrink-0", color)}>
            <Icon className="h-4 w-4 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const ConvBar = ({ label, value, max, color }: any) => (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{value} {max ? `/ ${max}` : ""}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full transition-all", color)} style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%` }} />
      </div>
    </div>
  );

  const docFolio = (d: any) => d.numero_factura || d.numero_pedido || d.numero_cotizacion || d.id.slice(0, 8);
  const docStatus = (d: any) => d.estatus_factura || d.estatus_pedido || d.estatus_cotizacion || "—";

  return (
    <div className="p-4 space-y-4 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">Portal del Vendedor</h1>
            <p className="text-sm text-muted-foreground">Centro de control diario · {format(from, "dd MMM", { locale: es })} – {format(to, "dd MMM yyyy", { locale: es })}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" asChild><Link to="/activities"><Plus className="h-3.5 w-3.5" /> Tarea</Link></Button>
            <Button size="sm" variant="outline" asChild><Link to="/crm"><UserPlus className="h-3.5 w-3.5" /> Prospecto</Link></Button>
            <Button size="sm" variant="outline" asChild><Link to="/documents/new"><FileText className="h-3.5 w-3.5" /> Cotización</Link></Button>
            <Button size="sm" variant="outline" asChild><Link to="/documents/new"><ShoppingCart className="h-3.5 w-3.5" /> Pedido</Link></Button>
            <Button size="sm" variant="outline" asChild><Link to="/cobranza"><Wallet className="h-3.5 w-3.5" /> Pago</Link></Button>
            <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-3.5 w-3.5" /> Exportar</Button>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-3 flex flex-wrap gap-2 items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {format(from, "dd MMM", { locale: es })} – {format(to, "dd MMM", { locale: es })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="range" selected={{ from, to }} onSelect={(r: any) => { if (r?.from) setFrom(startOfDay(r.from)); if (r?.to) setTo(endOfDay(r.to)); }} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="sm" onClick={() => { setFrom(startOfDay(new Date())); setTo(endOfDay(new Date())); }}>Hoy</Button>
            <Button variant="ghost" size="sm" onClick={() => { const d = new Date(); d.setDate(d.getDate() - 7); setFrom(startOfDay(d)); setTo(endOfDay(new Date())); }}>7 días</Button>
            <Button variant="ghost" size="sm" onClick={() => { const d = new Date(); d.setDate(1); setFrom(startOfDay(d)); setTo(endOfDay(new Date())); }}>Mes</Button>

            {isManager && (
              <Select value={ejecutivoId} onValueChange={setEjecutivoId}>
                <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Ejecutivo" /></SelectTrigger>
                <SelectContent>
                  {ejecutivos.map(e => <SelectItem key={e.user_id} value={e.user_id}>{e.full_name || e.user_id.slice(0, 8)}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={plazaId} onValueChange={setPlazaId}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Plaza" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las plazas</SelectItem>
                {plazas.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={pipelineMarca} onValueChange={setPipelineMarca}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Marca" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Ambas marcas</SelectItem>
                <SelectItem value="chevron">Chevron</SelectItem>
                <SelectItem value="phillips66">Phillips 66</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /></Button>
          </CardContent>
        </Card>
      </div>

      {/* Score */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className={cn("h-14 w-14 rounded-full flex items-center justify-center text-white font-bold text-xl", scoreColor)}>{scoreTotal}</div>
              <div>
                <p className="text-sm font-semibold">Score Diario · {scoreText}</p>
                <p className="text-xs text-muted-foreground">Tareas {scoreTareas}/20 · Prospectos {scoreProspectos}/20 · Cot/Ped {scoreCotPed}/20 · Fact {scoreFact}/20 · Cob {scoreCob}/10 · Seg {scoreSeg}/10</p>
              </div>
            </div>
            <div className="flex-1 min-w-[200px] max-w-md">
              <Progress value={scoreTotal} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard title="Tareas vencidas" value={tasksVencidas.length} sub={`${tasksHoyPendientes.length} pendientes hoy`} icon={AlertCircle} color="bg-red-600" />
        <KpiCard title="Tareas completadas hoy" value={tasksHoyCompletadas.length} icon={CheckCircle2} color="bg-green-600" />
        <KpiCard title="Prospectos nuevos" value={dealsEnRango.length} sub={`${dealsNuevos.length} 1ª compra · ${dealsRecompra.length} recompra`} icon={UserPlus} color="bg-blue-600" />
        <KpiCard title="Cotizaciones" value={cotizaciones.length} sub={`${fmtMoney(sum(cotizaciones, "total"))} · ${fmtNum(sum(cotizaciones, "unidades_equivalentes_total"))} u`} icon={FileText} color="bg-blue-500" />
        <KpiCard title="Pedidos" value={pedidos.length} sub={`${fmtMoney(sum(pedidos, "total"))} · ${fmtNum(sum(pedidos, "unidades_equivalentes_total"))} u`} icon={ShoppingCart} color="bg-blue-700" />
        <KpiCard title="Facturas" value={facturas.length} sub={`${fmtNum(unidadesFacturadas)} unid. equiv.`} icon={Receipt} color="bg-indigo-600" />
        <KpiCard title="Total facturado" value={fmtMoney(totalFacturado)} sub={`${fmtNum(unidadesFacturadas)} u equiv.`} icon={Receipt} color="bg-indigo-700" />
        <KpiCard title="Total cobrado" value={fmtMoney(totalCobrado)} sub={`${pagos.length} pagos`} icon={Wallet} color="bg-purple-600" />
        <KpiCard title="Saldo pendiente" value={fmtMoney(saldoPendiente)} sub={`${facturas.filter(f => Number(f.saldo_pendiente_cobranza) > 0).length} facturas con saldo`} icon={Clock} color="bg-yellow-500" />
        <KpiCard title="Clientes que compraron" value={clientesNuevosCompraron + clientesRecompraCompraron} sub={`${clientesNuevosCompraron} nuevos · ${clientesRecompraCompraron} recompra`} icon={Target} color="bg-green-700" />
      </div>

      {/* Conversiones */}
      <div className="grid md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Conversión · Clientes nuevos (Primera compra)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <ConvBar label="Activos" value={convNuevos.activos} max={convNuevos.activos} color="bg-blue-500" />
            <ConvBar label="Cotizados" value={convNuevos.cotizados} max={convNuevos.activos} color="bg-blue-600" />
            <ConvBar label="Pedido" value={convNuevos.pedidos} max={convNuevos.activos} color="bg-indigo-600" />
            <ConvBar label="Facturados" value={convNuevos.facturados} max={convNuevos.activos} color="bg-green-600" />
            <p className="text-xs text-muted-foreground pt-2">Unid. equiv: {fmtNum(convNuevos.uCot)} cot · {fmtNum(convNuevos.uPed)} ped · {fmtNum(convNuevos.uFac)} fact</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Conversión · Recompra</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <ConvBar label="Activos" value={convRecompra.activos} max={convRecompra.activos} color="bg-purple-500" />
            <ConvBar label="Cotizados" value={convRecompra.cotizados} max={convRecompra.activos} color="bg-purple-600" />
            <ConvBar label="Pedido" value={convRecompra.pedidos} max={convRecompra.activos} color="bg-indigo-600" />
            <ConvBar label="Facturados" value={convRecompra.facturados} max={convRecompra.activos} color="bg-green-600" />
            <p className="text-xs text-muted-foreground pt-2">Unid. equiv: {fmtNum(convRecompra.uCot)} cot · {fmtNum(convRecompra.uPed)} ped · {fmtNum(convRecompra.uFac)} fact</p>
          </CardContent>
        </Card>
      </div>

      {/* Mi día */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Mi día · Tareas y Actividades</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tarea</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead>Estatus</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {misTareasHoy.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sin tareas para hoy</TableCell></TableRow>}
                {misTareasHoy.map(t => {
                  const venc = t.due_date ? new Date(t.due_date) : null;
                  const isVenc = venc && !t.completed && venc < todayStart;
                  const statusColor = t.completed ? "bg-green-100 text-green-800" : isVenc ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800";
                  const statusText = t.completed ? "Completada" : isVenc ? "Vencida" : "Pendiente";
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium text-sm">{companyMap[t.company_id] || "—"}</TableCell>
                      <TableCell className="text-sm">{t.title}{t.description && <p className="text-xs text-muted-foreground truncate max-w-[300px]">{t.description}</p>}</TableCell>
                      <TableCell className="text-xs">{venc ? format(venc, "dd MMM HH:mm", { locale: es }) : "—"}</TableCell>
                      <TableCell><Badge variant="outline" className={statusColor}>{statusText}</Badge></TableCell>
                      <TableCell className="text-right space-x-1">
                        {!t.completed && <Button size="sm" variant="ghost" onClick={() => completarTarea(t.id)}><CheckCircle2 className="h-3.5 w-3.5" /></Button>}
                        {!t.completed && <Button size="sm" variant="ghost" onClick={() => reprogramarTarea(t.id)}><Clock className="h-3.5 w-3.5" /></Button>}
                        {t.deal_id && <Button size="sm" variant="ghost" asChild><Link to="/crm"><ExternalLink className="h-3.5 w-3.5" /></Link></Button>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Tabs detalle */}
      <Tabs defaultValue="prospectos">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="prospectos">Prospectos ({dealsEnRango.length})</TabsTrigger>
          <TabsTrigger value="cotizaciones">Cotizaciones ({cotizaciones.length})</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos ({pedidos.length})</TabsTrigger>
          <TabsTrigger value="facturas">Facturas ({facturas.length})</TabsTrigger>
          <TabsTrigger value="cobranza">Cobranza ({pagos.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="prospectos">
          <Card><CardContent className="p-0 overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Tipo</TableHead><TableHead>Fecha</TableHead><TableHead className="text-right">Importe</TableHead><TableHead className="text-right">Unid. equiv.</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {dealsEnRango.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Sin prospectos en el rango</TableCell></TableRow>}
              {dealsEnRango.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium text-sm">{companyMap[d.company_id] || d.title}</TableCell>
                  <TableCell><Badge variant="outline">{d.pipeline_type === "recompra" ? "Recompra" : "1ª Compra"}</Badge></TableCell>
                  <TableCell className="text-xs">{format(new Date(d.created_at), "dd MMM yyyy", { locale: es })}</TableCell>
                  <TableCell className="text-right text-sm">{fmtMoney(Number(d.value))}</TableCell>
                  <TableCell className="text-right text-sm">{fmtNum(Number(d.potencial_unidades || 0))}</TableCell>
                  <TableCell><Button size="sm" variant="ghost" asChild><Link to="/crm"><ExternalLink className="h-3.5 w-3.5" /></Link></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></CardContent></Card>
        </TabsContent>

        {[
          { key: "cotizaciones", data: cotizaciones, color: "blue" },
          { key: "pedidos", data: pedidos, color: "indigo" },
          { key: "facturas", data: facturas, color: "green" },
        ].map(({ key, data }) => (
          <TabsContent value={key} key={key}>
            <Card><CardContent className="p-0 overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead>Folio</TableHead><TableHead>Cliente</TableHead><TableHead>Fecha</TableHead><TableHead>Estatus</TableHead><TableHead className="text-right">Importe</TableHead><TableHead className="text-right">Unid. equiv.</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {data.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Sin registros</TableCell></TableRow>}
                {data.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{docFolio(d)}</TableCell>
                    <TableCell className="text-sm">{companyMap[d.empresa_id] || "—"}</TableCell>
                    <TableCell className="text-xs">{d.fecha_documento}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{docStatus(d)}</Badge></TableCell>
                    <TableCell className="text-right text-sm">{fmtMoney(Number(d.total))}</TableCell>
                    <TableCell className="text-right text-sm">{fmtNum(Number(d.unidades_equivalentes_total))}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" asChild><Link to={`/documents/${d.id}`}><ExternalLink className="h-3.5 w-3.5" /></Link></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table></CardContent></Card>
          </TabsContent>
        ))}

        <TabsContent value="cobranza">
          <Card><CardContent className="p-0 overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Fecha</TableHead><TableHead>Estatus</TableHead><TableHead className="text-right">Monto</TableHead><TableHead className="text-right">Aplicado</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {pagos.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Sin pagos en el rango</TableCell></TableRow>}
              {pagos.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm font-medium">{companyMap[p.empresa_id] || "—"}</TableCell>
                  <TableCell className="text-xs">{p.fecha_pago}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{p.estatus_pago}</Badge></TableCell>
                  <TableCell className="text-right text-sm">{fmtMoney(Number(p.monto_total))}</TableCell>
                  <TableCell className="text-right text-sm">{fmtMoney(Number(p.monto_aplicado))}</TableCell>
                  <TableCell><Button size="sm" variant="ghost" asChild><Link to="/cobranza"><ExternalLink className="h-3.5 w-3.5" /></Link></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}