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

import { filterContactsByAudience } from "./whatsappAudience";
describe("filterContactsByAudience", () => {
  const cs = [
    { id: "1", mobile: "6641", plaza_id: "tij", interes_ids: ["ind"] },
    { id: "2", mobile: "6642", plaza_id: "tij", interes_ids: ["tra"] },
    { id: "3", mobile: "6643", plaza_id: "mxl", interes_ids: ["ind"] },
    { id: "4", mobile: null, plaza_id: "tij", interes_ids: ["ind"] },
  ];
  const base = { recentIds: new Set<string>(), blockedPhones: new Set<string>(), excludeRecent: true };
  it("plaza y giro OR", () => {
    const r = filterContactsByAudience(cs, { plaza_id: "tij", giro_ids: ["ind", "tra"], exclude_blocked: true }, base);
    expect(r.eligible.map((c) => c.id)).toEqual(["1", "2"]);
  });
  it("48 h se aplica solo si está marcado", () => {
    const f = { plaza_id: null, giro_ids: [], exclude_blocked: true };
    expect(filterContactsByAudience(cs, f, { ...base, recentIds: new Set(["1"]) }).eligible).toHaveLength(2);
    expect(filterContactsByAudience(cs, f, { ...base, recentIds: new Set(["1"]), excludeRecent: false }).eligible).toHaveLength(3);
  });
  it("bloqueados se excluyen", () => {
    const r = filterContactsByAudience(cs, { plaza_id: null, giro_ids: [], exclude_blocked: true }, { ...base, blockedPhones: new Set(["6643"]) });
    expect(r.excludedBlocked).toBe(1);
    expect(r.eligible).toHaveLength(2);
  });
});
