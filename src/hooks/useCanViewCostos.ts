import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useCanViewCostos(): boolean {
  const { roles, hasRole } = useAuth();
  const { data } = useQuery({
    queryKey: ["role_costos_visibility"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("role_costos_visibility").select("role, puede_ver_costos");
      if (error) throw error;
      return (data || []) as { role: string; puede_ver_costos: boolean }[];
    },
    staleTime: 5 * 60 * 1000,
  });
  if (hasRole("admin")) return true;
  if (!data) return false;
  return roles.some((r) => data.some((d) => d.role === r && d.puede_ver_costos));
}
