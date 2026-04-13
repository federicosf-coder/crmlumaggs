import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CrmBrandDashboard } from "@/components/crm/CrmBrandDashboard";

export default function CrmLanding() {
  const [tab, setTab] = useState("chevron");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">CRM</h1>
        <p className="text-muted-foreground mt-1">Gestión de negocios y ventas</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="chevron">CRM Chevron</TabsTrigger>
          <TabsTrigger value="phillips66">CRM Phillips 66</TabsTrigger>
        </TabsList>
        <TabsContent value="chevron" className="mt-6">
          <CrmBrandDashboard marca="chevron" />
        </TabsContent>
        <TabsContent value="phillips66" className="mt-6">
          <CrmBrandDashboard marca="phillips66" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
