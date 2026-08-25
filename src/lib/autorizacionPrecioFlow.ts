import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabasePagination";
import { formatDate } from "@/lib/formatters";
import {
  normalizeDatosCliente,
  labelTipoPago,
  labelFormaPago,
  labelMetodoPago,
  labelUsoCfdi,
  labelListaPrecios,
} from "@/lib/autorizacionDatosCliente";
import { extractDocFilesPath } from "@/lib/storageSignedUrl";



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
      "id, empresa_id, empresa_vendedora, numero_pedido, numero_factura, ejecutivo_venta_id, tipo_pago, companies(name, razon_social, justificacion_precio_default, industrias, tipo_destino_lubricante, lista_precios, limite_credito, tipo_pago, forma_pago, metodo_pago, uso_cfdi)"
    )
    .eq("id", documentoId)
    .maybeSingle();

  if (docError) throw docError;
  if (!documento) throw new Error("Documento no encontrado");

  const empresaCosto = resolveEmpresaCosto(documento.empresa_vendedora);


  const { data: lineas, error: lineasError } = await (supabase as any)
    .from("documento_productos")
    .select(
      "cantidad, precio_unitario, subtotal, producto:productos(codigo, nombre_producto, costo_actual, presentacion:presentaciones(nombre))"
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
    const descripcion = `${linea.producto?.nombre_producto || ""}${
      linea.producto?.presentacion?.nombre
        ? " — " + linea.producto.presentacion.nombre
        : ""
    }`.trim();
    const cantidad = Number(linea.cantidad) || 0;
    const precio_unitario = Number(linea.precio_unitario) || 0;

    let costo: number | null =
      linea.producto?.costo_actual != null ? Number(linea.producto.costo_actual) : null;


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

  const justificacion = (documento.companies?.justificacion_precio_default || "").trim();

  const c = documento.companies || {};
  const datosClienteSnapshot = {
    industrias: Array.isArray(c.industrias) ? c.industrias : [],
    tipo_destino_lubricante: c.tipo_destino_lubricante || null,
    lista_precios: c.lista_precios || null,
    limite_credito: c.limite_credito != null ? Number(c.limite_credito) : null,
    tipo_pago: c.tipo_pago || null,
    forma_pago: c.forma_pago || null,
    metodo_pago: c.metodo_pago || null,
    uso_cfdi: c.uso_cfdi || null,
  };




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
      datos_cliente_snapshot: datosClienteSnapshot,

      creado_por: creadoPor,
      numero_pedido_ref: documento.numero_pedido || documento.numero_factura || "—",
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return insertado;
}

export async function buildAutorizacionPrecioEmailFlow(autorizacionId: string) {
  // 1. Autorización + documento + empresa
  const { data: autorizacion, error: authError } = await (supabase as any)
    .from("documento_autorizaciones_precio")
    .select(
      "id, documento_id, justificacion, costo_margen_snapshot, historico_snapshot, datos_cliente_snapshot, numero_pedido_ref, documentos(id, numero_pedido, numero_factura, pdf_url, ejecutivo_venta_id, companies(name, razon_social, industrias, tipo_destino_lubricante, lista_precios, limite_credito, tipo_pago, forma_pago, metodo_pago, uso_cfdi))"
    )
    .eq("id", autorizacionId)
    .maybeSingle();

  if (authError) throw authError;
  if (!autorizacion) throw new Error("Autorización no encontrada");

  const documento = autorizacion.documentos;

  // 2. Perfil del ejecutivo
  let ejecutivoNombre = "—";
  let ejecutivoEmail: string | null = null;
  if (documento?.ejecutivo_venta_id) {
    const { data: perfil } = await (supabase as any)
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", documento.ejecutivo_venta_id)
      .maybeSingle();
    if (perfil) {
      ejecutivoNombre = perfil.full_name || "—";
      ejecutivoEmail = perfil.email || null;
    }
  }

  // 3. Tabla de productos
  const costoMargenSnapshot = autorizacion.costo_margen_snapshot || [];
  const fmtCurrency = (v: number | null | undefined) =>
    v == null
      ? "—"
      : new Intl.NumberFormat("es-MX", {
          style: "currency",
          currency: "MXN",
        }).format(v);
  const fmtNumber = (v: number | null | undefined) =>
    v == null ? "—" : new Intl.NumberFormat("es-MX").format(v);

  const productosLista = `
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;width:100%">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="text-align:left">Código</th>
          <th style="text-align:left">Descripción</th>
          <th style="text-align:right">Cantidad</th>
          <th style="text-align:right">Precio venta</th>
          <th style="text-align:right">Costo (CRM)</th>
          <th style="text-align:right">Margen % (CRM)</th>
        </tr>
      </thead>
      <tbody>
        ${costoMargenSnapshot
          .map(
            (p: any) => `
          <tr>
            <td>${p.codigo || "—"}</td>
            <td>${p.descripcion || "—"}</td>
            <td style="text-align:right">${fmtNumber(p.cantidad)}</td>
            <td style="text-align:right">${fmtCurrency(p.precio_unitario)}</td>
            <td style="text-align:right">${fmtCurrency(p.costo)}</td>
            <td style="text-align:right">${
              p.margen_porcentaje == null
                ? "—"
                : `${new Intl.NumberFormat("es-MX").format(p.margen_porcentaje)}%`
            }</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `.trim();

  // 4. Histórico (mismo formato que computeHistoricoCliente)
  const historicoSnapshot = autorizacion.historico_snapshot || {};
  const mesesRaw = historicoSnapshot.mesesRaw || [];
  const ultimos6 = mesesRaw.slice(-6);
  const historicoLista =
    ultimos6.length > 0
      ? `<ul>${ultimos6
          .map(
            (m: any) =>
              `<li>${formatMonthYearUpper(m.mes)} — ${new Intl.NumberFormat(
                "es-MX"
              ).format(Number(m.unidades) || 0)} unidades</li>`
          )
          .join("")}</ul>`
      : "<em>Sin historial de facturación</em>";

  // 5. Evidencias con signed URLs de 7 días
  const { data: evidenciasRows } = await (supabase as any)
    .from("documento_autorizacion_evidencias")
    .select("storage_path, nombre_archivo")
    .eq("autorizacion_id", autorizacionId);

  const comprobantes: { nombre: string; url: string }[] = [];

  // 5a. PDF del pedido / cotización original (bucket privado document-files).
  // Si el documento aún no tiene PDF, se genera con la misma función de cotización.
  let documentoPdfLista = "<em>Sin PDF del documento</em>";
  let pdfUrlDoc: string | null = documento?.pdf_url || null;
  const documentoIdReal = documento?.id || autorizacion.documento_id;
  if (!pdfUrlDoc && documentoIdReal) {
    try {
      await supabase.functions.invoke("generate-cotizacion-pdf", {
        body: { documento_id: documentoIdReal },
      });
      const { data: refetched } = await (supabase as any)
        .from("documentos")
        .select("pdf_url")
        .eq("id", documentoIdReal)
        .maybeSingle();
      pdfUrlDoc = refetched?.pdf_url || null;
    } catch {
      /* no se pudo generar el PDF */
    }
  }
  if (pdfUrlDoc) {
    try {
      const pdfPath = extractDocFilesPath(pdfUrlDoc);
      const { data: signedPdf } = await supabase.storage
        .from("document-files")
        .createSignedUrl(pdfPath, 60 * 60 * 24 * 7);
      if (signedPdf?.signedUrl) {
        const nombrePdf = `${documento?.numero_pedido || autorizacion.numero_pedido_ref || "documento"}.pdf`;
        comprobantes.push({ nombre: nombrePdf, url: signedPdf.signedUrl });
        documentoPdfLista = `<ul><li><a href="${signedPdf.signedUrl}">${nombrePdf}</a></li></ul>`;
      }
    } catch {
      /* sin PDF disponible */
    }
  }


  for (const ev of evidenciasRows || []) {
    try {
      const { data: signed } = await supabase.storage
        .from("autorizacion-precios")
        .createSignedUrl(ev.storage_path, 60 * 60 * 24 * 7);
      if (signed?.signedUrl) {
        comprobantes.push({
          nombre: ev.nombre_archivo || ev.storage_path,
          url: signed.signedUrl,
        });
      }
    } catch {
      /* omitir evidencia sin URL */
    }
  }
  const evidencias = comprobantes.filter((c) => !documentoPdfLista.includes(c.url));
  const evidenciasLista = evidencias.length
    ? `<ul>${evidencias
        .map((c) => `<li><a href="${c.url}">${c.nombre}</a></li>`)
        .join("")}</ul>`
    : "<em>Sin evidencia adjunta</em>";


  // 5b. Clasificación y detalles de facturación (snapshot editable del documento)
  const snapDatos = autorizacion.datos_cliente_snapshot;
  const datos = normalizeDatosCliente(
    snapDatos && Object.keys(snapDatos).length > 0 ? snapDatos : documento?.companies || {}
  );

  let industriasEtiquetas: string[] = datos.industrias;
  if (datos.industrias.length > 0) {
    try {
      const { data: catalogo } = await (supabase as any)
        .from("industrias_catalog")
        .select("clave, etiqueta");
      industriasEtiquetas = datos.industrias.map(
        (clave) => (catalogo || []).find((c: any) => c.clave === clave)?.etiqueta || clave
      );
    } catch {
      industriasEtiquetas = datos.industrias;
    }
  }

  const rowsHtml = (pares: [string, string | null][]) =>
    `<table cellpadding="4" cellspacing="0" style="font-family:Arial,sans-serif;font-size:14px">
      ${pares
        .map(
          ([k, v]) =>
            `<tr><td style="color:#6b7280">${k}</td><td><strong>${v && String(v).trim() ? v : "—"}</strong></td></tr>`
        )
        .join("")}
    </table>`.trim();

  const clasificacionLista = rowsHtml([
    ["Industria", industriasEtiquetas.length ? industriasEtiquetas.join(", ") : null],
    ["Tipo según destino del lubricante", datos.tipo_destino_lubricante],
    ["Lista de precios", labelListaPrecios(datos.lista_precios)],
  ]);

  const facturacionLista = rowsHtml([
    ["Límite de crédito", datos.limite_credito != null ? fmtCurrency(datos.limite_credito) : null],
    ["Tipo de pago", labelTipoPago(datos.tipo_pago)],
    ["Forma de pago (SAT)", labelFormaPago(datos.forma_pago)],
    ["Método de pago", labelMetodoPago(datos.metodo_pago)],
    ["Uso de CFDI", labelUsoCfdi(datos.uso_cfdi)],
  ]);

  // 6. Variables de plantilla
  const numeroFacturaDoc = String(documento?.numero_factura || "").trim();
  const facturaBloque = numeroFacturaDoc
    ? `<p style="font-family:Arial,sans-serif;font-size:14px"><strong>Número de factura:</strong> ${numeroFacturaDoc}</p>`
    : "";

  const tplVars: Record<string, string> = {
    cliente: documento?.companies?.name || "—",
    razon_social: documento?.companies?.razon_social || "—",
    ejecutivo: ejecutivoNombre,
    numero_pedido:
      documento?.numero_pedido || documento?.numero_factura || autorizacion.numero_pedido_ref || "—",
    numero_factura: numeroFacturaDoc,
    factura_bloque: facturaBloque,
    productos_lista: productosLista,
    historico_lista: historicoLista,
    acumulado_unidades: fmtNumber(historicoSnapshot.acumuladoUnidades),
    fecha_acumulado_desde: historicoSnapshot.fechaDesde || "—",
    promedio_mensual: fmtNumber(historicoSnapshot.promedioMensual),
    justificacion: autorizacion.justificacion || "—",
    evidencias_lista: evidenciasLista,
    documento_pdf_lista: documentoPdfLista,

    clasificacion_lista: clasificacionLista,
    facturacion_lista: facturacionLista,
  };


  // 7. Plantilla del sistema
  let tpl: any = null;
  try {
    const { data } = await (supabase as any)
      .from("templates")
      .select("subject, body")
      .eq("system_key", "autorizacion_precio")
      .eq("is_active", true)
      .limit(1);
    tpl = (data || [])[0] || null;
  } catch {
    tpl = null;
  }

  function render(text: string, vars: Record<string, string>): string {
    let out = text || "";
    for (const [k, v] of Object.entries(vars)) {
      out = out.split(`{${k}}`).join(v ?? "");
    }
    return out;
  }

  const subjectOverride = render(
    tpl?.subject || "Autorización de precio — {cliente}",
    tplVars
  );
  const bodyTemplate =
    tpl?.body ||
    `<p>Solicitud de autorización de precio para {cliente} — Pedido {numero_pedido}.</p>
       <p><strong>Justificación:</strong></p>
       <pre style="white-space:pre-wrap;font-family:Arial,sans-serif">{justificacion}</pre>
       {factura_bloque}
       <p><strong>Productos:</strong></p>
       {productos_lista}
       <p><strong>Histórico:</strong></p>
       {historico_lista}
       <p><strong>Clasificación:</strong></p>
       {clasificacion_lista}
       <p><strong>Detalles de facturación:</strong></p>
       {facturacion_lista}
       <p><strong>Evidencias:</strong></p>
       {evidencias_lista}`;

  // La plantilla es la única fuente de verdad: lo que se ve en la vista previa
  // de Plantillas es exactamente lo que se envía.
  const htmlOverride = render(bodyTemplate, tplVars);



  // 8. Destinatarios del grupo "Autorización de Precio"
  let defaultEmails: string[] = [];
  try {
    const { data: groupRow } = await (supabase as any)
      .from("email_groups")
      .select("id")
      .eq("nombre", "Autorización de Precio")
      .maybeSingle();
    if (groupRow?.id) {
      const { data: members } = await (supabase as any)
        .from("email_group_members")
        .select("email")
        .eq("group_id", groupRow.id);
      defaultEmails = (members || [])
        .map((m: any) => (m.email || "").trim())
        .filter((e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    }
  } catch {
    defaultEmails = [];
  }

  // 9. CC
  const cc: string[] = [
    "precios@correo.lumaggs.com.mx",
    "f.sarinanaf@lumaggs.com.mx",
    "atencionclientes.tijuana@dagal.com.mx",
  ];
  if (ejecutivoEmail && !cc.includes(ejecutivoEmail)) cc.push(ejecutivoEmail);


  // 10. Retorno
  return {
    title: `Autorización de precio — ${tplVars.cliente}`,
    description: "Al enviar, el pedido quedará en espera de respuesta.",
    subjectOverride,
    htmlOverride,
    defaultEmails,
    cc,
    comprobantes,
    previouslySentEmails: [] as string[],
    templateName: "raw-html",
    fromAddress: "Lumaggs <precios@correo.lumaggs.com.mx>",
  };
}

