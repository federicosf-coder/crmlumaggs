import { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STEPS = [
  { key: "empresa", title: "Empresa y contacto" },
  { key: "domicilios", title: "Domicilios" },
  { key: "representacion", title: "Representante y aval" },
  { key: "sociedad", title: "Sociedad" },
  { key: "bancos", title: "Cuentas bancarias" },
  { key: "referencias", title: "Referencias comerciales" },
  { key: "revision", title: "Revisión" },
];

export function CreditoFormularioGuiado({ value, onValueChange, personaMoral, saving, onSave, children }: {
  value: string;
  onValueChange: (value: string) => void;
  personaMoral: boolean;
  saving: boolean;
  onSave: () => Promise<boolean>;
  children: ReactNode;
}) {
  const steps = STEPS.filter((step) => personaMoral || step.key !== "sociedad");
  const index = Math.max(0, steps.findIndex((step) => step.key === value));
  const current = steps[index];
  const next = steps[index + 1];
  return (
    <Tabs value={current.key} onValueChange={onValueChange} className="space-y-5">
      <div className="sticky top-0 z-20 border-b bg-background py-3 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">{current.title}</h2>
          <span className="shrink-0 text-xs text-muted-foreground">Paso {index + 1} de {steps.length}</span>
        </div>
        <Progress value={((index + 1) / steps.length) * 100} aria-label="Paso actual" />
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/50 p-1">
          {steps.map((step, i) => (
            <TabsTrigger key={step.key} value={step.key} disabled={saving} className="h-auto gap-1.5 whitespace-normal text-xs px-2 py-2 text-left">
              <span className="shrink-0">{i + 1}.</span>{step.title}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <fieldset disabled={saving} className="min-w-0 space-y-5 font-light">{children}</fieldset>
      <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-2 border-t bg-background py-3">
        <Button type="button" variant="outline" disabled={saving || index === 0} onClick={() => onValueChange(steps[index - 1].key)}>
          <ArrowLeft className="mr-2 h-4 w-4" />Anterior
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={saving} onClick={() => { void onSave(); }}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Guardar avance
          </Button>
          <Button type="button" disabled={saving} onClick={async () => {
            if (await onSave()) {
              if (next) onValueChange(next.key);
            }
          }}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : next ? <ArrowRight className="mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
            {next ? "Guardar y continuar" : "Guardar solicitud"}
          </Button>
        </div>
      </div>
    </Tabs>
  );
}