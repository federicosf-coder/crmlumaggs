import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useModuleAccess } from "@/hooks/useModuleAccess";

export interface CrmTask {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  deal_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  priority: string;
  created_at: string;
  updated_at: string;
  crm_deals?: { id: string; title: string } | null;
  contacts?: { id: string; first_name: string; last_name: string } | null;
}

export function useCrmTasks(filters?: { completed?: boolean; deal_id?: string; brand?: string }) {
  const { session } = useAuth();
  const module = filters?.brand === "phillips66" ? "crm_phillips66" as const : "crm_chevron" as const;
  const access = useModuleAccess(module);

  return useQuery({
    queryKey: ["crm_tasks", filters, access.accessLevel, access.teamMemberIds],
    queryFn: async () => {
      if (!access.canView) return [];

      let q = supabase
        .from("crm_tasks")
        .select("*, crm_deals(id, title), contacts(id, first_name, last_name)")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (filters?.completed !== undefined) q = q.eq("completed", filters.completed);
      if (filters?.deal_id) q = q.eq("deal_id", filters.deal_id);

      // Apply access filtering on user_id, include tasks where user is collaborator
      if (access.accessLevel === "propio" && access.userId) {
        const { data: collabRows } = await supabase
          .from("crm_task_collaborators")
          .select("task_id")
          .eq("user_id", access.userId);
        const collabIds = collabRows?.map((r: any) => r.task_id) || [];
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
      return data as unknown as CrmTask[];
    },
    enabled: !!session && !access.isLoading,
  });
}

export function useCreateCrmTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (task: {
      user_id: string;
      title: string;
      description?: string | null;
      due_date?: string | null;
      priority?: string;
      company_id?: string | null;
      deal_id?: string | null;
      contact_id?: string | null;
    }) => {
      const { data, error } = await supabase.from("crm_tasks").insert(task).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm_tasks"] }),
  });
}

export function useUpdateCrmTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { data, error } = await supabase.from("crm_tasks").update(updates as any).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm_tasks"] }),
  });
}

export function useDeleteCrmTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm_tasks"] }),
  });
}
