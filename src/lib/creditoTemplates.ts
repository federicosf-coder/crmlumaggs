import { CREDITO_TIPO_PERSONA_LABEL } from "./credito";

export const TEMPLATE_KEYS = [
  "solicitud",
  "confidencialidad",
  "buro",
  "subsistencia",
  "bc_si",
  "bc_no",
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  solicitud: "Solicitud de crédito",
  confidencialidad: "Contrato de confidencialidad",
  buro: "Autorización Buró de Crédito",
  subsistencia: "Carta de Subsistencia de Poderes",
  bc_si: "Beneficiario Controlador — Sí existe",
  bc_no: "Beneficiario Controlador — No existe",
};

// Maps firma key → template key. For lfpiorpi, picks bc_si or bc_no based on credit data.
export function templateKeyForFirma(firmaKey: string, form: any): TemplateKey | null {
  if (firmaKey === "lfpiorpi") {
    return form?.lfpiorpi_beneficiario_controlador ? "bc_si" : "bc_no";
  }
  if ((TEMPLATE_KEYS as readonly string[]).includes(firmaKey)) return firmaKey as TemplateKey;
  return null;
}

function fmtDate(d: any): string {
  if (!d) return "";
  try {
    const dt = typeof d === "string" ? new Date(d) : d;
    return dt.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return String(d); }
}

function fmtMoney(n: any): string {
  if (n == null || n === "") return "";
  const num = Number(n);
  if (!isFinite(num)) return String(n);
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(num);
}

function entidadNombreLargo(empresa: string | null | undefined): string {
  switch ((empresa || "").toLowerCase()) {
    case "galsa":
    case "lumaggs_phillips66":
      return "GALSA SA DE CV";
    case "lumaggs":
    case "lumaggs_chevron":
      return "PROCESADORA DE SERVICIOS MAGG'S SA DE CV";
    default:
      return "PROCESADORA DE SERVICIOS MAGG'S SA DE CV";
  }
}

export function buildTokens(form: any, company: any = {}): Record<string, string> {
  const bc = form?.bc_data || {};
  const referencias = Array.isArray(form?.referencias_comerciales) ? form.referencias_comerciales : [];
  const banco = form?.datos_bancarios || {};
  const tipo = form?.tipo_persona || form?.csf_tipo_persona || "moral";

  const refsHtml = referencias.length
    ? `<table class="grid"><thead><tr><th>Empresa</th><th>Contacto</th><th>Teléfono</th></tr></thead><tbody>${referencias
        .map((r: any) => `<tr><td>${r?.empresa ?? ""}</td><td>${r?.contacto ?? ""}</td><td>${r?.telefono ?? ""}</td></tr>`)
        .join("")}</tbody></table>`
    : '<p class="muted">Sin referencias capturadas.</p>';

  const t: Record<string, string> = {
    razon_social: form?.razon_social || form?.csf_razon_social || company?.razon_social || company?.name || "",
    nombre_comercial: form?.nombre_comercial || company?.name || "",
    rfc: form?.rfc || form?.csf_rfc || "",
    telefono: form?.telefono || "",
    correo: form?.correo_contacto || form?.client_email || "",
    domicilio_fiscal: form?.domicilio_fiscal || form?.csf_domicilio || "",
    ciudad: form?.ciudad_fiscal || "",
    estado: form?.estado_fiscal || "",
    antiguedad: form?.antiguedad || "",
    domicilio_comercial: form?.domicilio_comercial || "",
    giro_comercial: form?.giro_comercial || form?.csf_actividad_economica || "",
    monto_credito: fmtMoney(form?.monto_solicitado),
    dias_credito: form?.dias_credito != null ? String(form.dias_credito) : "",
    banco_nombre: banco?.banco || "",
    banco_cuenta: banco?.cuenta || "",
    banco_clabe: banco?.clabe || "",
    referencias_comerciales_html: refsHtml,
    aval_nombre: form?.aval_nombre || "",
    aval_direccion: form?.aval_direccion || "",
    aval_ciudad: form?.aval_ciudad || "",
    aval_relacion: form?.aval_relacion || "",
    aval_regimen: form?.aval_regimen_conyugal || "",
    municipio: form?.ciudad_fiscal || "",
    tipo_persona_label: CREDITO_TIPO_PERSONA_LABEL[tipo] || "",
    rep_legal_nombre: form?.rep_legal_nombre || "",
    rep_legal_curp: form?.rep_legal_curp || "",
    rep_legal_rfc: form?.rep_legal_rfc || "",
    rep_legal_fecha_nac: fmtDate(form?.rep_legal_fecha_nacimiento),
    rep_legal_pais_nac: form?.rep_legal_pais_nacimiento || "",
    rep_legal_id_tipo: form?.rep_legal_tipo_id || "",
    rep_legal_id_num: form?.rep_legal_num_id || "",
    fecha_firma: fmtDate(form?.lfpiorpi_fecha_firma || new Date()),
    ciudad_firma: form?.lfpiorpi_lugar_firma || form?.ciudad_fiscal || "",
    fecha_constitucion: fmtDate(form?.csf_fecha_inicio_operaciones),
    nacionalidad: "Mexicana",
    bc_nombre: bc?.nombre || "",
    bc_porcentaje: bc?.porcentaje != null ? `${bc.porcentaje}%` : "",
    empresa_vendedora_nombre_largo: entidadNombreLargo(company?.empresa_vendedora || form?.empresa_vendedora),
  };
  return t;
}

export function renderTemplate(html: string, tokens: Record<string, string>): string {
  return (html || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k) => {
    const v = tokens[k];
    return v == null ? "" : String(v);
  });
}

export const PRINT_STYLES = `
  @page { size: letter; margin: 18mm 15mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #111; font-size: 11pt; line-height: 1.5; }
  .doc-title { font-size: 18pt; text-align: center; margin: 0 0 4pt; letter-spacing: 0.5px; }
  .doc-subtitle { text-align: center; margin: 0 0 18pt; color: #555; font-size: 10pt; text-transform: uppercase; letter-spacing: 1px; }
  .doc-right { text-align: right; }
  h2 { font-size: 12pt; border-bottom: 1px solid #999; padding-bottom: 2pt; margin: 16pt 0 8pt; text-transform: uppercase; letter-spacing: 0.5px; }
  p { margin: 6pt 0; text-align: justify; }
  table.kv { width: 100%; border-collapse: collapse; margin: 4pt 0; }
  table.kv th { width: 35%; text-align: left; font-weight: 600; background: #f5f5f5; padding: 4pt 6pt; border: 1px solid #ddd; vertical-align: top; }
  table.kv td { padding: 4pt 6pt; border: 1px solid #ddd; vertical-align: top; }
  table.grid { width: 100%; border-collapse: collapse; margin: 4pt 0; }
  table.grid th, table.grid td { border: 1px solid #ccc; padding: 4pt 6pt; text-align: left; font-size: 10pt; }
  table.grid th { background: #f5f5f5; }
  .muted { color: #888; font-style: italic; }
  .signature-row { display: flex; justify-content: space-around; gap: 24pt; margin-top: 36pt; }
  .signature-row.centered { justify-content: center; }
  .signature-row .sig { flex: 1; max-width: 280pt; text-align: center; }
  .signature-row .sig .line { border-top: 1px solid #333; height: 1px; margin-bottom: 4pt; }
  .signature-row .sig p { font-size: 9pt; margin: 0; color: #333; }
`;