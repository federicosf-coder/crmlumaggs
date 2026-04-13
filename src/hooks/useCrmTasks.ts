import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CrmTask {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  deal_id: string | null;
  contact_id: string | null;
  priority: string;
  created_at: string;
  updated_at: string;
  crm_deals?: { id: string; title: string } | null;
  contacts?: { id: string; first_name: string; last_name: string } | null;
}

export function useCrmTasks(filters?: { completed?: boolean; deal_id?: string }) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["crm_tasks", filters],
    queryFn: async () => {
      let q = supabase
        .from("crm_tasks")
        .select("*, crm_deals(id, title), contacts(id, first_name, last_name)")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (filters?.completed !== undefined) q = q.eq("completed", filters.completed);
      if (filters?.deal_id) q = q.eq("deal_id", filters.deal_id);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as CrmTask[];
    },
    enabled: !!session,
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
      const { data, error } = await supabase.from("crm_tasks").update(updates).eq("id", id).select().single();
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
