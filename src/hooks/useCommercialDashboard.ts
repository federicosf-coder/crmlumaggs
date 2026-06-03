import { useQuery } from "@tanstack/react-query";
import { supabase as _supabaseTyped } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _supabaseTyped;
import { useAuth } from "@/contexts/AuthContext";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { fetchAllRows } from "@/lib/supabasePagination";

export interface CommercialFilters {
  from: string; // ISO date
  to: string;   // ISO date
  ejecutivoId: string | "all";
  plazaId: string | "all";
  segmentoId: string | "all";
  tipoClienteId: string | "all";
}

export interface ExecutiveRow {
  user_id: string;
  full_name: string;
  prospectos_nuevos: number;
  negocios_nuevos: number;
  cotizaciones: number;
  conversiones: number;
  conversion_pct: number;
  volumen_uds: number;
  volumen_recompra_uds: number;
  ticket_promedio: number;
  clientes_riesgo: number;
  tareas_completadas: number;
  tareas_vencidas: number;
  actividades: number;
  score: number;
  desempeno: "alto" | "medio" | "bajo";
}

export interface CommercialDashboardData {
  // KPIs prospectos
  prospectosNuevos: number;
  negociosNuevos: number;
  cotizacionesProspectos: number;
  prospectosConvertidos: number;
  tasaConversion: number;
  tiempoConversionPromedio: number; // días

  // Ventas (uds equivalentes)
  volumenTotal: number;
  volumenPorEjecutivo: { name: string; uds: number }[];
  volumenPorSegmento: { name: string; uds: number }[];
  ticketPromedio: number;
  volumenPromedioCliente: number;

  // Recompra
  clientesActivos: number;
  clientesConRecompra: number;
  volumenRecompra: number;
  clientesRiesgo: number;
  clientesDormidos: number;
  tasaRecompra: number;

  // Expansión
  topClientes: { name: string; uds: number }[];
  oportunidadesExpansion: number;

  // Actividad
  totalTareas: number;
  tareasCompletadas: number;
  tareasVencidas: number;
  actividadesPorTipo: { type: string; count: number }[];

  // Embudos
  embudoPrimera: { stage: string; count: number; color: string }[];
  embudoRecompra: { stage: string; count: number; color: string }[];

  // Ranking
  ranking: ExecutiveRow[];
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function useCommercialDashboard(filters: CommercialFilters) {
  const { user } = useAuth();
  const access = useModuleAccess("crm_chevron");
  // Si el usuario no es admin/manager, restringir al propio user
  const isPrivileged = access.accessLevel === "todos";

  return useQuery({
    queryKey: ["commercial_dashboard", filters, isPrivileged, user?.id],
    enabled: !!user?.id && !access.isLoading,
    staleTime: 60_000,
    queryFn: async (): Promise<CommercialDashboardData> => {
      const fromIso = filters.from;
      const toIso = filters.to;
      const userId = user!.id;

      const userFilter = isPrivileged ? null : userId;
      const ejecutivoFilter = filters.ejecutivoId !== "all"
        ? filters.ejecutivoId
        : userFilter;

      // Helper: aplica filtros comunes a queries de companies
      const applyCompanyFilters = <T extends any>(q: T): T => {
        let r: any = q;
        if (filters.plazaId !== "all") r = r.eq("plaza_id", filters.plazaId);
        if (filters.segmentoId !== "all") r = r.eq("segmento_id", filters.segmentoId);
        if (filters.tipoClienteId !== "all") r = r.eq("tipo_cliente_id", filters.tipoClienteId);
        return r as T;
      };

      // ============= QUERIES PARALELAS =============
      const [
        profilesRes,
        prospectosCreadosRes,
        prospectosConvertidosRes,
        dealsPrimeraRes,
        dealsRecompraRes,
        cotizacionesRes,
        facturasRes,
        companiesRes,
        tasksRes,
        activitiesRes,
        pipelinesRes,
        stagesRes,
      ] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, is_active").eq("is_active", true),

        // Prospectos creados en periodo: companies sin estatus_cliente o con estatus prospecto
        applyCompanyFilters(
          supabase.from("companies")
            .select("id, name, created_by, created_at, fecha_conversion_cliente, plaza_id, segmento_id, tipo_cliente_id, estatus_cliente_id", { count: "exact" })
            .gte("created_at", fromIso).lte("created_at", toIso)
        ),

        // Convertidos: deals con convertido_a_cliente=true en periodo (de primera_compra)
        supabase.from("crm_deals")
          .select("id, company_id, created_by, owner_id, created_at, fecha_conversion, pipeline_type, value, volumen_mensual_estimado")
          .eq("convertido_a_cliente", true)
          .eq("pipeline_type", "primera_compra")
          .gte("fecha_conversion", fromIso).lte("fecha_conversion", toIso),

        supabase.from("crm_deals")
          .select("id, company_id, created_by, owner_id, stage_id, pipeline_id, created_at, value")
          .eq("pipeline_type", "primera_compra")
          .gte("created_at", fromIso).lte("created_at", toIso),

        supabase.from("crm_deals")
          .select("id, company_id, created_by, owner_id, stage_id, pipeline_id, created_at, value")
          .eq("pipeline_type", "recompra")
          .gte("created_at", fromIso).lte("created_at", toIso),

        supabase.from("documentos")
          .select("id, empresa_id, ejecutivo_venta_id, created_by, fecha_documento, total, unidades_equivalentes_total, tipo_documento, estatus_cotizacion")
          .eq("tipo_documento", "cotizacion")
          .gte("fecha_documento", fromIso.slice(0,10)).lte("fecha_documento", toIso.slice(0,10)),

        supabase.from("documentos")
          .select("id, empresa_id, ejecutivo_venta_id, created_by, fecha_documento, total, unidades_equivalentes_total, tipo_documento, estatus_factura")
          .eq("tipo_documento", "factura")
          .neq("estatus_factura", "cancelada")
          .gte("fecha_documento", fromIso.slice(0,10)).lte("fecha_documento", toIso.slice(0,10)),

        // Para riesgo/dormido y métricas globales (paginado por si supera 1000)
        fetchAllRows<any>((from, to) => supabase
          .from("companies")
          .select("id, name, created_by, plaza_id, segmento_id, tipo_cliente_id, estatus_recompra_chevron, estatus_recompra_phillips66, fecha_ultima_compra, fecha_ultima_compra_chevron, fecha_ultima_compra_phillips66")
          .range(from, to)),

        supabase.from("crm_tasks")
          .select("id, user_id, completed, due_date, created_at, title")
          .gte("created_at", fromIso).lte("created_at", toIso),

        supabase.from("crm_activities")
          .select("id, user_id, type, activity_date")
          .gte("activity_date", fromIso).lte("activity_date", toIso),

        supabase.from("crm_pipelines").select("id, marca, pipeline_type"),
        supabase.from("crm_pipeline_stages").select("id, pipeline_id, name, position, color").order("position"),
      ]);

      const profiles = profilesRes.data || [];
      const profileById = new Map(profiles.map((p: any) => [p.user_id, p.full_name || "Sin nombre"]));

      // Aplicar filtro de ejecutivo a colecciones que dependen del usuario
      const matchesEjec = (ownerA?: string | null, ownerB?: string | null) => {
        if (!ejecutivoFilter) return true;
        return ownerA === ejecutivoFilter || ownerB === ejecutivoFilter;
      };

      // ===== Prospectos =====
      const prospectosRows = (prospectosCreadosRes.data || []).filter((c: any) => matchesEjec(c.created_by));
      const prospectosNuevos = prospectosRows.length;

      const convertidos = (prospectosConvertidosRes.data || []).filter((d: any) => matchesEjec(d.owner_id, d.created_by));
      const prospectosConvertidos = convertidos.length;
      const tasaConversion = prospectosNuevos > 0 ? (prospectosConvertidos / prospectosNuevos) * 100 : 0;

      // Tiempo conversión promedio: usar deals convertidos con fecha_conversion - created_at
      const tiempos = convertidos
        .map((d: any) => {
          if (!d.fecha_conversion || !d.created_at) return null;
          const ms = new Date(d.fecha_conversion).getTime() - new Date(d.created_at).getTime();
          return ms > 0 ? ms / (1000 * 60 * 60 * 24) : null;
        })
        .filter((n): n is number => n !== null);
      const tiempoConversionPromedio = tiempos.length ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : 0;

      // ===== Negocios nuevos (primera compra) =====
      const dealsPrimera = (dealsPrimeraRes.data || []).filter((d: any) => matchesEjec(d.owner_id, d.created_by));
      const dealsRecompra = (dealsRecompraRes.data || []).filter((d: any) => matchesEjec(d.owner_id, d.created_by));
      const negociosNuevos = dealsPrimera.length;

      // Cotizaciones a prospectos: cotizaciones donde la empresa esté en lista de prospectosCreadosRes
      const allProspectIds = new Set((prospectosCreadosRes.data || []).map((c: any) => c.id));
      const cotizaciones = (cotizacionesRes.data || []).filter((d: any) => matchesEjec(d.ejecutivo_venta_id, d.created_by));
      const cotizacionesProspectos = cotizaciones.filter((d: any) => d.empresa_id && allProspectIds.has(d.empresa_id)).length;

      // ===== Ventas (uds equivalentes) =====
      const facturas = (facturasRes.data || []).filter((d: any) => matchesEjec(d.ejecutivo_venta_id, d.created_by));
      const volumenTotal = facturas.reduce((sum: number, d: any) => sum + Number(d.unidades_equivalentes_total || 0), 0);
      const valorTotal = facturas.reduce((sum: number, d: any) => sum + Number(d.total || 0), 0);
      const ticketPromedio = facturas.length ? valorTotal / facturas.length : 0;

      // Volumen por ejecutivo
      const udsByEjec = new Map<string, number>();
      for (const f of facturas) {
        const ejec = f.ejecutivo_venta_id || f.created_by;
        if (!ejec) continue;
        udsByEjec.set(ejec, (udsByEjec.get(ejec) || 0) + Number(f.unidades_equivalentes_total || 0));
      }
      const volumenPorEjecutivo = Array.from(udsByEjec.entries())
        .map(([id, uds]) => ({ name: profileById.get(id) || "—", uds }))
        .sort((a, b) => b.uds - a.uds).slice(0, 12);

      // Volumen por segmento (resolviendo via companies)
      const companies = companiesRes || [];
      const companyById = new Map<string, any>(companies.map((c: any) => [c.id, c]));
      const segmentValueById = new Map<string, string>();
      // Resolver labels de segmentos
      const segmentIds = Array.from(new Set(companies.map((c: any) => c.segmento_id).filter(Boolean)));
      if (segmentIds.length > 0) {
        const { data: segVals } = await supabase.from("product_option_values").select("id, value").in("id", segmentIds);
        for (const s of (segVals || [])) segmentValueById.set(s.id, s.value);
      }
      const udsBySeg = new Map<string, number>();
      const udsByCliente = new Map<string, number>();
      for (const f of facturas) {
        const company = f.empresa_id ? companyById.get(f.empresa_id) : null;
        const segId = company?.segmento_id;
        const segLabel = segId ? (segmentValueById.get(segId) || "Sin segmento") : "Sin segmento";
        udsBySeg.set(segLabel, (udsBySeg.get(segLabel) || 0) + Number(f.unidades_equivalentes_total || 0));
        if (f.empresa_id) {
          udsByCliente.set(f.empresa_id, (udsByCliente.get(f.empresa_id) || 0) + Number(f.unidades_equivalentes_total || 0));
        }
      }
      const volumenPorSegmento = Array.from(udsBySeg.entries())
        .map(([name, uds]) => ({ name, uds }))
        .sort((a, b) => b.uds - a.uds);

      const clientesConCompra = udsByCliente.size;
      const volumenPromedioCliente = clientesConCompra > 0 ? volumenTotal / clientesConCompra : 0;

      const topClientes = Array.from(udsByCliente.entries())
        .map(([id, uds]) => ({ name: companyById.get(id)?.name || "—", uds }))
        .sort((a, b) => b.uds - a.uds).slice(0, 10);

      // ===== Recompra =====
      // Filtrar companies por filtros generales
      const companiesFiltered = companies.filter((c: any) => {
        if (filters.plazaId !== "all" && c.plaza_id !== filters.plazaId) return false;
        if (filters.segmentoId !== "all" && c.segmento_id !== filters.segmentoId) return false;
        if (filters.tipoClienteId !== "all" && c.tipo_cliente_id !== filters.tipoClienteId) return false;
        if (ejecutivoFilter && c.created_by !== ejecutivoFilter) return false;
        return true;
      });
      const isActiveStatus = (s: string | null | undefined) => s && ["al_dia","proximo","vencido","en_riesgo"].includes(s);
      const clientesActivos = companiesFiltered.filter((c: any) =>
        isActiveStatus(c.estatus_recompra_chevron) || isActiveStatus(c.estatus_recompra_phillips66)
      ).length;
      const clientesRiesgo = companiesFiltered.filter((c: any) =>
        c.estatus_recompra_chevron === "en_riesgo" || c.estatus_recompra_phillips66 === "en_riesgo"
      ).length;
      const clientesDormidos = companiesFiltered.filter((c: any) =>
        c.estatus_recompra_chevron === "dormido" || c.estatus_recompra_phillips66 === "dormido"
      ).length;

      // Volumen de recompra: facturas de empresas que ya habían comprado antes del periodo
      const empresasConHistorial = new Set(
        companies
          .filter((c: any) => c.fecha_ultima_compra && new Date(c.fecha_ultima_compra) < new Date(fromIso))
          .map((c: any) => c.id)
      );
      const facturasRecompra = facturas.filter((f: any) => f.empresa_id && empresasConHistorial.has(f.empresa_id));
      const volumenRecompra = facturasRecompra.reduce((s: number, f: any) => s + Number(f.unidades_equivalentes_total || 0), 0);
      const clientesConRecompra = new Set(facturasRecompra.map((f: any) => f.empresa_id)).size;
      const tasaRecompra = clientesActivos > 0 ? (clientesConRecompra / clientesActivos) * 100 : 0;

      // ===== Expansión =====
      const oportunidadesExpansion = dealsRecompra.length;

      // ===== Actividad =====
      const tasks = (tasksRes.data || []).filter((t: any) => !ejecutivoFilter || t.user_id === ejecutivoFilter);
      const totalTareas = tasks.length;
      const tareasCompletadas = tasks.filter((t: any) => t.completed).length;
      const now = new Date();
      const tareasVencidas = tasks.filter((t: any) => !t.completed && t.due_date && new Date(t.due_date) < now).length;

      const activities = (activitiesRes.data || []).filter((a: any) => !ejecutivoFilter || a.user_id === ejecutivoFilter);
      const actByType = new Map<string, number>();
      for (const a of activities) actByType.set(a.type, (actByType.get(a.type) || 0) + 1);
      const actividadesPorTipo = Array.from(actByType.entries()).map(([type, count]) => ({ type, count }));

      // ===== Embudos =====
      const pipelines = pipelinesRes.data || [];
      const stages = stagesRes.data || [];
      const stageMap = new Map<string, { name: string; color: string; pipeline_id: string; position: number }>();
      for (const s of stages) stageMap.set(s.id, s as any);

      const buildEmbudo = (pipelineType: "primera_compra" | "recompra") => {
        const pipelineIds = new Set(pipelines.filter((p: any) => p.pipeline_type === pipelineType).map((p: any) => p.id));
        const counts = new Map<string, { name: string; color: string; count: number; position: number }>();
        // inicializar con todas las etapas
        for (const s of stages) {
          if (!pipelineIds.has(s.pipeline_id)) continue;
          const key = s.name.toLowerCase();
          const prev = counts.get(key);
          counts.set(key, {
            name: s.name,
            color: s.color,
            position: s.position,
            count: prev?.count || 0,
          });
        }
        const dealsList = pipelineType === "primera_compra" ? dealsPrimera : dealsRecompra;
        for (const d of dealsList) {
          const st = stageMap.get(d.stage_id);
          if (!st) continue;
          const key = st.name.toLowerCase();
          const cur = counts.get(key);
          if (cur) cur.count += 1;
        }
        return Array.from(counts.values())
          .sort((a, b) => a.position - b.position)
          .map((c) => ({ stage: c.name, count: c.count, color: c.color }));
      };

      const embudoPrimera = buildEmbudo("primera_compra");
      const embudoRecompra = buildEmbudo("recompra");

      // ===== Ranking & Score =====
      // Construir set de usuarios candidatos
      const candidateIds = new Set<string>();
      for (const id of udsByEjec.keys()) candidateIds.add(id);
      for (const c of prospectosRows) if (c.created_by) candidateIds.add(c.created_by);
      for (const d of dealsPrimera) {
        if (d.owner_id) candidateIds.add(d.owner_id);
        if (d.created_by) candidateIds.add(d.created_by);
      }
      for (const t of tasks) if (t.user_id) candidateIds.add(t.user_id);
      // Si filtramos por ejecutivo, solo ese
      if (ejecutivoFilter) {
        candidateIds.clear();
        candidateIds.add(ejecutivoFilter);
      }

      const ranking: ExecutiveRow[] = [];
      for (const uid of candidateIds) {
        const prospN = prospectosRows.filter((c: any) => c.created_by === uid).length;
        const negN = dealsPrimera.filter((d: any) => d.owner_id === uid || d.created_by === uid).length;
        const cotN = cotizaciones.filter((d: any) => d.ejecutivo_venta_id === uid || d.created_by === uid).length;
        const convN = convertidos.filter((d: any) => d.owner_id === uid || d.created_by === uid).length;
        const convPct = prospN > 0 ? (convN / prospN) * 100 : 0;
        const uds = udsByEjec.get(uid) || 0;
        const facsEjec = facturas.filter((f: any) => f.ejecutivo_venta_id === uid || f.created_by === uid);
        const valEjec = facsEjec.reduce((s: number, f: any) => s + Number(f.total || 0), 0);
        const tickEjec = facsEjec.length ? valEjec / facsEjec.length : 0;
        const udsRecEjec = facsEjec
          .filter((f: any) => f.empresa_id && empresasConHistorial.has(f.empresa_id))
          .reduce((s: number, f: any) => s + Number(f.unidades_equivalentes_total || 0), 0);
        const cliRiesgoEjec = companies.filter((c: any) =>
          c.created_by === uid &&
          (c.estatus_recompra_chevron === "en_riesgo" || c.estatus_recompra_phillips66 === "en_riesgo")
        ).length;
        const tareasUserAll = tasks.filter((t: any) => t.user_id === uid);
        const tareasComp = tareasUserAll.filter((t: any) => t.completed).length;
        const tareasVenc = tareasUserAll.filter((t: any) => !t.completed && t.due_date && new Date(t.due_date) < now).length;
        const actsN = activities.filter((a: any) => a.user_id === uid).length;

        // Score: pondera 5 dimensiones (0-100 cada una, normalizadas vs máximos del periodo)
        ranking.push({
          user_id: uid,
          full_name: profileById.get(uid) || "Sin nombre",
          prospectos_nuevos: prospN,
          negocios_nuevos: negN,
          cotizaciones: cotN,
          conversiones: convN,
          conversion_pct: convPct,
          volumen_uds: uds,
          volumen_recompra_uds: udsRecEjec,
          ticket_promedio: tickEjec,
          clientes_riesgo: cliRiesgoEjec,
          tareas_completadas: tareasComp,
          tareas_vencidas: tareasVenc,
          actividades: actsN,
          score: 0,
          desempeno: "bajo",
        });
      }

      // Calcular score normalizado
      const max = (sel: (r: ExecutiveRow) => number) => Math.max(1, ...ranking.map(sel));
      const maxProsp = max((r) => r.prospectos_nuevos);
      const maxConv = max((r) => r.conversiones);
      const maxUds = max((r) => r.volumen_uds);
      const maxRec = max((r) => r.volumen_recompra_uds);
      const maxAct = max((r) => r.tareas_completadas + r.actividades);

      for (const r of ranking) {
        const sProsp = (r.prospectos_nuevos / maxProsp) * 100;
        const sConv = (r.conversiones / maxConv) * 100;
        const sVol = (r.volumen_uds / maxUds) * 100;
        const sRec = (r.volumen_recompra_uds / maxRec) * 100;
        const sAct = ((r.tareas_completadas + r.actividades) / maxAct) * 100;
        // Pesos: ventas 35, recompra 25, prospectos 15, conversión 15, actividad 10
        const score = clamp(
          sVol * 0.35 + sRec * 0.25 + sProsp * 0.15 + sConv * 0.15 + sAct * 0.10,
          0, 100
        );
        r.score = Math.round(score);
        r.desempeno = score >= 70 ? "alto" : score >= 40 ? "medio" : "bajo";
      }

      ranking.sort((a, b) => b.score - a.score);

      return {
        prospectosNuevos,
        negociosNuevos,
        cotizacionesProspectos,
        prospectosConvertidos,
        tasaConversion,
        tiempoConversionPromedio,
        volumenTotal,
        volumenPorEjecutivo,
        volumenPorSegmento,
        ticketPromedio,
        volumenPromedioCliente,
        clientesActivos,
        clientesConRecompra,
        volumenRecompra,
        clientesRiesgo,
        clientesDormidos,
        tasaRecompra,
        topClientes,
        oportunidadesExpansion,
        totalTareas,
        tareasCompletadas,
        tareasVencidas,
        actividadesPorTipo,
        embudoPrimera,
        embudoRecompra,
        ranking,
      };
    },
  });
}
