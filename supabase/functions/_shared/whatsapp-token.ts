/**
 * Resuelve la llave de acceso de Meta según el número o la cuenta (WABA).
 *
 * El número Marketing vive en una cuenta de Meta distinta y su usuario del
 * sistema tiene su propia llave (WHATSAPP_ACCESS_TOKEN_MARKETING). El resto de
 * números (Mexicali, Tijuana, Galsa) siguen usando WHATSAPP_ACCESS_TOKEN.
 */
export const MARKETING_PHONE_NUMBER_ID = "1476909262169059";
export const MARKETING_WABA_ID = "1127465449904495";

export function isMarketingLine(ids: { phoneId?: string | null; wabaId?: string | null }): boolean {
  const phone = ids.phoneId ? String(ids.phoneId).trim() : "";
  const waba = ids.wabaId ? String(ids.wabaId).trim() : "";
  return phone === MARKETING_PHONE_NUMBER_ID || waba === MARKETING_WABA_ID;
}

export function whatsappTokenFor(
  ids: { phoneId?: string | null; wabaId?: string | null } = {},
  env: (name: string) => string | undefined = (n) =>
    (globalThis as unknown as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get(n),
): string | undefined {
  if (isMarketingLine(ids)) {
    return env("WHATSAPP_ACCESS_TOKEN_MARKETING") || env("WHATSAPP_ACCESS_TOKEN");
  }
  return env("WHATSAPP_ACCESS_TOKEN");
}
