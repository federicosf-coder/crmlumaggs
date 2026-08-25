import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAlertasPendientes } from "@/hooks/useAlertasPendientes";
import { cn } from "@/lib/utils";

export function AlertasBell() {
  const navigate = useNavigate();
  const { totalCount } = useAlertasPendientes();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      aria-label={`Alertas pendientes: ${totalCount}`}
      onClick={() => navigate("/alertas")}
    >
      <Bell className={cn("h-5 w-5", totalCount > 0 ? "text-blue-600" : "text-muted-foreground")} />
      {totalCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center">
          {totalCount > 99 ? "99+" : totalCount}
        </span>
      )}
    </Button>
  );
}
