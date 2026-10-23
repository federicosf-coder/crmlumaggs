export type ConfirmacionFacturacion = "si" | "no" | null;

/** No se asume autorización para productos existentes sin respuesta. */
export function confirmacionFacturacion(value: unknown): ConfirmacionFacturacion {
  if (typeof value !== "string") return null;
  const normalizado = value.trim().toLowerCase();
  if (normalizado === "si" || normalizado === "sí") return "si";
  return normalizado === "no" ? "no" : null;
}

export function etiquetaFacturacion(value: unknown): string {
  const respuesta = confirmacionFacturacion(value);
  return respuesta === "si" ? "Sí" : respuesta === "no" ? "No" : "Sin confirmar";
}