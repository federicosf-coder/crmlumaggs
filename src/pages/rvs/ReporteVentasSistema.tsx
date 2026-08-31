import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageBanner } from "@/components/PageBanner";
import { PersonalTab } from "./PersonalTab";
import { ReportesMesTab } from "./ReportesMesTab";
import { ConfiguracionTab } from "./ConfiguracionTab";

export default function ReporteVentasSistema() {
  return (
    <>
      <PageBanner
        title="Reporte de Ventas Sistema"
        description="Ventas mensuales por agente y sucursal recibidas automáticamente del sistema."
      />
      <div className="container mx-auto p-4">
        <Tabs defaultValue="personal" className="space-y-4">
          <TabsList>
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="mes">Reportes del Mes</TabsTrigger>
            <TabsTrigger value="config">Configuración</TabsTrigger>
          </TabsList>
          <TabsContent value="personal">
            <PersonalTab />
          </TabsContent>
          <TabsContent value="mes">
            <ReportesMesTab />
          </TabsContent>
          <TabsContent value="config">
            <ConfiguracionTab />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
