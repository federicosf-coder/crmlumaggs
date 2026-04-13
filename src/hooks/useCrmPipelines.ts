import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CrmPipeline {
  id: string;
  nombre: string;
  marca: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmPipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
}

export function useCrmPipelines(marca: string) {
  return useQuery({
    queryKey: ["crm_pipelines", marca],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_pipelines")
        .select("*")
        .eq("marca", marca)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as CrmPipeline[];
    },
  });
}

export function useCrmPipelineStages(pipelineId: string | undefined) {
  return useQuery({
    queryKey: ["crm_pipeline_stages", pipelineId],
    queryFn: async () => {
      if (!pipelineId) return [];
      const { data, error } = await supabase
        .from("crm_pipeline_stages")
        .select("*")
        .eq("pipeline_id", pipelineId)
        .order("position", { ascending: true });
      if (error) throw error;
      return data as CrmPipelineStage[];
    },
    enabled: !!pipelineId,
  });
}
