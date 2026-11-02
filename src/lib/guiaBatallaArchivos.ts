import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { FilaActiva, FilaPerdida } from "./guiaBatalla";

export interface GuiaArchivoInput {
  ejecutivo: string;
  marcaLabel: string;
  corteLabel: string;
  mesAnterior: string;
  mesActual: string;
  activos: FilaActiva[];
  perdidos: FilaPerdida[];
  kpis: { u90: number; promedio: number; mesAnterior: number; esteMes: number; esperadoMes: number };
}

const n1 = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 1 });
const f = (v: string | null) => (v ? v.split("-").reverse().join("/") : "—");

export function nombreArchivoGuia(i: GuiaArchivoInput) {
  return `Guia_Batalla_${i.marcaLabel.split(" ")[0]}_${i.ejecutivo}_${i.corteLabel}`.replace(/[^\w-]+/g, "_");
}

export function generarGuiaPdf(i: GuiaArchivoInput): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  doc.setFontSize(14);
  doc.text(`Guía de Batalla — ${i.ejecutivo}`, 36, 40);
  doc.setFontSize(9);
  doc.text(`${i.marcaLabel} · Corte ${i.corteLabel} · Generado ${new Date().toLocaleDateString("es-MX")}`, 36, 56);

  autoTable(doc, {
    startY: 68,
    head: [["Unidades 90 días", "Promedio mensual", `Mes anterior (${i.mesAnterior})`, `Lleva ${i.mesActual}`, "Esperado este mes"]],
    body: [[n1(i.kpis.u90), n1(i.kpis.promedio), n1(i.kpis.mesAnterior), n1(i.kpis.esteMes), n1(i.kpis.esperadoMes)]],
    styles: { fontSize: 10, halign: "center" },
    headStyles: { fillColor: [91, 76, 196] },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 14,
    head: [["Cliente", "Unid. 90 días", "Promedio", i.mesAnterior, `Lleva ${i.mesActual}`, "Frecuencia", "Próx. compra est.", `Esperado ${i.mesActual}`]],
    body: i.activos.map((a) => [
      a.cliente, n1(a.u90), n1(a.promedio), n1(a.mesAnterior), n1(a.esteMes),
      a.frecuenciaDias ? `c/${a.frecuenciaDias} días` : "—",
      `${f(a.proximaCompra)}${a.atrasado ? " (atrasado)" : ""}`, n1(a.esperadoMes),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [91, 76, 196] },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 7: { halign: "right" } },
    didParseCell: (d) => {
      if (d.section === "body" && i.activos[d.row.index]?.esteMes <= 0) d.cell.styles.textColor = [200, 30, 30];
    },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 18,
    head: [["Clientes sin compra +91 días", "Última compra", "Total comprado (12 m)", "Promedio mensual"]],
    body: i.perdidos.map((p) => [p.cliente, f(p.ultimaCompra), n1(p.total), n1(p.promedio)]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [120, 120, 130] },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
  });
  return doc;
}

export function generarGuiaXlsx(i: GuiaArchivoInput): Uint8Array {
  const wb = XLSX.utils.book_new();
  const act = XLSX.utils.aoa_to_sheet([
    [`Guía de Batalla — ${i.ejecutivo}`], [`${i.marcaLabel} · Corte ${i.corteLabel}`], [],
    ["Cliente", "Unidades 90 días", "Promedio mensual", i.mesAnterior, `Lleva ${i.mesActual}`, "Frecuencia (días)", "Próxima compra estimada", "Atrasado", `Esperado ${i.mesActual}`],
    ...i.activos.map((a) => [a.cliente, a.u90, +a.promedio.toFixed(1), a.mesAnterior, a.esteMes, a.frecuenciaDias ?? "", f(a.proximaCompra), a.atrasado ? "Sí" : "", +a.esperadoMes.toFixed(1)]),
    ["TOTAL", i.kpis.u90, +i.kpis.promedio.toFixed(1), i.kpis.mesAnterior, i.kpis.esteMes, "", "", "", +i.kpis.esperadoMes.toFixed(1)],
  ]);
  act["!cols"] = [{ wch: 42 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 9 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, act, "Clientes activos");
  const per = XLSX.utils.aoa_to_sheet([
    ["Cliente", "Última compra", "Total comprado (12 meses)", "Promedio mensual"],
    ...i.perdidos.map((p) => [p.cliente, f(p.ultimaCompra), p.total, +p.promedio.toFixed(1)]),
  ]);
  per["!cols"] = [{ wch: 42 }, { wch: 14 }, { wch: 22 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, per, "Sin compra +91 días");
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
}

export function bytesToBase64(bytes: Uint8Array) {
  let s = "";
  for (let k = 0; k < bytes.length; k += 0x8000) s += String.fromCharCode(...bytes.subarray(k, k + 0x8000));
  return btoa(s);
}
