import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CrmActivityType = "call" | "email" | "meeting" | "note" | "field_visit" | "whatsapp" | "follow_up" | "task";

export const ACTIVITY_TYPE_CONFIG: Record<CrmActivityType, { emoji: string; label: string }> = {
  call: { emoji: "📞", label: "Llamada" },
  email: { emoji: "📧", label: "Correo" },
  meeting: { emoji: "📅", label: "Reunión" },
  note: { emoji: "📝", label: "Nota" },
  field_visit: { emoji: "🏢", label: "Visita de Campo" },
  whatsapp: { emoji: "💬", label: "WhatsApp" },
  follow_up: { emoji: "🔄", label: "Seguimiento" },
  task: { emoji: "✅", label: "Tarea" },
};

export interface CrmActivity {
  id: string;
  deal_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  user_id: string;
  type: CrmActivityType;
  title: string;
  description: string | null;
  activity_date: string;
  created_at: string;
  crm_deals?: { id: string; title: string } | null;
  contacts?: { id: string; first_name: string; last_name: string } | null;
  companies?: { id: string; name: string } | null;
}

export function useCrmActivities(filters?: { type?: string; limit?: number; since?: string; pipelineId?: string }) {
  return useQuery({
    queryKey: ["crm_activities", filters],
    queryFn: async () => {
      let q = supabase
        .from("crm_activities")
        .select("*, crm_deals(id, title, pipeline_id), contacts(id, first_name, last_name), companies(id, name)")
        .order("activity_date", { ascending: false });
      if (filters?.type) q = q.eq("type", filters.type);
      if (filters?.since) q = q.gte("created_at", filters.since);
      if (filters?.limit) q = q.limit(filters.limit);
      const { data, error } = await q;
      if (error) throw error;
      // Filter by pipeline if needed
      let results = data as any[];
      if (filters?.pipelineId) {
        results = results.filter(
          (a) => !a.crm_deals || a.crm_deals.pipeline_id === filters.pipelineId
        );
      }
      return results as CrmActivity[];
    },
  });
}

export function useCreateCrmActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (activity: {
      company_id?: string | null;
      deal_id?: string | null;
      contact_id?: string | null;
      user_id: string;
      type: CrmActivityType;
      title: string;
      description?: string | null;
      activity_date?: string;
    }) => {
      const { data, error } = await supabase.from("crm_activities").insert(activity).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm_activities"] });
    },
  });
}

export function useUpdateCrmActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; title?: string; description?: string | null; type?: string }) => {
      const { data, error } = await supabase.from("crm_activities").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm_activities"] });
    },
  });
}

export function useDeleteCrmActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_activities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm_activities"] });
    },
  });
}
