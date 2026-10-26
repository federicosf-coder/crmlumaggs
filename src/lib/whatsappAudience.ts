export type AudienceFilters = {
  plaza_id: string | null;
  giro_ids: string[];
  exclude_blocked: boolean;
};

export function normalizeAudienceFilters(raw: unknown): AudienceFilters {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const plaza = typeof r.plaza_id === "string" && r.plaza_id.trim() ? r.plaza_id : null;
  const giros = Array.isArray(r.giro_ids)
    ? Array.from(new Set(r.giro_ids.filter((g): g is string => typeof g === "string" && g.length > 0)))
    : [];
  return { plaza_id: plaza, giro_ids: giros, exclude_blocked: r.exclude_blocked !== false };
}
