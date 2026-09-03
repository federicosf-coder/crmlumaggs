import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface RotacionPdfRow {
  codigo: string;
  nombre: string;
  marca: string;
  stock_total: number;
  valor_stock: number;
  clasificacionLabel: string;
}

export interface RotacionPdfGroup {
  label: string;
  level: number;
  count: number;
  valor: number;
  children?: RotacionPdfGroup[];
  rows?: RotacionPdfRow[];
}

const fmtCurrency = (n: number) =>
  "$" + Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = (n: number) => Number(n || 0).toLocaleString("es-MX");

type Body = any[][];

function pushGroups(groups: RotacionPdfGroup[], body: Body) {
  for (const g of groups) {
    body.push([
      {
        content: `${"    ".repeat(g.level)}${g.label}  ·  ${g.count} SKUs  ·  ${fmtCurrency(g.valor)}`,
        colSpan: 6,
        styles: {
          fontStyle: "bold",
          fillColor: g.level === 0 ? [232, 234, 250] : [243, 244, 250],
          textColor: [40, 40, 60],
        },
      },
    ]);
    if (g.children?.length) pushGroups(g.children, body);
    for (const r of g.rows || []) body.push(rowCells(r));
  }
}

function rowCells(r: RotacionPdfRow) {
  return [
    r.codigo,
    r.nombre,
    r.marca || "—",
    { content: fmtNum(r.stock_total), styles: { halign: "right" } },
    { content: fmtCurrency(r.valor_stock), styles: { halign: "right" } },
    r.clasificacionLabel,
  ];
}

export function generateRotacionInventarioPdf(
  groups: RotacionPdfGroup[],
  flatRows: RotacionPdfRow[],
  meta?: { titulo?: string; subtitulo?: string }
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 28;

  doc.setFillColor(56, 84, 186);
  doc.rect(0, 0, pageW, 56, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(meta?.titulo || "Rotación de Inventario", margin, 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(meta?.subtitulo || new Date().toLocaleDateString("es-MX"), margin, 44);
  doc.setTextColor(0, 0, 0);

  const body: Body = [];
  if (groups.length) pushGroups(groups, body);
  else for (const r of flatRows) body.push(rowCells(r));

  const totalValor = flatRows.reduce((s, r) => s + (r.valor_stock || 0), 0);

  autoTable(doc, {
    startY: 72,
    head: [["Código", "Producto", "Marca", "Stock", "Valor Stock", "Clasificación"]],
    body,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [56, 84, 186], textColor: 255, fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 70 },
      3: { halign: "right", cellWidth: 55 },
      4: { halign: "right", cellWidth: 80 },
      5: { cellWidth: 110 },
    },
    margin: { left: margin, right: margin },
    foot: [[
      { content: `Total: ${flatRows.length} SKUs`, colSpan: 4, styles: { halign: "right" } },
      { content: fmtCurrency(totalValor), styles: { halign: "right" } },
      "",
    ]],
    footStyles: { fillColor: [240, 240, 245], textColor: [40, 40, 60], fontStyle: "bold" },
  });

  doc.save(`rotacion_inventario_${new Date().toISOString().slice(0, 10)}.pdf`);
}
