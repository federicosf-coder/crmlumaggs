import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PipelineType = "primera_compra" | "recompra";

export interface CrmPipeline {
  id: string;
  nombre: string;
  marca: string;
  pipeline_type: PipelineType | null;
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

export function useCrmPipelines(marca: string, pipelineType?: PipelineType) {
  return useQuery({
    queryKey: ["crm_pipelines", marca, pipelineType ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("crm_pipelines")
        .select("*")
        .eq("marca", marca)
        .order("created_at", { ascending: true });
      if (pipelineType) q = q.eq("pipeline_type", pipelineType);
      const { data, error } = await q;
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
