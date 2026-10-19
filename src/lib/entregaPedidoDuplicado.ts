import { supabase } from "@/integrations/supabase/client";

/**
 * Returns a warning when an order number already arrived by email or is already scheduled.
 * `intakeId` excludes the email currently being processed.
 */
export async function buscarPedidoDuplicado(numeroPedido: string | null | undefined, intakeId?: string): Promise<string | null> {
  const num = String(numeroPedido || "").trim();
  if (!num) return null;
  const db = supabase as any;
  const { data: ents } = await db.from("entregas_corporativas")
    .select("id,cliente,fecha_programada,intake_ids").eq("numero_pedido", num).limit(20);
  const ajenas = (ents || []).filter((e: any) => !intakeId || !(e.intake_ids || []).includes(intakeId));
  if (ajenas.length) {
    return `Orden duplicada: el pedido #${num} ya está programado (${ajenas[0].cliente}, ${ajenas[0].fecha_programada}). No se volvió a subir.`;
  }
  let q = db.from("entregas_corporativas_intake").select("id,created_at,estatus")
    .eq("numero_pedido_detectado", num).neq("estatus", "descartado").limit(5);
  if (intakeId) q = q.neq("id", intakeId);
  const { data: correos } = await q;
  if (!intakeId && correos?.length) {
    const f = new Date(correos[0].created_at).toLocaleDateString("es-MX");
    return `Orden duplicada: el pedido #${num} ya se recibió por correo el ${f}. Procésalo desde «Correos de Chevron».`;
  }
  if (intakeId && (correos || []).some((c: any) => c.estatus === "procesado")) {
    return `Orden duplicada: el pedido #${num} ya fue procesado desde otro correo.`;
  }
  return null;
}
