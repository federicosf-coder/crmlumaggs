import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabasePagination";
import { formatDate } from "@/lib/formatters";

function resolveEmpresaCosto(empresaVendedora: string): "lumaggs" | "galsa" {
  return empresaVendedora === "galsa_phillips66" ? "galsa" : "lumaggs";
}

function formatMonthYearUpper(mesYYYYMM: string): string {
  const [y, m] = mesYYYYMM.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const monthName = d.toLocaleString("es-MX", { month: "long" });
  return `${monthName.toUpperCase()} ${y}`;
}

export async function computeHistoricoCliente(
  empresaId: string,
  empresaVendedora: string
) {
  const allDocs = await fetchAllRows<any>(async (from, to) => {
    return (supabase as any)
      .from("documentos")
      .select("fecha_documento, unidades_equivalentes_total")
      .eq("empresa_id", empresaId)
      .eq("tipo_documento", "factura")
      .eq("is_active", true)
      .eq("empresa_vendedora", empresaVendedora)
      .neq("estatus_factura", "cancelada")
      .range(from, to);
  });

  const mesesMap = new Map<string, number>();
  let fechaMin: Date | null = null;

  for (const doc of allDocs) {
    const fecha = doc.fecha_documento ? new Date(doc.fecha_documento) : null;
    if (!fecha || Number.isNaN(fecha.getTime())) continue;

    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, "0");
    const key = `${y}-${m}`;

    mesesMap.set(key, (mesesMap.get(key) || 0) + (Number(doc.unidades_equivalentes_total) || 0));

    if (!fechaMin || fecha < fechaMin) {
      fechaMin = fecha;
    }
  }

  const mesesRaw = Array.from(mesesMap.entries())
    .map(([mes, unidades]) => ({ mes, unidades }))
    .sort((a, b) => a.mes.localeCompare(b.mes));

  const acumuladoUnidades = mesesRaw.reduce((s, m) => s + m.unidades, 0);
  const numeroMeses = mesesRaw.length;
  const promedioMensual = numeroMeses > 0 ? acumuladoUnidades / numeroMeses : 0;
  const fechaDesde = fechaMin ? formatDate(fechaMin) : null;

  const ultimos6 = mesesRaw.slice(-6);
  const historicoLista =
    ultimos6.length > 0
      ? ultimos6
          .map(
            (m) =>
              `<div>${formatMonthYearUpper(m.mes)} — ${new Intl.NumberFormat(
                "es-MX"
              ).format(m.unidades)} unidades</div>`
          )
          .join("")
      : "<em>Sin historial de facturación</em>";

  return {
    historicoLista,
    acumuladoUnidades,
    fechaDesde,
    promedioMensual,
    mesesRaw,
  };
}

export async function buildAutorizacionPrecioDraft(
  documentoId: string,
  creadoPor: string | null
) {
  const { data: documento, error: docError } = await (supabase as any)
    .from("documentos")
    .select(
      "id, empresa_id, empresa_vendedora, numero_pedido, ejecutivo_venta_id, tipo_pago, companies(name, razon_social, justificacion_precio_default)"
    )
    .eq("id", documentoId)
    .maybeSingle();

  if (docError) throw docError;
  if (!documento) throw new Error("Documento no encontrado");

  const empresaCosto = resolveEmpresaCosto(documento.empresa_vendedora);

  const { data: lineas, error: lineasError } = await (supabase as any)
    .from("documento_productos")
    .select(
      "cantidad, precio_unitario, subtotal, producto:productos(codigo, descripcion)"
    )
    .eq("documento_id", documentoId);

  if (lineasError) throw lineasError;

  const costoMargenSnapshot: {
    codigo: string;
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    costo: number | null;
    margen_porcentaje: number | null;
  }[] = [];

  for (const linea of lineas || []) {
    const codigo = linea.producto?.codigo || "";
    const descripcion = linea.producto?.descripcion || "";
    const cantidad = Number(linea.cantidad) || 0;
    const precio_unitario = Number(linea.precio_unitario) || 0;

    let costo: number | null = null;
    if (codigo) {
      const { data: costoRow } = await (supabase as any)
        .from("inv_costos_producto")
        .select("costo_efectivo")
        .eq("codigo_producto", codigo)
        .eq("empresa", empresaCosto)
        .maybeSingle();

      if (costoRow?.costo_efectivo != null) {
        costo = Number(costoRow.costo_efectivo);
      }
    }

    let margen_porcentaje: number | null = null;
    if (costo != null && precio_unitario > 0) {
      margen_porcentaje = Math.round(((precio_unitario - costo) / precio_unitario) * 1000) / 10;
    }

    costoMargenSnapshot.push({
      codigo,
      descripcion,
      cantidad,
      precio_unitario,
      costo,
      margen_porcentaje,
    });
  }

  const historico = await computeHistoricoCliente(
    documento.empresa_id,
    documento.empresa_vendedora
  );

  const historicoTexto =
    historico.mesesRaw.length > 0
      ? historico.mesesRaw
          .map((m) => `${formatMonthYearUpper(m.mes)}: ${m.unidades} unidades`)
          .join("\n")
      : "Sin historial de facturación";

  const justificacionDefault = documento.companies?.justificacion_precio_default;
  const partes: string[] = [];
  partes.push(
    `Histórico:\n${historicoTexto}\nAcumulado desde ${
      historico.fechaDesde ?? "—"
    }: ${new Intl.NumberFormat("es-MX").format(
      historico.acumuladoUnidades
    )} unidades. Promedio mensual: ${new Intl.NumberFormat("es-MX").format(
      historico.promedioMensual
    )} unidades.`
  );
  if (justificacionDefault) {
    partes.push("", justificacionDefault);
  }
  const justificacion = partes.join("\n").trim();

  const { count: countExistentes, error: countError } = await (supabase as any)
    .from("documento_autorizaciones_precio")
    .select("id", { count: "exact", head: true })
    .eq("documento_id", documentoId);

  if (countError) throw countError;
  const ronda = (countExistentes ?? 0) + 1;

  const { data: insertado, error: insertError } = await (supabase as any)
    .from("documento_autorizaciones_precio")
    .insert({
      documento_id: documentoId,
      ronda,
      estatus: "pendiente_revision",
      justificacion,
      historico_snapshot: {
        mesesRaw: historico.mesesRaw,
        acumuladoUnidades: historico.acumuladoUnidades,
        fechaDesde: historico.fechaDesde,
        promedioMensual: historico.promedioMensual,
      },
      costo_margen_snapshot: costoMargenSnapshot,
      creado_por: creadoPor,
      numero_pedido_ref: documento.numero_pedido,
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return insertado;
}
