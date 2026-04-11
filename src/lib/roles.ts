// Spanish labels for role keys
export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  sales: "Ventas",
  delivery: "Entregas",
  warehouse: "Almacén",
  customer_service: "Servicio al Cliente",
  accounting: "Contabilidad",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] || role;
}
