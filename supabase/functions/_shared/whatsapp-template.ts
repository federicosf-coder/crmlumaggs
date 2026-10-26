/** Keep presentation labels out of Meta's technical template identity. */
export function normalizeWhatsAppTemplate(rawName: string, rawLanguage?: string | null) {
  const trimmed = String(rawName ?? "").trim();
  const suffixLanguage = trimmed.match(/\(\s*([a-z]{2,3}(?:_[A-Za-z]{2})?)\s*\)\s*$/i)?.[1];
  const name = trimmed.replace(/\s*\([a-z_]+\)\s*$/i, "").replace(/\([^)]*\)/g, "").replace(/\s/g, "").trim();
  // El idioma visible en el sufijo manda; si no hay, el seleccionado; si no, es_MX.
  const language = suffixLanguage || rawLanguage?.trim() || "es_MX";
  if (!/^[a-z0-9_]+$/.test(name)) {
    throw new Error("El nombre técnico de la plantilla debe contener solo minúsculas, números y guiones bajos.");
  }
  if (!/^[a-z]{2,3}(?:_[A-Za-z]{2})?$/.test(language)) {
    throw new Error("El idioma de la plantilla no es válido.");
  }
  return { name, language: { code: language } };
}
