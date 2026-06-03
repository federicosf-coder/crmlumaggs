import { useQuery } from "@tanstack/react-query";
import { supabase as _supabaseTyped } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _supabaseTyped;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

export function CrmMiniPipelineChart({ pipelineId }: { pipelineId?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["crm-pipeline-chart", pipelineId],
    queryFn: async () => {
      if (!pipelineId) return [];

      const { data: stages } = await supabase
        .from("crm_pipeline_stages")
        .select("id, name, color, position")
        .eq("pipeline_id", pipelineId)
        .order("position");

      const { data: deals } = await supabase
        .from("crm_deals")
        .select("stage_id")
        .eq("pipeline_id", pipelineId);

      if (!stages) return [];

      return stages.map((s: any) => ({
        name: s.name,
        color: s.color,
        count: deals?.filter((d: any) => d.stage_id === s.id).length || 0,
      }));
    },
    enabled: !!pipelineId,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">Vista General del Pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Crea un pipeline para ver la gráfica.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.map((entry: any, idx: number) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
