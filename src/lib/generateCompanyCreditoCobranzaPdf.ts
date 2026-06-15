import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { CompanyCreditoCobranzaData } from "./buildCompanyCreditoCobranzaData";

const fmt = (n: number) =>
  "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function buildCompanyCreditoCobranzaPdfDoc(d: CompanyCreditoCobranzaData): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 28;
  const brandColor: [number, number, number] = [56, 84, 186];
  const destructive: [number, number, number] = [200, 40, 40];
  const warning: [number, number, number] = [200, 130, 20];
  const success: [number, number, number] = [22, 130, 76];
  const border: [number, number, number] = [220, 220, 220];
  const muted: [number, number, number] = [110, 110, 110];

  // Header
  doc.setFillColor(...brandColor);
  doc.rect(0, 0, pageW, 60, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(d.empresaNombre, margin, 28);
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.text("Crédito y Cobranza", margin, 48);

  doc.setTextColor(0, 0, 0);
  let y = 78;
  doc.setFontSize(10);
  doc.text(`Fecha: ${d.fechaGeneracion}`, margin, y);
  if (d.razonSocial) { y += 14; doc.text(`Razón Social: ${d.razonSocial}`, margin, y); }
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.text(`Límite de Crédito: ${fmt(d.limiteCredito)}`, margin, y);
  doc.setFont("helvetica", "normal");
  y += 14;
  doc.text(`Crédito Utilizado: ${fmt(d.creditoUtilizado)}`, margin, y);
  y += 14;
  doc.text(`Crédito Disponible: ${fmt(d.creditoDisponible)}`, margin, y);
  y += 16;

  // KPI cards
  const cards: { title: string; value: string; subtitle: string; color: [number, number, number] }[] = [
    { title: "Total Facturado", value: fmt(d.totalFacturadoImporte), subtitle: `${d.totalFacturadoCount} facturas`, color: brandColor },
    { title: "Vigente", value: fmt(d.vigenteImporte), subtitle: `${d.vigenteCount} facturas`, color: success },
    { title: "Vencido", value: fmt(d.vencidoImporte), subtitle: `${d.vencidoCount} facturas`, color: destructive },
    { title: "Total Facturas Pagadas", value: String(d.pagadasCount), subtitle: `${d.pagadasVencidasPct.toFixed(1)}% vencidas / ${d.pagadasVigentesPct.toFixed(1)}% vigentes`, color: brandColor },
  ];
  const gap = 10;
  const cardW = (pageW - margin * 2 - gap * 3) / 4;
  const cardH = 72;
  cards.forEach((c, i) => {
    const x = margin + i * (cardW + gap);
    doc.setDrawColor(...border);
    doc.rect(x, y, cardW, cardH, "S");
    doc.setFillColor(...c.color);
    doc.rect(x, y, 4, cardH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...c.color);
    doc.text(c.title, x + 12, y + 20);
    doc.setFontSize(17);
    doc.setTextColor(0, 0, 0);
    doc.text(c.value, x + 12, y + 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text(c.subtitle, x + 12, y + 58);
  });
  y += cardH + 14;

  // Buckets table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...brandColor);
  doc.text("Cartera por Antigüedad", margin, y);
  y += 6;
  autoTable(doc, {
    startY: y + 4,
    head: [["Bucket", "Facturas", "Importe"]],
    body: d.buckets.map(b => [
      b.label,
      String(b.count),
      { content: fmt(b.monto), styles: { halign: "right" } },
    ]),
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 4, lineColor: border, lineWidth: 0.3 },
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

  // Vencidas
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...brandColor);
  doc.text("Facturas Vencidas", margin, 36);
  autoTable(doc, {
    startY: 50,
    head: [["No. Factura", "F. Documento", "F. Vencimiento", "Días Vencida", "Tipo Pago", "Total", "Saldo"]],
    body: d.vencidas.length === 0
      ? [[{ content: "Sin facturas vencidas.", colSpan: 7, styles: { halign: "center", textColor: muted } }]]
      : d.vencidas.map(f => [
          f.numero, f.fechaDocumento, f.fechaVencimiento,
          { content: f.dias != null ? String(f.dias) : "-", styles: { halign: "center", textColor: destructive, fontStyle: "bold" } },
          f.tipoPago,
          { content: fmt(f.total), styles: { halign: "right" } },
          { content: fmt(f.saldo), styles: { halign: "right", textColor: destructive, fontStyle: "bold" } },
        ]),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 3, lineColor: border, lineWidth: 0.3 },
    headStyles: { fillColor: brandColor, textColor: 255 },
    margin: { left: margin, right: margin },
    didDrawPage: () => {
      doc.setFontSize(8); doc.setTextColor(...muted);
      doc.text(`Página ${doc.getCurrentPageInfo().pageNumber}`, pageW - margin, pageH - 12, { align: "right" });
    },
  });

  // Por vencer (todas, asc por días)
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...brandColor);
  doc.text("Facturas por Vencer (orden ascendente)", margin, 36);
  autoTable(doc, {
    startY: 50,
    head: [["No. Factura", "F. Documento", "F. Vencimiento", "Días para Vencer", "Tipo Pago", "Total", "Saldo"]],
    body: d.porVencer.length === 0
      ? [[{ content: "Sin facturas por vencer.", colSpan: 7, styles: { halign: "center", textColor: muted } }]]
      : d.porVencer.map(f => [
          f.numero, f.fechaDocumento, f.fechaVencimiento,
          { content: f.dias != null ? String(f.dias) : "-", styles: { halign: "center", textColor: warning, fontStyle: "bold" } },
          f.tipoPago,
          { content: fmt(f.total), styles: { halign: "right" } },
          { content: fmt(f.saldo), styles: { halign: "right", fontStyle: "bold" } },
        ]),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 3, lineColor: border, lineWidth: 0.3 },
    headStyles: { fillColor: brandColor, textColor: 255 },
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
