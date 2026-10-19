/** Avisos de captura, no cambian las reglas de aprobación ni impiden guardar borradores. */
export function avisosCreditoFila(row: Record<string, unknown>, keys: string[]): string[] {
  const has = (key: string) => String(row?.[key] ?? "").trim().length > 0;
  const avisos: string[] = [];
  if (keys.some((key) => !has(key))) avisos.push("Hay datos pendientes en este registro.");
  if (keys.includes("clabe") && has("clabe") && !/^\d{18}$/.test(String(row.clabe).replace(/[\s-]/g, ""))) {
    avisos.push("Revise la CLABE: debe contener 18 dígitos.");
  }
  return avisos;
}