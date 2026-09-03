import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { format, startOfDay, endOfDay, parseISO, addDays, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, CheckCircle2, Clock, AlertCircle, FileText, ShoppingCart, Receipt, Wallet, UserPlus, RefreshCw, Plus, Download, ExternalLink, Target, AlertTriangle, CalendarClock, MessageCircle, Mail, Users, Activity, TrendingUp, ListChecks, Package, Pencil, ArrowUp, ArrowDown, ArrowUpDown, MoreHorizontal, Search, Layers, List, CornerDownRight, ChevronRight, ChevronDown, BookOpen } from "lucide-react";
import { CobranzaComunicacionDialog } from "@/components/cobranza/CobranzaComunicacionDialog";
import { supabase as _supabaseTyped } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _supabaseTyped;
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CrmTaskDetailDialog } from "@/components/crm/CrmTaskDetailDialog";
import { CrmActivityDetailDialog } from "@/components/crm/CrmActivityDetailDialog";
import type { CrmTask } from "@/hooks/useCrmTasks";
import { ACTIVITY_TYPE_CONFIG } from "@/hooks/useCrmActivities";
import { Copy } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const fmtMoney = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n || 0);
const fmtNum = (n: number) => new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(n || 0);

type Profile = { user_id: string; full_name: string | null };
type Plaza = { id: string; nombre: string };
type Team = { id: string; name: string; user_ids: string[] };

export default function SellerPortal() {
  const { user, profile, hasAnyRole } = useAuth();
  const isManager = hasAnyRole(["admin", "manager"]);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sp = (k: string) => searchParams.get(k);
  const initFrom = sp("from") ? startOfDay(parseISO(sp("from")!)) : startOfDay(new Date());
  const initTo = sp("to") ? endOfDay(parseISO(sp("to")!)) : endOfDay(new Date());
  const [from, setFrom] = useState<Date>(initFrom);
  const [to, setTo] = useState<Date>(initTo);
  const [ejecutivoId, setEjecutivoId] = useState<string>(sp("ejecutivo") || user?.id || "");
  const [teamId, setTeamId] = useState<string>(sp("equipo") || "all");
  const [plazaId, setPlazaId] = useState<string>(sp("plaza") || "all");
  // Marcas independientes (toggles). Si ninguna está activa, se asume ambas.
  const [marcaChevron, setMarcaChevron] = useState<boolean>(sp("chevron") ? sp("chevron") === "1" : true);
  const [marcaPhillips, setMarcaPhillips] = useState<boolean>(sp("phillips") ? sp("phillips") === "1" : true);

  const [ejecutivos, setEjecutivos] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [plazas, setPlazas] = useState<Plaza[]>([]);
  const [loading, setLoading] = useState(false);

  const [tasks, setTasks] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);
  const [facturasPorVencer, setFacturasPorVencer] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<CrmTask | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [facturasVencidasAll, setFacturasVencidasAll] = useState<any[]>([]);
  const [actividades, setActividades] = useState<any[]>([]);
  const [companyMap, setCompanyMap] = useState<Record<string, string>>({});
  const [companyPhoneMap, setCompanyPhoneMap] = useState<Record<string, { phone: string | null; name: string }>>({});
  const [ejecutivoMap, setEjecutivoMap] = useState<Record<string, string>>({});
  const [cobradoDeVencido, setCobradoDeVencido] = useState<number>(0);
  const [seguimientoRows, setSeguimientoRows] = useState<any[]>([]);
  const [estatusCatalogo, setEstatusCatalogo] = useState<any[]>([]);
  const [verTodosSeguimiento, setVerTodosSeguimiento] = useState(false);
  const [convertidosPeriodo, setConvertidosPeriodo] = useState<number>(0);
  const [bucketActivo, setBucketActivo] = useState<"vencidas" | "1-5" | "6-10" | "11-20" | "21-30" | null>(null);

  // Dialog de comunicación de cobranza
  const [cobranzaFactura, setCobranzaFactura] = useState<any | null>(null);
  const [cobranzaTab, setCobranzaTab] = useState<"whatsapp" | "email">("whatsapp");
  const [cobranzaOpen, setCobranzaOpen] = useState(false);

  // Límites de visualización + paginación por lista (10 / 25 / 50 / "all")
  type PageLimit = "10" | "25" | "50" | "all";
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [limCreadas, setLimCreadas] = useState<PageLimit>("10");
  const [pageCreadas, setPageCreadas] = useState(1);
  const [sortCreadas, setSortCreadas] = useState<{ col: "cliente" | "tarea" | "categoria" | "tipo" | "creada" | "estatus"; dir: "asc" | "desc" }>({ col: "creada", dir: "desc" });
  const [statusCreadas, setStatusCreadas] = useState<"all" | "Pendiente" | "Vencida" | "Completada">("all");
  const [searchCreadas, setSearchCreadas] = useState("");
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
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

  // Querystring para preservar filtros al navegar a /crm y volver
  const sellerFiltersQs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("from-page", "seller-portal");
    p.set("from", format(from, "yyyy-MM-dd"));
    p.set("to", format(to, "yyyy-MM-dd"));
    if (ejecutivoId) p.set("ejecutivo", ejecutivoId);
    if (teamId && teamId !== "all") p.set("equipo", teamId);
    if (plazaId) p.set("plaza", plazaId);
    p.set("chevron", marcaChevron ? "1" : "0");
    p.set("phillips", marcaPhillips ? "1" : "0");
    return p.toString();
  }, [from, to, ejecutivoId, teamId, plazaId, marcaChevron, marcaPhillips]);

  // Catálogo de estatus de seguimiento (no depende de filtros)
  useEffect(() => {
    supabase
      .from("seguimiento_estatus_catalogo")
      .select("id, nombre, color, ambito, familia, orden")
      .then(({ data }) => setEstatusCatalogo((data || []) as any[]));
  }, []);

  // Load filter options

  useEffect(() => {
    if (!user) return;
    if (isManager) {
      supabase.from("profiles").select("user_id, full_name").eq("is_active", true).order("full_name").then(({ data }) => {
        setEjecutivos((data || []).sort((a: any, b: any) => (a.full_name || "").localeCompare(b.full_name || "", "es")) as any);
      });
      // Cargar equipos + miembros (sólo gerentes/admins)
      (async () => {
        const { data: ts } = await supabase.from("teams").select("id, name").eq("is_active", true).order("name");
        const tIds = (ts || []).map((t: any) => t.id);
        const memMap: Record<string, string[]> = {};
        if (tIds.length) {
          const { data: mems } = await supabase.from("team_members").select("team_id, user_id").in("team_id", tIds);
          (mems || []).forEach((m: any) => {
            (memMap[m.team_id] ||= []).push(m.user_id);
          });
        }
        setTeams((ts || []).map((t: any) => ({ id: t.id, name: t.name, user_ids: memMap[t.id] || [] })));
      })();
    } else {
      setEjecutivos([{ user_id: user.id, full_name: profile?.full_name || "Yo" }]);
      setEjecutivoId(user.id);
    }
    supabase.from("plazas").select("id, nombre").eq("is_active", true).order("nombre").then(({ data }) => {
      setPlazas((data || []).sort((a: any, b: any) => (a.nombre || "").localeCompare(b.nombre || "", "es")) as any);
    });
  }, [user, isManager, profile]);

  // Lista de user_ids efectivos según ejecutivo + equipo. null = sin filtro (Todos).
  const filterUserIds = useMemo<string[] | null>(() => {
    if (teamId && teamId !== "all") {
      const t = teams.find((x) => x.id === teamId);
      return t ? t.user_ids : [];
    }
    if (!ejecutivoId || ejecutivoId === "all") return null;
    return [ejecutivoId];
  }, [teamId, teams, ejecutivoId]);

  const fetchData = async () => {
    if (!ejecutivoId && (!teamId || teamId === "all")) return;
    // Si seleccionaron equipo pero los miembros aún no cargan, esperar
    if (teamId !== "all" && filterUserIds === null) return;
    setLoading(true);
    try {
      // Periodo inclusivo: [fromDate, toDateExclusive)
      const fromDate = format(startOfDay(from), "yyyy-MM-dd");
      const toDate = format(startOfDay(from > to ? from : to), "yyyy-MM-dd"); // safety
      const toExclusive = format(addDays(startOfDay(to), 1), "yyyy-MM-dd");
      const fromIso = startOfDay(from).toISOString();
      const toIso = endOfDay(to).toISOString();
      const todayIso = format(new Date(), "yyyy-MM-dd");

      const uIds = filterUserIds; // null = sin filtro, [] = ninguno, [...] = filtrar
      const inList = uIds && uIds.length ? `(${uIds.join(",")})` : null;
      // helper: si hay equipo vacío, no devolver nada
      if (uIds && uIds.length === 0) {
        setTasks([]); setDocs([]); setPagos([]);
        setFacturasPorVencer([]); setFacturasVencidasAll([]); setActividades([]);
        setCompanyMap({}); setCompanyPhoneMap({}); setEjecutivoMap({});
        setCobradoDeVencido(0);
        setSeguimientoRows([]);
        setConvertidosPeriodo(0);
        setLoading(false);
        return;
      }

      // Empresas asignadas al(los) ejecutivo(s) seleccionados (company_ejecutivos).
      // Se usa para filtrar facturas vencidas/por vencer por EMPRESA (no por ejecutivo de la factura),
      // de modo que el vendedor vea todas las facturas de sus clientes aunque la factura
      // específica esté a nombre de otro ejecutivo.
      let empresaIdsAsignadas: string[] | null = null;
      if (uIds) {
        const [ceRes, docsCompRes] = await Promise.all([
          supabase.from("company_ejecutivos").select("company_id").in("user_id", uIds),
          supabase
            .from("documentos")
            .select("empresa_id")
            .eq("is_active", true)
            .or(`ejecutivo_venta_id.in.(${uIds.join(",")}),created_by.in.(${uIds.join(",")})`)
            .limit(10000),
        ]);
        const set = new Set<string>();
        (ceRes.data || []).forEach((r: any) => { if (r.company_id) set.add(r.company_id); });
        (docsCompRes.data || []).forEach((r: any) => { if (r.empresa_id) set.add(r.empresa_id); });
        empresaIdsAsignadas = Array.from(set);
      }
      const empresasInList = empresaIdsAsignadas && empresaIdsAsignadas.length
        ? `(${empresaIdsAsignadas.join(",")})`
        : null;

      // Tasks: traemos del ejecutivo (sin filtro de fecha porque necesitamos vencidas + creadas + completadas en periodo)
      let tq = supabase.from("crm_tasks").select("id, title, due_date, completed, completed_at, priority, company_id, contact_id, description, user_id, created_at, updated_at, task_type, parent_category, parent_task_id, sequence_order").order("due_date", { ascending: true, nullsFirst: false }).limit(500);
      if (uIds) tq = tq.in("user_id", uIds);
      const { data: tasksData } = await tq;

      const dealsData: any[] = [];

      // Documentos en rango (cot/ped/fact). Periodo inclusivo [from, to+1).
      let docQ = supabase.from("documentos").select("id, tipo_documento, fecha_documento, fecha_vencimiento, total, unidades_equivalentes_total, estatus_cotizacion, estatus_pedido, estatus_factura, empresa_id, plaza_id, ejecutivo_venta_id, created_by, numero_cotizacion, numero_pedido, numero_factura, saldo_pendiente_cobranza, estado_cobranza, empresa_vendedora, created_at").gte("fecha_documento", fromDate).lt("fecha_documento", toExclusive).eq("is_active", true).in("empresa_vendedora", marcasSeleccionadas as any).limit(2000);
      if (inList) docQ = docQ.or(`ejecutivo_venta_id.in.${inList},created_by.in.${inList}`);
      if (plazaId !== "all") docQ = docQ.eq("plaza_id", plazaId);
      const { data: docsData } = await docQ;

      // Pagos cobrados en rango (periodo inclusivo [from, to+1))
      let pq = supabase.from("cobranza_pagos").select("id, fecha_pago, monto_total, monto_aplicado, empresa_id, plaza_id, creado_por, estatus_pago, created_at").gte("fecha_pago", fromDate).lt("fecha_pago", toExclusive).limit(1000);
      if (uIds) pq = pq.in("creado_por", uIds);
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
        .limit(2000);
      if (inList) fpvQ = fpvQ.or(`ejecutivo_venta_id.in.${inList},created_by.in.${inList}`);
      if (plazaId !== "all") fpvQ = fpvQ.eq("plaza_id", plazaId);
      // Ampliar: incluir también facturas de empresas asignadas al ejecutivo.
      if (empresaIdsAsignadas !== null) {
        // Reemplazamos filtro: facturas mías OR de empresas asignadas a mí
        fpvQ = supabase
          .from("documentos")
          .select("id, fecha_documento, fecha_vencimiento, total, saldo_pendiente_cobranza, empresa_id, empresa_vendedora, numero_factura, estado_cobranza, estatus_factura, ejecutivo_venta_id, created_by")
          .eq("tipo_documento", "factura")
          .eq("is_active", true)
          .neq("estatus_factura", "cancelada")
          .gt("fecha_vencimiento", todayIso)
          .lte("fecha_vencimiento", in30Iso)
          .in("empresa_vendedora", marcasSeleccionadas as any)
          .limit(2000);
        if (plazaId !== "all") fpvQ = fpvQ.eq("plaza_id", plazaId);
        const orParts: string[] = [];
        if (inList) orParts.push(`ejecutivo_venta_id.in.${inList}`, `created_by.in.${inList}`);
        if (empresasInList) orParts.push(`empresa_id.in.${empresasInList}`);
        if (orParts.length) fpvQ = fpvQ.or(orParts.join(","));
        else { fpvQ = fpvQ.eq("id", "00000000-0000-0000-0000-000000000000"); }
      }
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

      // Facturas vencidas: fuente única de verdad = estatus_factura = 'vencida'.
      // Los días vencidos se calculan a partir de fecha_vencimiento del documento.
      let venQ = supabase.from("documentos")
        .select("id, fecha_documento, fecha_vencimiento, total, saldo_pendiente_cobranza, empresa_id, empresa_vendedora, numero_factura, estado_cobranza, estatus_factura, ejecutivo_venta_id, created_by")
        .eq("tipo_documento", "factura")
        .eq("is_active", true)
        .eq("estatus_factura", "vencida")
        .in("empresa_vendedora", marcasSeleccionadas as any)
        .limit(2000);
      if (inList) venQ = venQ.or(`ejecutivo_venta_id.in.${inList},created_by.in.${inList}`);
      if (plazaId !== "all") venQ = venQ.eq("plaza_id", plazaId);
      if (empresaIdsAsignadas !== null) {
        venQ = supabase.from("documentos")
          .select("id, fecha_documento, fecha_vencimiento, total, saldo_pendiente_cobranza, empresa_id, empresa_vendedora, numero_factura, estado_cobranza, estatus_factura, ejecutivo_venta_id, created_by")
          .eq("tipo_documento", "factura")
          .eq("is_active", true)
          .eq("estatus_factura", "vencida")
          .in("empresa_vendedora", marcasSeleccionadas as any)
          .limit(2000);
        if (plazaId !== "all") venQ = venQ.eq("plaza_id", plazaId);
        const orParts: string[] = [];
        if (inList) orParts.push(`ejecutivo_venta_id.in.${inList}`, `created_by.in.${inList}`);
        if (empresasInList) orParts.push(`empresa_id.in.${empresasInList}`);
        if (orParts.length) venQ = venQ.or(orParts.join(","));
        else { venQ = venQ.eq("id", "00000000-0000-0000-0000-000000000000"); }
      }
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

      // Cobrado de vencido (en periodo): aplicaciones activas ligadas a facturas vencidas (fecha_vencimiento < hoy,
      // factura no cancelada) cuyo pago cayó dentro del periodo y fue creado por el ejecutivo.
      let cobradoVenc = 0;
      try {
        // Universo de facturas vencidas (a hoy) del ejecutivo + filtros — reutilizamos la query base.
        let venTodayQ = supabase.from("documentos")
          .select("id")
          .eq("tipo_documento", "factura")
          .eq("is_active", true)
          .neq("estatus_factura", "cancelada")
          .lt("fecha_vencimiento", todayIso)
          .in("empresa_vendedora", marcasSeleccionadas as any)
          .limit(5000);
        if (inList) venTodayQ = venTodayQ.or(`ejecutivo_venta_id.in.${inList},created_by.in.${inList}`);
        if (plazaId !== "all") venTodayQ = venTodayQ.eq("plaza_id", plazaId);
        const { data: venTodayDocs } = await venTodayQ;
        const venTodayIds = (venTodayDocs || []).map((d: any) => d.id);
        const pagosPeriodoIds = (pagosData || []).map((p: any) => p.id);
        if (venTodayIds.length && pagosPeriodoIds.length) {
          // Chunk in case lists are large
          const chunk = <T,>(arr: T[], size: number) => {
            const out: T[][] = []; for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size)); return out;
          };
          for (const docChunk of chunk(venTodayIds, 200)) {
            for (const pagChunk of chunk(pagosPeriodoIds, 200)) {
              const { data: aplics } = await supabase
                .from("cobranza_aplicaciones")
                .select("monto_aplicado, estatus_aplicacion, documento_id, pago_id")
                .in("documento_id", docChunk)
                .in("pago_id", pagChunk)
                .eq("estatus_aplicacion", "activa");
              (aplics || []).forEach((a: any) => { cobradoVenc += Number(a.monto_aplicado || 0); });
            }
          }
        }
      } catch (err) {
        console.warn("[CobradoDeVencido] error", err);
      }
      setCobradoDeVencido(cobradoVenc);

      // Actividades CRM creadas/realizadas en el periodo (por ejecutivo)
      let actQ = supabase
        .from("crm_activities")
        .select("id, type, activity_date, created_at, user_id, company_id")
        .gte("activity_date", fromIso)
        .lte("activity_date", toIso)
        .limit(2000);
      if (uIds) actQ = actQ.in("user_id", uIds);
      const { data: actData } = await actQ;

      // Company names
      const ids = new Set<string>();
      (tasksData || []).forEach((t: any) => t.company_id && ids.add(t.company_id));
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
      setDocs(docsData || []);
      setPagos(pagosData || []);
      setFacturasPorVencer(fpvData || []);
      setFacturasVencidasAll(venData || []);
      setActividades(actData || []);
      setCompanyMap(cmap);
      setCompanyPhoneMap(cphone);
      setEjecutivoMap(emap);

      // Seguimiento de ventas (empresas registradas / con-sin venta / activas)
      try {
        let sgQ = supabase
          .from("seguimiento_ventas")
          .select("id, company_id, tiene_venta, perdido, fecha_perdida, owner_id, empresa_vendedora, dias_ultima_compra, promedio_historico_mensual, acum_mes, acum_mes_anterior, ritmo_pct, cotizaciones_total, dias_ultima_cotizacion, dias_ultima_actividad, estatus_riesgo_id, estatus_ritmo_id, estatus_gestion_id, companies:company_id(id, created_at)")
          .in("empresa_vendedora", marcasSeleccionadas as any)
          .limit(20000);
        if (uIds) sgQ = sgQ.in("owner_id", uIds);
        const { data: sgData } = await sgQ;
        setSeguimientoRows(sgData || []);
      } catch (err) {
        console.warn("[Seguimiento] error", err);
        setSeguimientoRows([]);
      }

      // Convertidos en periodo: empresas con su PRIMERA factura cayendo dentro del rango
      try {
        const empresasFactPeriodo = Array.from(new Set(
          (docsData || [])
            .filter((d: any) => d.tipo_documento === "factura" && d.estatus_factura !== "cancelada")
            .map((d: any) => d.empresa_id)
            .filter(Boolean)
        ));
        if (empresasFactPeriodo.length === 0) {
          setConvertidosPeriodo(0);
        } else {
          const { data: prevFacts } = await supabase
            .from("documentos")
            .select("empresa_id")
            .eq("tipo_documento", "factura")
            .eq("is_active", true)
            .neq("estatus_factura", "cancelada")
            .in("empresa_id", empresasFactPeriodo)
            .lt("fecha_documento", fromDate)
            .limit(20000);
          const conPrevia = new Set((prevFacts || []).map((d: any) => d.empresa_id));
          const convertidos = empresasFactPeriodo.filter((cid) => !conPrevia.has(cid)).length;
          setConvertidosPeriodo(convertidos);
        }
      } catch (err) {
        console.warn("[Convertidos] error", err);
        setConvertidosPeriodo(0);
      }
    } catch (e: any) {
      toast.error("Error cargando datos: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [ejecutivoId, teamId, filterUserIds, from, to, plazaId, marcaChevron, marcaPhillips]);

  // Métricas
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const fromTs = startOfDay(from).getTime();
  const toTs = endOfDay(to).getTime();

  // Tareas vencidas: fecha_vencimiento <= fecha_fin (to) y no completadas
  const tasksVencidas = tasks.filter(t => !t.completed && t.due_date && new Date(t.due_date).getTime() <= toTs && new Date(t.due_date) < todayStart);
  // Tareas completadas en periodo: usar completed_at; fallback a updated_at solo si completed_at no existe (datos viejos previos al backfill).
  const tasksCompletadasPeriodo = tasks.filter(t => {
    if (!t.completed) return false;
    const ts = t.completed_at ? new Date(t.completed_at).getTime() : (t.updated_at ? new Date(t.updated_at).getTime() : null);
    return ts !== null && ts >= fromTs && ts <= toTs;
  });
  // Tareas creadas en periodo
  const tasksCreadasPeriodo = tasks.filter(t => t.created_at && new Date(t.created_at).getTime() >= fromTs && new Date(t.created_at).getTime() <= toTs);
  const tasksHoyPendientes = tasks.filter(t => !t.completed && t.due_date && new Date(t.due_date) >= todayStart && new Date(t.due_date) <= todayEnd);
  const misTareasHoy = [...tasksVencidas, ...tasksHoyPendientes, ...tasksCompletadasPeriodo].slice(0, 50);

  const dealsEnRango: any[] = [];

  const cotizaciones = docs.filter(d => d.tipo_documento === "cotizacion");
  const pedidos = docs.filter(d => d.tipo_documento === "pedido");
  const facturas = docs.filter(d => d.tipo_documento === "factura" && d.estatus_factura !== "cancelada");

  const sum = (arr: any[], key: string) => arr.reduce((a, b) => a + Number(b[key] || 0), 0);

  const totalFacturado = sum(facturas, "total");
  const unidadesFacturadas = sum(facturas, "unidades_equivalentes_total");
  // Total cobrado: usar monto_aplicado si existe (>0), sino monto_total. Evita sobreconteo cuando un pago se aplica parcialmente.
  const totalCobrado = pagos.reduce((acc, p: any) => {
    const aplicado = Number(p.monto_aplicado || 0);
    return acc + (aplicado > 0 ? aplicado : Number(p.monto_total || 0));
  }, 0);
  // Saldo pendiente: calcular real desde aplicaciones activas. No depender de documentos.saldo_pendiente_cobranza.
  // facturasPorVencer y facturasVencidasAll ya traen saldo recalculado; los saldos del periodo (facturas en filtro) los recalculamos abajo en cobradoVencidoState.
  const saldoPendiente = facturas.reduce((acc, f: any) => {
    // Para facturas dentro del periodo filtrado: usar saldo del documento, pero si la lista de cobranza recalculó algo distinto, preferir el cálculo.
    // Como los pagos del periodo ya están en `pagos`, si el doc figura en facturasVencidasAll/facturasPorVencer usamos esa lectura saneada.
    const recal = [...facturasVencidasAll, ...facturasPorVencer].find((x: any) => x.id === f.id);
    if (recal) return acc + Number(recal.saldo_pendiente_cobranza || 0);
    return acc + Number(f.saldo_pendiente_cobranza || 0);
  }, 0);

  // Cobranza vencida
  const clientesConSaldoVencido = new Set(facturasVencidasAll.map(f => f.empresa_id)).size;
  const saldoVencidoTotal = sum(facturasVencidasAll, "saldo_pendiente_cobranza");
  // Cobrado de vencido (en periodo): se calcula por separado vía aplicaciones ligadas a facturas vencidas. Ver cobradoDeVencido state.

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

  // KPIs adicionales
  // Clientes únicos con factura (no cancelada) en el periodo filtrado
  const clientesConCompra = new Set(
    facturas.map((f: any) => f.empresa_id).filter(Boolean)
  ).size;
  const ticketPromedio = facturas.length > 0 ? totalFacturado / facturas.length : 0;
  const unidadesPromedioCliente = clientesConCompra > 0 ? unidadesFacturadas / clientesConCompra : 0;


  // ===== Nuevos KPIs basados en seguimiento_ventas =====
  // Distintas por company_id (una empresa puede tener seguimiento por marca; deduplicamos para "empresas registradas")
  const seguimientoByCompany = useMemo(() => {
    const m = new Map<string, any>();
    for (const s of seguimientoRows) {
      if (!s.company_id) continue;
      const prev = m.get(s.company_id);
      // Si alguna fila tiene venta y no perdida, esa gana
      if (!prev) m.set(s.company_id, s);
      else {
        const prevActivo = prev.tiene_venta && !prev.perdido;
        const curActivo = s.tiene_venta && !s.perdido;
        if (curActivo && !prevActivo) m.set(s.company_id, s);
        else if (s.tiene_venta && !prev.tiene_venta) m.set(s.company_id, s);
      }
    }
    return m;
  }, [seguimientoRows]);
  const empresasRegistradasTotal = seguimientoByCompany.size;

  // Mapa de estatus del catálogo: id -> { nombre, color, orden }
  const estatusMap = useMemo(() => {
    const m = new Map<string, { nombre: string; color: string; orden: number }>();
    for (const e of estatusCatalogo) {
      m.set(e.id, { nombre: e.nombre, color: e.color, orden: Number(e.orden ?? 0) });
    }
    return m;
  }, [estatusCatalogo]);

  // Prospectos nuevos contactados: empresas sin venta cuya PRIMERA actividad/tarea cae en el rango
  const prospectosContactadosPeriodo = useMemo(() => {
    const first = new Map<string, number>();
    const push = (cid: string | null, created: string | null) => {
      if (!cid || !created) return;
      const t = new Date(created).getTime();
      if (Number.isNaN(t)) return;
      const prev = first.get(cid);
      if (prev === undefined || t < prev) first.set(cid, t);
    };
    (actividades || []).forEach((a: any) => push(a.company_id, a.created_at));
    (tasks || []).forEach((t: any) => push(t.company_id, t.created_at));
    let n = 0;
    first.forEach((t, cid) => {
      const sg = seguimientoByCompany.get(cid);
      if (!sg || sg.tiene_venta) return;
      if (t >= fromTs && t <= toTs) n += 1;
    });
    return n;
  }, [actividades, tasks, seguimientoByCompany, fromTs, toTs]);

  // Meta del mes (clientes con venta)
  const metaMes = useMemo(() => {
    let meta = 0;
    let avance = 0;
    seguimientoByCompany.forEach((s) => {
      if (!s.tiene_venta) return;
      meta += Number(s.promedio_historico_mensual || 0);
      avance += Number(s.acum_mes || 0);
    });
    return { meta, avance, pct: meta > 0 ? Math.min(100, (avance / meta) * 100) : 0 };
  }, [seguimientoByCompany]);

  // Seguimiento a clientes actuales (ordenado por mayor riesgo)
  const clientesActualesSeguimiento = useMemo(() => {
    const rows: any[] = [];
    seguimientoByCompany.forEach((s, cid) => {
      if (!s.tiene_venta) return;
      rows.push({ ...s, company_id: cid });
    });
    return rows.sort((a, b) => {
      const oa = a.estatus_riesgo_id ? (estatusMap.get(a.estatus_riesgo_id)?.orden ?? 999) : 999;
      const ob = b.estatus_riesgo_id ? (estatusMap.get(b.estatus_riesgo_id)?.orden ?? 999) : 999;
      if (oa !== ob) return ob - oa;
      return Number(b.dias_ultima_compra || 0) - Number(a.dias_ultima_compra || 0);
    });
  }, [seguimientoByCompany, estatusMap]);
  const empresasRegistradasPeriodo = useMemo(() => {
    let n = 0;
    seguimientoByCompany.forEach((s) => {
      const ca = s.companies?.created_at;
      if (!ca) return;
      const t = new Date(ca).getTime();
      if (t >= fromTs && t <= toTs) n += 1;
    });
    return n;
  }, [seguimientoByCompany, fromTs, toTs]);
  const empresasSinVenta = useMemo(() => {
    let n = 0;
    seguimientoByCompany.forEach((s) => { if (!s.tiene_venta) n += 1; });
    return n;
  }, [seguimientoByCompany]);
  const empresasConVenta = empresasRegistradasTotal - empresasSinVenta;
  const clientesConVentaActivos = useMemo(() => {
    let n = 0;
    seguimientoByCompany.forEach((s) => { if (s.tiene_venta && !s.perdido) n += 1; });
    return n;
  }, [seguimientoByCompany]);

  // Empresas sin/con venta creadas en el periodo
  const empresasSinVentaPeriodo = useMemo(() => {
    let n = 0;
    seguimientoByCompany.forEach((s) => {
      if (s.tiene_venta) return;
      const ca = s.companies?.created_at;
      if (!ca) return;
      const t = new Date(ca).getTime();
      if (t >= fromTs && t <= toTs) n += 1;
    });
    return n;
  }, [seguimientoByCompany, fromTs, toTs]);
  const empresasConVentaPeriodo = useMemo(() => {
    let n = 0;
    seguimientoByCompany.forEach((s) => {
      if (!s.tiene_venta) return;
      const ca = s.companies?.created_at;
      if (!ca) return;
      const t = new Date(ca).getTime();
      if (t >= fromTs && t <= toTs) n += 1;
    });
    return n;
  }, [seguimientoByCompany, fromTs, toTs]);

  // Clientes perdidos (total y en periodo según fecha_perdida)
  const empresasPerdidasTotal = useMemo(() => {
    let n = 0;
    seguimientoByCompany.forEach((s) => { if (s.perdido) n += 1; });
    return n;
  }, [seguimientoByCompany]);
  const empresasPerdidasPeriodo = useMemo(() => {
    let n = 0;
    seguimientoByCompany.forEach((s) => {
      if (!s.perdido) return;
      const fp = s.fecha_perdida;
      if (!fp) return;
      const t = new Date(fp).getTime();
      if (t >= fromTs && t <= toTs) n += 1;
    });
    return n;
  }, [seguimientoByCompany, fromTs, toTs]);

  // Conversión por segmento de Seguimiento a Ventas (sin venta / con venta activos)
  const companiesSinVentaSet = useMemo(() => {
    const s = new Set<string>();
    seguimientoByCompany.forEach((r, cid) => { if (!r.tiene_venta) s.add(cid); });
    return s;
  }, [seguimientoByCompany]);
  const companiesConVentaActivasSet = useMemo(() => {
    const s = new Set<string>();
    seguimientoByCompany.forEach((r, cid) => { if (r.tiene_venta && !r.perdido) s.add(cid); });
    return s;
  }, [seguimientoByCompany]);

  const buildConvFromCompanies = (companyIds: Set<string>) => {
    const docsDe = (tipo: string) =>
      docs.filter((d: any) =>
        d.tipo_documento === tipo &&
        (tipo !== "factura" || d.estatus_factura !== "cancelada") &&
        companyIds.has(d.empresa_id)
      );
    const distinct = (rows: any[]) =>
      new Set(rows.map((r: any) => r.empresa_id).filter(Boolean)).size;
    const cotDocs = docsDe("cotizacion");
    const pedDocs = docsDe("pedido");
    const facDocs = docsDe("factura");
    return {
      activos: companyIds.size,
      cotizados: distinct(cotDocs),
      pedidos: distinct(pedDocs),
      facturados: distinct(facDocs),
      uCot: cotDocs.reduce((a: number, b: any) => a + Number(b.unidades_equivalentes_total || 0), 0),
      uPed: pedDocs.reduce((a: number, b: any) => a + Number(b.unidades_equivalentes_total || 0), 0),
      uFac: facDocs.reduce((a: number, b: any) => a + Number(b.unidades_equivalentes_total || 0), 0),
    };
  };
  const convSinVenta = buildConvFromCompanies(companiesSinVentaSet);
  const convConVenta = buildConvFromCompanies(companiesConVentaActivasSet);

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
            {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
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

  const PaginatorBar = ({ page, setPage, total, lim, setLim }: { page: number; setPage: (n: number) => void; total: number; lim: PageLimit; setLim: (v: PageLimit) => void }) => {
    const pages = lim === "all" ? 1 : totalPages(total, lim);
    const showPager = lim !== "all" && total > 0 && pages > 1;
    return (
      <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-muted-foreground gap-2 flex-wrap">
        <PageSizeSelect value={lim} onChange={setLim} total={total} onPageReset={() => setPage(1)} />
        {showPager ? (
          <div className="flex items-center gap-2">
            <span>Página {page} de {pages}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="h-7" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
              <Button size="sm" variant="outline" className="h-7" disabled={page >= pages} onClick={() => setPage(page + 1)}>Siguiente</Button>
            </div>
          </div>
        ) : <span />}
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
            <Button size="sm" variant="outline" asChild><Link to="/seller-portal/guias-de-venta"><BookOpen className="h-3.5 w-3.5" /> Guías de Venta</Link></Button>
            <Button size="sm" variant="outline" asChild><Link to="/activities"><Plus className="h-3.5 w-3.5" /> Tarea</Link></Button>
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
            {(() => {
              const presets = [
                { key: "ayer", label: "Ayer", apply: () => { const d = subDays(new Date(), 1); setFrom(startOfDay(d)); setTo(endOfDay(d)); } },
                { key: "hoy", label: "Hoy", apply: () => { setFrom(startOfDay(new Date())); setTo(endOfDay(new Date())); } },
                { key: "7d", label: "7 días", apply: () => { const d = new Date(); d.setDate(d.getDate() - 7); setFrom(startOfDay(d)); setTo(endOfDay(new Date())); } },
                { key: "mes", label: "Mes", apply: () => { const d = new Date(); d.setDate(1); setFrom(startOfDay(d)); setTo(endOfDay(new Date())); } },
              ];
              const matchRange = (a: Date, b: Date) => from.getTime() === a.getTime() && to.getTime() === b.getTime();
              const today = new Date();
              const ranges: Record<string, [Date, Date]> = {
                ayer: [startOfDay(subDays(today, 1)), endOfDay(subDays(today, 1))],
                hoy: [startOfDay(today), endOfDay(today)],
                "7d": [startOfDay((() => { const d = new Date(); d.setDate(d.getDate() - 7); return d; })()), endOfDay(today)],
                mes: [startOfDay((() => { const d = new Date(); d.setDate(1); return d; })()), endOfDay(today)],
              };
              const activeKey = presets.find(p => matchRange(ranges[p.key][0], ranges[p.key][1]))?.key;
              return presets.map(p => (
                <Button
                  key={p.key}
                  variant={activeKey === p.key ? "default" : "ghost"}
                  size="sm"
                  onClick={p.apply}
                  className={cn(activeKey === p.key && "bg-accent text-accent-foreground hover:bg-accent/90")}
                >
                  {p.label}
                </Button>
              ));
            })()}

            {isManager && (
              <>
                <Select
                  value={teamId}
                  onValueChange={(v) => {
                    setTeamId(v);
                    if (v !== "all") setEjecutivoId("all"); // al elegir equipo, ejecutivo => Todos
                  }}
                >
                  <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Equipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los equipos</SelectItem>
                    {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            )}
            <Select value={plazaId} onValueChange={setPlazaId}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Plaza" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las plazas</SelectItem>
                {plazas.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            {isManager && (
              <Select
                value={ejecutivoId || "all"}
                onValueChange={(v) => {
                  setEjecutivoId(v);
                  if (v !== "all") setTeamId("all"); // al elegir ejecutivo, equipo => Todos
                }}
              >
                <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Usuario" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los usuarios</SelectItem>
                  {ejecutivos.map(e => <SelectItem key={e.user_id} value={e.user_id}>{e.full_name || e.user_id.slice(0, 8)}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          title="Convertidos a con venta"
          value={convertidosPeriodo}
          sub="empresas con 1ª factura en periodo"
          icon={TrendingUp}
          color="bg-emerald-600"
        />
        <KpiCard
          title="Empresas registradas"
          value={empresasRegistradasTotal}
          sub={
            <div className="space-y-0.5 mt-1">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-500" />
                <span className="text-[11px]">Sin venta: {empresasSinVenta}</span>
                <span className="text-[10px] text-muted-foreground/70">({empresasSinVentaPeriodo} en periodo)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[11px]">Con venta: {empresasConVenta}</span>
                <span className="text-[10px] text-muted-foreground/70">({empresasConVentaPeriodo} en periodo)</span>
              </div>
            </div>
          }
          icon={UserPlus}
          color="bg-blue-600"
        />
        <KpiCard
          title="Clientes con venta activos"
          value={clientesConVentaActivos}
          sub={`${clientesConCompra} vendidos en periodo`}
          icon={Users}
          color="bg-emerald-700"
        />
        <KpiCard
          title="Clientes perdidos"
          value={empresasPerdidasTotal}
          sub={`${empresasPerdidasPeriodo} perdidos en periodo`}
          icon={AlertTriangle}
          color="bg-rose-700"
        />
        <KpiCard title="Unidades / cliente" value={fmtNum(unidadesPromedioCliente)} sub="promedio" icon={Package} color="bg-slate-600" />
        <KpiCard title="Facturado (Unidades)" value={fmtNum(unidadesFacturadas)} sub="u. equivalentes" icon={Package} color="bg-indigo-600" />
      </div>

      {/* Prospectos nuevos contactados */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          title="Prospectos Nuevos Contactados"
          value={prospectosContactadosPeriodo}
          sub="1er contacto en el periodo"
          icon={UserPlus}
          color="bg-sky-600"
        />
      </div>

      {/* Meta del Mes */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Meta del Mes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-xs text-muted-foreground">Meta</p>
              <p className="text-lg font-semibold">{fmtNum(metaMes.meta)} u.</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avance</p>
              <p className="text-lg font-semibold">{fmtNum(metaMes.avance)} u.</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cumplimiento</p>
              <p className="text-lg font-semibold">{fmtNum(metaMes.pct)}%</p>
            </div>
          </div>
          <Progress value={metaMes.pct} />
        </CardContent>
      </Card>

      {/* Seguimiento a Clientes Actuales */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Seguimiento a Clientes Actuales ({clientesActualesSeguimiento.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead className="text-right">Días última compra</TableHead>
                <TableHead>Riesgo</TableHead>
                <TableHead>Ritmo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(verTodosSeguimiento ? clientesActualesSeguimiento : clientesActualesSeguimiento.slice(0, 20)).map((s: any) => {
                const riesgo = s.estatus_riesgo_id ? estatusMap.get(s.estatus_riesgo_id) : null;
                const ritmo = s.estatus_ritmo_id ? estatusMap.get(s.estatus_ritmo_id) : null;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{companyMap[s.company_id] || "—"}</TableCell>
                    <TableCell className="text-right">{s.dias_ultima_compra ?? "—"}</TableCell>
                    <TableCell>
                      {riesgo ? (
                        <Badge className="text-xs text-white" style={{ backgroundColor: riesgo.color }}>{riesgo.nombre}</Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {ritmo ? (
                        <Badge className="text-xs text-white" style={{ backgroundColor: ritmo.color }}>{ritmo.nombre}</Badge>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {clientesActualesSeguimiento.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Sin clientes con venta</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {clientesActualesSeguimiento.length > 20 && (
            <div className="pt-2">
              <Button variant="ghost" size="sm" onClick={() => setVerTodosSeguimiento(v => !v)}>
                {verTodosSeguimiento ? "Ver menos" : `Ver todas (${clientesActualesSeguimiento.length})`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>



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
        <KpiCard title="Ticket promedio" value={fmtMoney(ticketPromedio)} sub="por factura" icon={TrendingUp} color="bg-violet-600" />
        <KpiCard title="Tareas creadas" value={tasksCreadasPeriodo.length} sub="en el periodo" icon={ListChecks} color="bg-cyan-600" />
        <KpiCard title="Tareas completadas" value={tasksCompletadasPeriodo.length} sub="en el periodo" icon={CheckCircle2} color="bg-green-600" />
        <KpiCard title="Tareas vencidas" value={tasksVencidas.length} sub={`${tasksHoyPendientes.length} pendientes hoy`} icon={AlertCircle} color="bg-red-600" />
      </div>

      {/* Conversiones */}
      <div className="grid md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Clientes sin venta</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <ConvBar label="Activos" value={convSinVenta.activos} max={convSinVenta.activos} color="bg-slate-500" />
            <ConvBar label="Cotizados" value={convSinVenta.cotizados} max={convSinVenta.activos} color="bg-blue-600" />
            <ConvBar label="Pedido" value={convSinVenta.pedidos} max={convSinVenta.activos} color="bg-indigo-600" />
            <ConvBar label="Facturados" value={convSinVenta.facturados} max={convSinVenta.activos} color="bg-green-600" />
            <p className="text-xs text-muted-foreground pt-2">Unid. equiv: {fmtNum(convSinVenta.uCot)} cot · {fmtNum(convSinVenta.uPed)} ped · {fmtNum(convSinVenta.uFac)} fact</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Clientes con venta</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <ConvBar label="Activos" value={convConVenta.activos} max={convConVenta.activos} color="bg-emerald-500" />
            <ConvBar label="Cotizados" value={convConVenta.cotizados} max={convConVenta.activos} color="bg-blue-600" />
            <ConvBar label="Pedido" value={convConVenta.pedidos} max={convConVenta.activos} color="bg-indigo-600" />
            <ConvBar label="Facturados" value={convConVenta.facturados} max={convConVenta.activos} color="bg-green-600" />
            <p className="text-xs text-muted-foreground pt-2">Unid. equiv: {fmtNum(convConVenta.uCot)} cot · {fmtNum(convConVenta.uPed)} ped · {fmtNum(convConVenta.uFac)} fact</p>
          </CardContent>
        </Card>
      </div>

      {/* Todas las tareas */}
      {(() => {
        const fmtCorta = (d: Date | null) => (d ? format(d, "dd/MM/yy") : "—");
        const allTasksList = tasks as any[];
        const getSelectedRows = () => allTasksList.filter((t) => selectedTaskIds.has(t.id));
        const handleCopiar = async () => {
          const rows = getSelectedRows();
          if (rows.length === 0) { toast.warning("Selecciona al menos una fila para copiar"); return; }
          const text = rows.map((t) => {
            const fecha = t.created_at ? new Date(t.created_at) : null;
            const empresa = companyMap[t.company_id] || "Sin empresa";
            return `${fmtCorta(fecha)} | ${empresa} | ${t.title || "Tarea"}`;
          }).join("\n");
          try { await navigator.clipboard.writeText(text); toast.success(`Copiadas ${rows.length} líneas`); }
          catch { toast.error("No se pudo copiar al portapapeles"); }
        };
        const handleExportar = () => {
          const rows = getSelectedRows();
          if (rows.length === 0) { toast.warning("Selecciona al menos una fila para exportar"); return; }
          const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
          const csv = [
            ["Fecha creada", "Empresa", "Tarea", "Estatus"].map(esc).join(","),
            ...rows.map((t) => {
              const fecha = t.created_at ? new Date(t.created_at) : null;
              const ven = t.due_date ? new Date(t.due_date) : null;
              const isVenc = ven && !t.completed && ven < todayStart;
              const status = t.completed ? "Completada" : isVenc ? "Vencida" : "Pendiente";
              return [fmtCorta(fecha), companyMap[t.company_id] || "", t.title || "", status].map(esc).join(",");
            }),
          ].join("\n");
          const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `tareas-${format(new Date(), "yyyy-MM-dd")}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success(`Exportadas ${rows.length} líneas`);
        };
        return (
        <Card>
        <CardHeader className="pb-2 gap-2">
          <div className="flex flex-row items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">Todas las tareas ({allTasksList.length})</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">{selectedTaskIds.size} seleccionadas</span>
              <Button size="sm" variant="outline" onClick={() => {
                const parentIds = allTasksList
                  .filter((t: any) => allTasksList.some((c: any) => c.parent_task_id === t.id))
                  .map((t: any) => t.id);
                const allExpanded = parentIds.length > 0 && parentIds.every(id => expandedParents.has(id));
                setExpandedParents(allExpanded ? new Set() : new Set(parentIds));
              }}>
                <Layers className="h-3.5 w-3.5 mr-1" /> Expandir / colapsar todo
              </Button>
              <Button size="sm" variant="outline" onClick={handleCopiar}><Copy className="h-3.5 w-3.5 mr-1" /> Copiar seleccionadas</Button>
              <Button size="sm" variant="outline" onClick={handleExportar}><Download className="h-3.5 w-3.5 mr-1" /> Exportar seleccionadas</Button>
              <PageSizeSelect value={limCreadas} onChange={setLimCreadas} total={allTasksList.length} onPageReset={() => setPageCreadas(1)} />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchCreadas}
                onChange={(e) => { setSearchCreadas(e.target.value); setPageCreadas(1); }}
                placeholder="Buscar cliente o tarea..."
                className="pl-8 h-8 text-sm"
              />
            </div>
            <div className="flex gap-1">
              {(["all", "Pendiente", "Vencida", "Completada"] as const).map(s => (
                <Button
                  key={s}
                  size="sm"
                  variant={statusCreadas === s ? "default" : "outline"}
                  className="h-8"
                  onClick={() => { setStatusCreadas(s); setPageCreadas(1); }}
                >
                  {s === "all" ? "Todos" : s}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 py-1.5">
                    {(() => {
                      const visibleIds = allTasksList.map((t) => t.id);
                      const allSel = visibleIds.length > 0 && visibleIds.every((id) => selectedTaskIds.has(id));
                      const someSel = !allSel && visibleIds.some((id) => selectedTaskIds.has(id));
                      return (
                        <Checkbox
                          checked={allSel ? true : someSel ? "indeterminate" : false}
                          onCheckedChange={() => {
                            if (allSel) setSelectedTaskIds(new Set());
                            else setSelectedTaskIds(new Set(visibleIds));
                          }}
                          aria-label="Seleccionar todas"
                        />
                      );
                    })()}
                  </TableHead>
                  {([
                    { key: "cliente", label: "Cliente" },
                    { key: "tarea", label: "Tarea" },
                    { key: "categoria", label: "Categoría" },
                    { key: "tipo", label: "Tipo" },
                    { key: "creada", label: "Creada" },
                    { key: "estatus", label: "Estatus" },
                  ] as const).map(h => {
                    const active = sortCreadas.col === h.key;
                    const Icon = !active ? ArrowUpDown : sortCreadas.dir === "asc" ? ArrowUp : ArrowDown;
                    return (
                      <TableHead key={h.key} className="py-1.5">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          onClick={() => setSortCreadas(s => s.col === h.key ? { col: h.key, dir: s.dir === "asc" ? "desc" : "asc" } : { col: h.key, dir: h.key === "creada" ? "desc" : "asc" })}
                        >
                          {h.label}
                          <Icon className={`h-3 w-3 ${active ? "opacity-100" : "opacity-40"}`} />
                        </button>
                      </TableHead>
                    );
                  })}
                  <TableHead className="text-right py-1.5">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const q = searchCreadas.trim().toLowerCase();
                  const filtered = allTasksList.filter((t: any) => {
                    const ven = t.due_date ? new Date(t.due_date) : null;
                    const isVenc = ven && !t.completed && ven < todayStart;
                    const status = t.completed ? "Completada" : isVenc ? "Vencida" : "Pendiente";
                    if (statusCreadas !== "all" && status !== statusCreadas) return false;
                    if (q) {
                      const cliente = (companyMap[t.company_id] || "").toLowerCase();
                      const titulo = (t.title || "").toLowerCase();
                      if (!cliente.includes(q) && !titulo.includes(q)) return false;
                    }
                    return true;
                  });
                  if (filtered.length === 0) return <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-3">Sin resultados</TableCell></TableRow>;
                  const sorted = [...filtered].sort((a, b) => {
                  const dir = sortCreadas.dir === "asc" ? 1 : -1;
                  const venA = a.due_date ? new Date(a.due_date) : null;
                  const isVencA = venA && !a.completed && venA < todayStart;
                  const statusA = a.completed ? "Completada" : isVencA ? "Vencida" : "Pendiente";
                  const venB = b.due_date ? new Date(b.due_date) : null;
                  const isVencB = venB && !b.completed && venB < todayStart;
                  const statusB = b.completed ? "Completada" : isVencB ? "Vencida" : "Pendiente";
                  let av: any, bv: any;
                  switch (sortCreadas.col) {
                    case "cliente": av = (companyMap[a.company_id] || "").toLowerCase(); bv = (companyMap[b.company_id] || "").toLowerCase(); break;
                    case "tarea": av = (a.title || "").toLowerCase(); bv = (b.title || "").toLowerCase(); break;
                    case "categoria": av = (a.parent_category || "otra"); bv = (b.parent_category || "otra"); break;
                    case "tipo": av = (a.task_type || ""); bv = (b.task_type || ""); break;
                    case "estatus": av = statusA; bv = statusB; break;
                    case "creada":
                    default: av = a.created_at ? new Date(a.created_at).getTime() : 0; bv = b.created_at ? new Date(b.created_at).getTime() : 0; break;
                  }
                  if (av < bv) return -1 * dir;
                  if (av > bv) return 1 * dir;
                  return 0;
                });
                let ordered: { task: any; isChild: boolean }[];
                {
                  const byId = new Map<string, any>(sorted.map((t: any) => [t.id, t]));
                  const childrenOf = new Map<string, any[]>();
                  const roots: any[] = [];
                  for (const t of sorted) {
                    const pid = (t as any).parent_task_id;
                    if (pid && byId.has(pid)) {
                      if (!childrenOf.has(pid)) childrenOf.set(pid, []);
                      childrenOf.get(pid)!.push(t);
                    } else {
                      roots.push(t);
                    }
                  }
                  ordered = [];
                  for (const r of roots) {
                    const kids = (childrenOf.get(r.id) || []).sort((a, b) =>
                      ((a.sequence_order ?? 0) - (b.sequence_order ?? 0)) ||
                      ((a.created_at ? new Date(a.created_at).getTime() : 0) - (b.created_at ? new Date(b.created_at).getTime() : 0))
                    );
                    (r as any)._childCount = kids.length;
                    ordered.push({ task: r, isChild: false });
                    if (kids.length > 0 && expandedParents.has(r.id)) {
                      for (const k of kids) ordered.push({ task: k, isChild: true });
                    }
                  }
                }
                return paginate(ordered, limCreadas, pageCreadas).map(({ task: t, isChild }) => {
                  const venc = t.due_date ? new Date(t.due_date) : null;
                  const isVenc = venc && !t.completed && venc < todayStart;
                  const statusCls = t.completed ? "bg-green-100 text-green-800 border-green-300" : isVenc ? "bg-red-100 text-red-800 border-red-300" : "bg-yellow-100 text-yellow-800 border-yellow-300";
                  const statusText = t.completed ? "Completada" : isVenc ? "Vencida" : "Pendiente";
                  const cat = t.parent_category === "seguimiento" ? { label: "Seguimiento", cls: "bg-blue-50 text-blue-700 border-blue-200" }
                    : t.parent_category === "cobranza" ? { label: "Cobranza", cls: "bg-violet-50 text-violet-700 border-violet-200" }
                    : { label: "Otra", cls: "bg-muted text-muted-foreground" };
                  const tipoCfg = (ACTIVITY_TYPE_CONFIG as any)[t.task_type] || { emoji: "•", label: t.task_type || "—" };
                  const childCount = (t as any)._childCount || 0;
                  const isExpanded = expandedParents.has(t.id);
                  return (
                    <TableRow
                      key={t.id}
                      data-state={selectedTaskIds.has(t.id) ? "selected" : undefined}
                      className={cn("cursor-pointer", isChild && "bg-muted/30")}
                      onClick={() => { setSelectedTask(t as CrmTask); setTaskDialogOpen(true); }}
                    >
                      <TableCell className="py-1.5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedTaskIds.has(t.id)}
                          onCheckedChange={() => {
                            const ns = new Set(selectedTaskIds);
                            ns.has(t.id) ? ns.delete(t.id) : ns.add(t.id);
                            setSelectedTaskIds(ns);
                          }}
                          aria-label="Seleccionar fila"
                        />
                      </TableCell>
                      <TableCell className="font-light text-sm py-1.5 w-[28%]">{companyMap[t.company_id] || "—"}</TableCell>
                      <TableCell className="font-light text-sm py-1.5 w-[20%]">
                        <span className={cn("inline-flex items-center gap-1", isChild && "pl-5 text-muted-foreground")}>
                          {isChild && <CornerDownRight className="h-3 w-3 shrink-0" />}
                          {!isChild && childCount > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedParents(prev => {
                                  const ns = new Set(prev);
                                  ns.has(t.id) ? ns.delete(t.id) : ns.add(t.id);
                                  return ns;
                                });
                              }}
                              className="inline-flex items-center justify-center h-4 w-4 rounded hover:bg-muted shrink-0"
                              aria-label={isExpanded ? "Colapsar" : "Expandir"}
                            >
                              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </button>
                          )}
                          <span className={cn(!isChild && childCount > 0 && "font-medium")}>{t.title}</span>
                          {!isChild && childCount > 0 && (
                            <span className="text-xs text-muted-foreground">({childCount})</span>
                          )}
                        </span>
                        {t.description && <p className={cn("text-xs font-light text-muted-foreground truncate max-w-[220px]", isChild && "pl-5")}>{t.description}</p>}
                      </TableCell>
                      <TableCell className="py-1.5"><Badge variant="outline" className={cn("text-xs", cat.cls)}>{cat.label}</Badge></TableCell>
                      <TableCell className="py-1.5"><span className="inline-flex items-center gap-1 text-xs"><span>{tipoCfg.emoji}</span>{tipoCfg.label}</span></TableCell>
                      <TableCell className="text-xs py-1.5">{t.created_at ? format(new Date(t.created_at), "dd MMM HH:mm", { locale: es }) : "—"}</TableCell>
                      <TableCell className="py-1.5">
                        <Badge variant="outline" className={cn("text-xs", statusCls)}>{statusText}</Badge>
                      </TableCell>
                      <TableCell className="text-right py-1.5" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!t.completed && <DropdownMenuItem onClick={() => completarTarea(t.id)}><CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Completar</DropdownMenuItem>}
                            {!t.completed && <DropdownMenuItem onClick={() => reprogramarTarea(t.id)}><Clock className="h-3.5 w-3.5 mr-2" /> Reprogramar</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                  });
                })()}
              </TableBody>
            </Table>
          </div>
          <Paginator page={pageCreadas} setPage={setPageCreadas} total={allTasksList.length} lim={limCreadas} />
        </CardContent>
        </Card>
        );
      })()}

      {/* Tabs detalle */}
      <Card>
        <CardHeader className="pb-2 gap-2">
          <CardTitle className="text-base">Detalle por sección</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="cotizaciones">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="cotizaciones">Cotizaciones ({cotizaciones.length})</TabsTrigger>
            <TabsTrigger value="pedidos">Pedidos ({pedidos.length})</TabsTrigger>
            <TabsTrigger value="facturas">Facturas ({facturas.length})</TabsTrigger>
            <TabsTrigger value="cobranza">Cobranza ({pagos.length})</TabsTrigger>
          </TabsList>

        {[
          { key: "cotizaciones", data: cotizaciones, lim: limCotizaciones, setLim: setLimCotizaciones, page: pageCotizaciones, setPage: setPageCotizaciones },
          { key: "pedidos", data: pedidos, lim: limPedidos, setLim: setLimPedidos, page: pagePedidos, setPage: setPagePedidos },
          { key: "facturas", data: facturas, lim: limFacturas, setLim: setLimFacturas, page: pageFacturas, setPage: setPageFacturas },
        ].map(({ key, data, lim, setLim, page, setPage }) => (
          <TabsContent value={key} key={key} className="mt-3">
            <div className="overflow-x-auto border rounded-md"><Table>
              <TableHeader><TableRow><TableHead className="py-1.5">Folio</TableHead><TableHead className="py-1.5">Cliente</TableHead><TableHead className="py-1.5">Fecha</TableHead><TableHead className="py-1.5">Estatus</TableHead><TableHead className="py-1.5 text-right">Importe</TableHead><TableHead className="py-1.5 text-right">Unid. equiv.</TableHead><TableHead className="py-1.5 text-right">Acciones</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-3 text-muted-foreground">Sin registros</TableCell></TableRow>}
                {paginate(data, lim, page).map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{docFolio(d)}</TableCell>
                    <TableCell className="font-medium">{companyMap[d.empresa_id] || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.fecha_documento}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{docStatus(d)}</Badge></TableCell>
                    <TableCell className="text-right">{fmtMoney(Number(d.total))}</TableCell>
                    <TableCell className="text-right">{fmtNum(Number(d.unidades_equivalentes_total))}</TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => window.open(`/documents/${d.id}`, "_blank")}><ExternalLink className="h-3.5 w-3.5" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginatorBar page={page} setPage={setPage} total={data.length} lim={lim} setLim={setLim} />
            </div>
          </TabsContent>
        ))}

        <TabsContent value="cobranza" className="mt-3">
          <div className="overflow-x-auto border rounded-md"><Table>
            <TableHeader><TableRow><TableHead className="py-1.5">Cliente</TableHead><TableHead className="py-1.5">Fecha</TableHead><TableHead className="py-1.5">Estatus</TableHead><TableHead className="py-1.5 text-right">Monto</TableHead><TableHead className="py-1.5 text-right">Aplicado</TableHead><TableHead className="py-1.5 text-right">Acciones</TableHead></TableRow></TableHeader>
            <TableBody>
              {pagos.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-3 text-muted-foreground">Sin pagos en el rango</TableCell></TableRow>}
              {paginate(pagos, limCobranza, pageCobranza).map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{companyMap[p.empresa_id] || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.fecha_pago}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{p.estatus_pago}</Badge></TableCell>
                  <TableCell className="text-right">{fmtMoney(Number(p.monto_total))}</TableCell>
                  <TableCell className="text-right">{fmtMoney(Number(p.monto_aplicado))}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => window.open("/cobranza", "_blank")}><ExternalLink className="h-3.5 w-3.5" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginatorBar page={pageCobranza} setPage={setPageCobranza} total={pagos.length} lim={limCobranza} setLim={setLimCobranza} />
          </div>
        </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

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
              : bucketActivo === "vencidas" ? facturasCobranza.filter((f: any) => (f.estatus_factura || "").toLowerCase() === "vencida")
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
                              <Button size="sm" variant="ghost" title="Abrir factura" onClick={() => window.open(`/documents/${f.id}`, "_blank")}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                title="Comunicar por WhatsApp"
                                onClick={() => { setCobranzaFactura(f); setCobranzaTab("whatsapp"); setCobranzaOpen(true); }}
                              >
                                <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                title="Comunicar por correo"
                                onClick={() => { setCobranzaFactura(f); setCobranzaTab("email"); setCobranzaOpen(true); }}
                              >
                                <Mail className="h-3.5 w-3.5 text-blue-600" />
                              </Button>
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

      <CrmTaskDetailDialog
        task={selectedTask}
        open={taskDialogOpen}
        onOpenChange={(o) => {
          setTaskDialogOpen(o);
          if (!o) {
            setSelectedTask(null);
            fetchData();
          }
        }}
      />

      <CobranzaComunicacionDialog
        factura={cobranzaFactura}
        empresaNombre={cobranzaFactura ? companyMap[cobranzaFactura.empresa_id] : undefined}
        open={cobranzaOpen}
        onOpenChange={(o) => { setCobranzaOpen(o); if (!o) setCobranzaFactura(null); }}
        defaultTab={cobranzaTab}
      />

      <CrmActivityDetailDialog
        activity={selectedActivity}
        open={activityDialogOpen}
        onOpenChange={(o) => {
          setActivityDialogOpen(o);
          if (!o) {
            setSelectedActivity(null);
            fetchData();
          }
        }}
      />
    </div>
  );
}