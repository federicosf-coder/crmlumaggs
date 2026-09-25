/**
 * Etiqueta unificada para selectores de Empresa (Cliente):
 * "Razón Social / Nombre Comercial".
 * Si solo existe uno de los dos, o son iguales, muestra uno solo.
 */
export interface CompanyLike {
  name?: string | null;
  razon_social?: string | null;
}

export function companyLabel(c: CompanyLike | null | undefined): string {
  const name = (c?.name || "").trim();
  const razon = (c?.razon_social || "").trim();
  if (razon && name && razon.toUpperCase() !== name.toUpperCase()) {
    return `${razon} / ${name}`;
  }
  return razon || name || "";
}

/** Texto de búsqueda que cubre ambos nombres. */
export function companySearchText(c: CompanyLike | null | undefined): string {
  return `${c?.razon_social || ""} ${c?.name || ""}`.trim();
}

/** Etiqueta con ID Contpaq: "Razón Social / Nombre Comercial · ID 123". */
export function companyLabelConContpaq(c: (CompanyLike & { id_contpaq?: string | null }) | null | undefined): string {
  const base = companyLabel(c);
  const contpaq = (c?.id_contpaq || "").trim();
  return contpaq ? `${base} · ID ${contpaq}` : base;
}

/** Opción con ID Contpaq lista para SearchableSelect (también busca por ID). */
export function companyOptionConContpaq(c: CompanyLike & { id: string; id_contpaq?: string | null }) {
  return {
    value: c.id,
    label: companyLabelConContpaq(c),
    searchText: `${companySearchText(c)} ${c?.id_contpaq || ""}`.trim(),
  };
}

/** Opción lista para SearchableSelect. */
export function companyOption(c: CompanyLike & { id: string }) {
  return { value: c.id, label: companyLabel(c), searchText: companySearchText(c) };
}
