// Parseo 100% cliente de CFDI 4.0 (XML) usando DOMParser nativo.

const NS_CFDI = "http://www.sat.gob.mx/cfd/4";
const NS_TFD = "http://www.sat.gob.mx/TimbreFiscalDigital";

export interface CfdiConcepto {
  codigo: string | null;
  claveProdServ: string | null;
  descripcion: string | null;
  cantidad: number;
  unidad: string | null;
  valorUnitario: number;
  importe: number;
}

export interface CfdiParsed {
  emisorRfc: string | null;
  emisorNombre: string | null;
  receptorRfc: string | null;
  receptorNombre: string | null;
  serie: string | null;
  folio: string | null;
  fecha: string | null;
  subtotal: number;
  total: number;
  formaPago: string | null;
  metodoPago: string | null;
  moneda: string | null;
  usoCfdi: string | null;
  uuidFiscal: string | null;
  fechaTimbrado: string | null;
  conceptos: CfdiConcepto[];
}

function attr(el: Element | null | undefined, name: string): string | null {
  if (!el) return null;
  const v = el.getAttribute(name);
  return v == null || v.trim() === "" ? null : v.trim();
}

function num(el: Element | null | undefined, name: string): number {
  const v = attr(el, name);
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function firstNS(root: Document | Element, ns: string, local: string): Element | null {
  const list = (root as any).getElementsByTagNameNS(ns, local);
  return list && list.length ? (list[0] as Element) : null;
}

export function parseCfdiXml(xmlText: string): CfdiParsed {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xmlText, "application/xml");
  } catch (e: any) {
    throw new Error(`El archivo no es un XML válido: ${e?.message || e}`);
  }

  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("El archivo no es un XML válido (error de sintaxis).");
  }

  const comprobante = firstNS(doc, NS_CFDI, "Comprobante");
  if (!comprobante) {
    throw new Error("El XML no es un CFDI 4.0 válido (no se encontró el nodo cfdi:Comprobante).");
  }

  const emisor = firstNS(comprobante, NS_CFDI, "Emisor");
  const receptor = firstNS(comprobante, NS_CFDI, "Receptor");
  const tfd = firstNS(doc, NS_TFD, "TimbreFiscalDigital");

  const conceptoNodes = (comprobante as any).getElementsByTagNameNS(NS_CFDI, "Concepto") as HTMLCollectionOf<Element>;
  const conceptos: CfdiConcepto[] = [];
  for (let i = 0; i < conceptoNodes.length; i++) {
    const c = conceptoNodes[i];
    conceptos.push({
      codigo: attr(c, "NoIdentificacion"),
      claveProdServ: attr(c, "ClaveProdServ"),
      descripcion: attr(c, "Descripcion"),
      cantidad: num(c, "Cantidad"),
      unidad: attr(c, "Unidad") || attr(c, "ClaveUnidad"),
      valorUnitario: num(c, "ValorUnitario"),
      importe: num(c, "Importe"),
    });
  }

  return {
    emisorRfc: attr(emisor, "Rfc"),
    emisorNombre: attr(emisor, "Nombre"),
    receptorRfc: attr(receptor, "Rfc"),
    receptorNombre: attr(receptor, "Nombre"),
    serie: attr(comprobante, "Serie"),
    folio: attr(comprobante, "Folio"),
    fecha: attr(comprobante, "Fecha"),
    subtotal: num(comprobante, "SubTotal"),
    total: num(comprobante, "Total"),
    formaPago: attr(comprobante, "FormaPago"),
    metodoPago: attr(comprobante, "MetodoPago"),
    moneda: attr(comprobante, "Moneda"),
    usoCfdi: attr(receptor, "UsoCFDI"),
    uuidFiscal: attr(tfd, "UUID"),
    fechaTimbrado: attr(tfd, "FechaTimbrado"),
    conceptos,
  };
}
