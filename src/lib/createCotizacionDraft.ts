import { supabase } from "@/integrations/supabase/client";

/**
 * Crea una cotización en borrador con líneas pre-llenadas a partir
 * de los productos seleccionados. Resuelve el precio unitario usando
 * companies.lista_precios (UF1..UF4 / R1..R4), igual que DocumentForm.
 * Devuelve el id del documento creado.
 */
export interface CreateCotizacionDraftParams {
  empresaId: string;
  contactoId?: string | null;
  productoIds: string[];
  empresaVendedora: "lumaggs_chevron" | "galsa_phillips66";
  ejecutivoId?: string | null;
  userId?: string | null;
  ivaPorcentaje?: number;
}

const PRICE_FIELD: Record<string, string> = {
  uf1: "precio_base_uf1", uf2: "precio_uf2", uf3: "precio_uf3", uf4: "precio_uf4",
  r1: "precio_r1", r2: "precio_r2", r3: "precio_r3", r4: "precio_r4",
};

export async function createCotizacionDraft(params: CreateCotizacionDraftParams): Promise<string> {
  const { empresaId, contactoId, productoIds, empresaVendedora, ejecutivoId, userId } = params;
  const ivaPct = params.ivaPorcentaje ?? 8;

  if (!empresaId) throw new Error("Falta empresa");
  if (!productoIds.length) throw new Error("Selecciona al menos un producto");

  const sb: any = supabase;

  const { data: company, error: cErr } = await sb
    .from("companies")
    .select("id, lista_precios")
    .eq("id", empresaId)
    .single();
  if (cErr || !company) throw cErr || new Error("Empresa no encontrada");

  const lista = (company.lista_precios || "").toLowerCase();
  const priceField = PRICE_FIELD[lista] || "precio_base_uf1";

  const { data: productos, error: pErr } = await sb
    .from("productos")
    .select("id, codigo, nombre_producto, precio_base_uf1, precio_uf2, precio_uf3, precio_uf4, precio_r1, precio_r2, precio_r3, precio_r4, presentaciones(unidades_equivalentes)")
    .in("id", productoIds);
  if (pErr) throw pErr;

  // 1. Insertar cabecera (totales se actualizan después)
  const { data: doc, error: dErr } = await sb
    .from("documentos")
    .insert({
      tipo_documento: "cotizacion",
      empresa_vendedora: empresaVendedora,
      empresa_id: empresaId,
      contacto_id: contactoId || null,
      ejecutivo_venta_id: ejecutivoId || null,
      created_by: userId || null,
      estatus_cotizacion: "borrador",
      iva_porcentaje: ivaPct,
      subtotal: 0,
      iva_importe: 0,
      total: 0,
      unidades_equivalentes_total: 0,
    })
    .select("id")
    .single();
  if (dErr || !doc) throw dErr || new Error("No se pudo crear el documento");

  // 2. Construir líneas
  const lineas = productoIds.map((pid) => {
    const prod: any = (productos || []).find((x: any) => x.id === pid);
    const precio = Number(prod?.[priceField] ?? prod?.precio_base_uf1 ?? 0);
    const ue = Number(prod?.presentaciones?.unidades_equivalentes ?? 1);
    const cantidad = 1;
    const subtotal = cantidad * precio;
    return {
      documento_id: doc.id,
      producto_id: pid,
      cantidad,
      precio_unitario: precio,
      descuento_porcentaje: 0,
      subtotal,
      unidades_equivalentes: cantidad * ue,
    };
  });

  if (lineas.length) {
    const { error: lErr } = await sb.from("documento_productos").insert(lineas);
    if (lErr) throw lErr;
  }

  // 3. Actualizar totales
  const subtotal = lineas.reduce((s, l) => s + l.subtotal, 0);
  const iva = subtotal * (ivaPct / 100);
  const total = subtotal + iva;
  const ueTotal = lineas.reduce((s, l) => s + l.unidades_equivalentes, 0);
  await sb
    .from("documentos")
    .update({ subtotal, iva_importe: iva, total, unidades_equivalentes_total: ueTotal })
    .eq("id", doc.id);

  return doc.id as string;
}