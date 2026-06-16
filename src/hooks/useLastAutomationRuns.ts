import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the last successful automation run timestamp per `trigger_key`
 * (existing-button-click button id) for a given entity. Useful to render
 * "Último envío: ..." below action buttons that fire automations.
 */
export function useLastAutomationRuns(
  entityId: string | null | undefined,
  triggerKeys: string[],
) {
  const keyHash = [...triggerKeys].sort().join("|");
  return useQuery({
    queryKey: ["lastAutomationRuns", entityId ?? null, keyHash],
    enabled: !!entityId && triggerKeys.length > 0,
    staleTime: 15_000,
    queryFn: async (): Promise<Record<string, string | null>> => {
      const result: Record<string, string | null> = {};
      for (const k of triggerKeys) result[k] = null;
      if (!entityId) return result;

      // 1. Map automations (button_id -> automation_ids[]) for the wanted keys
      const { data: autos } = await (supabase as any)
        .from("automations")
        .select("id, trigger_config")
        .eq("trigger_type", "existing_button_click");
      const idToKey = new Map<string, string>();
      const wanted = new Set(triggerKeys);
      for (const a of autos || []) {
        const k = (a as any).trigger_config?.button_id;
        if (k && wanted.has(k)) idToKey.set((a as any).id, k);
      }
      const automationIds = Array.from(idToKey.keys());
      if (!automationIds.length) return result;

      // 2. Latest successful run per automation_id for this entity
      const { data: runs } = await (supabase as any)
        .from("automation_runs")
        .select("automation_id, run_at, status")
        .eq("entity_id", entityId)
        .in("automation_id", automationIds)
        .eq("status", "success")
        .order("run_at", { ascending: false })
        .limit(200);
      for (const r of runs || []) {
        const k = idToKey.get((r as any).automation_id);
        if (!k) continue;
        if (!result[k]) result[k] = (r as any).run_at;
      }
      return result;
    },
  });
}
