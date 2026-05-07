import * as XLSX from "xlsx";
import type { CobranzaReportInput, FacturaRow } from "./generateCobranzaReportPdf";

const parseMoney = (s: string): number => {
  if (typeof s === "number") return s;
  const n = Number(String(s).replace(/[^0-9.-]/g, ""));
  return isFinite(n) ? n : 0;
};

export function generateCobranzaReportXlsx(input: CobranzaReportInput): void {
  const wb = XLSX.utils.book_new();

  // ===== Sheet 1: Resumen =====
  const aoa: any[][] = [];
  aoa.push([input.empresaNombre]);
  aoa.push(["Reporte de Cobranza"]);
  aoa.push([`Fecha: ${input.fecha}`]);
  aoa.push([`Plaza: ${input.plaza}`]);
  aoa.push([]);

  const pushKpiRow = (label: string, kpis: typeof input.kpisRow1) => {
    aoa.push([label]);
    aoa.push(["KPI", "Valor", "Detalle", "Línea 1", "Línea 2"]);
    kpis.forEach((c) => {
      const l1 = c.lines?.[0] ? `${c.lines[0].label}: ${c.lines[0].value}` : "";
      const l2 = c.lines?.[1] ? `${c.lines[1].label}: ${c.lines[1].value}` : "";
      aoa.push([c.title, c.value, c.subtitle || "", l1, l2]);
    });
    aoa.push([]);
  };

  pushKpiRow("Cartera por tipo de crédito", input.kpisRow1);
  pushKpiRow("Cartera vencida", input.kpisRow2);
  pushKpiRow("Cobranza y clientes", input.kpisRow3);

  // Buckets
  input.buckets.forEach((b) => {
    aoa.push([b.title]);
    aoa.push(["Rango", "Facturas", "Monto"]);
    b.rows.forEach((r) => aoa.push([r.label, r.count, r.monto]));
    aoa.push([]);
  });

  const wsResumen = XLSX.utils.aoa_to_sheet(aoa);
  wsResumen["!cols"] = [{ wch: 32 }, { wch: 22 }, { wch: 28 }, { wch: 36 }, { wch: 36 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

  // ===== Sheet 2: Facturas vencidas =====
  const headers = [
    "Cliente",
    "No. Factura",
    "Ejecutivo",
    "Plaza",
    "F. Documento",
    "F. Vencimiento",
    "Tipo Pago",
    "Total",
    "Saldo",
  ];

  // Group by client and sort
  const map = new Map<string, FacturaRow[]>();
  for (const f of input.facturas) {
    const k = f.cliente || "Sin cliente";
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(f);
  }
  const grouped = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "es"));

  const facAoa: any[][] = [];
  facAoa.push(["Facturas Vencidas — Agrupadas por Cliente"]);
  facAoa.push([]);
  facAoa.push(headers);

  let totalGral = 0;
  let saldoGral = 0;
  grouped.forEach(([cliente, facs]) => {
    const subT = facs.reduce((s, f) => s + f.total, 0);
    const subS = facs.reduce((s, f) => s + f.saldo, 0);
    totalGral += subT;
    saldoGral += subS;
    facAoa.push([`${cliente}  (${facs.length})`, "", "", "", "", "", "", subT, subS]);
    facs.forEach((f) => {
      facAoa.push([
        f.cliente,
        f.numero,
        f.ejecutivo,
        f.plaza,
        f.fechaDocumento,
        f.fechaVencimiento,
        f.tipoPago,
        f.total,
        f.saldo,
      ]);
    });
  });
  facAoa.push([]);
  facAoa.push(["TOTAL GENERAL", "", "", "", "", "", "", totalGral, saldoGral]);

  const wsFac = XLSX.utils.aoa_to_sheet(facAoa);
  wsFac["!cols"] = [
    { wch: 36 }, { wch: 14 }, { wch: 22 }, { wch: 16 },
    { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 14 },
  ];

  // Currency format for Total/Saldo columns (H, I)
  const range = XLSX.utils.decode_range(wsFac["!ref"]!);
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (const C of [7, 8]) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = wsFac[addr];
      if (cell && typeof cell.v === "number") {
        cell.t = "n";
        cell.z = '"$"#,##0.00';
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, wsFac, "Facturas Vencidas");

  const fname = `Reporte_Cobranza_${input.brand}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fname);

  // suppress unused warning for parseMoney (kept for future use)
  void parseMoney;
}