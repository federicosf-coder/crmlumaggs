import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface DevolucionPdfData {
  folio: string;
  marca: "galsa" | "lumaggs";
  cliente: string;
  rfc?: string | null;
  factura: string;
  fechaVenta?: string | null;
  fechaSolicitud: string;
  ejecutivo?: string | null;
  motivos: string[];
  motivoSeleccionado?: string | null;
  lineas: { codigo: string; descripcion: string; facturada: number | null; devolver: number | null; lote?: string | null }[];
  politica: string;
}

const fmt = (d?: string | null) => {
  if (!d) return "____/____/______";
  const [y, m, dd] = d.slice(0, 10).split("-");
  return `${dd}/${m}/${y}`;
};

export const POLITICA_DEVOLUCION_DEFAULT =
  "Las devoluciones deben solicitarse dentro de los 15 días naturales posteriores a la fecha de venta. El producto debe estar sellado, en su envase original y sin uso, salvo daños de origen o de transporte reportados al recibir. Toda devolución está sujeta a revisión y autorización; la resolución puede ser nota de crédito, reembolso o cambio de producto. No se aceptan devoluciones de producto abierto o contaminado, excepto por defecto de fabricación comprobado.";

export function buildDevolucionPdf(d: DevolucionPdfData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  const color: [number, number, number] = d.marca === "galsa" ? [204, 31, 46] : [56, 84, 186];
  const marcaNombre = d.marca === "galsa" ? "GALSA · Phillips 66" : "LUMAGGS · Chevron";

  // Encabezado
  doc.setFillColor(...color);
  doc.rect(0, 0, W, 62, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("SOLICITUD DE DEVOLUCIÓN DE PRODUCTO", M, 28);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(marcaNombre, M, 46);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(d.folio, W - M, 32, { align: "right" });
  doc.setTextColor(20, 20, 20);

  // Datos
  let y = 82;
  const campo = (label: string, val: string, x: number, w: number) => {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(110, 110, 110);
    doc.text(label.toUpperCase(), x, y);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20, 20, 20);
    doc.text(doc.splitTextToSize(val || "", w)[0] || "", x, y + 13);
    doc.setDrawColor(200);
    doc.line(x, y + 17, x + w, y + 17);
  };
  const cw = (W - 2 * M - 30) / 3;
  campo("Cliente", d.cliente, M, cw * 2 + 15);
  campo("RFC", d.rfc || "", M + cw * 2 + 30, cw);
  y += 32;
  campo("Factura", d.factura, M, cw);
  campo("Fecha de venta", fmt(d.fechaVenta), M + cw + 15, cw);
  campo("Fecha de solicitud", fmt(d.fechaSolicitud), M + 2 * cw + 30, cw);
  y += 32;
  campo("Ejecutivo", d.ejecutivo || "", M, cw * 2 + 15);
  y += 34;

  // Productos
  const rows = d.lineas.map((l) => [l.codigo, l.descripcion, l.facturada ?? "", l.devolver ?? "", l.lote || ""]);
  while (rows.length < Math.max(5, d.lineas.length + 2)) rows.push(["", "", "", "", ""]);
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [["Código", "Descripción", "Cant. facturada", "Cant. a devolver", "Lote"]],
    body: rows as any,
    styles: { fontSize: 8.5, minCellHeight: 20, valign: "middle", lineColor: [190, 190, 190], lineWidth: 0.5 },
    headStyles: { fillColor: color, textColor: 255, fontSize: 8 },
    columnStyles: { 0: { cellWidth: 70 }, 2: { cellWidth: 65, halign: "center" }, 3: { cellWidth: 65, halign: "center" }, 4: { cellWidth: 70 } },
    theme: "grid",
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  const titulo = (t: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...color);
    doc.text(t.toUpperCase(), M, y);
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "normal");
    y += 12;
  };
  const casilla = (x: number, yy: number, label: string, marcada = false) => {
    doc.setDrawColor(80);
    doc.rect(x, yy - 8, 9, 9);
    if (marcada) { doc.setFont("helvetica", "bold"); doc.text("X", x + 1.8, yy - 0.5); doc.setFont("helvetica", "normal"); }
    doc.setFontSize(9);
    doc.text(label, x + 14, yy);
  };

  // Motivos
  titulo("Motivo de la devolución (marque con X)");
  const opts = [...d.motivos, "Otro: ________________________________"];
  const colW = (W - 2 * M) / 2;
  opts.forEach((m, i) => {
    const x = M + (i % 2) * colW;
    if (i % 2 === 0 && i > 0) y += 15;
    casilla(x, y, m, !!d.motivoSeleccionado && m === d.motivoSeleccionado);
  });
  y += 24;

  // Descripción a mano
  titulo("Descripción del problema (llenar con puño y letra del cliente)");
  doc.setDrawColor(170);
  doc.rect(M, y - 4, W - 2 * M, 104);
  for (let i = 1; i <= 5; i++) doc.line(M + 8, y - 4 + i * 18, W - M - 8, y - 4 + i * 18);
  y += 114;

  // Estado del producto + resolución solicitada
  titulo("Estado del producto");
  casilla(M, y, "Sellado"); casilla(M + 90, y, "Abierto"); casilla(M + 180, y, "Dañado");
  doc.text("¿Envase original?", M + 290, y); casilla(M + 380, y, "Sí"); casilla(M + 420, y, "No");
  y += 22;
  titulo("Resolución que solicita el cliente");
  casilla(M, y, "Nota de crédito"); casilla(M + 130, y, "Reembolso"); casilla(M + 240, y, "Cambio de producto");
  y += 30;

  // Firmas
  const fw = (W - 2 * M - 40) / 3;
  const firma = (x: number, label: string) => {
    doc.setDrawColor(60);
    doc.line(x, y + 30, x + fw, y + 30);
    doc.setFontSize(8);
    doc.text(label, x + fw / 2, y + 41, { align: "center" });
    doc.text("Nombre: ______________________", x, y + 56);
    doc.text("Fecha: ____/____/______", x, y + 70);
  };
  firma(M, "Firma del cliente");
  firma(M + fw + 20, "Recibe (almacén / ejecutivo)");
  firma(M + 2 * (fw + 20), "Autoriza");
  y += 86;

  // Uso interno
  doc.setFillColor(243, 244, 246);
  doc.rect(M, y, W - 2 * M, 50, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("USO INTERNO", M + 8, y + 13);
  doc.setFont("helvetica", "normal");
  casilla(M + 8, y + 30, "Nota de crédito"); casilla(M + 120, y + 30, "Reembolso"); casilla(M + 210, y + 30, "Cambio"); casilla(M + 280, y + 30, "Rechazada");
  doc.text("Folio NC / reembolso / pedido: ______________", M + 8, y + 45);
  doc.text("Fecha: ____/____/______", W - M - 120, y + 45);
  y += 62;

  // Política
  doc.setFontSize(6.8);
  doc.setTextColor(100, 100, 100);
  doc.text(doc.splitTextToSize("Política de devolución: " + d.politica, W - 2 * M), M, y);

  doc.setFontSize(7);
  doc.text(`${d.folio} · Favor de entregar este formato firmado junto con el producto o enviarlo escaneado a su ejecutivo.`, W / 2, doc.internal.pageSize.getHeight() - 18, { align: "center" });
  return doc;
}
