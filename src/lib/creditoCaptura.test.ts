import { describe, expect, it } from "vitest";
import { avisosCreditoFila } from "./creditoCaptura";

describe("Avisos de captura de crédito", () => {
  it("señala una referencia vacía sin contarla como completa", () => {
    expect(avisosCreditoFila({}, ["empresa", "contacto", "telefono"])).toContain("Hay datos pendientes en este registro.");
    expect(avisosCreditoFila({ empresa: "Proveedor", contacto: "Ana", telefono: "6861234567" }, ["empresa", "contacto", "telefono"])).toEqual([]);
  });
  it("revisa la CLABE proporcionada sin alterar el borrador ni sus ceros iniciales", () => {
    const row = { banco: "Banco", cuenta: "001234", clabe: "012 345 678 901 234 567", extra: "conservar" };
    expect(avisosCreditoFila(row, ["banco", "cuenta", "clabe"])).toEqual([]);
    expect(row).toEqual({ banco: "Banco", cuenta: "001234", clabe: "012 345 678 901 234 567", extra: "conservar" });
    expect(avisosCreditoFila({ ...row, clabe: "123" }, ["banco", "cuenta", "clabe"])).toContain("Revise la CLABE: debe contener 18 dígitos.");
  });
});