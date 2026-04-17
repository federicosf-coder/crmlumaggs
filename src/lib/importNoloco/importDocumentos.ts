import { supabase } from "@/integrations/supabase/client";

export interface ImportDocsParams {
  rows: Record<string, string>[];
  plazaMap: Map<string, string>;
  ejecutivoMap: Map<string, string>;
  onProgress?: (done: number, total: number) => void;
}

export interface ImportDocsLog {
  insertados: number;
  actualizados: number;
  omitidos_empresa_invalida: { row: number; empresa_id: string; numero: string }[];
  errores: { row: number; numero: string; error: string }[];
  relaciones: { company_ejecutivos_creadas: number; company_plazas_creadas: number };
}

const TIPO_DOC_VALIDOS = new Set(["cotizacion", "pedido", "factura"]);

const emptyToNull = (v: string | undefined | null): string | null => {
  if (v === undefined || v === null) return null;
  const t = v.toString().trim();
  return t === "" ? null : t;
};

const numOrNull = (v: string | undefined | null): number | null => {
  const t = emptyToNull(v);
  if (t === null) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const stripSpaces = (s: string | null) => (s ? s.replace(/\s+/g, "") : s);

export async function importDocumentos(params: ImportDocsParams): Promise<ImportDocsLog> {
  const { rows, plazaMap, ejecutivoMap, onProgress } = params;
  const log: ImportDocsLog = {
    insertados: 0,
    actualizados: 0,
    omitidos_empresa_invalida: [],
    errores: [],
    relaciones: { company_ejecutivos_creadas: 0, company_plazas_creadas: 0 },
  };

  // Cache de empresas válidas
  const { data: companies, error: cErr } = await supabase.from("companies").select("id");
  if (cErr) throw cErr;
  const companyIds = new Set((companies || []).map((c) => c.id));

  // Cache de documentos existentes para dedupe
  const { data: existingDocs, error: dErr } = await supabase
    .from("documentos")
    .select("id, numero_cotizacion, numero_pedido, numero_factura");
  if (dErr) throw dErr;
  const byCot = new Map<string, string>();
  const byPed = new Map<string, string>();
  const byFac = new Map<string, string>();
  (existingDocs || []).forEach((d) => {
    if (d.numero_cotizacion) byCot.set(d.numero_cotizacion.trim(), d.id);
    if (d.numero_pedido) byPed.set(d.numero_pedido.trim(), d.id);
    if (d.numero_factura) byFac.set((d.numero_factura.replace(/\s+/g, "") || "").trim(), d.id);
  });

  // Cache de relaciones para evitar duplicados
  const { data: ce } = await supabase.from("company_ejecutivos").select("company_id, user_id");
  const ceSet = new Set((ce || []).map((r) => `${r.company_id}|${r.user_id}`));
  const { data: cp } = await supabase.from("company_plazas").select("company_id, plaza_id");
  const cpSet = new Set((cp || []).map((r) => `${r.company_id}|${r.plaza_id}`));

  const total = rows.length;
  const BATCH = 25;

  for (let i = 0; i < total; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await Promise.all(batch.map(async (row, idx) => {
      const rowNum = i + idx + 2; // +2 por header y 1-indexed
      const numeroLog =
        emptyToNull(row.numero_factura) ||
        emptyToNull(row.numero_pedido) ||
        emptyToNull(row.numero_cotizacion) ||
        `(fila ${rowNum})`;

      try {
        const empresa_id = emptyToNull(row.empresa_id);
        if (!empresa_id || !companyIds.has(empresa_id)) {
          log.omitidos_empresa_invalida.push({ row: rowNum, empresa_id: empresa_id || "", numero: numeroLog });
          return;
        }

        const tipo_documento = emptyToNull(row.tipo_documento) || "cotizacion";
        if (!TIPO_DOC_VALIDOS.has(tipo_documento)) {
          log.errores.push({ row: rowNum, numero: numeroLog, error: `tipo_documento inválido: ${tipo_documento}` });
          return;
        }

        const empresa_vendedora = emptyToNull(row.empresa_vendedora);
        if (!empresa_vendedora) {
          log.errores.push({ row: rowNum, numero: numeroLog, error: "empresa_vendedora requerida" });
          return;
        }

        // Resolver plaza
        let plaza_id: string | null = null;
        const plazaResuelto = emptyToNull(row.plaza_id_resuelto) || emptyToNull(row.plaza_id);
        if (plazaResuelto) {
          plaza_id = plazaMap.get(plazaResuelto) || (companyIds.size && plazaResuelto) || null;
          // Si el id ya es real (no placeholder), úsalo tal cual
          if (!plazaMap.has(plazaResuelto)) plaza_id = plazaResuelto;
        }

        // Resolver ejecutivo
        let ejecutivo_venta_id: string | null = null;
        const ejecResuelto = emptyToNull(row.ejecutivo_venta_id_resuelto) || emptyToNull(row.ejecutivo_venta_id);
        if (ejecResuelto) {
          ejecutivo_venta_id = ejecutivoMap.get(ejecResuelto) || ejecResuelto;
          if (!ejecutivoMap.has(ejecResuelto)) ejecutivo_venta_id = ejecResuelto;
        }

        // numero_factura sin espacios
        const numero_factura_raw = emptyToNull(row.numero_factura);
        const numero_factura = numero_factura_raw ? numero_factura_raw.replace(/\s+/g, "") : null;
        const numero_pedido = emptyToNull(row.numero_pedido);
        const numero_cotizacion = emptyToNull(row.numero_cotizacion);

        // Detectar duplicado
        let existingId: string | null = null;
        if (numero_factura && byFac.has(numero_factura)) existingId = byFac.get(numero_factura)!;
        else if (numero_pedido && byPed.has(numero_pedido)) existingId = byPed.get(numero_pedido)!;
        else if (numero_cotizacion && byCot.has(numero_cotizacion)) existingId = byCot.get(numero_cotizacion)!;

        const payload: Record<string, any> = {
          empresa_vendedora,
          plaza_id,
          tipo_documento,
          ejecutivo_venta_id,
          empresa_id,
          contacto_id: emptyToNull(row.contacto_id),
          fecha_documento: emptyToNull(row.fecha_documento) || new Date().toISOString().slice(0, 10),
          fecha_vencimiento: emptyToNull(row.fecha_vencimiento),
          iva_porcentaje: numOrNull(row.iva_porcentaje) ?? 8,
          numero_cotizacion,
          numero_pedido,
          numero_factura,
          estatus_cotizacion: emptyToNull(row.estatus_cotizacion),
          estatus_pedido: emptyToNull(row.estatus_pedido),
          estatus_factura: emptyToNull(row.estatus_factura),
          subtotal: numOrNull(row.subtotal) ?? 0,
          iva_importe: numOrNull(row.iva_importe) ?? 0,
          total: numOrNull(row.total) ?? 0,
          unidades_equivalentes_total: numOrNull(row.unidades_equivalentes_total) ?? 0,
          negocio_crm: emptyToNull(row.negocio_crm),
          notas: emptyToNull(row.notas),
          pdf_url: emptyToNull(row.pdf_url),
          numero_oc_cliente: emptyToNull(row.numero_oc_cliente),
          direccion_envio: emptyToNull(row.direccion_envio),
          cotizacion_original_id: emptyToNull(row.cotizacion_original_id),
          tipo_pago: emptyToNull(row.tipo_pago),
          uso_cfdi: emptyToNull(row.uso_cfdi),
          metodo_pago: emptyToNull(row.metodo_pago),
          is_active: (row.is_active || "true").toLowerCase() !== "false",
          fecha_entrega_programada: emptyToNull(row.fecha_entrega_programada),
          saldo_pendiente_cobranza: numOrNull(row.saldo_pendiente_cobranza) ?? 0,
          estado_cobranza: emptyToNull(row.estado_cobranza),
          direccion_envio_lat: numOrNull(row.direccion_envio_lat),
          direccion_envio_lng: numOrNull(row.direccion_envio_lng),
        };

        // Quitar nulos para no pisar campos en update
        const updatePayload: Record<string, any> = {};
        Object.entries(payload).forEach(([k, v]) => { if (v !== null && v !== undefined) updatePayload[k] = v; });

        if (existingId) {
          const { error: uErr } = await supabase.from("documentos").update(updatePayload as any).eq("id", existingId);
          if (uErr) throw uErr;
          log.actualizados++;
        } else {
          const { data: inserted, error: iErr } = await supabase
            .from("documentos")
            .insert(payload as any)
            .select("id")
            .single();
          if (iErr || !inserted) throw iErr || new Error("Insert vacío");
          log.insertados++;
          // actualizar caches para evitar duplicados en el mismo lote
          if (numero_cotizacion) byCot.set(numero_cotizacion, inserted.id);
          if (numero_pedido) byPed.set(numero_pedido, inserted.id);
          if (numero_factura) byFac.set(numero_factura, inserted.id);
          existingId = inserted.id;
        }

        // Relaciones complementarias
        if (ejecutivo_venta_id) {
          const k = `${empresa_id}|${ejecutivo_venta_id}`;
          if (!ceSet.has(k)) {
            const { error: ceErr } = await supabase
              .from("company_ejecutivos")
              .insert({ company_id: empresa_id, user_id: ejecutivo_venta_id });
            if (!ceErr) { ceSet.add(k); log.relaciones.company_ejecutivos_creadas++; }
          }
        }
        if (plaza_id) {
          const k = `${empresa_id}|${plaza_id}`;
          if (!cpSet.has(k)) {
            const { error: cpErr } = await supabase
              .from("company_plazas")
              .insert({ company_id: empresa_id, plaza_id });
            if (!cpErr) { cpSet.add(k); log.relaciones.company_plazas_creadas++; }
          }
        }
      } catch (err: any) {
        log.errores.push({ row: rowNum, numero: numeroLog, error: err?.message || String(err) });
      }
    }));

    onProgress?.(Math.min(i + BATCH, total), total);
  }

  return log;
}
