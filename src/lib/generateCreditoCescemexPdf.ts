import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface CategoriaPdf {
  label: string;
  monto: number;
  ue: number;
  utilidad: number;
  pct: number;
}

export interface MesPdf {
  label: string;
  cescemexMonto: number;
  cescemexUe: number;
  directoMonto: number;
  directoUe: number;
  sinClasificarMonto: number;
  sinClasificarUe: number;
}

export interface ClientePdf {
  cliente: string;
  tipo: string;
  ue: number;
  monto: number;
  utilidad: number;
}

export interface CreditoCescemexPdfInput {
  fecha: string;
  plazasLabel: string;
  categorias: CategoriaPdf[];
  utilidadTotal: number;
  margenUtilidadPct: number;
  porMes: MesPdf[];
  porCliente: ClientePdf[];
}

const EMERALD: [number, number, number] = [5, 150, 105];
const BLUE: [number, number, number] = [37, 99, 235];
const SLATE: [number, number, number] = [148, 163, 184];

const fmtCurrency = (n: number) =>
  "$" + Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = (n: number) =>
  Number(n || 0).toLocaleString("es-MX", { maximumFractionDigits: 1 });

function accentFor(label: string): [number, number, number] {
  const l = (label || "").toLowerCase();
  if (l.includes("cescemex")) return EMERALD;
  if (l.includes("directo")) return BLUE;
  return SLATE;
}

function softFor(label: string): [number, number, number] {
  const l = (label || "").toLowerCase();
  if (l.includes("cescemex")) return [230, 247, 240];
  if (l.includes("directo")) return [231, 239, 253];
  return [241, 245, 249];
}

export function buildCreditoCescemexPdfDoc(input: CreditoCescemexPdfInput): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 28;

  const brandColor: [number, number, number] = EMERALD;
  const mutedText: [number, number, number] = [110, 110, 110];
  const borderColor: [number, number, number] = [220, 220, 220];

  const footer = () => {
    const pStr = `Página ${doc.getCurrentPageInfo().pageNumber}`;
    doc.setFontSize(8);
    doc.setTextColor(...mutedText);
    doc.text(pStr, pageW - margin, pageH - 12, { align: "right" });
  };

  // ===== Header =====
  doc.setFillColor(...brandColor);
  doc.rect(0, 0, pageW, 60, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Crédito Cescemex vs Directo", margin, 28);
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.text(input.fecha, margin, 48);

  doc.setTextColor(0, 0, 0);
  let y = 78;
  doc.setFontSize(10);
  doc.text(`Plazas: ${input.plazasLabel}`, margin, y);
  y += 20;

  // ===== Category cards (3 columns) =====
  const gap = 10;
  const cardW = (pageW - margin * 2 - gap * 2) / 3;
  const cardH = 92;
  input.categorias.slice(0, 3).forEach((c, i) => {
    const x = margin + i * (cardW + gap);
    const accent = accentFor(c.label);
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.6);
    doc.rect(x, y, cardW, cardH, "S");
    doc.setFillColor(...accent);
    doc.rect(x, y, 4, cardH, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...accent);
    doc.text(c.label, x + 12, y + 18);

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text(fmtCurrency(c.monto), x + 12, y + 40);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...mutedText);
    doc.text(`${fmtNum(c.ue)} UE`, x + 12, y + 54);
    doc.setTextColor(40, 40, 40);
    doc.text(`${c.pct.toFixed(1)}% del crédito`, x + 12, y + 68);
    doc.setTextColor(...accent);
    doc.text(`Utilidad estimada: ${fmtCurrency(c.utilidad)}`, x + 12, y + 82);
  });
  y += cardH + 16;

  // ===== Utilidad total =====
  const blockH = 70;
  doc.setDrawColor(...borderColor);
  doc.setFillColor(240, 253, 246);
  doc.rect(margin, y, pageW - margin * 2, blockH, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...mutedText);
  doc.text("Utilidad Total Generada", margin + 14, y + 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...EMERALD);
  doc.text(fmtCurrency(input.utilidadTotal), margin + 14, y + 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...mutedText);
  doc.text(
    `Estimado con margen de utilidad de ${input.margenUtilidadPct}% sobre precio de venta (categorías seleccionadas).`,
    margin + 14,
    y + 60
  );
  footer();

  // ===== Página 2: tabla mensual =====
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...brandColor);
  doc.text("Evolución Mensual", margin, 36);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: 50,
    head: [["Mes", "Cescemex $", "Cescemex UE", "Directo $", "Directo UE", "Sin Clasificar $", "Sin Clasificar UE"]],
    body: input.porMes.map((m) => [
      m.label,
      fmtCurrency(m.cescemexMonto),
      fmtNum(m.cescemexUe),
      fmtCurrency(m.directoMonto),
      fmtNum(m.directoUe),
      fmtCurrency(m.sinClasificarMonto),
      fmtNum(m.sinClasificarUe),
    ]),
    foot: [[
      "Acumulado",
      fmtCurrency(input.porMes.reduce((s, m) => s + m.cescemexMonto, 0)),
      fmtNum(input.porMes.reduce((s, m) => s + m.cescemexUe, 0)),
      fmtCurrency(input.porMes.reduce((s, m) => s + m.directoMonto, 0)),
      fmtNum(input.porMes.reduce((s, m) => s + m.directoUe, 0)),
      fmtCurrency(input.porMes.reduce((s, m) => s + m.sinClasificarMonto, 0)),
      fmtNum(input.porMes.reduce((s, m) => s + m.sinClasificarUe, 0)),
    ]],
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 4, lineColor: borderColor, lineWidth: 0.3 },
    headStyles: { fillColor: brandColor, textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [240, 240, 245], textColor: 20, fontStyle: "bold" },
    columnStyles: {
      1: { halign: "right" }, 2: { halign: "right" },
      3: { halign: "right" }, 4: { halign: "right" },
      5: { halign: "right" }, 6: { halign: "right" },
    },
    margin: { left: margin, right: margin },
    didDrawPage: footer,
  });

  // ===== Página 3: clientes =====
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...brandColor);
  doc.text("Clientes por Tipo de Crédito", margin, 36);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: 50,
    head: [["Cliente", "Tipo", "UE", "Subtotal", "Utilidad"]],
    body: input.porCliente.map((c) => {
      const soft = softFor(c.tipo);
      const accent = accentFor(c.tipo);
      return [
        c.cliente,
        { content: c.tipo, styles: { fillColor: soft, textColor: accent, fontStyle: "bold" } },
        { content: fmtNum(c.ue), styles: { halign: "right" } },
        { content: fmtCurrency(c.monto), styles: { halign: "right" } },
        { content: fmtCurrency(c.utilidad), styles: { halign: "right", textColor: EMERALD, fontStyle: "bold" } },
      ];
    }),
    foot: [[
      "Total",
      "",
      fmtNum(input.porCliente.reduce((s, c) => s + c.ue, 0)),
      fmtCurrency(input.porCliente.reduce((s, c) => s + c.monto, 0)),
      fmtCurrency(input.porCliente.reduce((s, c) => s + c.utilidad, 0)),
    ]],
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 4, lineColor: borderColor, lineWidth: 0.3 },
    headStyles: { fillColor: brandColor, textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [240, 240, 245], textColor: 20, fontStyle: "bold", halign: "right" },
    columnStyles: {
      0: { cellWidth: 260 },
      2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" },
    },
    margin: { left: margin, right: margin },
    didDrawPage: footer,
  });

  return doc;
}

export function generateCreditoCescemexPdf(input: CreditoCescemexPdfInput): void {
  const doc = buildCreditoCescemexPdfDoc(input);
  doc.save(`Credito_Cescemex_vs_Directo_${new Date().toISOString().slice(0, 10)}.pdf`);
}