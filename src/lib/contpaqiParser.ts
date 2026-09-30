import * as XLSX from "xlsx";

export interface ContpaqiLinea {
  codigo: string;
  nombre: string;
  cantidad: number;
  unidad: string;
  precio: number;
  neto: number;
  descuento: number;
  impuesto: number;
  total: number;
}

export interface ContpaqiFactura {
  serie: string;
  folio: string;
  numero: string;
  fecha: string;
  concepto: string;
  cliente: string;
  agente: string;
  estado: string;
  cancelada: boolean;
  esRefactura: boolean;
  lineas: ContpaqiLinea[];
  cantidad: number;
  neto: number;
  descuento: number;
  impuesto: number;
  total: number;
}

const num = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

const esFilaVacia = (r: unknown[]) => r.every((c) => c === null || c === undefined || String(c).trim() === "");

/** Interpreta el archivo "Impresión de Documentos" de ContPAQi (xls/xlsx/csv). */
export function parseContpaqi(data: ArrayBuffer): ContpaqiFactura[] {
  const wb = XLSX.read(data, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });

  const facturas: ContpaqiFactura[] = [];
  let i = 0;

  while (i < rows.length) {
    const r = rows[i] ?? [];
    const esCabeceraDoc = str(r[0]).toLowerCase() === "fecha" && str(r[1]).toLowerCase() === "serie";
    if (!esCabeceraDoc) {
      i++;
      continue;
    }
    const doc = rows[i + 1] ?? [];
    const serie = str(doc[1]).toUpperCase();
    const folio = str(doc[2]);
    if (!serie && !folio) {
      i += 2;
      continue;
    }
    const estado = str(doc[8]);
    const factura: ContpaqiFactura = {
      serie,
      folio,
      numero: `${serie}${folio}`.replace(/\s+/g, "").toUpperCase(),
      fecha: str(doc[0]),
      concepto: str(doc[3]),
      cliente: str(doc[4]),
      agente: str(doc[7]),
      estado,
      cancelada: /cancel/i.test(estado),
      esRefactura: /^RFC/i.test(serie),
      lineas: [],
      cantidad: 0,
      neto: 0,
      descuento: 0,
      impuesto: 0,
      total: 0,
    };

    // Buscar encabezado de partidas
    let j = i + 2;
    while (j < rows.length && str((rows[j] ?? [])[0]).toLowerCase() !== "código") {
      if (str((rows[j] ?? [])[0]).toLowerCase() === "fecha") break;
      j++;
    }
    if (str((rows[j] ?? [])[0]).toLowerCase() === "código") {
      j++;
      while (j < rows.length) {
        const l = rows[j] ?? [];
        if (str(l[0]).toLowerCase() === "fecha") break;
        if (esFilaVacia(l)) {
          // posible fin de partidas -> la siguiente fila con datos y sin código es el acumulado
          const sig = rows[j + 1] ?? [];
          if (!esFilaVacia(sig) && str(sig[0]) === "" && str(sig[1]) === "") {
            factura.cantidad = num(sig[2]);
            factura.neto = num(sig[5]);
            factura.descuento = num(sig[6]);
            factura.impuesto = num(sig[7]);
            factura.total = num(sig[8]);
            j += 2;
          } else {
            j++;
          }
          break;
        }
        if (str(l[0]) !== "") {
          factura.lineas.push({
            codigo: str(l[0]),
            nombre: str(l[1]),
            cantidad: num(l[2]),
            unidad: str(l[3]),
            precio: num(l[4]),
            neto: num(l[5]),
            descuento: num(l[6]),
            impuesto: num(l[7]),
            total: num(l[8]),
          });
        }
        j++;
      }
    }

    if (!factura.total && factura.lineas.length) {
      factura.neto = factura.lineas.reduce((a, l) => a + l.neto, 0);
      factura.impuesto = factura.lineas.reduce((a, l) => a + l.impuesto, 0);
      factura.total = factura.lineas.reduce((a, l) => a + l.total, 0);
      factura.cantidad = factura.lineas.reduce((a, l) => a + l.cantidad, 0);
    }

    facturas.push(factura);
    i = Math.max(j, i + 2);
  }

  return facturas;
}
