import { describe, expect, it } from "vitest";
import { empaqueEtiqueta } from "@/lib/generateReclamoProbidPdf";

describe("empaqueEtiqueta", () => {
  it("usa el nombre del catálogo de Presentaciones cuando hay mapa", () => {
    const mapa = { "273271981": "Tambor 208L (55G)" };
    expect(empaqueEtiqueta("273271981", "", mapa)).toBe("Tambor 208L (55G)");
  });

  it("ignora mayúsculas/minúsculas y espacios en el código", () => {
    const mapa = { "ABC123": "Cubeta 19L (5G)" };
    expect(empaqueEtiqueta(" abc123 ", "otro", mapa)).toBe("Cubeta 19L (5G)");
  });

  it("regresa lo capturado si el código no está en el catálogo", () => {
    expect(empaqueEtiqueta("X1", "Tambor 200L", { "ABC": "Litro" })).toBe("Tambor 200L");
    expect(empaqueEtiqueta("X1", "Tambor 200L", undefined)).toBe("Tambor 200L");
    expect(empaqueEtiqueta("", "", { "ABC": "Litro" })).toBe("");
  });
});
