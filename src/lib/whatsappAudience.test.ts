import { describe, it, expect } from "vitest";
import { normalizeAudienceFilters } from "./whatsappAudience";

describe("normalizeAudienceFilters", () => {
  it("vacío = todas las plazas, sin giros, excluye bloqueados", () => {
    expect(normalizeAudienceFilters(null)).toEqual({ plaza_id: null, giro_ids: [], exclude_blocked: true });
  });
  it("quita giros duplicados y vacíos", () => {
    expect(normalizeAudienceFilters({ giro_ids: ["a", "a", "", 3] }).giro_ids).toEqual(["a"]);
  });
  it("respeta exclude_blocked=false", () => {
    expect(normalizeAudienceFilters({ exclude_blocked: false }).exclude_blocked).toBe(false);
  });
});
