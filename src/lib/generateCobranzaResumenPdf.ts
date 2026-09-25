import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface CobranzaPdfFila {
  empresa: string | null;
  plaza: string;
  tipoLabel: string;
  cliente: string;
  fecha: string;
  importe: number;
}

const EMPRESAS: { key: string; nombre: string; sub: string; color: [number, number, number] }[] = [
  { key: "lumaggs_chevron", nombre: "LUMAGGS", sub: "Distribuidor Chevron", color: [0, 84, 164] },
  { key: "galsa_phillips66", nombre: "GALSA", sub: "Distribuidor Phillips 66", color: [200, 16, 46] },
];

const TIPO_COLOR: Record<string, [number, number, number]> = {
  Contado: [224, 236, 252],
  "Crédito Directo": [236, 230, 250],
  Cescemex: [222, 245, 234],
  "Sin tipo": [252, 243, 222],
};

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });
const fmtFecha = (s: string) => {
  const [y, m, d] = (s || "").slice(0, 10).split("-");
  return y ? `${d}/${m}/${y}` : "—";
};

function agrupar<T>(arr: T[], key: (t: T) => string) {
  const m = new Map<string, T[]>();
  arr.forEach((a) => {
    const k = key(a);
    m.set(k, [...(m.get(k) ?? []), a]);
  });
  return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], "es"));
}

export function generateCobranzaResumenPdf(filas: CobranzaPdfFila[], periodoLabel: string, fileName: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  let first = true;

  const empresas = EMPRESAS.filter((e) => filas.some((f) => f.empresa === e.key));
  const sinEmpresa = filas.filter((f) => !EMPRESAS.some((e) => e.key === f.empresa));
  const secciones = empresas.map((e) => ({ ...e, filas: filas.filter((f) => f.empresa === e.key) }));
  if (sinEmpresa.length)
    secciones.push({ key: "otra", nombre: "SIN EMPRESA", sub: "", color: [90, 90, 90], filas: sinEmpresa });

  secciones.forEach((sec) => {
    const tablas: { titulo: string; nivel1: (f: CobranzaPdfFila) => string; nivel2: (f: CobranzaPdfFila) => string }[] = [
      { titulo: "Agrupado por Plaza › Tipo de pago", nivel1: (f) => f.plaza, nivel2: (f) => f.tipoLabel },
      { titulo: "Agrupado por Tipo de pago › Plaza", nivel1: (f) => f.tipoLabel, nivel2: (f) => f.plaza },
    ];
    tablas.forEach((t) => {
      if (!first) doc.addPage();
      first = false;
      // Encabezado
      doc.setFillColor(...sec.color);
      doc.rect(0, 0, W, 6, "F");
      doc.setTextColor(...sec.color);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(sec.nombre, 40, 40);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(110);
      if (sec.sub) doc.text(sec.sub, 40, 54);
      doc.setFontSize(12);
      doc.setTextColor(40);
      doc.setFont("helvetica", "bold");
      doc.text("Reporte de Cobranza", W - 40, 40, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(110);
      doc.text(periodoLabel, W - 40, 54, { align: "right" });
      doc.setDrawColor(220);
      doc.line(40, 64, W - 40, 64);
      doc.setFontSize(10);
      doc.setTextColor(60);
      doc.setFont("helvetica", "bold");
      doc.text(t.titulo, 40, 82);
      const total = sec.filas.reduce((a, f) => a + f.importe, 0);
      doc.text(`Total: ${money(total)}`, W - 40, 82, { align: "right" });

      const body: any[] = [];
      agrupar(sec.filas, t.nivel1).forEach(([g1, items1]) => {
        const tot1 = items1.reduce((a, f) => a + f.importe, 0);
        body.push([
          { content: g1.toUpperCase(), colSpan: 4, styles: { fontStyle: "bold", fillColor: [238, 240, 244], textColor: [30, 30, 30] } },
          { content: money(tot1), styles: { fontStyle: "bold", halign: "right", fillColor: [238, 240, 244] } },
        ]);
        agrupar(items1, t.nivel2).forEach(([g2, items2]) => {
          items2
            .sort((a, b) => a.fecha.localeCompare(b.fecha))
            .forEach((f) => {
              const fill = TIPO_COLOR[f.tipoLabel];
              body.push([
                f.plaza,
                { content: f.tipoLabel, styles: fill ? { fillColor: fill } : {} },
                f.cliente,
                fmtFecha(f.fecha),
                { content: money(f.importe), styles: { halign: "right" } },
              ]);
            });
          const tot2 = items2.reduce((a, f) => a + f.importe, 0);
          body.push([
            { content: `Subtotal ${g2}`, colSpan: 4, styles: { halign: "right", fontStyle: "italic", textColor: [100, 100, 100] } },
            { content: money(tot2), styles: { halign: "right", fontStyle: "bold", textColor: [60, 60, 60] } },
          ]);
        });
      });
      body.push([
        { content: "TOTAL GENERAL", colSpan: 4, styles: { fontStyle: "bold", halign: "right", fillColor: sec.color, textColor: 255 } },
        { content: money(total), styles: { fontStyle: "bold", halign: "right", fillColor: sec.color, textColor: 255 } },
      ]);

      autoTable(doc, {
        startY: 92,
        margin: { left: 40, right: 40, top: 40 },
        head: [["Plaza", "Tipo de pago", "Cliente (Razón social / Nombre comercial)", "Fecha de pago", "Importe"]],
        body,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 4, lineColor: [225, 225, 225], lineWidth: 0.5, textColor: [40, 40, 40] },
        headStyles: { fillColor: [55, 65, 81], textColor: 255, fontStyle: "bold", fontSize: 8 },
        columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 80 }, 3: { cellWidth: 65 }, 4: { cellWidth: 80, halign: "right" } },
      });
    });
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    const h = doc.internal.pageSize.getHeight();
    doc.text(`Página ${i} de ${pages}`, W - 40, h - 20, { align: "right" });
    doc.text(`Generado ${new Date().toLocaleString("es-MX")}`, 40, h - 20);
  }
  doc.save(fileName);
}
