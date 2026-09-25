/**
 * Etiqueta unificada para selectores de Empresa (Cliente):
 * "Razón Social / Nombre Comercial".
 * Si solo existe uno de los dos, o son iguales, muestra uno solo.
 */
export interface CompanyLike {
  name?: string | null;
  razon_social?: string | null;
  id_contpaq?: string | null;
}

export function companyLabel(c: CompanyLike | null | undefined): string {
  const name = (c?.name || "").trim();
  const razon = (c?.razon_social || "").trim();
  const contpaq = (c?.id_contpaq || "").trim();
  let base: string;
  if (razon && name && razon.toUpperCase() !== name.toUpperCase()) {
    base = `${razon} / ${name}`;
  } else {
    base = razon || name || "";
  }
  return contpaq ? `${base} · ID ${contpaq}` : base;
}

/** Texto de búsqueda que cubre ambos nombres y el ID Contpaq. */
export function companySearchText(c: CompanyLike | null | undefined): string {
  return `${c?.razon_social || ""} ${c?.name || ""} ${c?.id_contpaq || ""}`.trim();
}

/** Opción lista para SearchableSelect. */
export function companyOption(c: CompanyLike & { id: string }) {
  return { value: c.id, label: companyLabel(c), searchText: companySearchText(c) };
}
