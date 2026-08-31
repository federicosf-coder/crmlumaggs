import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageBanner } from "@/components/PageBanner";
import { PersonalTab } from "./PersonalTab";
import { ReportesMesTab } from "./ReportesMesTab";
import { ConfiguracionTab } from "./ConfiguracionTab";
import { CapturaManualTab } from "./CapturaManualTab";
import { Historico12MesesTab } from "./Historico12MesesTab";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { Loader2 } from "lucide-react";

export default function ReporteVentasSistema() {
  const access = useModuleAccess("reporte_ventas_sistema");

  if (access.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
      </div>
    );
  }

  if (!access.canView) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">No tienes permiso para ver este módulo.</p>
      </div>
    );
  }

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
            <TabsTrigger value="hist12">Últimos 12 meses</TabsTrigger>
            <TabsTrigger value="captura">Captura Manual</TabsTrigger>
            <TabsTrigger value="config">Configuración</TabsTrigger>
          </TabsList>
          <TabsContent value="personal">
            <PersonalTab />
          </TabsContent>
          <TabsContent value="mes">
            <ReportesMesTab />
          </TabsContent>
          <TabsContent value="hist12">
            <Historico12MesesTab />
          </TabsContent>
          <TabsContent value="captura">
            <CapturaManualTab />
          </TabsContent>
          <TabsContent value="config">
            <ConfiguracionTab />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
