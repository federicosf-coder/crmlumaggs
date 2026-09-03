import { useNavigate } from "react-router-dom";
import { PageBanner } from "@/components/PageBanner";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import CobranzaDashboardContent from "./CobranzaDashboardContent";

export default function CobranzaLanding() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <PageBanner
        title="Cobranza"
        description="Cobrado, facturado y cartera por periodo, plaza y empresa"
        avatar={<div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center"><Wallet className="h-5 w-5" /></div>}
      >
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:text-blue-300"
            onClick={() => navigate("/cobranza/chevron")}
          >
            Lumaggs · Chevron
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:text-orange-300"
            onClick={() => navigate("/cobranza/phillips66")}
          >
            Galsa · Phillips 66
          </Button>
        </div>
      </PageBanner>
      <CobranzaDashboardContent />
    </div>
  );
}
