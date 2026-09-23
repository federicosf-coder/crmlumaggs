// Helpers de emparejamiento para la importación de facturas XML (CFDI).

// RFC del emisor -> empresa vendedora.
// PSM891005QY7 = Procesadora de Servicios Maggs (Lumaggs / Chevron)
// PGA850730EU0 = Proveedora Galsa (Galsa / Phillips 66)
const EMISOR_RFC_MAP: Record<string, string> = {
  PSM891005QY7: "lumaggs_chevron",
  PGA850730EU0: "galsa_phillips66",
};

export function mapEmisorAEmpresaVendedora(rfc: string): string | null {
  if (!rfc) return null;
  return EMISOR_RFC_MAP[rfc.trim().toUpperCase()] ?? null;
}

// Prefijo de Serie -> nombre de plaza (se evalúan primero los prefijos más largos).
const SERIE_PLAZA_MAP: Record<string, string> = {
  TIJ: "Tijuana",
  MXL: "Mexicali",
  ENS: "Ensenada",
  MOR: "Morelos",
  SLR: "San Luis",
  SQN: "San Quintin",
  PEN: "Peñasco",
  TJ: "Tijuana",
  MX: "Mexicali",
  EN: "Ensenada",
  MR: "Morelos",
  SL: "San Luis",
  SQ: "San Quintin",
  PE: "Peñasco",
};


export function mapSerieAPlaza(serie: string, folio?: string): string | null {
  const s = `${serie || ""}${folio || ""}`.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s) return null;
  const prefijos = Object.keys(SERIE_PLAZA_MAP).sort((a, b) => b.length - a.length);
  for (const prefijo of prefijos) {
    if (s.startsWith(prefijo)) return SERIE_PLAZA_MAP[prefijo];
  }
  return null;
}

export function normalizarTexto(s: string): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "SA", "S", "A", "DE", "CV", "C", "V", "SAPI", "SRL", "RL", "DEL", "LA", "EL",
  "LOS", "LAS", "Y", "SC", "S.A.", "S.A", "SADECV",
]);

// Palabras significativas para búsqueda por nombre.
export function palabrasSignificativas(nombre: string): string[] {
  return normalizarTexto(nombre)
    .replace(/[.,()]/g, " ")
    .split(" ")
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    .slice(0, 4);
}

export const RFC_GENERICOS = new Set(["XAXX010101000"]); // "Público en General" y similares — nunca auto-emparejar ni auto-crear
