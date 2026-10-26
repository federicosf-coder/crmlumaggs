import { describe, expect, it } from "vitest";
import { normalizeWhatsAppTemplate } from "../../supabase/functions/_shared/whatsapp-template";

describe("Meta template identity", () => {
  it("removes the es display suffix and sends its language independently", () => {
    expect(normalizeWhatsAppTemplate("nombre_plantilla (es)")).toEqual({
      name: "nombre_plantilla", language: { code: "es" },
    });
  });
  it("removes spaces and the es_MX suffix", () => {
    expect(normalizeWhatsAppTemplate("  nombre_plantilla  (es_MX)  ")).toEqual({
      name: "nombre_plantilla", language: { code: "es_MX" },
    });
  });
  it("uses the suffix language over a different stored language", () => {
    expect(normalizeWhatsAppTemplate("prueba (es)", " es_MX ")).toEqual({
      name: "prueba", language: { code: "es" },
    });
  });
  it("uses the stored language when there is no suffix", () => {
    expect(normalizeWhatsAppTemplate("prueba", "es")).toEqual({
      name: "prueba", language: { code: "es" },
    });
  });
  it("keeps a technical name unchanged and defaults only missing languages", () => {
    expect(normalizeWhatsAppTemplate("nombre_plantilla")).toEqual({
      name: "nombre_plantilla", language: { code: "es_MX" },
    });
  });
  it("rejects an empty technical name instead of sending it to Meta", () => {
    expect(() => normalizeWhatsAppTemplate(" (es) ")).toThrow();
  });
  it("rejects a decorated language code", () => {
    expect(() => normalizeWhatsAppTemplate("nombre_plantilla", "(es)")).toThrow();
  });
});