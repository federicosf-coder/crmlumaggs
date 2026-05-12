import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function usePendingFeedbackCount() {
  const { hasRole } = useAuth();

  const { data: count = 0 } = useQuery({
    queryKey: ["pending_feedback_count"],
    queryFn: async () => {
      if (!hasRole("admin")) return 0;
      const { count, error } = await supabase
        .from("user_feedback")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) {
        console.error("Error fetching pending feedback:", error);
        return 0;
      }
      return count || 0;
    },
    enabled: hasRole("admin"),
    refetchInterval: 60000, // refetch every minute
  });

  return count;
}
