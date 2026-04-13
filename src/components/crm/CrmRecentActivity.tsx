import { useCrmActivities } from "@/hooks/useCrmActivities";
import { CrmActivityItem } from "@/components/crm/CrmActivityItem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CrmRecentActivity({ pipelineId, since }: { pipelineId?: string; since?: string | null }) {
  const { data: activities, isLoading } = useCrmActivities({ limit: 5, since: since || undefined, pipelineId });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">Actividad Reciente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
        ) : !activities || activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin actividades. Registra llamadas, emails y reuniones.</p>
        ) : (
          activities.map((a) => <CrmActivityItem key={a.id} activity={a} />)
        )}
      </CardContent>
    </Card>
  );
}
