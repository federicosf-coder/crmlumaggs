import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Building2, ArrowLeft } from "lucide-react";
import CommercialDashboard from "./CommercialDashboard";
import CrmPipeline from "./CrmPipeline";

export default function CrmLanding() {
  const [tab, setTab] = useState("chevron");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromSellerPortal =
    searchParams.get("from-page") === "seller-portal" ||
    searchParams.get("from") === "seller-portal";

  const handleBack = () => {
    const params = new URLSearchParams();
    ["from", "to", "ejecutivo", "plaza", "chevron", "phillips"].forEach((k) => {
      const v = searchParams.get(k);
      if (v && v !== "seller-portal") params.set(k, v);
    });
    const qs = params.toString();
    navigate(qs ? `/seller-portal?${qs}` : "/seller-portal");
  };

  return (
    <div className="space-y-6">
      {fromSellerPortal && (
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver al Portal del Vendedor
        </Button>
      )}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">CRM</h1>
          <p className="text-muted-foreground mt-1">Pipelines completos por marca</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/crm/empresas")}>
          <Building2 className="h-4 w-4 mr-2" /> CRM por Empresa
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="chevron">Pipeline Chevron</TabsTrigger>
          <TabsTrigger value="phillips66">Pipeline Phillips 66</TabsTrigger>
          <TabsTrigger value="comercial">Dashboard Comercial</TabsTrigger>
        </TabsList>

        <TabsContent value="chevron" className="mt-6">
          <CrmPipeline brandProp="chevron" embedded />
        </TabsContent>
        <TabsContent value="phillips66" className="mt-6">
          <CrmPipeline brandProp="phillips66" embedded />
        </TabsContent>

        <TabsContent value="comercial" className="mt-6">
          <CommercialDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
