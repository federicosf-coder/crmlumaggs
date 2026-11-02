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
  const act = new Map<string, FilaActiva>();
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

  const activos = Array.from(act.values())
    .map((a) => ({ ...a, promedio: a.u90 / 3 }))
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
    clientes: activos.length,
    sinCompraMes: activos.filter((a) => a.esteMes <= 0).length,
  };

  return { activos, perdidos, kpis };
}
