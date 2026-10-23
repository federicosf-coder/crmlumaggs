import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { empaqueEtiqueta } from "@/lib/generateReclamoProbidPdf";

export interface ReclamoResumenFila {
  inv_pedidos?: { numero_po_interno?: string | null } | null;
  chevron_facturas_recibidas?: { folio?: string | null; fecha?: string | null } | null;
  plaza?: string | null;
  cliente_nombre?: string | null;
  no_pedido_factura?: string | null;
  id_reclamo_proveedor?: string | null;
  fecha_reclamo?: string | null;
  inv_reclamo_lineas?: { codigo_producto?: string | null; empaque?: string | null; diferencia?: number | null }[];
  estatus?: string | null;
  fecha_envio?: string | null;
}

const fecha = (value?: string | null) => {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
};

export function reclamosResumenRows(reclamos: ReclamoResumenFila[], empaques: Record<string, string>, estatus: Record<string, string>) {
  return reclamos.map((r) => [
    r.inv_pedidos?.numero_po_interno || "—",
    r.chevron_facturas_recibidas?.folio ? `Folio ${r.chevron_facturas_recibidas.folio}\n${fecha(r.chevron_facturas_recibidas.fecha)}` : "—",
    r.plaza || "—",
    r.cliente_nombre || "LUMAGGS",
    r.inv_pedidos?.numero_po_interno || r.no_pedido_factura || "—",
    r.id_reclamo_proveedor || "Sin ID",
    fecha(r.fecha_reclamo),
    (r.inv_reclamo_lineas || []).map((l) => `${l.codigo_producto || "—"} · ${empaqueEtiqueta(l.codigo_producto, l.empaque, empaques) || "—"} · ${Number(l.diferencia ?? 0)}`).join("\n") || "—",
    estatus[r.estatus || ""] || r.estatus || "—",
    r.fecha_envio ? new Date(r.fecha_envio).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) : "—",
  ]);
}

/** Standalone summary: never generates official notices or modifies claim status. */
export function generateReclamosResumenPdf(reclamos: ReclamoResumenFila[], empaques: Record<string, string>, estatus: Record<string, string>, filtros: string) {
  if (!reclamos.length) throw new Error("No hay reclamos para exportar");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const width = doc.internal.pageSize.getWidth();
  const generatedAt = new Date();
  const body = reclamosResumenRows(reclamos, empaques, estatus);
  autoTable(doc, {
    margin: { left: 18, right: 18, top: 82, bottom: 30 },
    head: [["Pedido", "Factura", "Plaza", "Cliente", "No. Pedido Factura", "ID Reclamo", "Fecha Reclamo", "SKUs · Empaque · Diferencia", "Estatus", "Enviado"]],
    body, theme: "grid", showHead: "everyPage", rowPageBreak: "avoid",
    styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak", lineWidth: 0.4, lineColor: [214, 222, 231], textColor: [30, 40, 55] },
    headStyles: { fillColor: [56, 84, 186], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [243, 246, 250] },
    columnStyles: { 0: { cellWidth: 75 }, 1: { cellWidth: 60 }, 2: { cellWidth: 40 }, 3: { cellWidth: 60 }, 4: { cellWidth: 75 }, 5: { cellWidth: 55 }, 6: { cellWidth: 55 }, 7: { cellWidth: 130 }, 8: { cellWidth: 55 }, 9: { cellWidth: 51 } },
    didDrawPage: () => {
      doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.setTextColor(56, 84, 186);
      doc.text("Resumen de reclamos de pedidos", 18, 32);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(50);
      doc.text(doc.splitTextToSize(`${filtros} · ${reclamos.length} reclamo(s)`, width - 36), 18, 49);
      doc.text(`Generado: ${generatedAt.toLocaleString("es-MX")}`, 18, 72);
    },
  });
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page); doc.setFontSize(8); doc.setTextColor(90);
    doc.text(`Página ${page} de ${doc.getNumberOfPages()}`, width - 18, 596, { align: "right" });
  }
  const localDate = `${generatedAt.getFullYear()}${String(generatedAt.getMonth() + 1).padStart(2, "0")}${String(generatedAt.getDate()).padStart(2, "0")}`;
  return { blob: doc.output("blob"), fileName: `Resumen_Reclamos_${localDate}.pdf` };
}