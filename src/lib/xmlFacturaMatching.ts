// Helpers de emparejamiento para la importación de facturas XML (CFDI).

// RFC del emisor -> empresa vendedora. Fácil de extender (Galsa se agregará después).
const EMISOR_RFC_MAP: Record<string, string> = {
  PSM891005QY7: "lumaggs_chevron",
};

export function mapEmisorAEmpresaVendedora(rfc: string): string | null {
  if (!rfc) return null;
  return EMISOR_RFC_MAP[rfc.trim().toUpperCase()] ?? null;
}

// Prefijo de Serie -> nombre de plaza.
const SERIE_PLAZA_MAP: Record<string, string> = {
  TIJ: "Tijuana",
  MXL: "Mexicali",
  ENS: "Ensenada",
  MOR: "Morelos",
};

export function mapSerieAPlaza(serie: string): string | null {
  if (!serie) return null;
  const s = serie.trim().toUpperCase();
  for (const prefijo of Object.keys(SERIE_PLAZA_MAP)) {
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
