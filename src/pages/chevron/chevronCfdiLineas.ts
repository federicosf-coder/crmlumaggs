export interface LineaChevron {
  linea: number;
  codigo: string | null;
  descripcion: string;
  unidad: string | null;
  cantidad: number;
  precio: number;
  importe: number;
}

const txt = (el: Element, tag: string) => el.getElementsByTagName(tag)[0]?.textContent?.trim() || null;
const n = (v: string | null) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/** Extrae partidas del XML de Chevron. Código = CustDetAFN_01 de la addenda (por número de línea). */
export function parseLineasChevron(xml: string | null | undefined): LineaChevron[] {
  if (!xml) return [];
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, "application/xml");
  } catch {
    return [];
  }
  const codigos = new Map<number, string>();
  Array.from(doc.getElementsByTagName("ecfd:CustDetalle")).forEach((d) => {
    const lin = n(txt(d, "ecfd:CustDetNroLin"));
    const afn = txt(d, "ecfd:CustDetAFN_01");
    if (lin && afn) codigos.set(lin, afn);
  });

  const conceptos = Array.from(doc.getElementsByTagName("cfdi:Concepto"));
  return conceptos.map((c, i) => {
    const linea = i + 1;
    return {
      linea,
      codigo: codigos.get(linea) || c.getAttribute("NoIdentificacion") || null,
      descripcion: c.getAttribute("Descripcion") || "—",
      unidad: c.getAttribute("Unidad") || c.getAttribute("ClaveUnidad"),
      cantidad: n(c.getAttribute("Cantidad")),
      precio: n(c.getAttribute("ValorUnitario")),
      importe: n(c.getAttribute("Importe")),
    };
  });
}
