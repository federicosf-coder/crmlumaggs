import { describe, expect, it } from "vitest";
import {
  AGENT_CONFIGS,
  empresaDeMarca,
  evaluarCobertura,
  resolveAgentConfig,
} from "../../supabase/functions/_shared/whatsapp-agents";

const GALSA_ID = "318296624690022";
const MEXICALI_ID = "1128863556971458";

describe("resolveAgentConfig", () => {
  it("el número de Galsa obtiene la configuración de Proveedora Galsa", () => {
    const cfg = resolveAgentConfig(GALSA_ID);
    expect(cfg.clave).toBe("galsa");
    expect(cfg.nombreComercial).toBe("Proveedora Galsa");
    expect(cfg.catalogoEmpresa).toBe("galsa_phillips66");
    expect(cfg.cobertura).toBe("bc_sonora");
  });

  it("el número de Mexicali conserva la configuración de Lumaggs", () => {
    const cfg = resolveAgentConfig(MEXICALI_ID);
    expect(cfg.clave).toBe("lumaggs_mexicali");
    expect(cfg.catalogoEmpresa).toBe("lumaggs_chevron");
    expect(cfg.cobertura).toBe("bc_slrc");
    expect(cfg.knowledgeSources).toBeNull();
  });

  it("un número desconocido usa la configuración original de Lumaggs", () => {
    expect(resolveAgentConfig(null).clave).toBe("lumaggs_mexicali");
    expect(resolveAgentConfig("999999999").clave).toBe("lumaggs_mexicali");
  });

  it("Galsa no tiene biblioteca técnica (no usa documentos de Lumaggs)", () => {
    expect(AGENT_CONFIGS[GALSA_ID].knowledgeSources).toEqual([]);
    expect(AGENT_CONFIGS[GALSA_ID].tieneBiblioteca).toBe(false);
  });

  it("cada número tiene su propia configuración aislada", () => {
    expect(AGENT_CONFIGS[MEXICALI_ID]).not.toBe(AGENT_CONFIGS[GALSA_ID]);
    expect(AGENT_CONFIGS[GALSA_ID].leadOrigen).toBe("whatsapp_asesor_ia_galsa");
    expect(AGENT_CONFIGS[GALSA_ID].leadEmpresa).toBe("galsa_phillips66");
  });
});

describe("evaluarCobertura bc_sonora (Galsa: Baja California + todo Sonora)", () => {
  it.each([
    ["Hermosillo", "Sonora"],
    ["Ciudad Obregón", "Sonora"],
    ["Nogales", "Sonora"],
    ["Guaymas", ""],
    ["Navojoa", ""],
    ["Puerto Peñasco", "Sonora"],
    ["Caborca", ""],
    ["San Luis Río Colorado", "Sonora"],
    ["Mexicali", "Baja California"],
    ["Tijuana", ""],
    ["Ensenada", "BC"],
  ])("dentro de cobertura: %s, %s", (municipio, estado) => {
    expect(evaluarCobertura(municipio, estado, "bc_sonora")).toBe("dentro");
  });

  it.each([
    ["La Paz", "Baja California Sur"],
    ["Los Cabos", "BCS"],
    ["Guadalajara", "Jalisco"],
    ["Culiacán", "Sinaloa"],
    ["Phoenix", "Arizona"],
    ["CDMX", "Ciudad de México"],
    ["Chihuahua", "Chihuahua"],
  ])("fuera de cobertura: %s, %s", (municipio, estado) => {
    expect(evaluarCobertura(municipio, estado, "bc_sonora")).toBe("fuera");
  });

  it("sin ubicación declarada queda desconocida", () => {
    expect(evaluarCobertura("", "", "bc_sonora")).toBe("desconocida");
  });

  it("municipio de Sonora con estado contradictorio queda fuera", () => {
    expect(evaluarCobertura("Guaymas", "Sinaloa", "bc_sonora")).toBe("fuera");
  });
});

describe("evaluarCobertura bc_slrc (Lumaggs: comportamiento original intacto)", () => {
  it.each([
    ["Mexicali", ""],
    ["Tijuana", "Baja California"],
    ["San Luis Río Colorado", "Sonora"],
    ["San Quintín", ""],
  ])("dentro: %s, %s", (municipio, estado) => {
    expect(evaluarCobertura(municipio, estado, "bc_slrc")).toBe("dentro");
  });

  it.each([
    ["Hermosillo", "Sonora"],
    ["Ciudad Obregón", "Sonora"],
    ["La Paz", "BCS"],
    ["Guadalajara", "Jalisco"],
  ])("fuera: %s, %s", (municipio, estado) => {
    expect(evaluarCobertura(municipio, estado, "bc_slrc")).toBe("fuera");
  });
});

describe("empresaDeMarca", () => {
  it("respeta el registro de empresa_marcas", () => {
    expect(empresaDeMarca("m1", "Chevron", { m1: "lumaggs_chevron" })).toBe("lumaggs_chevron");
    expect(empresaDeMarca("m2", "Phillips 66", { m2: "galsa_phillips66" })).toBe("galsa_phillips66");
  });

  it("sin registro: Chevron es Lumaggs y cualquier otra marca es Galsa", () => {
    expect(empresaDeMarca(null, "Chevron", {})).toBe("lumaggs_chevron");
    expect(empresaDeMarca(null, "Gonher", {})).toBe("galsa_phillips66");
    expect(empresaDeMarca(undefined, undefined, {})).toBe("galsa_phillips66");
  });
});
