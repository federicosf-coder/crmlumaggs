import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCrmPipelines, useCrmPipelineStages } from "@/hooks/useCrmPipelines";
import { useCrmDeals } from "@/hooks/useCrmDeals";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, DollarSign, TrendingUp, Clock, Kanban, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { CrmRecentActivity } from "./CrmRecentActivity";
import { CrmClosingSoon } from "./CrmClosingSoon";
import { CrmMiniPipelineChart } from "./CrmMiniPipelineChart";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { startOfWeek, startOfMonth, startOfQuarter } from "date-fns";

type Period = "week" | "month" | "quarter" | "all";

function getStartDate(period: Period): string | null {
  const now = new Date();
  if (period === "week") return startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  if (period === "month") return startOfMonth(now).toISOString();
  if (period === "quarter") return startOfQuarter(now).toISOString();
  return null;
}

export function CrmBrandDashboard({ marca }: { marca: string }) {
  const { session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [period, setPeriod] = useState<Period>("all");
  const since = getStartDate(period);

  const { data: pipelines, isLoading: pipelinesLoading } = useCrmPipelines(marca);
  const pipeline = pipelines?.[0];
  const { data: stages } = useCrmPipelineStages(pipeline?.id);
  const { data: deals, isLoading: dealsLoading } = useCrmDeals(pipeline?.id);

  const handleCreatePipeline = async () => {
    if (!session?.user) return;
    const { error } = await supabase.rpc("seed_crm_pipeline", { p_marca: marca, p_user_id: session.user.id });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Pipeline creado" });
      window.location.reload();
    }
  };

  if (!pipelinesLoading && !pipeline) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Kanban className="h-16 w-16 text-muted-foreground/40 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Sin Pipeline</h2>
        <p className="text-muted-foreground mb-6">Crea tu primer pipeline para comenzar a rastrear negocios.</p>
        <Button onClick={handleCreatePipeline} size="lg">
          <Plus className="h-5 w-5 mr-2" /> Crear Pipeline
        </Button>
      </div>
    );
  }

  // Stats
  const totalDeals = deals?.length || 0;
  const totalValue = deals?.reduce((sum, d) => sum + Number(d.value || 0), 0) || 0;
  const wonStage = stages?.find((s) => s.name === "Ganado");
  const lostStage = stages?.find((s) => s.name === "Perdido");
  const wonCount = deals?.filter((d) => d.stage_id === wonStage?.id).length || 0;
  const lostCount = deals?.filter((d) => d.stage_id === lostStage?.id).length || 0;
  const closedTotal = wonCount + lostCount;
  const winRate = closedTotal > 0 ? Math.round((wonCount / closedTotal) * 100) : 0;

  const statCards = [
    { label: "Total Negocios", value: String(totalDeals), icon: Target, color: "hsl(210, 70%, 55%)" },
    { label: "Valor Pipeline", value: formatCurrency(totalValue), icon: DollarSign, color: "hsl(170, 50%, 45%)" },
    { label: "Tasa de Cierre", value: `${winRate}%`, icon: TrendingUp, color: "hsl(262, 60%, 55%)" },
    { label: "Ganados", value: String(wonCount), icon: Clock, color: "hsl(14, 98%, 60%)" },
  ];

  const periods: { label: string; value: Period }[] = [
    { label: "Esta Semana", value: "week" },
    { label: "Este Mes", value: "month" },
    { label: "Este Trimestre", value: "quarter" },
    { label: "Todo", value: "all" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate(`/crm/${marca}/pipeline`)}>
            <Kanban className="h-4 w-4 mr-2" /> Pipeline
          </Button>
          <Button variant="outline" onClick={() => navigate(`/crm/${marca}/activities`)}>
            Actividades / Tareas
          </Button>
        </div>
        {isMobile ? (
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {periods.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex flex-wrap gap-1 rounded-full bg-secondary p-1">
            {periods.map((p) => (
              <Button key={p.value} variant={period === p.value ? "default" : "ghost"} size="sm" className="text-xs whitespace-nowrap" onClick={() => setPeriod(p.value)}>
                {p.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="relative overflow-hidden">
            <div className="absolute left-0 top-0 h-full w-1 rounded-l-xl" style={{ backgroundColor: stat.color }} />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
            </CardHeader>
            <CardContent>
              {dealsLoading ? <Skeleton className="h-7 w-20" /> : (
                <div className="text-xl font-semibold">{stat.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CrmRecentActivity pipelineId={pipeline?.id} since={since} />
        <CrmClosingSoon pipelineId={pipeline?.id} since={since} />
      </div>

      <CrmMiniPipelineChart pipelineId={pipeline?.id} />
    </div>
  );
}
