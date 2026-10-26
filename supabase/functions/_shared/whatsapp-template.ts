/** Keep presentation labels out of Meta's technical template identity. */
export function normalizeWhatsAppTemplate(rawName: string, rawLanguage?: string | null) {
  const suffixLanguage = rawName.match(/\(\s*([a-z]{2,3}(?:_[A-Za-z]{2})?)\s*\)\s*$/)?.[1];
  const name = rawName.replace(/\([^)]*\)/g, "").replace(/\s/g, "");
  const language = rawLanguage?.trim() || suffixLanguage || "es_MX";
  if (!/^[a-z0-9_]+$/.test(name)) {
    throw new Error("El nombre técnico de la plantilla debe contener solo minúsculas, números y guiones bajos.");
  }
  if (!/^[a-z]{2,3}(?:_[A-Za-z]{2})?$/.test(language)) {
    throw new Error("El idioma de la plantilla no es válido.");
  }
  return { name, language: { code: language } };
}