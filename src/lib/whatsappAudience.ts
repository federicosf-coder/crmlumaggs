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

export type AudienceContact = {
  id: string;
  whatsapp_phone?: string | null;
  mobile?: string | null;
  plaza_id?: string | null;
  interes_ids?: string[];
};

export type AudienceBreakdown<T> = {
  eligible: T[];
  matched: number;
  excludedRecent: number;
  excludedBlocked: number;
};

/** Aplica las reglas de una audiencia + exclusiones. Los bloqueados siempre se excluyen al enviar. */
export function filterContactsByAudience<T extends AudienceContact>(
  contacts: T[],
  filters: AudienceFilters,
  opts: { recentIds: Set<string>; blockedPhones: Set<string>; excludeRecent: boolean },
): AudienceBreakdown<T> {
  let matched = 0, excludedRecent = 0, excludedBlocked = 0;
  const eligible: T[] = [];
  for (const c of contacts) {
    if (!(c.whatsapp_phone || c.mobile)) continue;
    if (filters.plaza_id && c.plaza_id !== filters.plaza_id) continue;
    if (filters.giro_ids.length > 0) {
      const ids = c.interes_ids || [];
      if (!filters.giro_ids.some((g) => ids.includes(g))) continue;
    }
    matched++;
    const digits = (c.whatsapp_phone || c.mobile || "").replace(/\D/g, "");
    if (digits && opts.blockedPhones.has(digits)) { excludedBlocked++; continue; }
    if (opts.excludeRecent && opts.recentIds.has(c.id)) { excludedRecent++; continue; }
    eligible.push(c);
  }
  return { eligible, matched, excludedRecent, excludedBlocked };
}
