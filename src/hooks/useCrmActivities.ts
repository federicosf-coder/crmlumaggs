import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase as _supabaseTyped } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _supabaseTyped;
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
  contact_id: string | null;
  company_id: string | null;
  user_id: string;
  type: CrmActivityType;
  title: string;
  description: string | null;
  activity_date: string;
  created_at: string;
  contacts?: { id: string; first_name: string; last_name: string } | null;
  companies?: { id: string; name: string } | null;
}

export function useCrmActivities(filters?: { type?: string; limit?: number; since?: string; brand?: string }) {
  const access = useModuleAccess("actividades");

  return useQuery({
    queryKey: ["crm_activities", filters, access.accessLevel, access.teamMemberIds],
    queryFn: async () => {
      if (!access.canView) return [];

      let q = supabase
        .from("crm_activities")
        .select("*, contacts(id, first_name, last_name), companies(id, name)")
        .order("activity_date", { ascending: false });
      if (filters?.type) q = q.eq("type", filters.type);
      if (filters?.since) q = q.gte("created_at", filters.since);
      if (filters?.limit) q = q.limit(filters.limit);

      // PROPIO: propias + colaborador
      // EQUIPO: del equipo + actividades donde un miembro del equipo es colaborador
      if (access.accessLevel === "propio" && access.userId) {
        const { data: collabRows } = await supabase
          .from("crm_activity_collaborators")
          .select("activity_id")
          .eq("user_id", access.userId);
        const collabIds = Array.from(new Set((collabRows || []).map((r: any) => r.activity_id)));
        if (collabIds.length > 0) {
          q = q.or(`user_id.eq.${access.userId},id.in.(${collabIds.join(",")})`);
        } else {
          q = q.eq("user_id", access.userId);
        }
      } else if (access.accessLevel === "equipo" && access.teamMemberIds.length > 0) {
        const { data: collabRows } = await supabase
          .from("crm_activity_collaborators")
          .select("activity_id")
          .in("user_id", access.teamMemberIds);
        const collabIds = Array.from(new Set((collabRows || []).map((r: any) => r.activity_id)));
        const ids = access.teamMemberIds.join(",");
        if (collabIds.length > 0) {
          q = q.or(`user_id.in.(${ids}),id.in.(${collabIds.join(",")})`);
        } else {
          q = q.in("user_id", access.teamMemberIds);
        }
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]) as CrmActivity[];
    },
    enabled: !access.isLoading,
  });
}

export function useCreateCrmActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (activity: {
      company_id?: string | null;
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
    onSuccess: () => invalidateActivitySeguimiento(queryClient),
  });
}

export function useUpdateCrmActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; title?: string; description?: string | null; type?: string; company_id?: string | null; contact_id?: string | null }) => {
      const { data, error } = await supabase.from("crm_activities").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateActivitySeguimiento(queryClient),
  });
}

export function useDeleteCrmActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_activities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateActivitySeguimiento(queryClient),
  });
}

function invalidateActivitySeguimiento(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["crm_activities"] });
  qc.invalidateQueries({ queryKey: ["seguimiento_activities_linked"] });
  qc.invalidateQueries({ queryKey: ["seguimiento_tasks_linked"] });
  qc.invalidateQueries({ queryKey: ["seguimiento_ventas"] });
}
