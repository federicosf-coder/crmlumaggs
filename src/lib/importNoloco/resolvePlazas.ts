import { supabase } from "@/integrations/supabase/client";
import { normalizeName, bestMatch } from "./normalize";

export interface PlazaCsvRow {
  plaza_raw: string;
  nombre_resuelto: string;
  plaza_id_placeholder: string;
  is_active: string;
}

export interface PlazasResult {
  mapping: Map<string, string>; // placeholder_id -> real_id
  log: {
    encontradas: { raw: string; nombre: string; id: string }[];
    creadas: { raw: string; nombre: string; id: string }[];
    ajustadas: { raw: string; matched: string; id: string; score: number }[];
  };
}

export async function resolvePlazas(rows: PlazaCsvRow[]): Promise<PlazasResult> {
  const { data: existing, error } = await supabase.from("plazas").select("id, nombre");
  if (error) throw error;
  const list = existing || [];

  const mapping = new Map<string, string>();
  const log: PlazasResult["log"] = { encontradas: [], creadas: [], ajustadas: [] };

  for (const row of rows) {
    const placeholder = (row.plaza_id_placeholder || "").trim();
    const target = row.nombre_resuelto || row.plaza_raw;
    const targetNorm = normalizeName(target);

    // Match exacto por nombre normalizado
    const exact = list.find((p) => normalizeName(p.nombre) === targetNorm);
    if (exact) {
      mapping.set(placeholder, exact.id);
      log.encontradas.push({ raw: row.plaza_raw, nombre: exact.nombre, id: exact.id });
      continue;
    }

    // Fuzzy
    const fuzzy = bestMatch(target, list, (p) => p.nombre, 0.85);
    if (fuzzy) {
      mapping.set(placeholder, fuzzy.item.id);
      log.ajustadas.push({ raw: row.plaza_raw, matched: fuzzy.item.nombre, id: fuzzy.item.id, score: fuzzy.score });
      continue;
    }

    // Crear
    const { data: created, error: insErr } = await supabase
      .from("plazas")
      .insert({ nombre: target, is_active: true })
      .select("id, nombre")
      .single();
    if (insErr || !created) throw insErr || new Error("No se pudo crear plaza");
    list.push(created);
    mapping.set(placeholder, created.id);
    log.creadas.push({ raw: row.plaza_raw, nombre: created.nombre, id: created.id });
  }

  return { mapping, log };
}
