import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: async () => ({ data: [] }) }) } }));
import { empaqueEtiqueta, generateReclamoProbidPdf } from "@/lib/generateReclamoProbidPdf";

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

describe("hoja oficial de reclamo", () => {
  it.each([1, 3, 10])("mantiene %i productos en una sola hoja carta horizontal", async (cantidad) => {
    const lineas = Array.from({ length: cantidad }, (_, i) => ({ codigo_producto: `P${i}`, nombre_producto: "DELO 400 XLE", cantidad_solicitada: 50, cantidad_recibida: 45, diferencia: 5, facturar_intercambiado: i % 2 ? "si" : "no" }));
    const { blob } = await generateReclamoProbidPdf({ cliente_nombre: "LUMAGGS", token_correo: "REC-3F9A2C" }, lineas, []);
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getSize()).toEqual({ width: 792, height: 612 });
  });
});
