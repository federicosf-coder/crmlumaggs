import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  isError?: boolean;
  onRetry?: () => void;
  deniedText?: string;
}

/**
 * Muestra "sin permiso" solo cuando realmente no hay permiso.
 * Si la verificación falló (conexión lenta / timeout), muestra un error con reintento.
 */
export function AccessMessage({ isError, onRetry, deniedText = "No tienes permiso para ver esta sección." }: Props) {
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 p-10 text-center">
        <AlertTriangle className="h-6 w-6 text-amber-500" />
        <p className="text-sm font-light text-muted-foreground">
          No se pudieron verificar tus permisos. La conexión con el servidor está lenta o falló.
        </p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw className="h-4 w-4 mr-2" /> Reintentar
          </Button>
        )}
      </div>
    );
  }
  return <p className="text-sm font-light text-muted-foreground p-8 text-center">{deniedText}</p>;
}
