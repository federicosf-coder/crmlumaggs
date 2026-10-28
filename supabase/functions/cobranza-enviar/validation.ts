export const MAX_PDF_BYTES = 8 * 1024 * 1024;

export function canSendCobranza(roles: string[]): boolean {
  return roles.some((role) => ["admin", "master", "accounting"].includes(role));
}

export interface CobranzaEmailBody {
  marca: "lumaggs" | "galsa";
  tipo: "ejecutivo" | "gerente";
  user_id: string;
  nombre: string;
  asunto: string;
  html: string;
  filename: string;
  pdf: string;
  corte: string;
  n_facturas: number;
  saldo: number;
  vencido: number;
  vencido_1_7: number;
}

export function validateCobranzaEmail(value: unknown): CobranzaEmailBody {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Solicitud inválida");
  const body = value as Record<string, unknown>;
  if (body.marca !== "lumaggs" && body.marca !== "galsa") throw new Error("Marca inválida");
  if (body.tipo !== "ejecutivo" && body.tipo !== "gerente") throw new Error("Tipo de destinatario inválido");
  if (typeof body.user_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.user_id)) throw new Error("Usuario inválido");
  for (const [field, max] of [["nombre", 255], ["asunto", 500], ["html", 2 * 1024 * 1024], ["filename", 255]] as const) {
    if (typeof body[field] !== "string" || !(body[field] as string).trim() || (body[field] as string).length > max) throw new Error(`Campo inválido: ${field}`);
  }
  if (!/^[^/\\\r\n]+\.pdf$/i.test(body.filename as string)) throw new Error("Nombre de PDF inválido");
  if (typeof body.corte !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.corte) || !Number.isFinite(Date.parse(body.corte)) || new Date(body.corte).toISOString().slice(0, 10) !== body.corte) throw new Error("Fecha de corte inválida");
  for (const field of ["n_facturas", "saldo", "vencido", "vencido_1_7"] as const) {
    if (typeof body[field] !== "number" || !Number.isFinite(body[field])) throw new Error(`Campo numérico inválido: ${field}`);
  }
  if (!Number.isInteger(body.n_facturas) || (body.n_facturas as number) < 0 || (body.n_facturas as number) > 2147483647) throw new Error("Cantidad de facturas inválida");
  if (typeof body.pdf !== "string" || body.pdf.length > Math.ceil(MAX_PDF_BYTES / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.pdf)) throw new Error("PDF inválido o mayor a 8 MB");
  const decoded = atob(body.pdf);
  if (decoded.length > MAX_PDF_BYTES) throw new Error("El PDF supera los 8 MB");
  if (!decoded.startsWith("%PDF-")) throw new Error("El adjunto no es un PDF");
  return body as unknown as CobranzaEmailBody;
}