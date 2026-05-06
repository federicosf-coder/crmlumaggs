import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Automation = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  entity_type: "deal" | "company" | "document" | "contact" | "task";
  trigger_type: string;
  trigger_config: any;
  conditions: any;
  run_count: number;
  last_run_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function useAutomations() {
  return useQuery({
    queryKey: ["automations"],
    queryFn: async (): Promise<Automation[]> => {
      const { data, error } = await (supabase as any)
        .from("automations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Automation[];
    },
  });
}

export function useToggleAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from("automations")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automations"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error al actualizar"),
  });
}

export function useDeleteAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("automations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automations"] });
      toast.success("Automatización eliminada");
    },
    onError: (e: any) => toast.error(e.message ?? "Error al eliminar"),
  });
}