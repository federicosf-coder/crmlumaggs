export function cantidadPendiente(linea: { cantidad: unknown; cantidad_entregada?: unknown }): number {
  return Math.max(0, Number(linea.cantidad || 0) - Number(linea.cantidad_entregada || 0));
}

export function validarCapturaEntrega(lineas: { id: string; cantidad: unknown; cantidad_entregada?: unknown }[], captura: Record<string, string>) {
  const values = lineas.map((l) => Number(captura[l.id] ?? 0));
  if (!lineas.length || values.some((v, i) => !Number.isFinite(v) || v < 0 || v > cantidadPendiente(lineas[i]))) {
    return "Las cantidades deben estar entre cero y lo pendiente por producto.";
  }
  if (!values.some((v) => v > 0)) return "Captura al menos una cantidad entregada.";
  return null;
}