import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase as _supabaseTyped } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _supabaseTyped;
import { useAuth } from "@/contexts/AuthContext";
import { useModuleAccess } from "@/hooks/useModuleAccess";

export interface CrmTask {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  contact_id: string | null;
  company_id: string | null;
  priority: string;
  created_at: string;
  updated_at: string;
  task_type?: string | null;
  parent_task_id?: string | null;
  parent_category?: "seguimiento" | "cobranza" | null;
  sequence_order?: number | null;
  completed_at?: string | null;
  mensaje_sugerido?: string | null;
  whatsapp_status?: string | null;
  whatsapp_last_sent_at?: string | null;
  contacts?: { id: string; first_name: string; last_name: string } | null;
  companies?: { id: string; name: string } | null;
}

export function useCrmTasks(filters?: { completed?: boolean; brand?: string }) {
  const { session } = useAuth();
  const access = useModuleAccess("tareas");

  return useQuery({
    queryKey: ["crm_tasks", filters, access.accessLevel, access.teamMemberIds],
    queryFn: async () => {
      if (!access.canView) return [];

      let q = supabase
        .from("crm_tasks")
        .select("*, contacts(id, first_name, last_name), companies(id, name)")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (filters?.completed !== undefined) q = q.eq("completed", filters.completed);

      // PROPIO: own tasks + tasks where I'm collaborator
      // EQUIPO: tasks owned by team OR tasks where any team member is collaborator
      // TODOS: no filter
      if (access.accessLevel === "propio" && access.userId) {
        const { data: collabRows } = await supabase
          .from("crm_task_collaborators")
          .select("task_id")
          .eq("user_id", access.userId);
        const collabIds = Array.from(new Set((collabRows || []).map((r: any) => r.task_id)));
        if (collabIds.length > 0) {
          q = q.or(`user_id.eq.${access.userId},id.in.(${collabIds.join(",")})`);
        } else {
          q = q.eq("user_id", access.userId);
        }
      } else if (access.accessLevel === "equipo" && access.teamMemberIds.length > 0) {
        const { data: collabRows } = await supabase
          .from("crm_task_collaborators")
          .select("task_id")
          .in("user_id", access.teamMemberIds);
        const collabIds = Array.from(new Set((collabRows || []).map((r: any) => r.task_id)));
        const ids = access.teamMemberIds.join(",");
        if (collabIds.length > 0) {
          q = q.or(`user_id.in.(${ids}),id.in.(${collabIds.join(",")})`);
        } else {
          q = q.in("user_id", access.teamMemberIds);
        }
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
      contact_id?: string | null;
      task_type?: string | null;
      parent_task_id?: string | null;
      parent_category?: "seguimiento" | "cobranza" | null;
      sequence_order?: number | null;
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

export function useTaskTimeline(parentId: string | null | undefined) {
  return useQuery({
    queryKey: ["crm_task_timeline", parentId],
    queryFn: async () => {
      if (!parentId) return [] as CrmTask[];
      const { data, error } = await supabase
        .from("crm_tasks")
        .select("*, contacts(id, first_name, last_name), companies(id, name)")
        .eq("parent_task_id", parentId)
        .order("sequence_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as CrmTask[];
    },
    enabled: !!parentId,
  });
}
