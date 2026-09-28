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
