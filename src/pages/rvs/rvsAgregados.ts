export const MESES_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export const mesLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES_ES[(m || 1) - 1]} ${y}`;
};

export const currency = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

export const shiftMes = (ym: string, delta: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, (m || 1) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const esGalsa = (marca: string) => (marca || "").toLowerCase().includes("galsa");
export const esLumaggs = (marca: string) => (marca || "").toLowerCase().includes("lumaggs");

export interface FilaVentas {
  key: string;
  nombre: string;
  plaza: string;
  empresaGrupo: string;
  galsa: number;
  lumaggs: number;
  total: number;
  udsGalsa: number;
  udsLumaggs: number;
  udsTotal: number;
  utilGalsa: number;
  utilLumaggs: number;
  utilTotal: number;
}

/** Agrega ventas de rvs_ventas_mes por persona */
export function agregarPorPersona(
  ventas: any[],
  personas: any[],
  plazaNombre: Map<string, string>,
  grupoNombre?: Map<string, string>
): FilaVentas[] {
  const personaMap = new Map<string, any>();
  personas.forEach((p) => personaMap.set(p.id, p));
  const acc = new Map<string, Omit<FilaVentas, "total" | "udsTotal" | "utilTotal">>();
  for (const v of ventas) {
    const p = personaMap.get(v.persona_id);
    if (!p) continue;
    const plazaId = v.plaza_id || p.plaza_id;
    if (!acc.has(v.persona_id))
      acc.set(v.persona_id, {
        key: v.persona_id,
        nombre: p.nombre_mostrar || p.nombre_reporte,
        plaza: (plazaId && plazaNombre.get(plazaId)) || "Sin plaza",
        empresaGrupo:
          (p.empresa_grupo_id && grupoNombre?.get(p.empresa_grupo_id)) || "Sin empresa / grupo",
        galsa: 0,
        lumaggs: 0,
        udsGalsa: 0,
        udsLumaggs: 0,
        utilGalsa: 0,
        utilLumaggs: 0,
      });

    const row = acc.get(v.persona_id)!;
    const monto = Number(v.venta || 0);
    const uds = Number(v.unidades || 0);
    const util = Number(v.utilidad || 0);
    if (esGalsa(v.marca)) {
      row.galsa += monto;
      row.udsGalsa += uds;
      row.utilGalsa += util;
    } else if (esLumaggs(v.marca)) {
      row.lumaggs += monto;
      row.udsLumaggs += uds;
      row.utilLumaggs += util;
    }
  }
  return Array.from(acc.values()).map((r) => ({
    ...r,
    total: r.galsa + r.lumaggs,
    udsTotal: r.udsGalsa + r.udsLumaggs,
    utilTotal: r.utilGalsa + r.utilLumaggs,
  }));
}

/** Agrega ventas de rvs_ventas_mes_plaza por plaza y calcula filas de zona */
export function agregarPorPlaza(
  ventasPlaza: any[],
  plazaNombre: Map<string, string>,
  zonas: any[],
  zonaPlazas: any[]
): { filas: (FilaVentas & { plazaId: string | null })[]; zonasFilas: FilaVentas[] } {
  const acc = new Map<
    string,
    {
      key: string;
      plazaId: string | null;
      nombre: string;
      galsa: number;
      lumaggs: number;
      udsGalsa: number;
      udsLumaggs: number;
      utilGalsa: number;
      utilLumaggs: number;
    }
  >();
  for (const v of ventasPlaza) {
    const key = v.plaza_id || `sr:${v.sucursal_reporte || "Sin plaza"}`;
    if (!acc.has(key))
      acc.set(key, {
        key,
        plazaId: v.plaza_id || null,
        nombre: (v.plaza_id && plazaNombre.get(v.plaza_id)) || v.sucursal_reporte || "Sin plaza",
        galsa: 0,
        lumaggs: 0,
        udsGalsa: 0,
        udsLumaggs: 0,
        utilGalsa: 0,
        utilLumaggs: 0,
      });
    const row = acc.get(key)!;
    const monto = Number(v.venta || 0);
    const uds = Number(v.unidades || 0);
    const util = Number(v.utilidad || 0);
    if (esGalsa(v.marca)) {
      row.galsa += monto;
      row.udsGalsa += uds;
      row.utilGalsa += util;
    } else if (esLumaggs(v.marca)) {
      row.lumaggs += monto;
      row.udsLumaggs += uds;
      row.utilLumaggs += util;
    }
  }
  const filas = Array.from(acc.values()).map((r) => ({
    key: r.key,
    plazaId: r.plazaId,
    nombre: r.nombre,
    plaza: r.nombre,
    empresaGrupo: "",

    galsa: r.galsa,
    lumaggs: r.lumaggs,
    total: r.galsa + r.lumaggs,
    udsGalsa: r.udsGalsa,
    udsLumaggs: r.udsLumaggs,
    udsTotal: r.udsGalsa + r.udsLumaggs,
    utilGalsa: r.utilGalsa,
    utilLumaggs: r.utilLumaggs,
    utilTotal: r.utilGalsa + r.utilLumaggs,
  }));

  const zonasFilas: FilaVentas[] = zonas.map((z: any) => {
    const plazaIds = zonaPlazas.filter((zp: any) => zp.zona_id === z.id).map((zp: any) => zp.plaza_id);
    const incluidas = filas.filter((f) => f.plazaId && plazaIds.includes(f.plazaId));
    const galsa = incluidas.reduce((s, f) => s + f.galsa, 0);
    const lumaggs = incluidas.reduce((s, f) => s + f.lumaggs, 0);
    const udsGalsa = incluidas.reduce((s, f) => s + f.udsGalsa, 0);
    const udsLumaggs = incluidas.reduce((s, f) => s + f.udsLumaggs, 0);
    const utilGalsa = incluidas.reduce((s, f) => s + f.utilGalsa, 0);
    const utilLumaggs = incluidas.reduce((s, f) => s + f.utilLumaggs, 0);
    return {
      key: `zona:${z.id}`,
      nombre: z.nombre,
      plaza: z.nombre,
      galsa,
      lumaggs,
      total: galsa + lumaggs,
      udsGalsa,
      udsLumaggs,
      udsTotal: udsGalsa + udsLumaggs,
      utilGalsa,
      utilLumaggs,
      utilTotal: utilGalsa + utilLumaggs,
    };
  });

  return { filas, zonasFilas };
}

export interface FilaComparativa {
  key: string;
  nombre: string;
  plaza: string;
  baseGalsa: number;
  baseLumaggs: number;
  baseTotal: number;
  actualGalsa: number;
  actualLumaggs: number;
  actualTotal: number;
  baseUdsGalsa: number;
  baseUdsLumaggs: number;
  baseUdsTotal: number;
  actualUdsGalsa: number;
  actualUdsLumaggs: number;
  actualUdsTotal: number;
  baseUtilGalsa: number;
  baseUtilLumaggs: number;
  baseUtilTotal: number;
  actualUtilGalsa: number;
  actualUtilLumaggs: number;
  actualUtilTotal: number;
  variacion: number | null; // porcentaje (venta $)
  variacionUds: number | null; // porcentaje (unidades)
}

/** Une dos periodos por key y calcula variación */
export function combinar(base: FilaVentas[], actual: FilaVentas[]): FilaComparativa[] {
  const keys = new Map<string, { nombre: string; plaza: string }>();
  [...base, ...actual].forEach((r) => keys.set(r.key, { nombre: r.nombre, plaza: r.plaza }));
  const baseMap = new Map(base.map((r) => [r.key, r]));
  const actualMap = new Map(actual.map((r) => [r.key, r]));

  return Array.from(keys.entries())
    .map(([key, meta]) => {
      const b = baseMap.get(key);
      const a = actualMap.get(key);
      const baseTotal = b?.total || 0;
      const actualTotal = a?.total || 0;
      const baseUdsTotal = b?.udsTotal || 0;
      const actualUdsTotal = a?.udsTotal || 0;
      return {
        key,
        nombre: meta.nombre,
        plaza: meta.plaza,
        baseGalsa: b?.galsa || 0,
        baseLumaggs: b?.lumaggs || 0,
        baseTotal,
        actualGalsa: a?.galsa || 0,
        actualLumaggs: a?.lumaggs || 0,
        actualTotal,
        baseUdsGalsa: b?.udsGalsa || 0,
        baseUdsLumaggs: b?.udsLumaggs || 0,
        baseUdsTotal,
        actualUdsGalsa: a?.udsGalsa || 0,
        actualUdsLumaggs: a?.udsLumaggs || 0,
        actualUdsTotal,
        baseUtilGalsa: b?.utilGalsa || 0,
        baseUtilLumaggs: b?.utilLumaggs || 0,
        baseUtilTotal: b?.utilTotal || 0,
        actualUtilGalsa: a?.utilGalsa || 0,
        actualUtilLumaggs: a?.utilLumaggs || 0,
        actualUtilTotal: a?.utilTotal || 0,
        variacion: baseTotal > 0 ? ((actualTotal - baseTotal) / baseTotal) * 100 : null,
        variacionUds: baseUdsTotal > 0 ? ((actualUdsTotal - baseUdsTotal) / baseUdsTotal) * 100 : null,
      };
    })
    .sort((x, y) => y.actualTotal - x.actualTotal);
}
