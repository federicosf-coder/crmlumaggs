import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { CompanyCreditoCobranzaData } from "./buildCompanyCreditoCobranzaData";

const fmt = (n: number) =>
  "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function buildCompanyCreditoCobranzaPdfDoc(d: CompanyCreditoCobranzaData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 43; // 1.5 cm
  const topMargin = 43; // 1.5 cm
  const brandColor: [number, number, number] = [56, 84, 186];
  const destructive: [number, number, number] = [200, 40, 40];
  const warning: [number, number, number] = [200, 130, 20];
  const success: [number, number, number] = [22, 130, 76];
  const border: [number, number, number] = [220, 220, 220];
  const muted: [number, number, number] = [110, 110, 110];

  // Header (compact)
  doc.setFillColor(...brandColor);
  doc.rect(0, topMargin, pageW, 44, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(d.empresaNombre, margin, topMargin + 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const subtitle = d.brandLabel
    ? `Crédito y Cobranza · ${d.brandLabel}`
    : "Crédito y Cobranza";
  doc.text(subtitle, margin, topMargin + 36);
  doc.setFontSize(9);
  doc.text(`Fecha: ${d.fechaGeneracion}`, pageW - margin, topMargin + 20, { align: "right" });
  if (d.razonSocial) doc.text(d.razonSocial, pageW - margin, topMargin + 34, { align: "right" });

  doc.setTextColor(0, 0, 0);
  let y = topMargin + 56;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`Límite: ${fmt(d.limiteCredito)}`, margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(`Utilizado: ${fmt(d.creditoUtilizado)}`, margin + 160, y);
  doc.text(`Disponible: ${fmt(d.creditoDisponible)}`, margin + 320, y);
  y += 24;

  // KPI cards
  const cards: { title: string; value: string; subtitle: string; color: [number, number, number] }[] = [
    { title: "Total Facturado", value: fmt(d.totalFacturadoImporte), subtitle: `${d.totalFacturadoCount} facturas`, color: brandColor },
    { title: "En Tiempo", value: fmt(d.vigenteImporte), subtitle: `${d.vigenteCount} facturas`, color: success },
    { title: "Vencido", value: fmt(d.vencidoImporte), subtitle: `${d.vencidoCount} facturas`, color: destructive },
  ];
  const gap = 8;
  const cardW = (pageW - margin * 2 - gap * 2) / 3;
  const cardH = 52;
  cards.forEach((c, i) => {
    const x = margin + i * (cardW + gap);
    doc.setDrawColor(...border);
    doc.rect(x, y, cardW, cardH, "S");
    doc.setFillColor(...c.color);
    doc.rect(x, y, 4, cardH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...c.color);
    doc.text(c.title, x + 10, y + 14);
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text(c.value, x + 10, y + 30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...muted);
    doc.text(c.subtitle, x + 10, y + 44);
  });
  y += cardH + 24;

  // Buckets table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...brandColor);
  doc.text("Cartera por Antigüedad", margin, y);
  autoTable(doc, {
    startY: y + 4,
    head: [["Días Vencimiento", "Facturas", "Importe"]],
    body: d.buckets.map(b => [
      b.label,
      String(b.count),
      { content: fmt(b.monto), styles: { halign: "right" } },
    ]),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2, lineColor: border, lineWidth: 0.3 },
    headStyles: { fillColor: brandColor, textColor: 255 },
    columnStyles: { 1: { halign: "center" }, 2: { halign: "right" } },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      if (data.section === "body") {
        const row = d.buckets[data.row.index];
        if (row?.variant === "destructive") data.cell.styles.textColor = destructive;
        else if (row?.variant === "warning") data.cell.styles.textColor = warning;
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 24;

  // Vencidas (continúa en la misma página si cabe)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...brandColor);
  doc.text("Facturas Vencidas", margin, y);
  autoTable(doc, {
    startY: y + 4,
    head: [["No. Factura", "F. Documento", "F. Vencimiento", "Días Vencida", "Total", "Saldo"]],
    body: d.vencidas.length === 0
      ? [[{ content: "Sin facturas vencidas.", colSpan: 6, styles: { halign: "center", textColor: muted } }]]
      : d.vencidas.map(f => [
          f.numero, f.fechaDocumento, f.fechaVencimiento,
          { content: f.dias != null ? String(f.dias) : "-", styles: { halign: "center", textColor: destructive, fontStyle: "bold" } },
          { content: fmt(f.total), styles: { halign: "right" } },
          { content: fmt(f.saldo), styles: { halign: "right", textColor: destructive, fontStyle: "bold" } },
        ]),
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 2, lineColor: border, lineWidth: 0.3 },
    headStyles: { fillColor: brandColor, textColor: 255 },
    columnStyles: { 4: { halign: "right" }, 5: { halign: "right" } },
    margin: { left: margin, right: margin },
    didDrawPage: () => {
      doc.setFontSize(8); doc.setTextColor(...muted);
      doc.text(`Página ${doc.getCurrentPageInfo().pageNumber}`, pageW - margin, pageH - 12, { align: "right" });
    },
  });
  y = (doc as any).lastAutoTable.finalY + 24;

  // Por vencer (todas, asc por días) — continúa, autoTable salta página solo si es necesario
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...brandColor);
  doc.text("Facturas por Vencer (orden ascendente)", margin, y);
  autoTable(doc, {
    startY: y + 4,
    head: [["No. Factura", "F. Documento", "F. Vencimiento", "Días para Vencer", "Total", "Saldo"]],
    body: d.porVencer.length === 0
      ? [[{ content: "Sin facturas por vencer.", colSpan: 6, styles: { halign: "center", textColor: muted } }]]
      : d.porVencer.map(f => [
          f.numero, f.fechaDocumento, f.fechaVencimiento,
          { content: f.dias != null ? String(f.dias) : "-", styles: { halign: "center", textColor: warning, fontStyle: "bold" } },
          { content: fmt(f.total), styles: { halign: "right" } },
          { content: fmt(f.saldo), styles: { halign: "right", fontStyle: "bold" } },
        ]),
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 2, lineColor: border, lineWidth: 0.3 },
    headStyles: { fillColor: brandColor, textColor: 255 },
    columnStyles: { 4: { halign: "right" }, 5: { halign: "right" } },
    margin: { left: margin, right: margin },
    didDrawPage: () => {
      doc.setFontSize(8); doc.setTextColor(...muted);
      doc.text(`Página ${doc.getCurrentPageInfo().pageNumber}`, pageW - margin, pageH - 12, { align: "right" });
    },
  });

  return doc;
}

export function generateCompanyCreditoCobranzaPdf(d: CompanyCreditoCobranzaData): void {
  const doc = buildCompanyCreditoCobranzaPdfDoc(d);
  const clean = d.empresaNombre.replace(/[^A-Za-z0-9 ]+/g, "").trim().replace(/\s+/g, "_");
  doc.save(`Credito_Cobranza_${clean}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function generateCompanyCreditoCobranzaPdfBlob(d: CompanyCreditoCobranzaData): Blob {
  return buildCompanyCreditoCobranzaPdfDoc(d).output("blob");
}
