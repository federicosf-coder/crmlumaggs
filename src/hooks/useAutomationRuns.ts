import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AutomationRun = {
  id: string;
  automation_id: string;
  entity_id: string | null;
  entity_type: string | null;
  entity_label: string | null;
  status: "success" | "failed" | "skipped";
  triggered_by: "system" | "user" | "cron";
  error_message: string | null;
  actions_executed: number;
  run_at: string;
};

export function useAutomationRuns(automationId: string | null) {
  return useQuery({
    queryKey: ["automation_runs", automationId],
    enabled: !!automationId,
    queryFn: async (): Promise<AutomationRun[]> => {
      const { data, error } = await (supabase as any)
        .from("automation_runs")
        .select("*")
        .eq("automation_id", automationId)
        .order("run_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as AutomationRun[];
    },
  });
}

export type AutomationRunWithName = AutomationRun & { automation_name: string | null };

export function useAllAutomationRuns(limit = 200) {
  return useQuery({
    queryKey: ["automation_runs_all", limit],
    queryFn: async (): Promise<AutomationRunWithName[]> => {
      const { data, error } = await (supabase as any)
        .from("automation_runs")
        .select("*, automations(name)")
        .order("run_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []).map((r: any) => ({
        ...r,
        automation_name: r.automations?.name ?? null,
      })) as AutomationRunWithName[];
    },
  });
}