import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  /** Ruta de fallback cuando no hay historial. Default: /crm */
  fallback?: string;
  className?: string;
  label?: string;
}

/**
 * Botón "Regresar" reutilizable.
 * - Vuelve al historial anterior cuando es posible.
 * - Si no hay historial (entrada directa), navega al fallback.
 */
export function BackButton({ fallback = "/crm", className, label = "Regresar" }: BackButtonProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleBack}
      className={cn("h-9 px-2 gap-1.5 -ml-2", className)}
    >
      <ArrowLeft className="h-4 w-4" />
      <span className="text-sm">{label}</span>
    </Button>
  );
}
