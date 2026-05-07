import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface KpiCardData {
  title: string;
  value: string;
  subtitle?: string;
  lines?: { label: string; value: string; tone?: "destructive" | "default" }[];
  variant?: "default" | "success" | "destructive";
}

export interface BucketData {
  title: string;
  rows: { label: string; count: number; monto: number }[];
}

export interface FacturaRow {
  numero: string;
  cliente: string;
  ejecutivo: string;
  plaza: string;
  fechaDocumento: string;
  fechaVencimiento: string;
  tipoPago: string;
  total: number;
  saldo: number;
}

export interface CobranzaReportInput {
  brand: "lumaggs" | "galsa";
  empresaNombre: string;
  fecha: string;
  plaza: string;
  kpisRow1: KpiCardData[]; // 3
  kpisRow2: KpiCardData[]; // 3
  kpisRow3: KpiCardData[]; // 3
  buckets: BucketData[];   // 3
  /** Facturas vencidas */
  facturas: FacturaRow[];
}

const fmtCurrency = (n: number) =>
  "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function generateCobranzaReportPdf(input: CobranzaReportInput): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 28;

  const brandColor: [number, number, number] =
    input.brand === "galsa" ? [204, 31, 46] : [56, 84, 186];
  const mutedText: [number, number, number] = [110, 110, 110];
  const borderColor: [number, number, number] = [220, 220, 220];
  const destructive: [number, number, number] = [200, 40, 40];
  const success: [number, number, number] = [22, 130, 76];

  // ===== Header =====
  doc.setFillColor(...brandColor);
  doc.rect(0, 0, pageW, 60, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(input.empresaNombre, margin, 28);
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.text("Reporte de Cobranza", margin, 48);

  doc.setTextColor(0, 0, 0);
  let y = 78;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha: ${input.fecha}`, margin, y);
  y += 14;
  doc.text(`Plaza: ${input.plaza}`, margin, y);
  y += 14;

  // ===== KPI cards (3 rows × 3 cards) =====
  const drawKpiRow = (cards: KpiCardData[], startY: number): number => {
    const gap = 10;
    const cardW = (pageW - margin * 2 - gap * 2) / 3;
    const cardH = 78;
    cards.slice(0, 3).forEach((c, i) => {
      const x = margin + i * (cardW + gap);
      // border
      doc.setDrawColor(...borderColor);
      doc.setLineWidth(0.6);
      // top accent
      let accent: [number, number, number] = brandColor;
      if (c.variant === "destructive") accent = destructive;
      else if (c.variant === "success") accent = success;
      doc.setDrawColor(...borderColor);
      doc.rect(x, startY, cardW, cardH, "S");
      // Left color stripe
      doc.setFillColor(...accent);
      doc.rect(x, startY, 4, cardH, "F");

      // title (larger, accent-colored)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...accent);
      doc.text(c.title, x + 12, startY + 18);

      // value
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(0, 0, 0);
      doc.text(c.value, x + 12, startY + 36);

      // subtitle
      if (c.subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...mutedText);
        doc.text(c.subtitle, x + 12, startY + 48);
      }

      // lines
      if (c.lines && c.lines.length) {
        let ly = startY + 60;
        c.lines.forEach((ln) => {
          const tone = ln.tone === "destructive" ? destructive : [60, 60, 60] as [number, number, number];
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(...tone);
          doc.text(ln.label + ":", x + 12, ly);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(40, 40, 40);
          const txt = doc.splitTextToSize(ln.value, cardW - 56);
          doc.text(txt[0] || "", x + 56, ly);
          ly += 10;
        });
      }
    });
    return startY + cardH + 10;
  };

  y = drawKpiRow(input.kpisRow1, y);
  y = drawKpiRow(input.kpisRow2, y);
  y = drawKpiRow(input.kpisRow3, y);

  // ===== Buckets (Cartera Total / Crédito Directo / Crédito Cescemex) =====
  if (y + 130 > pageH - margin) { doc.addPage(); y = margin; }
  const bgap = 10;
  const bW = (pageW - margin * 2 - bgap * 2) / 3;
  input.buckets.slice(0, 3).forEach((b, i) => {
    const x = margin + i * (bW + bgap);
    doc.setDrawColor(...borderColor);
    doc.rect(x, y, bW, 16 + b.rows.length * 12 + 8, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(b.title, x + 8, y + 12);
    let ly = y + 26;
    doc.setFontSize(8);
    b.rows.forEach((r) => {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text(`${r.label} (${r.count})`, x + 8, ly);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      const monto = fmtCurrency(r.monto);
      const w = doc.getTextWidth(monto);
      doc.text(monto, x + bW - 8 - w, ly);
      ly += 12;
    });
  });

  // ===== Facturas vencidas agrupadas por cliente =====
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...brandColor);
  doc.text("Facturas Vencidas — Agrupadas por Cliente", margin, 36);
  doc.setTextColor(0, 0, 0);

  // Group
  const map = new Map<string, FacturaRow[]>();
  for (const f of input.facturas) {
    const k = f.cliente || "Sin cliente";
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(f);
  }
  const grouped = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "es"));

  // Build rows with group separators
  const body: any[] = [];
  let totalGral = 0;
  let saldoGral = 0;
  grouped.forEach(([cliente, facs]) => {
    const subT = facs.reduce((s, f) => s + f.total, 0);
    const subS = facs.reduce((s, f) => s + f.saldo, 0);
    totalGral += subT;
    saldoGral += subS;
    body.push([
      {
        content: `${cliente}  (${facs.length})`,
        colSpan: 6,
        styles: { fillColor: [240, 240, 245], fontStyle: "bold", textColor: [40, 40, 40] },
      },
      { content: fmtCurrency(subT), styles: { fillColor: [240, 240, 245], fontStyle: "bold", halign: "right" } },
      { content: fmtCurrency(subS), styles: { fillColor: [240, 240, 245], fontStyle: "bold", halign: "right" } },
    ]);
    facs.forEach((f) => {
      body.push([
        f.numero,
        f.ejecutivo,
        f.plaza,
        f.fechaDocumento,
        f.fechaVencimiento,
        f.tipoPago,
        { content: fmtCurrency(f.total), styles: { halign: "right" } },
        { content: fmtCurrency(f.saldo), styles: { halign: "right", textColor: destructive, fontStyle: "bold" } },
      ]);
    });
  });

  autoTable(doc, {
    startY: 50,
    head: [["No. Factura", "Ejecutivo", "Plaza", "F. Documento", "F. Vencimiento", "Tipo Pago", "Total", "Saldo"]],
    body,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 3, lineColor: borderColor, lineWidth: 0.3 },
    headStyles: { fillColor: brandColor, textColor: 255, fontStyle: "bold" },
    columnStyles: {
      6: { halign: "right" },
      7: { halign: "right" },
    },
    margin: { left: margin, right: margin },
    didDrawPage: () => {
      const pStr = `Página ${doc.getCurrentPageInfo().pageNumber}`;
      doc.setFontSize(8);
      doc.setTextColor(...mutedText);
      doc.text(pStr, pageW - margin, pageH - 12, { align: "right" });
    },
  });

  // Totals
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Total general: ${fmtCurrency(totalGral)}   ·   Saldo total vencido: ${fmtCurrency(saldoGral)}`, margin, finalY);

  const fname = `Reporte_Cobranza_${input.brand}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fname);
}