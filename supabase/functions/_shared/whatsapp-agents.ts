// Configuración por número de WhatsApp para el agente de IA.
// Cada número tiene su propia identidad comercial, cobertura geográfica,
// catálogo y fuentes de conocimiento. Sin dependencias externas: este archivo
// también se importa desde las pruebas unitarias del proyecto (vitest).

export type CoberturaClave = "bc_slrc" | "bc_sonora";

export type WhatsAppAgentConfig = {
  /** Identificador interno del agente. */
  clave: string;
  /** Nombre comercial con el que se presenta el agente. */
  nombreComercial: string;
  /** Descripción de identidad usada en el prompt. */
  identidad: string;
  /** Empresa vendedora usada para filtrar el catálogo (empresa_marcas.empresa_vendedora). */
  catalogoEmpresa: "lumaggs_chevron" | "galsa_phillips66";
  /** Cobertura geográfica del agente. */
  cobertura: CoberturaClave;
  /** Texto de cobertura mostrado en el prompt. */
  coberturaDescripcion: string;
  /** Respuesta sugerida cuando el cliente está fuera de cobertura. */
  fueraCoberturaTexto: string;
  /** Fuentes de la biblioteca técnica permitidas; null = todas, [] = sin biblioteca. */
  knowledgeSources: string[] | null;
  /** true si el agente cuenta con biblioteca técnica propia. */
  tieneBiblioteca: boolean;
  /** Origen registrado en leads.payload.origen al transferir. */
  leadOrigen: string;
  /** Empresa registrada en leads.payload.empresa al transferir. */
  leadEmpresa: string;
  /** Nombre de la empresa usado al despedir la transferencia ("un asesor de X continuará"). */
  empresaTransferencia: string;
  /** Instrucciones de calificación adicionales específicas del agente (opcional). */
  calificacionExtra: string;
};

const LUMAGGS_CONFIG: WhatsAppAgentConfig = {
  clave: "lumaggs_mexicali",
  nombreComercial: "Lumaggs",
  identidad:
    "Eres asesor comercial y técnico de LUMAGGS, distribuidor autorizado Chevron para clientes empresariales (B2B) de Baja California.",
  catalogoEmpresa: "lumaggs_chevron",
  cobertura: "bc_slrc",
  coberturaDescripcion:
    "SOLO se atienden negocios/operaciones ubicados en BAJA CALIFORNIA (Tijuana, Mexicali, Ensenada, Tecate, Playas de Rosarito, San Quintín, San Felipe y sus localidades) y en SAN LUIS RÍO COLORADO, SONORA.\n- FUERA DE COBERTURA: resto de Sonora, Baja California Sur, Sinaloa, Chihuahua, Jalisco, CDMX, cualquier otro estado, Estados Unidos u otro país.",
  fueraCoberturaTexto:
    "Gracias por contactarnos. Actualmente nuestra atención comercial está limitada a Baja California y San Luis Río Colorado, por lo que por el momento no podemos atender operaciones fuera de esta zona.",
  knowledgeSources: null,
  tieneBiblioteca: true,
  leadOrigen: "whatsapp_asesor_ia",
  leadEmpresa: "lumaggs_chevron",
  empresaTransferencia: "Lumaggs",
  calificacionExtra: "",
};

const GALSA_CONFIG: WhatsAppAgentConfig = {
  clave: "galsa",
  nombreComercial: "Proveedora Galsa",
  identidad:
    "Eres asesor comercial de PROVEEDORA GALSA, distribuidor de lubricantes Phillips 66 y marcas especializadas para clientes empresariales (B2B) de Baja California y Sonora. Te presentas siempre como parte del equipo de Proveedora Galsa: NUNCA te presentes como Lumaggs, Dagal, Chevron ni como agente de otra empresa o sucursal. Respondes como un asesor comercial capacitado, no como un menú automatizado, y comprendes mensajes informales, con errores ortográficos o incompletos.",
  catalogoEmpresa: "galsa_phillips66",
  cobertura: "bc_sonora",
  coberturaDescripcion:
    "SOLO se atienden negocios/operaciones ubicados en BAJA CALIFORNIA (Tijuana, Mexicali, Ensenada, Tecate, Playas de Rosarito, San Quintín, San Felipe y sus localidades) y en SONORA (Hermosillo, Nogales, Ciudad Obregón, Navojoa, Guaymas, San Luis Río Colorado, Puerto Peñasco, Caborca, Agua Prieta, Cananea y todo el estado).\n- FUERA DE COBERTURA: Baja California Sur, Sinaloa, Chihuahua, Jalisco, CDMX, cualquier otro estado, Estados Unidos u otro país.",
  fueraCoberturaTexto:
    "Gracias por contactar a Proveedora Galsa. Actualmente nuestra atención comercial está limitada a Baja California y Sonora, por lo que por el momento no podemos atender operaciones fuera de esta zona.",
  knowledgeSources: [],
  tieneBiblioteca: false,
  leadOrigen: "whatsapp_asesor_ia_galsa",
  leadEmpresa: "galsa_phillips66",
  empresaTransferencia: "Proveedora Galsa",
  calificacionExtra:
    "- Identifica también si el cliente compra para USO PROPIO, para su EMPRESA o NEGOCIO, o para REVENTA; guárdalo en tipo_cliente.",
};

/** Configuración por business_phone_number_id. Sin coincidencia = agente Lumaggs (comportamiento original). */
export const AGENT_CONFIGS: Record<string, WhatsAppAgentConfig> = {
  // Mexicali (Lumaggs · agente original)
  "1128863556971458": LUMAGGS_CONFIG,
  // Galsa (Proveedora Galsa · +52 1 686 561 8533)
  "318296624690022": GALSA_CONFIG,
};

export function resolveAgentConfig(businessPhoneId: string | null | undefined): WhatsAppAgentConfig {
  return (businessPhoneId && AGENT_CONFIGS[businessPhoneId]) || LUMAGGS_CONFIG;
}

// ───────────────────── cobertura geográfica ─────────────────────
const normalizar = (s: unknown) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const MUNICIPIOS_BC = [
  "tijuana", "mexicali", "ensenada", "tecate", "rosarito", "playas de rosarito",
  "san quintin", "san felipe", "valle de guadalupe", "maneadero", "vicente guerrero",
  "guadalupe victoria", "ciudad morelos", "los algodones", "algodones", "el sauzal",
  "la rumorosa", "valle de la trinidad", "camalu", "el rosario",
];

const MUNICIPIOS_SONORA = [
  "hermosillo", "nogales", "ciudad obregon", "obregon", "cajeme", "navojoa",
  "guaymas", "empalme", "puerto penasco", "penasco", "rocky point", "caborca",
  "sonoyta", "puerto libertad", "bahia de kino", "bahia kino", "kino",
  "agua prieta", "cananea", "naco", "nacozari", "magdalena", "santa ana",
  "altar", "huatabampo", "etchojoa", "miguel aleman", "imuris", "san luis rio colorado",
];

/**
 * Evalúa si una ubicación está dentro de la cobertura del agente.
 *  - bc_slrc:   Baja California + San Luis Río Colorado (agente Lumaggs, comportamiento original).
 *  - bc_sonora: Baja California + todo Sonora (agente Galsa).
 * La ubicación solo se determina por lo que dice el cliente; nunca por la lada.
 */
export function evaluarCobertura(
  municipio: string,
  estado: string,
  cobertura: CoberturaClave = "bc_slrc",
): "dentro" | "fuera" | "desconocida" {
  const m = normalizar(municipio);
  const e = normalizar(estado);
  const txt = `${m} ${e}`.trim();
  if (!txt) return "desconocida";
  if (/san luis rio colorado|\bslrc\b/.test(txt)) return "dentro";
  if (/baja california sur|\bbcs\b|la paz|los cabos|cabo san lucas|comondu|loreto|mulege/.test(txt)) return "fuera";
  if (/baja california|\bb\.?\s?c\.?\b/.test(e) || /baja california/.test(m)) return "dentro";
  if (cobertura === "bc_sonora") {
    if (/\bsonora\b|\bson\.?\b/.test(e)) return "dentro";
    if (MUNICIPIOS_SONORA.some((x) => m === x || m.includes(x))) {
      // Si el estado declarado contradice (otro estado/país), queda fuera
      if (e && !/sonora|\bson\.?\b/.test(e)) return "fuera";
      return "dentro";
    }
  }
  if (MUNICIPIOS_BC.some((x) => m === x || m.includes(x))) {
    // Si el estado declarado contradice (otro estado/país), queda fuera
    if (e && !/baja california|\bbc\b/.test(e)) return "fuera";
    return "dentro";
  }
  if (e || m) return "fuera";
  return "desconocida";
}

/**
 * Empresa vendedora de una marca: primero empresa_marcas; si no hay registro,
 * la marca Chevron pertenece a Lumaggs y cualquier otra a Galsa
 * (misma regla que contabilidad_costos_listar).
 */
export function empresaDeMarca(
  marcaId: string | null | undefined,
  marcaNombre: string | null | undefined,
  mapa: Record<string, string>,
): "lumaggs_chevron" | "galsa_phillips66" {
  const registrada = marcaId ? mapa[marcaId] : undefined;
  if (registrada === "lumaggs_chevron" || registrada === "galsa_phillips66") return registrada;
  return normalizar(marcaNombre) === "chevron" ? "lumaggs_chevron" : "galsa_phillips66";
}
