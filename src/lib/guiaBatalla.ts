// Cálculo de la "Guía de batalla" por ejecutivo.
// El corte es un mes (YYYY-MM). Las cifras históricas quedan fijas durante todo el mes:
//  - 90 días = los 3 meses completos anteriores al mes de corte.
//  - Promedio mensual = 90 días / 3.
//  - Mes anterior = mes completo previo al corte.
//  - Este mes = lo facturado dentro del mes de corte (se actualiza día a día).
// Clientes sin compra en 3 meses ni en el mes de corte pasan a "sin compra +91 días",
// con su total y promedio de los 12 meses previos al corte.

export interface FacturaGuia {
  empresa_id: string | null;
  cliente: string;
  fecha: string; // YYYY-MM-DD
  unidades: number;
}

export interface FilaActiva {
  empresa_id: string;
  cliente: string;
  u90: number;
  promedio: number;
  mesAnterior: number;
  esteMes: number;
  /** Días promedio entre compras (12 meses previos al corte); null si hay menos de 2 compras. */
  frecuenciaDias: number | null;
  /** Fecha estimada de la próxima compra (YYYY-MM-DD). */
  proximaCompra: string | null;
  /** Unidades que se espera compre en el mes de corte. */
  esperadoMes: number;
  atrasado: boolean;
}

export interface FilaPerdida {
  empresa_id: string;
  cliente: string;
  ultimaCompra: string;
  total: number;
  promedio: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function mesOffset(corte: string, delta: number): string {
  const [y, m] = corte.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

export function rangosCorte(corte: string) {
  return {
    inicioHistorico: mesOffset(corte, -12),
    inicio90: mesOffset(corte, -3),
    inicioMesAnterior: mesOffset(corte, -1),
    inicioCorte: mesOffset(corte, 0),
    finCorte: mesOffset(corte, 1),
  };
}

export function calcularGuia(facturas: FacturaGuia[], corte: string) {
  const r = rangosCorte(corte);
  const act = new Map<string, Omit<FilaActiva, "frecuenciaDias" | "proximaCompra" | "esperadoMes" | "atrasado">>();
  const hist = new Map<string, { cliente: string; total: number; ultima: string }>();

  for (const f of facturas) {
    if (!f.empresa_id) continue;
    const fecha = f.fecha.slice(0, 10);
    if (fecha < r.inicioHistorico || fecha >= r.finCorte) continue;
    const u = Number(f.unidades) || 0;
    const h = hist.get(f.empresa_id) ?? { cliente: f.cliente, total: 0, ultima: "" };
    h.total += u;
    if (fecha > h.ultima) h.ultima = fecha;
    hist.set(f.empresa_id, h);

    if (fecha >= r.inicio90) {
      const a = act.get(f.empresa_id) ?? {
        empresa_id: f.empresa_id, cliente: f.cliente, u90: 0, promedio: 0, mesAnterior: 0, esteMes: 0,
      };
      if (fecha >= r.inicioCorte) a.esteMes += u;
      else {
        a.u90 += u;
        if (fecha >= r.inicioMesAnterior) a.mesAnterior += u;
      }
      act.set(f.empresa_id, a);
    }
  }

  // Frecuencia: compras (días distintos) antes del corte, dentro de los 12 meses.
  const compras = new Map<string, Map<string, number>>();
  for (const f of facturas) {
    if (!f.empresa_id) continue;
    const fecha = f.fecha.slice(0, 10);
    if (fecha < r.inicioHistorico || fecha >= r.inicioCorte) continue;
    const m = compras.get(f.empresa_id) ?? new Map<string, number>();
    m.set(fecha, (m.get(fecha) ?? 0) + (Number(f.unidades) || 0));
    compras.set(f.empresa_id, m);
  }
  const DIA = 86400000;
  const toMs = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  const toStr = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const estimar = (id: string, promedio: number) => {
    const m = compras.get(id);
    const fechas = m ? Array.from(m.keys()).sort() : [];
    if (fechas.length < 2) {
      return { frecuenciaDias: null, proximaCompra: null, esperadoMes: promedio, atrasado: false };
    }
    const frec = (toMs(fechas[fechas.length - 1]) - toMs(fechas[0])) / DIA / (fechas.length - 1);
    const porCompra = Array.from(m!.values()).reduce((s, u) => s + u, 0) / fechas.length;
    const proxMs = toMs(fechas[fechas.length - 1]) + Math.round(frec) * DIA;
    const proxima = toStr(proxMs);
    const atrasado = proxima < r.inicioCorte;
    // Compras esperadas dentro del mes de corte (al menos 1 si ya está atrasado).
    const ini = toMs(r.inicioCorte), fin = toMs(r.finCorte);
    let n = 0;
    for (let t = Math.max(proxMs, ini); t < fin; t += Math.max(1, Math.round(frec)) * DIA) n++;
    if (atrasado && n === 0) n = 1;
    return { frecuenciaDias: Math.round(frec), proximaCompra: proxima, esperadoMes: n * porCompra, atrasado };
  };

  const activos = Array.from(act.values())
    .map((a) => ({ ...a, promedio: a.u90 / 3, ...estimar(a.empresa_id, a.u90 / 3) }))
    .sort((a, b) => b.u90 - a.u90 || b.esteMes - a.esteMes);

  const perdidos: FilaPerdida[] = Array.from(hist.entries())
    .filter(([id]) => !act.has(id))
    .map(([id, h]) => ({ empresa_id: id, cliente: h.cliente, ultimaCompra: h.ultima, total: h.total, promedio: h.total / 12 }))
    .sort((a, b) => b.total - a.total);

  const kpis = {
    u90: activos.reduce((s, a) => s + a.u90, 0),
    promedio: activos.reduce((s, a) => s + a.promedio, 0),
    mesAnterior: activos.reduce((s, a) => s + a.mesAnterior, 0),
    esteMes: activos.reduce((s, a) => s + a.esteMes, 0),
    esperadoMes: activos.reduce((s, a) => s + a.esperadoMes, 0),
    clientes: activos.length,
    sinCompraMes: activos.filter((a) => a.esteMes <= 0).length,
  };

  return { activos, perdidos, kpis };
}
