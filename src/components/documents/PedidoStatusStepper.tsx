import { Check, Ban } from "lucide-react";

const STEPS = [
  { key: "confirmado_cliente", label: "Confirmado" },
  { key: "espera_autorizacion_precio", label: "Autorización" },
  { key: "precio_autorizado", label: "Precio OK" },
  { key: "validado_contabilidad", label: "Contabilidad" },
  { key: "programado_entrega", label: "Programado" },
  { key: "entregado", label: "Entregado" },
];

interface PedidoStatusStepperProps {
  estatus: string;
}

export default function PedidoStatusStepper({ estatus }: PedidoStatusStepperProps) {
  if (estatus === "cancelado") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3">
        <Ban className="h-4 w-4 text-red-600" />
        <span className="font-medium text-red-700">Pedido cancelado</span>
      </div>
    );
  }

  const currentIndex = STEPS.findIndex((s) => s.key === estatus);
  const activeIndex = currentIndex === -1 ? 0 : currentIndex;

  return (
    <div className="flex w-full items-start overflow-x-auto pb-1">
      {STEPS.map((step, index) => {
        const isCompleted = index < activeIndex;
        const isCurrent = index === activeIndex;
        const isFuture = index > activeIndex;

        return (
          <div key={step.key} className="flex min-w-[72px] flex-1 items-start">
            <div className="flex flex-col items-center">
              <div
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors",
                  isCompleted && "bg-emerald-500 text-white",
                  isCurrent && "bg-blue-600 text-white ring-2 ring-blue-200 ring-offset-2",
                  isFuture && "border-2 border-muted-foreground/20 bg-muted text-muted-foreground",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span
                className={[
                  "mt-2 text-center text-[11px]",
                  isCompleted && "text-emerald-600",
                  isCurrent && "font-semibold text-blue-700",
                  isFuture && "text-muted-foreground",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={[
                  "mt-4 h-0.5 flex-1 min-w-[16px]",
                  isCompleted ? "bg-emerald-500" : "bg-muted",
                ].join(" ")}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
