import { CREDITO_TIPO_PERSONA_LABEL } from "./credito";

export const TEMPLATE_KEYS = [
  "solicitud",
  "confidencialidad",
  "buro",
  "subsistencia",
  "lfpiorpi",
  "bc_si",
  "bc_no",
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  solicitud: "Solicitud de crédito",
  confidencialidad: "Contrato de confidencialidad",
  buro: "Autorización Buró de Crédito",
  subsistencia: "Carta de Subsistencia de Poderes",
  lfpiorpi: "Recursos de Procedencia Lícita",
  bc_si: "Beneficiario Controlador — Sí existe",
  bc_no: "Beneficiario Controlador — No existe",
};

export function templateKeyForFirma(firmaKey: string, form: any): TemplateKey | null {
  if (firmaKey === "lfpiorpi") {
    return "lfpiorpi";
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
  const bancosRaw = form?.datos_bancarios;
  const bancos: any[] = Array.isArray(bancosRaw)
    ? bancosRaw
    : (bancosRaw && typeof bancosRaw === "object" ? [bancosRaw] : []);
  const primerBanco: any = bancos[0] || {};

  const emptyBankRow = `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`;
  const bancosTop3 = bancos.slice(0, 3);
  const bancosHtml =
    bancosTop3
      .map((b: any) => `<tr><td>${b?.banco ?? ""}</td><td>${b?.cuenta ?? ""}</td><td>${b?.clabe ?? ""}</td></tr>`)
      .join("") + emptyBankRow.repeat(Math.max(0, 3 - bancosTop3.length));

  const tipo = form?.tipo_persona || form?.csf_tipo_persona || "moral";

  const emptyRefRow = `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`;
  const refsTop3 = referencias.slice(0, 3);
  const refsHtml =
    refsTop3
      .map((r: any) => `<tr><td>${r?.empresa ?? ""}</td><td>${r?.contacto ?? ""}</td><td>${r?.telefono ?? ""}</td></tr>`)
      .join("") + emptyRefRow.repeat(Math.max(0, 3 - refsTop3.length));

  const accionistasRaw = Array.isArray(form?.accionistas) ? form.accionistas : [];
  const fmtAcc = (v: any) => {
    if (v === null || v === undefined || v === "") return "";
    const n = Number(v);
    return Number.isFinite(n) ? n.toLocaleString("es-MX") : String(v);
  };
  const accionistasHtml =
    accionistasRaw.length > 0
      ? accionistasRaw
          .map(
            (a: any) =>
              `<tr><td class="accionista-nombre" style="width:70% !important;text-align:left !important">${a?.nombre ?? ""}</td><td class="accionista-acciones" style="width:30% !important;text-align:right !important">${fmtAcc(a?.acciones ?? a?.no_acciones)}</td></tr>`
          )
          .join("")
      : `<tr><td class="accionista-nombre" style="width:70% !important;text-align:left !important">&nbsp;</td><td class="accionista-acciones" style="width:30% !important;text-align:right !important">&nbsp;</td></tr>`;

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
    banco_nombre: primerBanco?.banco || "",
    banco_cuenta: primerBanco?.cuenta || "",
    banco_clabe: primerBanco?.clabe || "",
    datos_bancarios_html: bancosHtml,
    referencias_comerciales_html: refsHtml,
    accionistas_html: accionistasHtml,
    escritura_constitutiva: form?.escritura_constitutiva || "",
    datos_registro: form?.datos_registro || "",
    ultima_asamblea: form?.ultima_asamblea || "",
    administrador_presidente: form?.administrador_presidente || "",
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

// Plantilla por defecto para "Recursos de Procedencia Lícita" (LFPIORPI).
// Se usa cuando no existe un registro en credit_doc_templates para la key "lfpiorpi".
export const LFPIORPI_DEFAULT_HTML = `
<div class="header">
  <div class="header-title" style="text-align:center;width:100%">
    <div class="empresa">{{empresa_vendedora_nombre_largo}}</div>
    <div class="doc-name">Declaración de Origen y Licitud de Recursos (LFPIORPI)</div>
  </div>
</div>

<p class="doc-right"><strong>LUGAR Y FECHA:</strong> {{ciudad_firma}}, a {{fecha_firma}}</p>

<p style="text-align:center;margin-top:10pt"><strong>ASUNTO: DECLARACIÓN DE ORIGEN Y LICITUD DE RECURSOS</strong></p>

<p style="margin-top:10pt"><strong>A QUIEN CORRESPONDA:</strong></p>
<p><strong>{{empresa_vendedora_nombre_largo}}</strong><br/>P R E S E N T E.</p>

<p>El que suscribe, <strong>{{rep_legal_nombre}}</strong>, actuando en mi propio nombre o, en su caso, en nombre y representación de <strong>{{razon_social}}</strong> ({{tipo_persona_label}}), y para dar cumplimiento a las disposiciones establecidas en la Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita (LFPIORPI) y su normatividad secundaria, declaro bajo protesta de decir verdad lo siguiente:</p>

<p><strong>PRIMERO.-</strong> Que los recursos, bienes, fondos y/o valores, monetarios o de cualquier otra índole, que entrego, transfiero, deposito o destino en relación con la operación, contrato o servicio celebrado con ustedes, tienen un origen lícito.</p>

<p><strong>SEGUNDO.-</strong> Que dichos recursos provienen directa y exclusivamente del desarrollo de mis actividades económicas y comerciales, las cuales se encuentran dentro del marco legal vigente en los Estados Unidos Mexicanos, y bajo ninguna circunstancia provienen, ni se utilizarán, para financiar, apoyar u ocultar actividades ilícitas de las contempladas en el Código Penal Federal o legislación aplicable.</p>

<p><strong>TERCERO.-</strong> Que los recursos son de mi propiedad exclusiva y no actúo en nombre ni por cuenta de un tercero oculto o no declarado, obligándome a informar de manera inmediata a esta institución en caso de que dicha situación cambie.</p>

<p><strong>CUARTO.-</strong> Autorizo expresamente a <strong>{{empresa_vendedora_nombre_largo}}</strong> para que lleve a cabo las verificaciones, análisis e investigaciones que considere pertinentes para comprobar la veracidad de esta declaración. Asimismo, me comprometo a proporcionar cualquier documentación adicional (estados de cuenta, declaraciones fiscales, facturas, actas constitutivas) que me sea requerida para cumplir con la normatividad de Prevención de Lavado de Dinero (PLD).</p>

<p><strong>QUINTO.-</strong> Asumo la plena responsabilidad jurídica y legal en caso de que esta declaración resulte ser falsa o inexacta, eximiendo a <strong>{{empresa_vendedora_nombre_largo}}</strong> de cualquier responsabilidad civil, penal o administrativa que dicha falsedad pudiera ocasionar.</p>

<p>Manifiesto mi conformidad para que la presente declaración sea del conocimiento de las autoridades competentes (incluyendo a la Secretaría de Hacienda y Crédito Público y la Unidad de Inteligencia Financiera) si así lo requieren en el ejercicio de sus facultades legales.</p>

<p style="margin-top:16pt;text-align:center"><strong>Atentamente,</strong></p>

<div class="signature-row" style="margin-top:20mm">
  <div class="sig">
    <div class="line"></div>
    <p><strong>{{rep_legal_nombre}}</strong></p>
    <p>{{razon_social}}</p>
  </div>
</div>
`;

export const PRINT_STYLES = `
  @page { size: letter; margin: 6mm 6mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #1a1a1a; background: #fff; }
  .doc-title { font-size: 18pt; text-align: center; margin: 0 0 4pt; letter-spacing: 0.5px; }
  .doc-subtitle { text-align: center; margin: 0 0 18pt; color: #555; font-size: 10pt; text-transform: uppercase; letter-spacing: 1px; }
  .doc-right { text-align: right; }
  h2 { font-size: 12pt; border-bottom: 1px solid #999; padding-bottom: 2pt; margin: 16pt 0 8pt; text-transform: uppercase; letter-spacing: 0.5px; }
  p { margin: 6pt 0; text-align: justify; }
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2mm; padding-bottom: 1.5mm; border-bottom: 1.2pt solid #1a3e6e; }
  .header-logo img { height: 14mm; }
  .header-title { text-align: right; }
  .header-title .empresa { font-size: 11pt; font-weight: bold; color: #1a3e6e; text-transform: uppercase; letter-spacing: 0.5px; }
  .header-title .doc-name { font-size: 9pt; color: #555; margin-top: 1px; }
  .section-title { background-color: #1a3e6e; color: #fff; font-size: 8pt; font-weight: bold; text-align: center; padding: 2px 5px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2mm; }
  table { width: 100%; border-collapse: collapse; }
  table.kv th, table.kv td { border: 0.4pt solid #b0b8c8; padding: 2px 5px; vertical-align: middle; line-height: 1.25; height: 5.2mm; }
  table.kv th { background: #dce6f1; color: #1a3e6e; font-weight: bold; white-space: nowrap; width: 22%; font-size: 7.5pt; text-align: left; }
  table.kv td { color: #1a1a1a; font-size: 8pt; }
  table.kv th.th-sm { width: 11%; }
  table.kv td.td-sm { width: 22%; }
  table.grid { display: table !important; width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 0; }
  table.grid thead { display: table-header-group !important; }
  table.grid tbody { display: table-row-group !important; }
  table.grid tr { display: table-row !important; }
  table.grid th, table.grid td { display: table-cell !important; }
  table.grid th { background: #dce6f1; color: #1a3e6e; font-weight: bold; border: 0.4pt solid #b0b8c8; padding: 2px 5px; font-size: 7.5pt; text-align: left; height: 5.2mm; overflow: hidden; }
  table.grid td { border: 0.4pt solid #b0b8c8; padding: 2px 5px; font-size: 8pt; height: 5.6mm; overflow: hidden; word-wrap: break-word; overflow-wrap: break-word; }
  table.accionistas-grid col:first-child { width: 70% !important; }
  table.accionistas-grid col:nth-child(2) { width: 30% !important; }
  table.accionistas-grid th:first-child, table.accionistas-grid td:first-child { width: 70% !important; text-align: left !important; }
  table.accionistas-grid th:nth-child(2), table.accionistas-grid td:nth-child(2) { width: 30% !important; text-align: right !important; }
  .muted { color: #888; font-style: italic; }
  .signature-row { display: flex; justify-content: space-between; margin-top: 8mm; gap: 14mm; }
  .sig { flex: 1; text-align: center; }
  .sig .line { border-top: 0.8pt solid #1a1a1a; margin-bottom: 2px; height: 7mm; }
  .sig p { font-size: 7pt; color: #444; }
`;
