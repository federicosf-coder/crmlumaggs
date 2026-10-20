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

import { supabase } from "@/integrations/supabase/client";

/**
 * Reemplaza los ejecutivos de una empresa conservando la plaza en que atiende
 * cada uno; los nuevos toman la plaza de su perfil.
 */
export async function syncEjecutivosConPlaza(companyId: string, userIds: string[]) {
  const sb = supabase as any;
  const [{ data: prev }, { data: perfiles }] = await Promise.all([
    sb.from("company_ejecutivos").select("user_id, plaza_id").eq("company_id", companyId),
    userIds.length ? sb.from("profiles").select("user_id, plaza_id").in("user_id", userIds) : Promise.resolve({ data: [] }),
  ]);
  const prevMap = new Map<string, string | null>((prev || []).map((r: any) => [r.user_id, r.plaza_id]));
  const perfMap = new Map<string, string | null>((perfiles || []).map((r: any) => [r.user_id, r.plaza_id]));
  await sb.from("company_ejecutivos").delete().eq("company_id", companyId);
  if (userIds.length) {
    await sb.from("company_ejecutivos").insert(
      userIds.map((uid) => ({ company_id: companyId, user_id: uid, plaza_id: prevMap.get(uid) ?? perfMap.get(uid) ?? null }))
    );
  }
}
