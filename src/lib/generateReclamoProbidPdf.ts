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
  const { data: prods } = await supabase.from("productos").select("codigo, nombre_producto");
  const out: Record<string, string> = {};
  for (const p of prods || []) {
    if (p.nombre_producto && p.codigo) out[String(p.codigo).trim().toUpperCase()] = p.nombre_producto;
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
  const formHeight = Math.max(279.4, 100 + Math.max(1, lineas.length) * 24 + 48);
  const doc = new jsPDF({ unit: "mm", format: [215.9, formHeight], orientation: "portrait" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 6; // márgenes mínimos para impresión carta
  const mapaEmp = await fetchMapaEmpaques();
  const mapaProd = await fetchMapaProductos();

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

  // Columnas proporcionales al formato oficial (Hoja de reclamo), a todo el ancho útil.
  const k = (W - 2 * M) / 993;
  const xL = M, wL = 116 * k, xV = xL + wL, wV = 269 * k;
  const xL2 = xV + wV + 48 * k, wL2 = 173 * k, xV2 = xL2 + wL2, wV2 = 175 * k;
  const xU = xV2 + wV2, wU = 55 * k, xC = xU + wU, wC = 106 * k, xB = xC + wC, wB = W - M - xB;

  const encabezado = (w = W) => {
    doc.addImage(CHEVRON_LOGO_PNG, "PNG", M + 4, 8, 15, 13.8);
    const bx = xV, bw = (w === W ? xU + wU : w - M) - bx;
    doc.setFillColor(...BARRA); doc.rect(bx, 10, bw, 7, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(255, 255, 255);
    doc.text("AVISO DE RECLAMO PROBID", bx + bw / 2, 15.2, { align: "center" });
    doc.setTextColor(0);
  };

  // ---- Datos generales ----
  encabezado();
  const f = reclamo.chevron_facturas_recibidas;
  const factura = f?.folio ? `${f.folio}${f.fecha ? ` · ${fmtFecha(f.fecha)}` : ""}` : "";
  const pedido = txt(reclamo.inv_pedidos?.numero_po_interno || reclamo.no_pedido_factura);
  let y = 26;
  etiqueta("Nombre de Cliente:", M, y + 3.4, 6.8); caja(xV, y, wV, 4.5, AZUL, txt(reclamo.cliente_nombre));
  etiqueta("Fecha de Reclamo:", xL2, y + 3.4, 6.8); caja(xV2, y, wV2, 4.5, AZUL, fmtFecha(reclamo.fecha_reclamo));
  y += 7;
  etiqueta("No. Pedido en Factura:", M, y + 3.4, 6.5); caja(xV, y, wV, 4.5, AZUL, pedido);
  etiqueta("Fecha de Recepción del producto:", xL2, y + 3.4, 6.2); caja(xV2, y, wV2, 4.5, AZUL, fmtFecha(reclamo.fecha_recepcion));
  y += 7;
  etiqueta("Factura:", M, y + 3.4, 6.8); caja(xV, y, wV, 4.5, AZUL, factura);
  y += 9;

  doc.setFont("helvetica", "normal"); doc.setFontSize(8.6);
  const aviso = "Al recibir e inspeccionar la mercancía en un plazo máximo de 48 hrs posterior a la recepción, se identificaron los siguientes defectos/diferencias:";
  const avisoLines = doc.splitTextToSize(aviso, xU + wU + wC - M - 2);
  doc.setFillColor(...ROSA); doc.rect(M, y, xU + wU + wC - M, avisoLines.length * 4 + 1.5, "F");
  doc.text(avisoLines, M + 1, y + 3.6);
  y += avisoLines.length * 4 + 4;

  // ---- Un bloque por producto (confirmación de facturación a la derecha) ----
  const RH = 4.2;
  const bloque = (l: any) => {
    const filas: [string, string, string, string, [number, number, number]][] = [
      ["Tipo de Producto", txt(l.tipo_producto), "Tipo de aviso", txt(l.tipo_aviso), AZUL],
      ["Código de Producto", txt(l.codigo_producto), "Cantidad Solicitada:", txt(l.cantidad_solicitada), AZUL],
      ["Descripción:", nombreProductoEtiqueta(l.codigo_producto, l.nombre_producto || l.descripcion, mapaProd), "Cantidad Recibida:", txt(l.cantidad_recibida), AZUL],
      ["Empaque:", empaqueEtiqueta(l.codigo_producto, l.empaque, mapaEmp), "Diferencia:", txt(l.diferencia), NARANJA],
    ];
    filas.forEach(([a, b, c, d, fill], i) => {
      const yy = y + i * RH;
      caja(xL, yy, wL, RH, GRIS); etiqueta(a, xL + 0.8, yy + 3.1, 6.8);
      caja(xV, yy, wV, RH, AZUL, b);
      caja(xL2, yy, wL2, RH, GRIS); etiqueta(c, xL2 + 0.8, yy + 3.1, 6.8);
      caja(xV2, yy, wV2, RH, fill, d, i === 0 ? "left" : "right");
    });
    doc.setDrawColor(0); doc.rect(xU, y, wU, RH * 4);
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.8); doc.text("Unidad", xU + wU / 2, y + 3.1, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.8);
    doc.text(txt(l.unidad), xU + 0.8, y + RH * 4 - 1.2, { maxWidth: wU - 1 });
    // Confirmación a la derecha del bloque, como en el formato oficial
    doc.setFont("helvetica", "bold"); doc.setFontSize(4.6);
    doc.text(["Confirmar si el producto", "intercambiado, sobrante le sea", "facturado"], xC + wC / 2, y + RH * 2 + 0.6, { align: "center" });
    caja(xB, y + RH * 3, wB, RH, AZUL, etiquetaFacturacion(l.facturar_intercambiado));
    y += RH * 4 + 3.5;
  };
  for (const l of lineas) {
    bloque(l);
  }
  if (!lineas.length) { doc.setFontSize(9); doc.text("Sin productos capturados.", M, y + 4); y += 10; }

  // ---- Recolección y pie ----
  y += 1;
  etiqueta("En caso de devolución indique el domicilio de recolección:", M, y + 3, 6.8);
  doc.setFillColor(...AZUL); doc.rect(xV + wV, y, xU - (xV + wV), 13, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  doc.text(doc.splitTextToSize(txt(reclamo.domicilio_recoleccion), xU - (xV + wV) - 2).slice(0, 3), xV + wV + 1, y + 3.5);
  etiqueta("Contacto:", M, y + 7.5, 6.8); caja(xV, y + 4.5, wV, 4, AZUL, "Federico Sariñana");
  etiqueta("Correo:", M, y + 11.5, 6.8); caja(xV, y + 8.5, wV, 4, AZUL, "f.sarinanaf@lumaggs.com.mx");
  y += 22;
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
