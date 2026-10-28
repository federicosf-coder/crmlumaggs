import { describe, expect, it } from "vitest";
import { canSendCobranza, MAX_PDF_BYTES, validateCobranzaEmail } from "../../../supabase/functions/cobranza-enviar/validation";
const valid = { marca: "lumaggs", tipo: "ejecutivo", user_id: "11111111-1111-1111-1111-111111111111", nombre: "Ejecutivo", asunto: "Cobranza", html: "<p>Reporte</p>", filename: "reporte.pdf", pdf: btoa("%PDF-1.7\n"), corte: "2026-10-28", n_facturas: 1, saldo: 100, vencido: 50, vencido_1_7: 25 };
describe("validación de correo de cobranza", () => {
  it.each(["admin", "master", "accounting"])("autoriza %s", (role) => expect(canSendCobranza([role])).toBe(true));
  it.each(["manager", "sales", "warehouse", "delivery", "customer_service"])("deniega %s", (role) => expect(canSendCobranza([role])).toBe(false));
  it("acepta PDF de exactamente 8 MiB", () => {
    expect(MAX_PDF_BYTES).toBe(8388608);
    const pdf = btoa("%PDF-" + "a".repeat(8388608 - 5));
    expect(validateCobranzaEmail({ ...valid, pdf }).pdf).toBe(pdf);
  });
  it("rechaza PDF superior a 8 MiB", () => expect(() => validateCobranzaEmail({ ...valid, pdf: btoa("%PDF-" + "a".repeat(8388608 - 4)) })).toThrow(/8 MB/));
  it("rechaza contenido que no sea PDF", () => expect(() => validateCobranzaEmail({ ...valid, pdf: btoa("archivo") })).toThrow(/PDF/));
  it("acepta las dos marcas y ambos destinatarios", () => {
    for (const marca of ["lumaggs", "galsa"]) for (const tipo of ["ejecutivo", "gerente"]) expect(validateCobranzaEmail({ ...valid, marca, tipo })).toMatchObject({ marca, tipo });
  });
  it("rechaza fecha y conteo inválidos", () => {
    expect(() => validateCobranzaEmail({ ...valid, corte: "2026-02-30" })).toThrow();
    expect(() => validateCobranzaEmail({ ...valid, n_facturas: 1.5 })).toThrow();
  });
});