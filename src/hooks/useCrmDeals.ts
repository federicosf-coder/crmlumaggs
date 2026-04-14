import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useModuleAccess } from "@/hooks/useModuleAccess";

export interface CrmDeal {
  id: string;
  title: string;
  pipeline_id: string;
  stage_id: string;
  company_id: string | null;
  contact_id: string | null;
  owner_id: string | null;
  value: number;
  probability: number;
  close_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  companies?: { id: string; name: string } | null;
  contacts?: { id: string; first_name: string; last_name: string } | null;
}

export function useCrmDeals(pipelineId: string | undefined, brand?: string) {
  const queryClient = useQueryClient();
  const module = brand === "phillips66" ? "crm_phillips66" as const : "crm_chevron" as const;
  const access = useModuleAccess(module);

  const query = useQuery({
    queryKey: ["crm_deals", pipelineId, access.accessLevel, access.teamMemberIds],
    queryFn: async () => {
      if (!pipelineId || !access.canView) return [];
      let q = supabase
        .from("crm_deals")
        .select("*, companies(id, name), contacts(id, first_name, last_name)")
        .eq("pipeline_id", pipelineId);

      if (access.accessLevel === "propio" && access.userId) {
        q = q.or(`created_by.eq.${access.userId},owner_id.eq.${access.userId}`);
      } else if (access.accessLevel === "equipo" && access.teamMemberIds.length > 0) {
        q = q.or(`created_by.in.(${access.teamMemberIds.join(",")}),owner_id.in.(${access.teamMemberIds.join(",")})`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown) as CrmDeal[];
    },
    enabled: !!pipelineId && !access.isLoading,
  });

  useEffect(() => {
    const channel = supabase
      .channel("crm-deals-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_deals" }, () => {
        queryClient.invalidateQueries({ queryKey: ["crm_deals"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}

export function useCreateCrmDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deal: {
      title: string;
      pipeline_id: string;
      stage_id: string;
      owner_id?: string;
      created_by?: string;
      company_id?: string | null;
      contact_id?: string | null;
      value?: number;
      probability?: number;
      close_date?: string | null;
      notes?: string | null;
    }) => {
      const { data, error } = await supabase.from("crm_deals").insert(deal).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm_deals"] });
    },
  });
}

export function useUpdateCrmDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { data, error } = await supabase.from("crm_deals").update(updates as any).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm_deals"] });
    },
  });
}

export function useDeleteCrmDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_deals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm_deals"] });
    },
  });
}
