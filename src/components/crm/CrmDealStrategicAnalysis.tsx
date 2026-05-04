import { useState } from "react";
import { Sparkles, AlertTriangle, Loader2, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AnalysisResult {
  resumen: string;
  acciones: string[];
  riesgo: { hay_riesgo: boolean; motivo?: string };
}

interface Props {
  dealId: string;
}

export function CrmDealStrategicAnalysis({ dealId }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("crm-deal-strategic-analysis", {
        body: { dealId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult(data as AnalysisResult);
    } catch (e: any) {
      toast({
        title: "No se pudo generar el análisis",
        description: e?.message || "Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!result) {
    return (
      <div className="flex flex-col items-start gap-2">
        <Button
          onClick={handleGenerate}
          disabled={loading}
          variant="outline"
          className="border-primary/40 bg-gradient-to-r from-primary/5 to-accent/5 hover:from-primary/10 hover:to-accent/10"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analizando…</>
          ) : (
            <><Sparkles className="h-4 w-4 mr-2 text-primary" /> ✨ Generar Análisis Estratégico</>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          IA analizará actividades, etapa y contexto del negocio.
        </p>
      </div>
    );
  }

  return (
    <Card className="relative overflow-hidden border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4 shadow-sm">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary via-accent to-primary" />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-primary/10 p-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <h4 className="text-sm font-semibold">Inteligencia Estratégica</h4>
        </div>
        {result.riesgo?.hay_riesgo && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" /> Riesgo
          </Badge>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Resumen de Situación
            </p>
          </div>
          <p className="text-sm leading-relaxed">{result.resumen}</p>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Target className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Acciones Recomendadas
            </p>
          </div>
          <ul className="space-y-1.5">
            {result.acciones?.map((a, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{a}</span>
              </li>
            ))}
          </ul>
        </div>

        {result.riesgo?.hay_riesgo && result.riesgo?.motivo && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5">
            <p className="text-xs text-destructive">
              <span className="font-semibold">⚠ Alerta:</span> {result.riesgo.motivo}
            </p>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs w-full"
          onClick={handleGenerate}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
          Regenerar análisis
        </Button>
      </div>
    </Card>
  );
}