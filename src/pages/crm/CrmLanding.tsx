import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CrmBrandDashboard } from "@/components/crm/CrmBrandDashboard";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";

export default function CrmLanding() {
  const [tab, setTab] = useState("chevron");
  const [subTab, setSubTab] = useState<"primera_compra" | "recompra">("primera_compra");
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">CRM</h1>
          <p className="text-muted-foreground mt-1">Negocios separados por marca y tipo de proceso comercial</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/crm/empresas")}>
          <Building2 className="h-4 w-4 mr-2" /> CRM por Empresa
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="chevron">CRM Chevron</TabsTrigger>
          <TabsTrigger value="phillips66">CRM Phillips 66</TabsTrigger>
        </TabsList>

        {(["chevron", "phillips66"] as const).map((m) => (
          <TabsContent key={m} value={m} className="mt-6 space-y-4">
            <Tabs value={subTab} onValueChange={(v) => setSubTab(v as "primera_compra" | "recompra")}>
              <TabsList>
                <TabsTrigger value="primera_compra">Primera Compra</TabsTrigger>
                <TabsTrigger value="recompra">Recompra</TabsTrigger>
              </TabsList>
              <TabsContent value="primera_compra" className="mt-4">
                <CrmBrandDashboard marca={m} pipelineType="primera_compra" />
              </TabsContent>
              <TabsContent value="recompra" className="mt-4">
                <CrmBrandDashboard marca={m} pipelineType="recompra" />
              </TabsContent>
            </Tabs>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
