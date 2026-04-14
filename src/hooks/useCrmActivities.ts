import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useModuleAccess } from "@/hooks/useModuleAccess";

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

export function useCrmActivities(filters?: { type?: string; limit?: number; since?: string; pipelineId?: string; brand?: string }) {
  const module = filters?.brand === "phillips66" ? "crm_phillips66" as const : "crm_chevron" as const;
  const access = useModuleAccess(module);

  return useQuery({
    queryKey: ["crm_activities", filters, access.accessLevel, access.teamMemberIds],
    queryFn: async () => {
      if (!access.canView) return [];

      let q = supabase
        .from("crm_activities")
        .select("*, crm_deals(id, title, pipeline_id), contacts(id, first_name, last_name), companies(id, name)")
        .order("activity_date", { ascending: false });
      if (filters?.type) q = q.eq("type", filters.type);
      if (filters?.since) q = q.gte("created_at", filters.since);
      if (filters?.limit) q = q.limit(filters.limit);

      // Apply access filtering on user_id, but also include activities where user is a collaborator
      if (access.accessLevel === "propio" && access.userId) {
        // Get activity IDs where user is collaborator
        const { data: collabRows } = await supabase
          .from("crm_activity_collaborators")
          .select("activity_id")
          .eq("user_id", access.userId);
        const collabIds = collabRows?.map((r: any) => r.activity_id) || [];
        if (collabIds.length > 0) {
          q = q.or(`user_id.eq.${access.userId},id.in.(${collabIds.join(",")})`);
        } else {
          q = q.eq("user_id", access.userId);
        }
      } else if (access.accessLevel === "equipo" && access.teamMemberIds.length > 0) {
        q = q.in("user_id", access.teamMemberIds);
      }

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
    enabled: !access.isLoading,
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
