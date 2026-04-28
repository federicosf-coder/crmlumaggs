/**
 * Helpers para mapear placeholders nombrados a {{n}} requerido por Meta.
 *
 * Convención del módulo de plantillas:
 * - El usuario escribe el cuerpo con placeholders nombrados: "Hola {nombre_cliente}, tu folio {folio_cotizacion}".
 * - Antes de enviar a Meta lo convertimos a "Hola {{1}}, tu folio {{2}}" y guardamos
 *   variable_map = ["nombre_cliente", "folio_cotizacion"].
 * - Al enviar un mensaje, el cliente solo manda { nombre_cliente: "...", folio_cotizacion: "..." }
 *   y el backend arma `parameters` en el orden correcto, evitando el error #132000.
 */

/** Extrae los placeholders nombrados {algo} en el orden de aparición y deduplicados. */
export function extractNamedPlaceholders(source: string): string[] {
  const re = /\{([a-z_][a-z0-9_]*)\}/gi;
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const key = m[1].toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

/**
 * Convierte un cuerpo con placeholders nombrados a formato Meta {{n}}.
 * Devuelve el cuerpo transformado y el variable_map ordenado.
 */
export function compileTemplateBody(source: string): {
  body: string;
  variable_map: string[];
} {
  const variable_map = extractNamedPlaceholders(source);
  const indexByName = new Map(variable_map.map((k, i) => [k, i + 1]));
  const body = source.replace(/\{([a-z_][a-z0-9_]*)\}/gi, (_m, raw) => {
    const idx = indexByName.get(String(raw).toLowerCase());
    return idx ? `{{${idx}}}` : _m;
  });
  return { body, variable_map };
}

/** Genera ejemplos genéricos para Meta (campo `examples`, requerido). */
export function buildExampleValues(variable_map: string[]): string[] {
  return variable_map.map((k) => {
    if (k.includes("nombre")) return "Juan Pérez";
    if (k.includes("empresa")) return "Empresa Demo S.A.";
    if (k.includes("folio")) return "COT-001234";
    if (k.includes("total") || k.includes("monto")) return "$12,500.00";
    if (k.includes("fecha")) return "31/12/2026";
    if (k.includes("producto")) return "Lubricante Delo 400";
    if (k.includes("ejecutivo")) return "Ana López";
    return "Texto de ejemplo";
  });
}

/** Renderiza preview reemplazando {nombre} con valores reales (para UI). */
export function renderNamedPreview(
  source: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  return source.replace(/\{([a-z_][a-z0-9_]*)\}/gi, (m, raw) => {
    const v = vars[String(raw).toLowerCase()];
    return v === undefined || v === null || v === "" ? m : String(v);
  });
}