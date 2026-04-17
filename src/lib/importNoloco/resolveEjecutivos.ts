import { supabase } from "@/integrations/supabase/client";
import { normalizeName, bestMatch } from "./normalize";

export interface EjecutivoCsvRow {
  full_name: string;
  full_name_normalized: string;
  user_id_placeholder: string;
  role: string;
  is_active: string;
}

export interface EjecutivosResult {
  mapping: Map<string, string>; // placeholder_user_id -> real user_id
  log: {
    encontradas: { raw: string; full_name: string; user_id: string }[];
    creadas: { raw: string; full_name: string; user_id: string }[];
    ajustadas: { raw: string; matched: string; user_id: string; score: number }[];
    roles_agregados: { user_id: string; full_name: string; role: string }[];
  };
}

export async function resolveEjecutivos(rows: EjecutivoCsvRow[]): Promise<EjecutivosResult> {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, user_id, full_name, is_active");
  if (error) throw error;
  const list = (profiles || []).map((p) => ({ user_id: p.user_id, full_name: p.full_name || "" }));

  // Cargar roles existentes
  const { data: roleRows } = await supabase.from("user_roles").select("user_id, role");
  const rolesByUser = new Map<string, Set<string>>();
  (roleRows || []).forEach((r) => {
    if (!rolesByUser.has(r.user_id)) rolesByUser.set(r.user_id, new Set());
    rolesByUser.get(r.user_id)!.add(r.role as string);
  });

  const mapping = new Map<string, string>();
  const log: EjecutivosResult["log"] = { encontradas: [], creadas: [], ajustadas: [], roles_agregados: [] };

  const ensureRole = async (userId: string, fullName: string, role: string) => {
    const set = rolesByUser.get(userId) || new Set();
    if (set.has(role)) return;
    const { error: rErr } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
    if (!rErr) {
      set.add(role);
      rolesByUser.set(userId, set);
      log.roles_agregados.push({ user_id: userId, full_name: fullName, role });
    }
  };

  for (const row of rows) {
    const placeholder = (row.user_id_placeholder || "").trim();
    const target = row.full_name;
    const targetNorm = normalizeName(target);
    const role = row.role || "sales";

    // Exacto
    const exact = list.find((p) => normalizeName(p.full_name) === targetNorm);
    if (exact) {
      mapping.set(placeholder, exact.user_id);
      log.encontradas.push({ raw: row.full_name, full_name: exact.full_name, user_id: exact.user_id });
      await ensureRole(exact.user_id, exact.full_name, role);
      continue;
    }

    // Fuzzy alto (0.9 para personas)
    const fuzzy = bestMatch(target, list, (p) => p.full_name, 0.9);
    if (fuzzy) {
      mapping.set(placeholder, fuzzy.item.user_id);
      log.ajustadas.push({ raw: row.full_name, matched: fuzzy.item.full_name, user_id: fuzzy.item.user_id, score: fuzzy.score });
      await ensureRole(fuzzy.item.user_id, fuzzy.item.full_name, role);
      continue;
    }

    // Crear profile sin auth (user_id generado)
    const newUserId = crypto.randomUUID();
    const { data: created, error: insErr } = await supabase
      .from("profiles")
      .insert({
        user_id: newUserId,
        full_name: target,
        email: null,
        is_active: row.is_active?.toLowerCase() !== "false",
      })
      .select("user_id, full_name")
      .single();
    if (insErr || !created) throw insErr || new Error("No se pudo crear profile");
    list.push({ user_id: created.user_id, full_name: created.full_name || target });
    mapping.set(placeholder, created.user_id);
    log.creadas.push({ raw: row.full_name, full_name: created.full_name || target, user_id: created.user_id });
    await ensureRole(created.user_id, created.full_name || target, role);
  }

  return { mapping, log };
}
