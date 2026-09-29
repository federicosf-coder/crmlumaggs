import type { SeguimientoEstatus, SeguimientoVentasRow } from "@/hooks/useSeguimientoVentas";

export interface GrupoResumen {
  grupoId: string;
  nombre: string;
  /** Días desde la última compra de CUALQUIER empresa del grupo */
  diasUltimaCompra: number | null;
  fechaUltimaCompra: string | null;
  /** Empresas del grupo presentes en la vista */
  empresas: string[];
}

/** Construye el resumen consolidado por grupo comercial a partir de las filas de seguimiento. */
export function buildGruposResumen(rows: SeguimientoVentasRow[]): Map<string, GrupoResumen> {
  const map = new Map<string, GrupoResumen>();
  for (const r of rows) {
    const grupo = r.companies?.grupos_comerciales;
    const grupoId = grupo?.id || r.companies?.grupo_comercial_id;
    if (!grupoId) continue;
    const prev =
      map.get(grupoId) ||
      ({
        grupoId,
        nombre: grupo?.nombre || "Grupo",
        diasUltimaCompra: null,
        fechaUltimaCompra: null,
        empresas: [],
      } as GrupoResumen);
    if (r.companies?.name && !prev.empresas.includes(r.companies.name)) prev.empresas.push(r.companies.name);
    const d = r.dias_ultima_compra;
    if (d != null && (prev.diasUltimaCompra == null || d < prev.diasUltimaCompra)) {
      prev.diasUltimaCompra = d;
      prev.fechaUltimaCompra = r.fecha_ultima_compra;
    }
    map.set(grupoId, prev);
  }
  return map;
}

/** Devuelve el id de estatus de riesgo que corresponde a los días y ciclo dados. */
export function resolveRiesgoEstatusId(
  catalog: SeguimientoEstatus[],
  dias: number | null,
  cicloDias: number | null
): string | null {
  if (dias == null) return null;
  const ciclo = cicloDias && cicloDias > 0 ? cicloDias : 30;
  const multiplo = dias / ciclo;
  const familia = catalog
    .filter((c) => c.ambito === "con_venta" && c.familia === "riesgo" && c.activo)
    .sort((a, b) => a.orden - b.orden);
  for (const c of familia) {
    const min = c.umbral_min ?? 0;
    const max = c.umbral_max;
    if (multiplo >= min && (max == null || multiplo < max)) return c.id;
  }
  return familia.length ? familia[familia.length - 1].id : null;
}

/**
 * Días de última compra considerando al grupo comercial completo
 * (si otra empresa del grupo compró más recientemente, manda esa).
 */
export function diasCompraConGrupo(
  row: SeguimientoVentasRow,
  grupos: Map<string, GrupoResumen>
): { dias: number | null; fecha: string | null; grupo: GrupoResumen | null; consolidado: boolean } {
  const grupoId = row.companies?.grupos_comerciales?.id || row.companies?.grupo_comercial_id;
  const grupo = grupoId ? grupos.get(grupoId) || null : null;
  if (!grupo || grupo.diasUltimaCompra == null) {
    return { dias: row.dias_ultima_compra, fecha: row.fecha_ultima_compra, grupo, consolidado: false };
  }
  const propio = row.dias_ultima_compra;
  if (propio == null || grupo.diasUltimaCompra < propio) {
    return { dias: grupo.diasUltimaCompra, fecha: grupo.fechaUltimaCompra, grupo, consolidado: true };
  }
  return { dias: propio, fecha: row.fecha_ultima_compra, grupo, consolidado: false };
}

export interface GrupoConsolidadoInfo {
  nombre: string;
  empresas: string[];
  companyIds: string[];
}

export type SeguimientoRowConsolidada = SeguimientoVentasRow & {
  __grupo?: GrupoConsolidadoInfo;
};

function maxFecha(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

function minDias(a: number | null, b: number | null): number | null {
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
}

/**
 * Consolida las filas que pertenecen al mismo grupo comercial en una sola fila:
 * suma volúmenes/importes y toma la recencia más favorable del grupo.
 * Las empresas sin grupo se devuelven tal cual.
 */
export function consolidarPorGrupo(rows: SeguimientoVentasRow[]): SeguimientoRowConsolidada[] {
  const sinGrupo: SeguimientoRowConsolidada[] = [];
  const porGrupo = new Map<string, SeguimientoVentasRow[]>();

  for (const r of rows) {
    const grupoId = r.companies?.grupos_comerciales?.id || r.companies?.grupo_comercial_id;
    if (!grupoId) {
      sinGrupo.push(r);
      continue;
    }
    const arr = porGrupo.get(grupoId) || [];
    arr.push(r);
    porGrupo.set(grupoId, arr);
  }

  const consolidadas: SeguimientoRowConsolidada[] = [];
  for (const [, grupoRows] of porGrupo) {
    if (grupoRows.length === 1) {
      consolidadas.push(grupoRows[0]);
      continue;
    }
    const base = [...grupoRows].sort((a, b) => (b.acum_anio ?? 0) - (a.acum_anio ?? 0))[0];
    const nombre = base.companies?.grupos_comerciales?.nombre || "Grupo";
    const sum = (sel: (r: SeguimientoVentasRow) => number | null | undefined) =>
      grupoRows.reduce((acc, r) => acc + (sel(r) ?? 0), 0);

    const merged: SeguimientoRowConsolidada = {
      ...base,
      potencial: sum((r) => r.potencial),
      promedio_historico_mensual: sum((r) => r.promedio_historico_mensual),
      acum_mes: sum((r) => r.acum_mes),
      acum_mes_anterior: sum((r) => r.acum_mes_anterior),
      acum_mes_anterior_mismo_dia: sum((r) => r.acum_mes_anterior_mismo_dia),
      importe_mes: sum((r) => r.importe_mes),
      importe_mes_anterior: sum((r) => r.importe_mes_anterior),
      importe_mes_anterior_mismo_dia: sum((r) => r.importe_mes_anterior_mismo_dia),
      acum_anio: sum((r) => r.acum_anio),
      total_historico: sum((r) => r.total_historico),
      total_historico_unidades: sum((r) => r.total_historico_unidades),
      cotizaciones_total: sum((r) => r.cotizaciones_total),
      actividades_activas: sum((r) => r.actividades_activas),
      actividades_total: sum((r) => r.actividades_total),
      dias_ultima_compra: grupoRows.reduce<number | null>((acc, r) => minDias(acc, r.dias_ultima_compra), null),
      fecha_ultima_compra: grupoRows.reduce<string | null>((acc, r) => maxFecha(acc, r.fecha_ultima_compra), null),
      dias_ultima_cotizacion: grupoRows.reduce<number | null>((acc, r) => minDias(acc, r.dias_ultima_cotizacion), null),
      ultima_cotizacion_fecha: grupoRows.reduce<string | null>((acc, r) => maxFecha(acc, r.ultima_cotizacion_fecha), null),
      dias_ultima_actividad: grupoRows.reduce<number | null>((acc, r) => minDias(acc, r.dias_ultima_actividad), null),
      ultima_actividad_fecha: grupoRows.reduce<string | null>((acc, r) => maxFecha(acc, r.ultima_actividad_fecha), null),
      proxima_tarea_fecha: grupoRows.reduce<string | null>((acc, r) => {
        const f = r.proxima_tarea_fecha;
        if (!f) return acc;
        if (!acc) return f;
        return new Date(f).getTime() <= new Date(acc).getTime() ? f : acc;
      }, null),
      __grupo: {
        nombre,
        empresas: grupoRows.map((r) => r.companies?.name || "—"),
        companyIds: grupoRows.map((r) => r.company_id),
      },
    };
    consolidadas.push(merged);
  }

  return [...consolidadas, ...sinGrupo];
}
