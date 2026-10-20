/**
 * Regla: las unidades de una factura son del ejecutivo que atiende a la empresa
 * en la plaza de la factura. Nunca se sugiere un ejecutivo de otra plaza.
 */
export interface FuentesEjecutivo {
  /** company_ejecutivos de la empresa con su plaza */
  asignados: { user_id: string; plaza_id: string | null }[];
  /** pedidos/cotizaciones recientes de la empresa (orden desc) */
  ultimosDocs: { ejecutivo_venta_id: string | null; plaza_id: string | null }[];
}

export function sugerirEjecutivoPorPlaza(fuentes: FuentesEjecutivo, plazaFactura: string | null): string | null {
  if (!plazaFactura) return null;
  const asignado = fuentes.asignados.find((a) => a.plaza_id === plazaFactura);
  if (asignado) return asignado.user_id;
  const doc = fuentes.ultimosDocs.find((d) => d.plaza_id === plazaFactura && d.ejecutivo_venta_id);
  if (doc) return doc.ejecutivo_venta_id;
  return null;
}
