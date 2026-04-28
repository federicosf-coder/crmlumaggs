import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format, startOfDay, endOfDay, parseISO, addDays, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, CheckCircle2, Clock, AlertCircle, FileText, ShoppingCart, Receipt, Wallet, UserPlus, RefreshCw, Plus, Download, ExternalLink, Target, AlertTriangle, CalendarClock, MessageCircle, Users, Activity, TrendingUp, Percent, ListChecks, Package } from "lucide-react";
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
import { Toggle } from "@/components/ui/toggle";
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
  const [searchParams] = useSearchParams();
  const sp = (k: string) => searchParams.get(k);
  const initFrom = sp("from") ? startOfDay(parseISO(sp("from")!)) : startOfDay(new Date());
  const initTo = sp("to") ? endOfDay(parseISO(sp("to")!)) : endOfDay(new Date());
  const [from, setFrom] = useState<Date>(initFrom);
  const [to, setTo] = useState<Date>(initTo);
  const [ejecutivoId, setEjecutivoId] = useState<string>(sp("ejecutivo") || user?.id || "");
  const [plazaId, setPlazaId] = useState<string>(sp("plaza") || "all");
  // Marcas independientes (toggles). Si ninguna está activa, se asume ambas.
  const [marcaChevron, setMarcaChevron] = useState<boolean>(sp("chevron") ? sp("chevron") === "1" : true);
  const [marcaPhillips, setMarcaPhillips] = useState<boolean>(sp("phillips") ? sp("phillips") === "1" : true);

  const [ejecutivos, setEjecutivos] = useState<Profile[]>([]);
  const [plazas, setPlazas] = useState<Plaza[]>([]);
  const [loading, setLoading] = useState(false);

  const [tasks, setTasks] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);
  const [facturasPorVencer, setFacturasPorVencer] = useState<any[]>([]);
  const [facturasVencidasAll, setFacturasVencidasAll] = useState<any[]>([]);
  const [actividades, setActividades] = useState<any[]>([]);
  const [companyMap, setCompanyMap] = useState<Record<string, string>>({});
  const [companyPhoneMap, setCompanyPhoneMap] = useState<Record<string, { phone: string | null; name: string }>>({});
  const [ejecutivoMap, setEjecutivoMap] = useState<Record<string, string>>({});
  const [bucketActivo, setBucketActivo] = useState<"vencidas" | "1-5" | "6-10" | "11-20" | "21-30" | null>(null);

  // Límites de visualización + paginación por lista (10 / 25 / 50 / "all")
  type PageLimit = "10" | "25" | "50" | "all";
  const [limTerminadas, setLimTerminadas] = useState<PageLimit>("10");
  const [pageTerminadas, setPageTerminadas] = useState(1);
  const [limCreadas, setLimCreadas] = useState<PageLimit>("10");
  const [pageCreadas, setPageCreadas] = useState(1);
  const [limProspectos, setLimProspectos] = useState<PageLimit>("10");
  const [pageProspectos, setPageProspectos] = useState(1);
  const [limCotizaciones, setLimCotizaciones] = useState<PageLimit>("10");
  const [pageCotizaciones, setPageCotizaciones] = useState(1);
  const [limPedidos, setLimPedidos] = useState<PageLimit>("10");
  const [pagePedidos, setPagePedidos] = useState(1);
  const [limFacturas, setLimFacturas] = useState<PageLimit>("10");
  const [pageFacturas, setPageFacturas] = useState(1);
  const [limCobranza, setLimCobranza] = useState<PageLimit>("10");
  const [pageCobranza, setPageCobranza] = useState(1);

  const paginate = <T,>(arr: T[], lim: PageLimit, page: number): T[] => {
    if (lim === "all") return arr;
    const size = parseInt(lim, 10);
    const start = (page - 1) * size;
    return arr.slice(start, start + size);
  };
  const totalPages = (total: number, lim: PageLimit) => {
    if (lim === "all" || total === 0) return 1;
    return Math.max(1, Math.ceil(total / parseInt(lim, 10)));
  };

  // Helpers de marca
  const marcasSeleccionadas = useMemo(() => {
    const arr: ("lumaggs_chevron" | "galsa_phillips66")[] = [];
    if (marcaChevron) arr.push("lumaggs_chevron");
    if (marcaPhillips) arr.push("galsa_phillips66");
    // Si ninguno seleccionado, no filtramos (= ambas)
    return arr.length === 0 ? ["lumaggs_chevron", "galsa_phillips66"] : arr;
  }, [marcaChevron, marcaPhillips]);
  const marcaPipelineList = useMemo(() => {
    const arr: string[] = [];
    if (marcaChevron) arr.push("chevron");
    if (marcaPhillips) arr.push("phillips66");
    return arr.length === 0 ? ["chevron", "phillips66"] : arr;
  }, [marcaChevron, marcaPhillips]);

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
      // Periodo inclusivo: [fromDate, toDateExclusive)
      const fromDate = format(startOfDay(from), "yyyy-MM-dd");
      const toDate = format(startOfDay(from > to ? from : to), "yyyy-MM-dd"); // safety
      const toExclusive = format(addDays(startOfDay(to), 1), "yyyy-MM-dd");
      const fromIso = startOfDay(from).toISOString();
      const toIso = endOfDay(to).toISOString();
      const todayIso = format(new Date(), "yyyy-MM-dd");

      // Tasks: traemos del ejecutivo (sin filtro de fecha porque necesitamos vencidas + creadas + completadas en periodo)
      let tq = supabase.from("crm_tasks").select("id, title, due_date, completed, priority, company_id, deal_id, contact_id, description, user_id, created_at, updated_at").eq("user_id", ejecutivoId).order("due_date", { ascending: true, nullsFirst: false }).limit(500);
      const { data: tasksData } = await tq;

      // Deals con marca via pipeline join (filtrado por marca y owner)
      let dq = supabase.from("crm_deals").select("id, title, created_at, company_id, value, stage_id, pipeline_id, pipeline_type, owner_id, tipo_negocio, potencial_unidades, cotizado_unidades, pedido_unidades, facturado_unidades, convertido_a_cliente, crm_pipelines!inner(marca)").eq("owner_id", ejecutivoId).in("crm_pipelines.marca", marcaPipelineList).order("created_at", { ascending: false }).limit(1000);
      const { data: dealsData } = await dq;

      // Documentos en rango (cot/ped/fact). Periodo inclusivo [from, to+1).
      let docQ = supabase.from("documentos").select("id, tipo_documento, fecha_documento, fecha_vencimiento, total, unidades_equivalentes_total, estatus_cotizacion, estatus_pedido, estatus_factura, empresa_id, plaza_id, ejecutivo_venta_id, created_by, numero_cotizacion, numero_pedido, numero_factura, saldo_pendiente_cobranza, estado_cobranza, empresa_vendedora, created_at").gte("fecha_documento", fromDate).lt("fecha_documento", toExclusive).eq("is_active", true).or(`ejecutivo_venta_id.eq.${ejecutivoId},created_by.eq.${ejecutivoId}`).in("empresa_vendedora", marcasSeleccionadas as any).limit(2000);
      if (plazaId !== "all") docQ = docQ.eq("plaza_id", plazaId);
      const { data: docsData } = await docQ;

      // Pagos cobrados en rango (periodo inclusivo [from, to+1))
      let pq = supabase.from("cobranza_pagos").select("id, fecha_pago, monto_total, monto_aplicado, empresa_id, plaza_id, creado_por, estatus_pago, created_at").gte("fecha_pago", fromDate).lt("fecha_pago", toExclusive).eq("creado_por", ejecutivoId).limit(1000);
      if (plazaId !== "all") pq = pq.eq("plaza_id", plazaId);
      const { data: pagosData } = await pq;

      // Facturas por vencer (> hoy, próximos 30 días) — saldo se calcula con cobranza_aplicaciones
      // No filtramos por saldo_pendiente_cobranza porque el campo está desactualizado en muchos registros.
      const in30 = new Date(); in30.setDate(in30.getDate() + 30);
      const in30Iso = in30.toISOString().slice(0, 10);
      let fpvQ = supabase
        .from("documentos")
        .select("id, fecha_documento, fecha_vencimiento, total, saldo_pendiente_cobranza, empresa_id, empresa_vendedora, numero_factura, estado_cobranza, estatus_factura, ejecutivo_venta_id, created_by")
        .eq("tipo_documento", "factura")
        .eq("is_active", true)
        .neq("estatus_factura", "cancelada")
        .gt("fecha_vencimiento", todayIso)
        .lte("fecha_vencimiento", in30Iso)
        .in("empresa_vendedora", marcasSeleccionadas as any)
        .or(`ejecutivo_venta_id.eq.${ejecutivoId},created_by.eq.${ejecutivoId}`)
        .limit(2000);
      if (plazaId !== "all") fpvQ = fpvQ.eq("plaza_id", plazaId);
      const { data: fpvRaw } = await fpvQ;

      // Calcular saldo real por factura: total - SUM(monto_aplicado activo)
      const fpvIds = (fpvRaw || []).map((f: any) => f.id);
      const aplicMap: Record<string, number> = {};
      if (fpvIds.length) {
        const { data: aplics } = await supabase
          .from("cobranza_aplicaciones")
          .select("documento_id, monto_aplicado, estatus_aplicacion")
          .in("documento_id", fpvIds)
          .eq("estatus_aplicacion", "activa");
        (aplics || []).forEach((a: any) => {
          aplicMap[a.documento_id] = (aplicMap[a.documento_id] || 0) + Number(a.monto_aplicado || 0);
        });
      }
      const fpvData = (fpvRaw || [])
        .map((f: any) => {
          const aplicado = aplicMap[f.id] || 0;
          const saldoCalc = Number(f.total || 0) - aplicado;
          // Preferir saldo_pendiente_cobranza solo si es > 0; si no, usar saldo calculado
          const saldoFinal = Number(f.saldo_pendiente_cobranza || 0) > 0
            ? Number(f.saldo_pendiente_cobranza)
            : saldoCalc;
          return { ...f, saldo_pendiente_cobranza: saldoFinal };
        })
        .filter((f: any) => Number(f.saldo_pendiente_cobranza) > 0);
      console.log("[FacturasPorVencer]", { recibidas: fpvRaw?.length || 0, conSaldo: fpvData.length });

      // Facturas vencidas (fecha_vencimiento <= max(hoy, fin del periodo))
      // Excluye canceladas y pagadas. Recalcula saldo real con cobranza_aplicaciones.
      const fechaCorte = todayIso > toDate ? todayIso : toDate;
      let venQ = supabase.from("documentos")
        .select("id, fecha_documento, fecha_vencimiento, total, saldo_pendiente_cobranza, empresa_id, empresa_vendedora, numero_factura, estado_cobranza, estatus_factura, ejecutivo_venta_id, created_by")
        .eq("tipo_documento", "factura")
        .eq("is_active", true)
        .neq("estatus_factura", "cancelada")
        .neq("estatus_factura", "pagada")
        .lte("fecha_vencimiento", fechaCorte)
        .in("empresa_vendedora", marcasSeleccionadas as any)
        .or(`ejecutivo_venta_id.eq.${ejecutivoId},created_by.eq.${ejecutivoId}`)
        .limit(2000);
      if (plazaId !== "all") venQ = venQ.eq("plaza_id", plazaId);
      const { data: venRaw } = await venQ;

      const venIds = (venRaw || []).map((f: any) => f.id);
      const venAplicMap: Record<string, number> = {};
      if (venIds.length) {
        const { data: aplics } = await supabase
          .from("cobranza_aplicaciones")
          .select("documento_id, monto_aplicado, estatus_aplicacion")
          .in("documento_id", venIds)
          .eq("estatus_aplicacion", "activa");
        (aplics || []).forEach((a: any) => {
          venAplicMap[a.documento_id] = (venAplicMap[a.documento_id] || 0) + Number(a.monto_aplicado || 0);
        });
      }
      const venData = (venRaw || [])
        .map((f: any) => {
          const aplicado = venAplicMap[f.id] || 0;
          const saldoCalc = Number(f.total || 0) - aplicado;
          const saldoFinal = Number(f.saldo_pendiente_cobranza || 0) > 0
            ? Math.min(Number(f.saldo_pendiente_cobranza), saldoCalc > 0 ? saldoCalc : Number(f.saldo_pendiente_cobranza))
            : saldoCalc;
          return { ...f, saldo_pendiente_cobranza: saldoFinal };
        })
        .filter((f: any) => Number(f.saldo_pendiente_cobranza) > 0);

      // Actividades CRM creadas/realizadas en el periodo (por ejecutivo)
      let actQ = supabase
        .from("crm_activities")
        .select("id, type, activity_date, created_at, user_id, company_id, deal_id")
        .eq("user_id", ejecutivoId)
        .gte("activity_date", fromIso)
        .lte("activity_date", toIso)
        .limit(2000);
      const { data: actData } = await actQ;

      // Company names
      const ids = new Set<string>();
      (tasksData || []).forEach((t: any) => t.company_id && ids.add(t.company_id));
      (dealsData || []).forEach((d: any) => d.company_id && ids.add(d.company_id));
      (docsData || []).forEach((d: any) => d.empresa_id && ids.add(d.empresa_id));
      (pagosData || []).forEach((p: any) => p.empresa_id && ids.add(p.empresa_id));
      (fpvData || []).forEach((d: any) => d.empresa_id && ids.add(d.empresa_id));
      (venData || []).forEach((d: any) => d.empresa_id && ids.add(d.empresa_id));
      const cmap: Record<string, string> = {};
      const cphone: Record<string, { phone: string | null; name: string }> = {};
      if (ids.size) {
        const { data: cs } = await supabase.from("companies").select("id, name, phone").in("id", Array.from(ids));
        (cs || []).forEach((c: any) => { cmap[c.id] = c.name; cphone[c.id] = { phone: c.phone, name: c.name }; });
        // Intentar obtener WhatsApp del contacto principal (primer contacto activo)
        const { data: cts } = await supabase.from("contacts").select("company_id, whatsapp_phone, mobile, phone").in("company_id", Array.from(ids)).eq("is_active", true);
        (cts || []).forEach((ct: any) => {
          const cur = cphone[ct.company_id];
          if (!cur) return;
          if (!cur.phone) cur.phone = ct.whatsapp_phone || ct.mobile || ct.phone || null;
        });
      }
      // Ejecutivos para mostrar nombre en desglose
      const ejIds = new Set<string>();
      (fpvData || []).forEach((d: any) => { if (d.ejecutivo_venta_id) ejIds.add(d.ejecutivo_venta_id); else if (d.created_by) ejIds.add(d.created_by); });
      const emap: Record<string, string> = {};
      if (ejIds.size) {
        const { data: ps } = await supabase.from("profiles").select("user_id, full_name").in("user_id", Array.from(ejIds));
        (ps || []).forEach((p: any) => { emap[p.user_id] = p.full_name || ""; });
      }

      setTasks(tasksData || []);
      setDeals(dealsData || []);
      setDocs(docsData || []);
      setPagos(pagosData || []);
      setFacturasPorVencer(fpvData || []);
      setFacturasVencidasAll(venData || []);
      setActividades(actData || []);
      setCompanyMap(cmap);
      setCompanyPhoneMap(cphone);
      setEjecutivoMap(emap);
    } catch (e: any) {
      toast.error("Error cargando datos: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [ejecutivoId, from, to, plazaId, marcaChevron, marcaPhillips]);

  // Métricas
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const fromTs = startOfDay(from).getTime();
  const toTs = endOfDay(to).getTime();

  // Tareas vencidas: fecha_vencimiento <= fecha_fin (to) y no completadas
  const tasksVencidas = tasks.filter(t => !t.completed && t.due_date && new Date(t.due_date).getTime() <= toTs && new Date(t.due_date) < todayStart);
  // Tareas completadas en periodo (proxy: updated_at en periodo y completed=true)
  const tasksCompletadasPeriodo = tasks.filter(t => t.completed && t.updated_at && new Date(t.updated_at).getTime() >= fromTs && new Date(t.updated_at).getTime() <= toTs);
  // Tareas creadas en periodo
  const tasksCreadasPeriodo = tasks.filter(t => t.created_at && new Date(t.created_at).getTime() >= fromTs && new Date(t.created_at).getTime() <= toTs);
  const tasksHoyPendientes = tasks.filter(t => !t.completed && t.due_date && new Date(t.due_date) >= todayStart && new Date(t.due_date) <= todayEnd);
  const misTareasHoy = [...tasksVencidas, ...tasksHoyPendientes, ...tasksCompletadasPeriodo].slice(0, 50);

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

  // Cobranza vencida
  const clientesConSaldoVencido = new Set(facturasVencidasAll.map(f => f.empresa_id)).size;
  const saldoVencidoTotal = sum(facturasVencidasAll, "saldo_pendiente_cobranza");
  // Total cobrado de saldo vencido en periodo: pagos cuyas empresas tenían facturas vencidas
  const empresasVencidasIds = new Set(facturasVencidasAll.map(f => f.empresa_id));
  const cobradoDeVencido = pagos.filter(p => empresasVencidasIds.has(p.empresa_id)).reduce((a, b) => a + Number(b.monto_aplicado || 0), 0);

  // Facturas por vencer agrupadas
  const ahora = startOfDay(new Date()).getTime();
  const bucket = (min: number, max: number) => facturasPorVencer.filter(f => {
    if (!f.fecha_vencimiento) return false;
    const dias = Math.ceil((new Date(f.fecha_vencimiento).getTime() - ahora) / (1000 * 60 * 60 * 24));
    return dias >= min && dias <= max;
  });
  const fxv1 = bucket(1, 5);
  const fxv2 = bucket(6, 10);
  const fxv3 = bucket(11, 20);
  const fxv4 = bucket(21, 30);

  // Lista unificada de cobranza: vencidas + por vencer
  // diasVencidos = hoy - fecha_vencimiento (positivo = vencida hace X días)
  const calcDiasVencidos = (fechaVenc: string | null) => {
    if (!fechaVenc) return 0;
    return Math.floor((ahora - new Date(fechaVenc).getTime()) / (1000 * 60 * 60 * 24));
  };
  const facturasCobranza = useMemo(() => {
    const combined = [...facturasVencidasAll, ...facturasPorVencer]
      .map((f: any) => ({ ...f, dias_vencidos: calcDiasVencidos(f.fecha_vencimiento) }));
    // Eliminar duplicados por id (por si una entra en ambas listas)
    const seen = new Set<string>();
    const unique = combined.filter((f: any) => {
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });
    // Orden: más vencidas primero (días desc), luego vence hoy, luego por vencer
    return unique.sort((a: any, b: any) => b.dias_vencidos - a.dias_vencidos);
  }, [facturasVencidasAll, facturasPorVencer]);

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

  // KPIs adicionales
  const clientesConCompra = new Set(facturas.map(f => f.empresa_id).filter(Boolean)).size;
  const ticketPromedio = facturas.length > 0 ? totalFacturado / facturas.length : 0;
  const unidadesPromedioCliente = clientesConCompra > 0 ? unidadesFacturadas / clientesConCompra : 0;
  const prospectosNuevosPeriodo = dealsNuevos.filter(d => new Date(d.created_at).getTime() >= fromTs && new Date(d.created_at).getTime() <= toTs).length;
  const pctConversionProspectos = prospectosNuevosPeriodo > 0
    ? (clientesNuevosCompraron / prospectosNuevosPeriodo) * 100
    : 0;

  // Score
  const scoreTareas = tasksVencidas.length === 0 ? 20 : Math.max(0, 20 - tasksVencidas.length * 2);
  const scoreProspectos = Math.min(20, dealsEnRango.length * 5);
  const scoreCotPed = Math.min(20, (cotizaciones.length + pedidos.length) * 2);
  const scoreFact = Math.min(20, facturas.length * 4);
  const scoreCob = pagos.length > 0 ? 10 : 0;
  const scoreSeg = tasksCompletadasPeriodo.length >= 3 ? 10 : tasksCompletadasPeriodo.length * 3;
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

  const PageSizeSelect = ({ value, onChange, total, onPageReset }: { value: PageLimit; onChange: (v: PageLimit) => void; total: number; onPageReset?: () => void }) => (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span>Mostrar</span>
      <Select value={value} onValueChange={(v) => { onChange(v as PageLimit); onPageReset?.(); }}>
        <SelectTrigger className="h-7 w-[88px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="10">10</SelectItem>
          <SelectItem value="25">25</SelectItem>
          <SelectItem value="50">50</SelectItem>
          <SelectItem value="all">Todas</SelectItem>
        </SelectContent>
      </Select>
      <span>de {total}</span>
    </div>
  );

  const Paginator = ({ page, setPage, total, lim }: { page: number; setPage: (n: number) => void; total: number; lim: PageLimit }) => {
    if (lim === "all" || total === 0) return null;
    const pages = totalPages(total, lim);
    if (pages <= 1) return null;
    return (
      <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-muted-foreground">
        <span>Página {page} de {pages}</span>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-7" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
          <Button size="sm" variant="outline" className="h-7" disabled={page >= pages} onClick={() => setPage(page + 1)}>Siguiente</Button>
        </div>
      </div>
    );
  };

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
            <Button size="sm" variant="outline" asChild><Link to="/crm?from=seller-portal"><UserPlus className="h-3.5 w-3.5" /> Prospecto</Link></Button>
            <Button size="sm" variant="outline" asChild><Link to="/documents/new"><FileText className="h-3.5 w-3.5" /> Cotización</Link></Button>
            <Button size="sm" variant="outline" asChild><Link to="/documents/new"><ShoppingCart className="h-3.5 w-3.5" /> Pedido</Link></Button>
            <Button size="sm" variant="outline" asChild><Link to="/cobranza?from=seller-portal"><Wallet className="h-3.5 w-3.5" /> Pago</Link></Button>
            <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-3.5 w-3.5" /> Exportar</Button>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-3 flex flex-wrap gap-2 items-center">
            {/* Rango fecha: Desde */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Desde: {format(from, "dd MMM yyyy", { locale: es })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={from} onSelect={(d) => { if (d) setFrom(startOfDay(d)); }} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            {/* Rango fecha: Hasta */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Hasta: {format(to, "dd MMM yyyy", { locale: es })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={to} onSelect={(d) => { if (d) setTo(endOfDay(d)); }} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="sm" onClick={() => { const d = subDays(new Date(), 1); setFrom(startOfDay(d)); setTo(endOfDay(d)); }}>Ayer</Button>
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
            {/* Toggles independientes por marca */}
            <div className="flex items-center gap-1 border rounded-md p-0.5">
              <Toggle size="sm" pressed={marcaChevron} onPressedChange={setMarcaChevron} className="data-[state=on]:bg-blue-600 data-[state=on]:text-white">Chevron</Toggle>
              <Toggle size="sm" pressed={marcaPhillips} onPressedChange={setMarcaPhillips} className="data-[state=on]:bg-red-600 data-[state=on]:text-white">Phillips 66</Toggle>
            </div>
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
      {/* Fila 1 — Demanda y volumen */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard title="Prospectos nuevos" value={prospectosNuevosPeriodo} sub="Pipeline 1ª compra" icon={UserPlus} color="bg-blue-600" />
        <KpiCard title="Clientes nuevos que compraron" value={clientesNuevosCompraron} sub="Primera compra" icon={Users} color="bg-emerald-600" />
        <KpiCard title="Clientes con compra" value={clientesConCompra} sub="únicos en periodo" icon={Users} color="bg-emerald-700" />
        <KpiCard title="Unidades / cliente" value={fmtNum(unidadesPromedioCliente)} sub="promedio" icon={Package} color="bg-amber-700" />
        <KpiCard title="Facturado (Unidades)" value={fmtNum(unidadesFacturadas)} sub="u. equivalentes" icon={Package} color="bg-indigo-600" />
      </div>

      {/* Fila 2 — Operación y cobranza */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard title="Cotizaciones generadas" value={cotizaciones.length} sub={`${fmtMoney(sum(cotizaciones, "total"))}`} icon={FileText} color="bg-blue-500" />
        <KpiCard title="Pedidos generados" value={pedidos.length} sub={`${fmtMoney(sum(pedidos, "total"))}`} icon={ShoppingCart} color="bg-blue-700" />
        <KpiCard title="Facturado ($)" value={fmtMoney(totalFacturado)} sub={`${facturas.length} facturas`} icon={Receipt} color="bg-indigo-700" />
        <KpiCard title="Total cobrado" value={fmtMoney(totalCobrado)} sub={`${pagos.length} pagos`} icon={Wallet} color="bg-purple-700" />
        <KpiCard title="Clientes con saldo vencido" value={clientesConSaldoVencido} sub={`${facturasVencidasAll.length} facturas`} icon={AlertTriangle} color="bg-orange-600" />
      </div>

      {/* Fila 3 — Calidad y tareas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard title="Saldo vencido" value={fmtMoney(saldoVencidoTotal)} sub="importe pendiente" icon={AlertCircle} color="bg-red-700" />
        <KpiCard title="Ticket promedio" value={fmtMoney(ticketPromedio)} sub="por factura" icon={TrendingUp} color="bg-amber-600" />
        <KpiCard title="Tareas creadas" value={tasksCreadasPeriodo.length} sub="en el periodo" icon={ListChecks} color="bg-cyan-600" />
        <KpiCard title="Tareas completadas" value={tasksCompletadasPeriodo.length} sub="en el periodo" icon={CheckCircle2} color="bg-green-600" />
        <KpiCard title="Tareas vencidas" value={tasksVencidas.length} sub={`${tasksHoyPendientes.length} pendientes hoy`} icon={AlertCircle} color="bg-red-600" />
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

      {/* Mi día - Terminadas en periodo */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Mi día - Terminadas en periodo ({tasksCompletadasPeriodo.length})</CardTitle>
          <PageSizeSelect value={limTerminadas} onChange={setLimTerminadas} total={tasksCompletadasPeriodo.length} onPageReset={() => setPageTerminadas(1)} />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tarea</TableHead>
                  <TableHead>Completada</TableHead>
                  <TableHead>Estatus</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasksCompletadasPeriodo.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sin terminadas en el periodo</TableCell></TableRow>}
                {paginate(tasksCompletadasPeriodo, limTerminadas, pageTerminadas).map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium text-sm">{companyMap[t.company_id] || "—"}</TableCell>
                    <TableCell className="text-sm">{t.title}{t.description && <p className="text-xs text-muted-foreground truncate max-w-[300px]">{t.description}</p>}</TableCell>
                    <TableCell className="text-xs">{t.updated_at ? format(new Date(t.updated_at), "dd MMM HH:mm", { locale: es }) : "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="bg-green-100 text-green-800">Completada</Badge></TableCell>
                    <TableCell className="text-right space-x-1">
                      {t.deal_id && <Button size="sm" variant="ghost" asChild><Link to="/crm"><ExternalLink className="h-3.5 w-3.5" /></Link></Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Paginator page={pageTerminadas} setPage={setPageTerminadas} total={tasksCompletadasPeriodo.length} lim={limTerminadas} />
        </CardContent>
      </Card>

      {/* Creadas en periodo */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Creadas en periodo ({tasksCreadasPeriodo.length})</CardTitle>
          <PageSizeSelect value={limCreadas} onChange={setLimCreadas} total={tasksCreadasPeriodo.length} onPageReset={() => setPageCreadas(1)} />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tarea</TableHead>
                  <TableHead>Creada</TableHead>
                  <TableHead>Estatus</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasksCreadasPeriodo.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sin creadas en el periodo</TableCell></TableRow>}
                {paginate(tasksCreadasPeriodo, limCreadas, pageCreadas).map(t => {
                  const venc = t.due_date ? new Date(t.due_date) : null;
                  const isVenc = venc && !t.completed && venc < todayStart;
                  const statusColor = t.completed ? "bg-green-100 text-green-800" : isVenc ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800";
                  const statusText = t.completed ? "Completada" : isVenc ? "Vencida" : "Pendiente";
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium text-sm">{companyMap[t.company_id] || "—"}</TableCell>
                      <TableCell className="text-sm">{t.title}{t.description && <p className="text-xs text-muted-foreground truncate max-w-[300px]">{t.description}</p>}</TableCell>
                      <TableCell className="text-xs">{t.created_at ? format(new Date(t.created_at), "dd MMM HH:mm", { locale: es }) : "—"}</TableCell>
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
          <Paginator page={pageCreadas} setPage={setPageCreadas} total={tasksCreadasPeriodo.length} lim={limCreadas} />
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
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-end"><PageSizeSelect value={limProspectos} onChange={setLimProspectos} total={dealsEnRango.length} onPageReset={() => setPageProspectos(1)} /></CardHeader>
            <CardContent className="p-0 overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Tipo</TableHead><TableHead>Fecha</TableHead><TableHead className="text-right">Unid. equiv.</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {dealsEnRango.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Sin prospectos en el rango</TableCell></TableRow>}
              {paginate(dealsEnRango, limProspectos, pageProspectos).map(d => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium text-sm">{companyMap[d.company_id] || d.title}</TableCell>
                  <TableCell><Badge variant="outline">{d.pipeline_type === "recompra" ? "Recompra" : "1ª Compra"}</Badge></TableCell>
                  <TableCell className="text-xs">{format(new Date(d.created_at), "dd MMM yyyy", { locale: es })}</TableCell>
                  <TableCell className="text-right text-sm">{fmtNum(Number(d.potencial_unidades || 0))}</TableCell>
                  <TableCell><Button size="sm" variant="ghost" asChild><Link to={`/crm?${sellerFiltersQs}`}><ExternalLink className="h-3.5 w-3.5" /></Link></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Paginator page={pageProspectos} setPage={setPageProspectos} total={dealsEnRango.length} lim={limProspectos} />
          </CardContent></Card>
        </TabsContent>

        {[
          { key: "cotizaciones", data: cotizaciones, lim: limCotizaciones, setLim: setLimCotizaciones, page: pageCotizaciones, setPage: setPageCotizaciones },
          { key: "pedidos", data: pedidos, lim: limPedidos, setLim: setLimPedidos, page: pagePedidos, setPage: setPagePedidos },
          { key: "facturas", data: facturas, lim: limFacturas, setLim: setLimFacturas, page: pageFacturas, setPage: setPageFacturas },
        ].map(({ key, data, lim, setLim, page, setPage }) => (
          <TabsContent value={key} key={key}>
            <Card>
              <CardHeader className="pb-2 flex-row items-center justify-end"><PageSizeSelect value={lim} onChange={setLim} total={data.length} onPageReset={() => setPage(1)} /></CardHeader>
              <CardContent className="p-0 overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead>Folio</TableHead><TableHead>Cliente</TableHead><TableHead>Fecha</TableHead><TableHead>Estatus</TableHead><TableHead className="text-right">Importe</TableHead><TableHead className="text-right">Unid. equiv.</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {data.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Sin registros</TableCell></TableRow>}
                {paginate(data, lim, page).map((d: any) => (
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
            </Table>
            <Paginator page={page} setPage={setPage} total={data.length} lim={lim} />
            </CardContent></Card>
          </TabsContent>
        ))}

        <TabsContent value="cobranza">
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-end"><PageSizeSelect value={limCobranza} onChange={setLimCobranza} total={pagos.length} onPageReset={() => setPageCobranza(1)} /></CardHeader>
            <CardContent className="p-0 overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Fecha</TableHead><TableHead>Estatus</TableHead><TableHead className="text-right">Monto</TableHead><TableHead className="text-right">Aplicado</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {pagos.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Sin pagos en el rango</TableCell></TableRow>}
              {paginate(pagos, limCobranza, pageCobranza).map(p => (
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
          </Table>
          <Paginator page={pageCobranza} setPage={setPageCobranza} total={pagos.length} lim={limCobranza} />
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Facturas vencidas y por vencer — buckets como filtros */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> Facturas vencidas y por vencer
            <Badge variant="outline" className="ml-2">{facturasCobranza.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {([
              { key: "vencidas" as const, label: "Vencidas", data: facturasVencidasAll, color: "bg-red-700", border: "border-red-700" },
              { key: "1-5" as const, label: "1–5 días", data: fxv1, color: "bg-red-600", border: "border-red-600" },
              { key: "6-10" as const, label: "6–10 días", data: fxv2, color: "bg-orange-500", border: "border-orange-500" },
              { key: "11-20" as const, label: "11–20 días", data: fxv3, color: "bg-yellow-500", border: "border-yellow-500" },
              { key: "21-30" as const, label: "21–30 días", data: fxv4, color: "bg-green-600", border: "border-green-600" },
            ]).map(b => {
              const total = b.data.reduce((a, c) => a + Number(c.saldo_pendiente_cobranza || 0), 0);
              const activo = bucketActivo === b.key;
              return (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => { setBucketActivo(activo ? null : b.key); setPageCobranza(1); }}
                  className={cn(
                    "text-left rounded-lg border-2 p-3 transition-all hover:shadow-md",
                    activo ? `${b.border} bg-muted/40` : "border-border hover:border-muted-foreground/40"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{b.label}</p>
                      <p className="text-2xl font-bold">{b.data.length}</p>
                      <p className="text-xs font-semibold mt-0.5">{fmtMoney(total)}</p>
                    </div>
                    <div className={cn("h-12 w-2 rounded-full shrink-0", b.color)} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tabla unificada (filtrada por bucket activo si lo hay) */}
          {(() => {
            const filtradas = !bucketActivo ? facturasCobranza
              : bucketActivo === "vencidas" ? facturasCobranza.filter((f: any) => f.dias_vencidos > 0)
              : bucketActivo === "1-5" ? facturasCobranza.filter((f: any) => f.dias_vencidos <= -1 && f.dias_vencidos >= -5)
              : bucketActivo === "6-10" ? facturasCobranza.filter((f: any) => f.dias_vencidos <= -6 && f.dias_vencidos >= -10)
              : bucketActivo === "11-20" ? facturasCobranza.filter((f: any) => f.dias_vencidos <= -11 && f.dias_vencidos >= -20)
              : facturasCobranza.filter((f: any) => f.dias_vencidos <= -21 && f.dias_vencidos >= -30);
            const tituloFiltro = bucketActivo === "vencidas" ? "Vencidas"
              : bucketActivo ? `${bucketActivo.replace("-", "–")} días` : null;
            return (
              <div>
                <div className="flex items-center justify-between px-1 pb-2">
                  <div className="text-sm text-muted-foreground">
                    {tituloFiltro ? <>Filtro: <span className="font-semibold text-foreground">{tituloFiltro}</span> · {filtradas.length} factura(s)</> : <>Mostrando todas · {filtradas.length} factura(s)</>}
                    {bucketActivo && (
                      <Button size="sm" variant="ghost" className="ml-2 h-6 px-2 text-xs" onClick={() => { setBucketActivo(null); setPageCobranza(1); }}>Limpiar filtro</Button>
                    )}
                  </div>
                  <PageSizeSelect value={limCobranza} onChange={setLimCobranza} total={filtradas.length} onPageReset={() => setPageCobranza(1)} />
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Núm. factura</TableHead>
                        <TableHead>Fecha factura</TableHead>
                        <TableHead>Fecha venc.</TableHead>
                        <TableHead className="text-right">Días vencidos</TableHead>
                        <TableHead className="text-right">Total factura</TableHead>
                        <TableHead className="text-right">Saldo pendiente</TableHead>
                        <TableHead>Ejecutivo</TableHead>
                        <TableHead>Estatus</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtradas.length === 0 && (
                        <TableRow><TableCell colSpan={10} className="text-center py-6 text-muted-foreground">Sin facturas en este filtro</TableCell></TableRow>
                      )}
                      {paginate(filtradas, limCobranza, pageCobranza).map((f: any) => {
                        const dias = f.dias_vencidos as number;
                        const phone = (companyPhoneMap[f.empresa_id]?.phone || "").replace(/[^0-9]/g, "");
                        const ejId = f.ejecutivo_venta_id || f.created_by;
                        const ejNombre = ejId ? (ejecutivoMap[ejId] || "—") : "—";
                        const num = f.numero_factura || f.id.slice(0, 8);
                        const saldoFmt = fmtMoney(Number(f.saldo_pendiente_cobranza || 0));
                        const diasLabel = dias > 0 ? `Vencida hace ${dias} día${dias === 1 ? "" : "s"}`
                          : dias === 0 ? "Vence hoy"
                          : `Vence en ${Math.abs(dias)} día${Math.abs(dias) === 1 ? "" : "s"}`;
                        const msg = dias > 0
                          ? `Hola, buen día. Le compartimos un recordatorio: la factura ${num} por ${saldoFmt} se encuentra vencida desde hace ${dias} día(s). Agradecemos su apoyo para regularizar el pago a la brevedad. Quedamos atentos.`
                          : dias === 0
                          ? `Hola, buen día. Le recordamos que la factura ${num} por ${saldoFmt} vence hoy. Agradecemos su apoyo para programar el pago. Quedamos atentos.`
                          : `Hola, buen día. Le recordamos que la factura ${num} por ${saldoFmt} vence en ${Math.abs(dias)} día(s). Agradecemos su apoyo para programar el pago. Quedamos atentos.`;
                        const waUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : null;
                        const estatus = dias > 0 ? "Vencida" : dias === 0 ? "Vence hoy" : "Por vencer";
                        const estatusColor = dias > 0
                          ? "bg-red-100 text-red-800 border-red-300"
                          : dias === 0
                          ? "bg-orange-100 text-orange-800 border-orange-300"
                          : "bg-amber-50 text-amber-800 border-amber-200";
                        const diasColor = dias > 0 ? "text-red-700 font-bold" : dias === 0 ? "text-orange-700 font-bold" : "text-muted-foreground";
                        return (
                          <TableRow key={f.id} title={diasLabel}>
                            <TableCell className="text-sm font-medium">{companyMap[f.empresa_id] || "—"}</TableCell>
                            <TableCell className="font-mono text-xs">{num}</TableCell>
                            <TableCell className="text-xs">{f.fecha_documento || "—"}</TableCell>
                            <TableCell className="text-xs">{f.fecha_vencimiento || "—"}</TableCell>
                            <TableCell className={cn("text-right text-sm", diasColor)}>{dias}</TableCell>
                            <TableCell className="text-right text-sm">{fmtMoney(Number(f.total))}</TableCell>
                            <TableCell className="text-right text-sm font-semibold">{saldoFmt}</TableCell>
                            <TableCell className="text-xs">{ejNombre}</TableCell>
                            <TableCell><Badge variant="outline" className={cn("text-xs", estatusColor)}>{estatus}</Badge></TableCell>
                            <TableCell className="text-right space-x-1 whitespace-nowrap">
                              <Button size="sm" variant="ghost" asChild title="Abrir factura">
                                <Link to={`/documents/${f.id}`}><ExternalLink className="h-3.5 w-3.5" /></Link>
                              </Button>
                              {waUrl ? (
                                <Button size="sm" variant="ghost" asChild title="Enviar WhatsApp">
                                  <a href={waUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-3.5 w-3.5 text-green-600" /></a>
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost" disabled title="Sin WhatsApp"><MessageCircle className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <Paginator page={pageCobranza} setPage={setPageCobranza} total={filtradas.length} lim={limCobranza} />
              </div>
            );
          })()}
        </CardContent>
      </Card>

    </div>
  );
}