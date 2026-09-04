import * as XLSX from "xlsx";

export interface CorteCajaPagoRow {
  cliente: string;
  metodo: string;
  referencia: string;
  importe: number;
  facturas: string[];
}

export interface CorteCajaInput {
  empresaNombre: string;
  fecha: string;
  totalCobrado: number;
  porMetodo: [string, number][];
  pagos: CorteCajaPagoRow[];
}

export function generateCorteCajaXlsx(
  input: CorteCajaInput,
  opts?: { returnBase64?: boolean }
): string | void {
  const wb = XLSX.utils.book_new();
  const aoa: any[][] = [];

  aoa.push([input.empresaNombre]);
  aoa.push(["Corte de Caja"]);
  aoa.push([`Fecha: ${input.fecha}`]);
  aoa.push([]);

  aoa.push(["Resumen"]);
  aoa.push(["Concepto", "Monto"]);
  aoa.push(["Total Cobrado", input.totalCobrado]);
  input.porMetodo.forEach(([metodo, monto]) => {
    aoa.push([metodo, monto]);
  });
  aoa.push([]);

  aoa.push(["Detalle de pagos"]);
  aoa.push(["Cliente", "Método", "Referencia", "Importe", "Facturas"]);
  input.pagos.forEach((p) => {
    aoa.push([p.cliente, p.metodo, p.referencia, p.importe, p.facturas.join(", ")]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 36 },
    { wch: 20 },
    { wch: 24 },
    { wch: 16 },
    { wch: 40 },
  ];

  // Currency format for importe column (D)
  const range = XLSX.utils.decode_range(ws["!ref"]!);
  for (let R = range.s.r; R <= range.e.r; ++R) {
    const addr = XLSX.utils.encode_cell({ r: R, c: 3 });
    const cell = ws[addr];
    if (cell && typeof cell.v === "number") {
      cell.t = "n";
      cell.z = '"$"#,##0.00';
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, "Corte de Caja");

  const fname = `corte-caja-${input.fecha}.xlsx`;
  XLSX.writeFile(wb, fname);
}
