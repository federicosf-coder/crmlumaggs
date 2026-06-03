import { useQuery } from "@tanstack/react-query";
import { supabase as _supabaseTyped } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _supabaseTyped;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/formatters";
import { Clock, CheckSquare } from "lucide-react";

export function CrmClosingSoon({ pipelineId, since }: { pipelineId?: string; since?: string | null }) {
  const { data: deals, isLoading: dealsLoading } = useQuery({
    queryKey: ["crm-deals-closing-soon", pipelineId, since],
    queryFn: async () => {
      const now = new Date().toISOString().split("T")[0];
      const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      let q = supabase
        .from("crm_deals")
        .select("id, title, value, close_date, companies(name)")
        .gte("close_date", now)
        .lte("close_date", weekFromNow)
        .order("close_date")
        .limit(5);
      if (pipelineId) q = q.eq("pipeline_id", pipelineId);
      if (since) q = q.gte("created_at", since);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!pipelineId,
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["crm-tasks-due-soon"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("crm_tasks")
        .select("id, title, due_date, priority, contacts(first_name, last_name)")
        .eq("completed", false)
        .gte("due_date", now)
        .lte("due_date", weekFromNow)
        .order("due_date")
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const isLoading = dealsLoading || tasksLoading;
  const priorityColor: Record<string, string> = {
    high: "destructive",
    medium: "secondary",
    low: "outline",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Clock className="h-4 w-4" /> Próximos a Vencer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
        ) : (
          <>
            {deals && deals.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Negocios por Cerrar</p>
                {deals.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{d.title}</p>
                      <p className="text-xs text-muted-foreground">{d.companies?.name} · {formatDate(d.close_date)}</p>
                    </div>
                    <span className="text-sm font-semibold">
                      {new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(Number((d as any).potencial_unidades) || Number((d as any).volumen_mensual_estimado) || 0)} u
                    </span>
                  </div>
                ))}
              </div>
            )}

            {tasks && tasks.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <CheckSquare className="h-3 w-3" /> Tareas Pendientes
                </p>
                {tasks.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.contacts ? `${t.contacts.first_name} ${t.contacts.last_name} · ` : ""}
                        {formatDate(t.due_date)}
                      </p>
                    </div>
                    <Badge variant={priorityColor[t.priority] as any}>{t.priority === "high" ? "Alta" : t.priority === "medium" ? "Media" : "Baja"}</Badge>
                  </div>
                ))}
              </div>
            )}

            {(!deals || deals.length === 0) && (!tasks || tasks.length === 0) && (
              <p className="text-sm text-muted-foreground">Nada pendiente en los próximos 7 días.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
