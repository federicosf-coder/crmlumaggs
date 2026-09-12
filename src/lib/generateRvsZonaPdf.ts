import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface RvsZonaPdfRow {
  nombre: string;
  empresa?: string;
  udsGalsa: number;
  udsLumaggs: number;
  udsTotal: number;
}

export interface RvsZonaPdfGroup {
  label: string;
  level: number;
  udsGalsa: number;
  udsLumaggs: number;
  udsTotal: number;
  children?: RvsZonaPdfGroup[];
  rows?: RvsZonaPdfRow[];
}

const fmtNum = (n: number) =>
  Number(n || 0).toLocaleString("es-MX", { maximumFractionDigits: 2 });

type Body = any[][];

function pushGroups(groups: RvsZonaPdfGroup[], body: Body) {
  for (const g of groups) {
    const fill: [number, number, number] = g.level === 0 ? [232, 234, 250] : [243, 244, 250];
    body.push([
      {
        content: `${"    ".repeat(g.level)}${g.label}`,
        styles: { fontStyle: "bold", fillColor: fill, textColor: [40, 40, 60] },
      },
      { content: "", styles: { fillColor: fill } },
      { content: fmtNum(g.udsGalsa), styles: { halign: "right", fontStyle: "bold", fillColor: fill, textColor: [40, 40, 60] } },
      { content: fmtNum(g.udsLumaggs), styles: { halign: "right", fontStyle: "bold", fillColor: fill, textColor: [40, 40, 60] } },
      { content: fmtNum(g.udsTotal), styles: { halign: "right", fontStyle: "bold", fillColor: fill, textColor: [40, 40, 60] } },
    ]);
    if (g.children?.length) pushGroups(g.children, body);
    for (const r of g.rows || []) body.push(rowCells(r, g.level + 1));
  }
}

function rowCells(r: RvsZonaPdfRow, level = 0) {
  return [
    `${"    ".repeat(level)}${r.nombre}`,
    r.empresa || "",
    { content: fmtNum(r.udsGalsa), styles: { halign: "right" } },
    { content: fmtNum(r.udsLumaggs), styles: { halign: "right" } },
    { content: fmtNum(r.udsTotal), styles: { halign: "right" } },
  ];
}

export function generateRvsZonaPdf(
  groups: RvsZonaPdfGroup[],
  meta?: { titulo?: string; subtitulo?: string; archivo?: string }
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 28;

  doc.setFillColor(56, 84, 186);
  doc.rect(0, 0, pageW, 56, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(meta?.titulo || "Ventas por zona", margin, 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(meta?.subtitulo || new Date().toLocaleDateString("es-MX"), margin, 44);
  doc.setTextColor(0, 0, 0);

  const body: Body = [];
  pushGroups(groups, body);

  const totalGalsa = groups.reduce((s, g) => s + (g.udsGalsa || 0), 0);
  const totalLumaggs = groups.reduce((s, g) => s + (g.udsLumaggs || 0), 0);
  const totalUds = groups.reduce((s, g) => s + (g.udsTotal || 0), 0);

  autoTable(doc, {
    startY: 72,
    head: [["Nombre", "Empresa", "Uds Galsa", "Uds Lumaggs", "Uds Total"]],
    body,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [56, 84, 186], textColor: 255, fontSize: 8 },
    columnStyles: {
      2: { halign: "right", cellWidth: 70 },
      3: { halign: "right", cellWidth: 75 },
      4: { halign: "right", cellWidth: 70 },
    },
    margin: { left: margin, right: margin },
    foot: [[
      { content: "Total", styles: { halign: "right" } },
      { content: "", styles: {} },
      { content: fmtNum(totalGalsa), styles: { halign: "right" } },
      { content: fmtNum(totalLumaggs), styles: { halign: "right" } },
      { content: fmtNum(totalUds), styles: { halign: "right" } },
    ]],
    footStyles: { fillColor: [240, 240, 245], textColor: [40, 40, 60], fontStyle: "bold" },
  });

  doc.save(meta?.archivo || `rvs_zonas_${new Date().toISOString().slice(0, 10)}.pdf`);
}
