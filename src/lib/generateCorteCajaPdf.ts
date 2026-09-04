import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface CorteCajaPagoRow {
  cliente: string;
  metodo: string;
  referencia: string;
  importe: number;
  facturas: string[];
}

export interface CorteCajaInput {
  empresaNombre: string;
  fecha: string;
  totalCobrado: number;
  porMetodo: [string, number][];
  pagos: CorteCajaPagoRow[];
}

const fmtCurrency = (n: number) =>
  "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function generateCorteCajaPdf(input: CorteCajaInput): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 28;

  const isGalsa =
    input.empresaNombre.toLowerCase().includes("galsa") ||
    input.empresaNombre.toLowerCase().includes("phillips");
  const brandColor: [number, number, number] = isGalsa ? [204, 31, 46] : [56, 84, 186];
  const mutedText: [number, number, number] = [110, 110, 110];
  const borderColor: [number, number, number] = [220, 220, 220];

  // Header
  doc.setFillColor(...brandColor);
  doc.rect(0, 0, pageW, 60, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(input.empresaNombre, margin, 28);
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.text(`Corte de Caja · ${input.fecha}`, margin, 48);

  doc.setTextColor(0, 0, 0);
  let y = 78;

  // Resumen
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...brandColor);
  doc.text("Resumen por método de pago", margin, y);
  y += 16;

  const resumenBody: any[] = [
    ["Total Cobrado", { content: fmtCurrency(input.totalCobrado), styles: { halign: "right" as const, fontStyle: "bold" as const } }],
    ...input.porMetodo.map(([metodo, monto]) => [metodo, { content: fmtCurrency(monto), styles: { halign: "right" as const } }]),
  ];

  autoTable(doc, {
    startY: y,
    head: [["Concepto", "Monto"]],
    body: resumenBody,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 4, lineColor: borderColor, lineWidth: 0.3 },
    headStyles: { fillColor: brandColor, textColor: 255, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 20;

  // Detalle
  if (y + 80 > pageH - margin) {
    doc.addPage();
    y = margin;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...brandColor);
  doc.text("Detalle de pagos", margin, y);
  y += 16;

  const detalleBody = input.pagos.map((p) => [
    p.cliente,
    p.metodo,
    p.referencia,
    { content: fmtCurrency(p.importe), styles: { halign: "right" as const } },
    p.facturas.join(", ") || "—",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Cliente", "Método", "Referencia", "Importe", "Facturas"]],
    body: detalleBody,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 3, lineColor: borderColor, lineWidth: 0.3 },
    headStyles: { fillColor: brandColor, textColor: 255, fontStyle: "bold" },
    columnStyles: {
      3: { halign: "right" },
    },
    margin: { left: margin, right: margin },
    didDrawPage: () => {
      const pStr = `Página ${doc.getCurrentPageInfo().pageNumber}`;
      doc.setFontSize(8);
      doc.setTextColor(...mutedText);
      doc.text(pStr, pageW - margin, pageH - 12, { align: "right" });
    },
  });

  const fname = `corte-caja-${input.fecha}.pdf`;
  doc.save(fname);
}
