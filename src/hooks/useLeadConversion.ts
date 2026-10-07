import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mecanismo central de conversión Prospecto → Cliente.
 * Toda pantalla (Bandeja de Prospectos, WhatsApp, etc.) debe leer de aquí.
 * Factura válida = tipo factura, estatus distinto de cancelada. Conversión a nivel empresa.
 */

export const CANALES = [
  "whatsapp", "facebook", "web", "formulario", "campana", "carga_manual", "otro", "desconocido",
] as const;
export type Canal = (typeof CANALES)[number];

export const CANAL_LABEL: Record<Canal, string> = {
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  web: "Sitio web",
  formulario: "Formulario",
  campana: "Campaña",
  carga_manual: "Carga manual",
  otro: "Otro",
  desconocido: "Desconocido",
};

export type EstadoComercial = "prospecto" | "convertido" | "cliente_previo" | "desconocido";

export const ESTADO_COMERCIAL_LABEL: Record<EstadoComercial, string> = {
  prospecto: "Prospecto",
  convertido: "Cliente convertido",
  cliente_previo: "Cliente previo",
  desconocido: "Desconocido",
};

export interface LeadConversionRow {
  lead_id: string;
  canal: Canal;
  empresa_id: string | null;
  empresa_nombre: string | null;
  estado: EstadoComercial;
  primera_compra: string | null;
  ultima_compra: string | null;
  num_facturas: number;
  facturacion: number;
  leads_en_empresa: number;
  atribuible: boolean;
}

export function useLeadsConversion() {
  return useQuery({
    queryKey: ["leads-conversion"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_leads_conversion");
      if (error) throw error;
      const map = new Map<string, LeadConversionRow>();
      for (const r of (data ?? []) as any[]) {
        map.set(r.lead_id, {
          ...r,
          num_facturas: Number(r.num_facturas ?? 0),
          facturacion: Number(r.facturacion ?? 0),
          leads_en_empresa: Number(r.leads_en_empresa ?? 0),
        });
      }
      return map;
    },
    staleTime: 60000,
  });
}

export interface ConversionMetrics {
  prospectos: number;
  convertidos: number;
  previos: number;
  elegibles: number;
  tasa: number | null;
  atribuida: number;
  noAtribuida: number;
}

/**
 * Prospectos y clientes se cuentan por prospecto.
 * La facturación se suma UNA vez por empresa:
 *  - atribuida: empresa con un solo prospecto, canal conocido, convertida después del prospecto.
 *  - no atribuida: empresas convertidas restantes (varias fuentes o canal desconocido).
 *  - clientes previos no suman facturación a ningún canal.
 */
export function computeConversionMetrics(rows: LeadConversionRow[]): ConversionMetrics {
  let convertidos = 0, previos = 0, desconocidos = 0;
  const atribuidas = new Map<string, number>();
  const noAtribuidas = new Map<string, number>();
  for (const r of rows) {
    if (r.estado === "convertido") convertidos++;
    else if (r.estado === "cliente_previo") previos++;
    else if (r.estado === "desconocido") desconocidos++;
    if (r.estado !== "convertido" || !r.empresa_id) continue;
    if (r.atribuible) atribuidas.set(r.empresa_id, r.facturacion);
    else noAtribuidas.set(r.empresa_id, r.facturacion);
  }
  for (const id of atribuidas.keys()) noAtribuidas.delete(id);
  const elegibles = rows.length - previos - desconocidos;
  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  return {
    prospectos: rows.length,
    convertidos,
    previos,
    elegibles,
    tasa: elegibles > 0 ? convertidos / elegibles : null,
    atribuida: sum(atribuidas),
    noAtribuida: sum(noAtribuidas),
  };
}

/** Estado de compra por empresa (misma regla de factura válida). Para vistas sin prospecto, ej. WhatsApp. */
export function useEmpresasEstadoCompra(empresaIds: (string | null | undefined)[]) {
  const ids = [...new Set(empresaIds.filter(Boolean) as string[])].sort();
  return useQuery({
    queryKey: ["empresas-estado-compra", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const map = new Map<string, { num_facturas: number; primera_compra: string | null; ultima_compra: string | null }>();
      for (let i = 0; i < ids.length; i += 150) {
        const { data, error } = await (supabase as any).rpc("get_empresas_estado_compra", { _empresa_ids: ids.slice(i, i + 150) });
        if (error) throw error;
        for (const r of (data ?? []) as any[]) {
          map.set(r.empresa_id, { num_facturas: Number(r.num_facturas), primera_compra: r.primera_compra, ultima_compra: r.ultima_compra });
        }
      }
      return map;
    },
    staleTime: 60000,
  });
}
