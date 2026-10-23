import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { generateReclamosResumenPdf, reclamosResumenRows } from "./generateReclamosResumenPdf";

const reclamo = {
  inv_pedidos: { numero_po_interno: "DAGAL_NAL_MXL_26065" },
  no_pedido_factura: "valor anterior",
  inv_reclamo_lineas: [{ codigo_producto: "273271981", empaque: "anterior", diferencia: 5 }],
  estatus: "borrador",
};

describe("resumen PDF de reclamos", () => {
  it("exporta solo las filas recibidas y conserva el pedido y el empaque del catálogo", () => {
    const rows = reclamosResumenRows([reclamo], { "273271981": "Tambor 208L (55G)" }, { borrador: "Borrador" });
    expect(rows).toHaveLength(1);
    expect(rows[0][4]).toBe("DAGAL_NAL_MXL_26065");
    expect(rows[0][7]).toBe("273271981 · Tambor 208L (55G) · 5");
    expect(rows[0][8]).toBe("Borrador");
  });
  it("produce un archivo PDF carta horizontal y conserva el estatus original", async () => {
    const original = structuredClone(reclamo);
    const { blob, fileName } = generateReclamosResumenPdf([reclamo], {}, {}, "Todos los estatus");
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPage(0).getSize()).toEqual({ width: 792, height: 612 });
    expect(blob.type).toBe("application/pdf");
    expect(fileName).toMatch(/^Resumen_Reclamos_\d{8}\.pdf$/);
    expect(reclamo).toEqual(original);
  });
  it("rechaza un resumen vacío", () => {
    expect(() => generateReclamosResumenPdf([], {}, {}, "Todos")).toThrow("No hay reclamos para exportar");
  });
});