import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  /** Ruta segura a la que debe volver. Default: /crm */
  fallback?: string;
  className?: string;
  label?: string;
  /** Permite volver por historial solo cuando se necesite explícitamente. */
  useHistory?: boolean;
}

/**
 * Botón "Regresar" reutilizable.
 * - Por defecto navega al fallback para evitar regresar a rutas rotas/404.
 * - Si useHistory=true, intenta regresar al historial y usa fallback como respaldo.
 */
export function BackButton({ fallback = "/crm", className, label = "Regresar", useHistory = false }: BackButtonProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (useHistory && typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(fallback, { replace: true });
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
