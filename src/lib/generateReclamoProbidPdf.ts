import { jsPDF } from "jspdf";
import { PDFDocument } from "pdf-lib";
import { supabase } from "@/integrations/supabase/client";
import { CHEVRON_LOGO_PNG } from "@/lib/chevronLogo";
import { etiquetaFacturacion } from "@/lib/reclamoFacturacion";

/** Formato oficial Chevron «Aviso de Reclamo PROBID»: datos generales una vez,
 *  un bloque por producto y todas las evidencias (fotos y PDFs) pegadas al final. */

const BUCKET = "inventario-reclamos";
const AZUL: [number, number, number] = [198, 233, 247];
const NARANJA: [number, number, number] = [252, 228, 214];
const GRIS: [number, number, number] = [217, 217, 217];
const BARRA: [number, number, number] = [21, 95, 130];
const ROSA: [number, number, number] = [248, 186, 186];

const fmtFecha = (d?: string | null) => {
  if (!d) return "";
  const [y, m, dd] = String(d).slice(0, 10).split("-");
  return y && m && dd ? `${dd}/${m}/${y}` : String(d);
};
const txt = (v: any) => (v === null || v === undefined ? "" : String(v));
const esImagen = (a: any) => (a.tipo_archivo || "").startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp)$/i.test(a.nombre_archivo || "");
const esPdf = (a: any) => (a.tipo_archivo || "") === "application/pdf" || /\.pdf$/i.test(a.nombre_archivo || "");

/** Mapa código de producto → nombre de presentación según el catálogo (admin → Presentaciones). */
export async function fetchMapaEmpaques(): Promise<Record<string, string>> {
  const [{ data: prods }, { data: pres }] = await Promise.all([
    supabase.from("productos").select("codigo, presentacion_id"),
    supabase.from("presentaciones").select("id, nombre"),
  ]);
  const nombres = new Map<string, string>((pres || []).map((p: any) => [p.id, p.nombre]));
  const out: Record<string, string> = {};
  for (const p of prods || []) {
    const n = p.presentacion_id ? nombres.get(p.presentacion_id) : null;
    if (n && p.codigo) out[String(p.codigo).trim().toUpperCase()] = n;
  }
  return out;
}

/** Mapa código de producto → nombre oficial según el catálogo de productos (admin → Productos). */
export async function fetchMapaProductos(): Promise<Record<string, string>> {
  const { data: prods } = await supabase.from("productos").select("codigo, nombre");
  const out: Record<string, string> = {};
  for (const p of prods || []) {
    if (p.nombre && p.codigo) out[String(p.codigo).trim().toUpperCase()] = p.nombre;
  }
  return out;
}

/** Nombre de empaque a mostrar: catálogo por código; si no hay, lo capturado. */
export function empaqueEtiqueta(codigo: any, empaqueActual: any, mapa: Record<string, string> | undefined): string {
  const key = String(codigo || "").trim().toUpperCase();
  return (mapa && key && mapa[key]) || txt(empaqueActual);
}

/** Nombre de producto a mostrar: catálogo por código; si no hay, lo capturado. */
export function nombreProductoEtiqueta(codigo: any, nombreActual: any, mapa: Record<string, string> | undefined): string {
  const key = String(codigo || "").trim().toUpperCase();
  return (mapa && key && mapa[key]) || txt(nombreActual);
}

async function imagenAJpeg(blob: Blob): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const bmp = await createImageBitmap(blob);
    const max = 2000;
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    return { data: c.toDataURL("image/jpeg", 0.85), w: c.width, h: c.height };
  } catch { return null; }
}

export interface ReclamoPdfResult { blob: Blob; fileName: string; embebidos: string[]; }

/** `embebidos` = url_archivo de las evidencias que quedaron pegadas dentro del PDF. */
export async function generateReclamoProbidPdf(reclamo: any, lineas: any[], archivos: any[]): Promise<ReclamoPdfResult> {
  // Render all product blocks, then fit the form (not the evidence) to one portrait letter sheet.
  const formHeight = Math.max(279.4, 110 + Math.max(1, lineas.length) * 29 + 48);
  const doc = new jsPDF({ unit: "mm", format: [215.9, formHeight], orientation: "portrait" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const mapaEmp = await fetchMapaEmpaques();

  const caja = (x: number, y: number, w: number, h: number, fill: [number, number, number], value = "", align: "left" | "right" = "left") => {
    doc.setFillColor(...fill); doc.setDrawColor(0); doc.setLineWidth(0.2);
    doc.rect(x, y, w, h, "FD");
    if (value) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(0);
      let size = 8.5;
      while (doc.getTextWidth(value) > w - 2 && size > 4) { size -= 0.25; doc.setFontSize(size); }
      doc.text(value, align === "right" ? x + w - 1 : x + 1, y + h - 1.4, { align });
    }
  };
  const etiqueta = (s: string, x: number, y: number, size = 8.5) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(size); doc.setTextColor(0); doc.text(s, x, y);
  };

  const encabezado = (w = W) => {
    doc.addImage(CHEVRON_LOGO_PNG, "PNG", M, 10, 15, 13.8);
    doc.setFillColor(...BARRA); doc.rect(M + 20, 12, w - 2 * M - 20, 9, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(255, 255, 255);
    doc.text("AVISO DE RECLAMO PROBID", M + 20 + (w - 2 * M - 20) / 2, 18.4, { align: "center" });
    doc.setTextColor(0);
  };

  // ---- Datos generales ----
  encabezado();
  const f = reclamo.chevron_facturas_recibidas;
  const factura = f?.folio ? `${f.folio}${f.fecha ? ` · ${fmtFecha(f.fecha)}` : ""}` : "";
  let y = 30;
  etiqueta("Nombre de Cliente:", M, y + 3.6); caja(M + 34, y, 62, 5, AZUL, txt(reclamo.cliente_nombre));
  etiqueta("Fecha de Reclamo:", 118, y + 3.6, 8); caja(160, y, W - M - 160, 5, AZUL, fmtFecha(reclamo.fecha_reclamo));
  y += 8;
  etiqueta("No. Pedido en Factura:", M, y + 3.6, 8); caja(M + 34, y, 62, 5, AZUL, txt(reclamo.no_pedido_factura || reclamo.inv_pedidos?.numero_po_interno));
  etiqueta("Fecha de Recepción del producto:", 118, y + 3.6, 6); caja(160, y, W - M - 160, 5, AZUL, fmtFecha(reclamo.fecha_recepcion));
  y += 8;
  etiqueta("Factura:", M, y + 3.6); caja(M + 34, y, 62, 5, AZUL, factura);
  y += 10;

  doc.setFont("helvetica", "normal"); doc.setFontSize(8.6);
  const aviso = "Al recibir e inspeccionar la mercancía en un plazo máximo de 48 hrs posterior a la recepción, se identificaron los siguientes defectos/diferencias:";
  const avisoLines = doc.splitTextToSize(aviso, W - 2 * M - 2);
  doc.setFillColor(...ROSA); doc.rect(M, y, W - 2 * M, avisoLines.length * 4 + 1.5, "F");
  doc.text(avisoLines, M + 1, y + 3.6);
  y += avisoLines.length * 4 + 5;

  // ---- Un bloque por producto ----
  const RH = 5; // alto de fila
  const xL = M, wL = 30, xV = M + 30, wV = 58, xL2 = xV + wV + 4, wL2 = 34, xV2 = xL2 + wL2, wV2 = 42, xU = xV2 + wV2, wU = W - M - xU;
  const bloque = (l: any) => {
    const filas: [string, string, string, string, [number, number, number]][] = [
      ["Tipo de Producto", txt(l.tipo_producto), "Tipo de aviso", txt(l.tipo_aviso), AZUL],
      ["Código de Producto", txt(l.codigo_producto), "Cantidad Solicitada:", txt(l.cantidad_solicitada), AZUL],
      ["Descripción:", txt(l.nombre_producto || l.descripcion), "Cantidad Recibida:", txt(l.cantidad_recibida), AZUL],
      ["Empaque:", empaqueEtiqueta(l.codigo_producto, l.empaque, mapaEmp), "Diferencia:", txt(l.diferencia), NARANJA],
    ];
    filas.forEach(([a, b, c, d, fill], i) => {
      const yy = y + i * RH;
      caja(xL, yy, wL, RH, GRIS); etiqueta(a, xL + 1, yy + 3.6, 8);
      caja(xV, yy, wV, RH, AZUL, b);
      caja(xL2, yy, wL2, RH, GRIS); etiqueta(c, xL2 + 1, yy + 3.6, 8);
      caja(xV2, yy, wV2, RH, fill, d, i === 0 ? "left" : "right");
    });
    doc.setDrawColor(0); doc.rect(xU, y, wU, RH * 4);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.text("Unidad", xU + wU / 2, y + 3.6, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    doc.text(txt(l.unidad), xU + 1.5, y + RH * 4 - 1.4);
    y += RH * 4;
    caja(M, y, W - 2 * M - 30, RH, GRIS, "Confirmar si el producto intercambiado, sobrante le sea facturado.");
    caja(W - M - 30, y, 30, RH, AZUL, etiquetaFacturacion(l.facturar_intercambiado));
    y += RH + 4;
  };
  for (const l of lineas) {
    bloque(l);
  }
  if (!lineas.length) { doc.setFontSize(9); doc.text("Sin productos capturados.", M, y + 4); y += 10; }

  // ---- Recolección y pie ----
  y += 2;
  etiqueta("En caso de devolución indique el domicilio de recolección:", M, y + 3.6, 8);
  doc.setFillColor(...AZUL); doc.rect(xL2 - 4, y, W - M - xL2 + 4, 15, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  doc.text(doc.splitTextToSize(txt(reclamo.domicilio_recoleccion), W - M - xL2).slice(0, 3), xL2 - 3, y + 4);
  etiqueta("Contacto:", M, y + 8.6, 8); caja(xV, y + 5, wV, 5, AZUL, "Federico Sariñana");
  etiqueta("Correo:", M, y + 13.6, 8); caja(xV, y + 10, wV, 5, AZUL, "f.sarinanaf@lumaggs.com.mx");
  y += 24;
  etiqueta("ENVIAR FORMATO AL CORREO:", M + 20, y, 8);
  doc.setTextColor(230, 120, 50); doc.setFontSize(11); doc.text("cvxordenesmexico@chevron.com", xL2 - 4, y);
  y += 8;
  doc.setTextColor(...BARRA); doc.setFontSize(9);
  doc.text("No olvides incluir en tu correo copia de Bill of Lading, Ticket de báscula, Certificado de báscula vigente, Fotografías de todo el producto dañado", M, y, { maxWidth: W - 2 * M });
  doc.setTextColor(120); doc.setFontSize(7.5);
  doc.text(`Referencia: ${txt(reclamo.token_correo)}`, M, H - 8);

  // ---- Evidencias ----
  const embebidos: string[] = [];
  const pdfs: { nombre: string; bytes: ArrayBuffer; path: string }[] = [];
  const otros: string[] = [];
  for (const a of archivos) {
    if (!esImagen(a) && !esPdf(a)) { otros.push(a.nombre_archivo); continue; }
    const { data: blob } = await supabase.storage.from(BUCKET).download(a.url_archivo);
    if (!blob) { otros.push(a.nombre_archivo); continue; }
    if (esPdf(a)) { pdfs.push({ nombre: a.nombre_archivo, bytes: await blob.arrayBuffer(), path: a.url_archivo }); continue; }
    const img = await imagenAJpeg(blob);
    if (!img) { otros.push(a.nombre_archivo); continue; }
    doc.addPage("letter", "portrait");
    const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
    encabezado(pw);
    etiqueta(`Evidencia: ${a.nombre_archivo}`, M, 30, 9);
    const maxW = pw - 2 * M, maxH = ph - 34 - M;
    const k = Math.min(maxW / img.w, maxH / img.h);
    const w = img.w * k, h = img.h * k;
    doc.addImage(img.data, "JPEG", M + (maxW - w) / 2, 34, w, h);
    embebidos.push(a.url_archivo);
  }
  if (otros.length) {
    doc.setPage(1); doc.setTextColor(80); doc.setFontSize(7.5);
    doc.text(`Otros archivos enviados como adjuntos: ${otros.join(", ")}`, M, H - 12, { maxWidth: W - 2 * M });
  }

  const rendered = await PDFDocument.load(doc.output("arraybuffer"));
  const out = await PDFDocument.create();
  const [form] = await out.embedPages([rendered.getPage(0)]);
  const page = out.addPage([612, 792]); // Carta vertical, sin importar la cantidad de productos.
  const scale = Math.min(612 / form.width, 792 / form.height);
  page.drawPage(form, { x: (612 - form.width * scale) / 2, y: (792 - form.height * scale) / 2, width: form.width * scale, height: form.height * scale });
  if (rendered.getPageCount() > 1) {
    const evidence = await out.copyPages(rendered, rendered.getPageIndices().slice(1));
    evidence.forEach((pg) => out.addPage(pg));
  }
  if (pdfs.length) {
    for (const p of pdfs) {
      try {
        const src = await PDFDocument.load(p.bytes, { ignoreEncryption: true });
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((pg) => out.addPage(pg));
        embebidos.push(p.path);
      } catch { /* PDF protegido o dañado: se envía como adjunto suelto */ }
    }
  }
  const bytes = await out.save();
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  return { blob, fileName: `Aviso_Reclamo_${txt(reclamo.token_correo) || "reclamo"}.pdf`, embebidos };
}
