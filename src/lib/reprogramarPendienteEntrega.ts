import { supabase } from "@/integrations/supabase/client";

/** Moves the remaining volume of an entrega to the client's next scheduled date and closes the current one. */
export async function reprogramarPendiente(entregaId: string, cliente: string, fechaActual: string) {
  const db = supabase as any;
  const { data: lineas, error } = await db.from("entregas_corporativas_lineas")
    .select("id,codigo_producto,nombre_producto,cantidad,cantidad_entregada").eq("entrega_id", entregaId);
  if (error) throw error;
  const pendientes = (lineas || []).map((l: any) => ({ ...l, pend: Math.max(0, Number(l.cantidad) - Number(l.cantidad_entregada || 0)) }))
    .filter((l: any) => l.pend > 0);
  if (!pendientes.length) return null;
  const { data: sig, error: e2 } = await db.from("entregas_corporativas").select("id,fecha_programada")
    .eq("cliente", cliente).eq("estatus", "programada").gt("fecha_programada", fechaActual).neq("id", entregaId)
    .order("fecha_programada").limit(1).maybeSingle();
  if (e2) throw e2;
  if (!sig) throw new Error("No hay una siguiente fecha programada para este cliente. El pendiente se conserva en esta entrega.");
  const { data: destino } = await db.from("entregas_corporativas_lineas").select("id,codigo_producto,cantidad").eq("entrega_id", sig.id);
  const map = new Map<string, any>((destino || []).map((d: any) => [String(d.codigo_producto), d]));
  for (const p of pendientes) {
    const d = map.get(String(p.codigo_producto));
    const r = d
      ? await db.from("entregas_corporativas_lineas").update({ cantidad: Number(d.cantidad) + p.pend }).eq("id", d.id)
      : await db.from("entregas_corporativas_lineas").insert({ entrega_id: sig.id, codigo_producto: p.codigo_producto, nombre_producto: p.nombre_producto, cantidad: p.pend });
    if (r.error) throw r.error;
    const c = await db.from("entregas_corporativas_lineas").update({ cantidad: Number(p.cantidad_entregada || 0) }).eq("id", p.id);
    if (c.error) throw c.error;
  }
  const { error: e3 } = await db.from("entregas_corporativas").update({ estatus: "entregada" }).eq("id", entregaId);
  if (e3) throw e3;
  return sig.fecha_programada as string;
}
