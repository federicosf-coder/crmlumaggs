import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageBanner } from "@/components/PageBanner";
import { DashboardTab } from "./DashboardTab";
import { PersonalTab } from "./PersonalTab";
import { ReportesMesTab } from "./ReportesMesTab";
import { ConfiguracionTab } from "./ConfiguracionTab";
import { CapturaManualTab } from "./CapturaManualTab";
import { Historico12MesesTab } from "./Historico12MesesTab";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { Loader2 } from "lucide-react";

export default function ReporteVentasSistema() {
  const access = useModuleAccess("reporte_ventas_sistema");
  const [tab, setTab] = useState("dashboard");

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
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="bg-gradient-to-r from-indigo-100 via-sky-100 to-emerald-100 dark:from-indigo-950/40 dark:via-sky-950/40 dark:to-emerald-950/40 p-1 h-auto gap-1 border border-indigo-200 dark:border-indigo-900">
            <TabsTrigger
              value="dashboard"
              className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-indigo-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md text-indigo-700 dark:text-indigo-300"
            >
              Dashboard
            </TabsTrigger>
            <TabsTrigger
              value="personal"
              className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-violet-500 data-[state=active]:to-fuchsia-600 data-[state=active]:text-white data-[state=active]:shadow-md text-violet-700 dark:text-violet-300"
            >
              Personal
            </TabsTrigger>
            <TabsTrigger
              value="mes"
              className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-500 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-md text-emerald-700 dark:text-emerald-300"
            >
              Reportes del Mes
            </TabsTrigger>
            <TabsTrigger
              value="hist12"
              className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-amber-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-md text-amber-700 dark:text-amber-300"
            >
              Histórico
            </TabsTrigger>
            <TabsTrigger
              value="captura"
              className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-rose-500 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-md text-rose-700 dark:text-rose-300"
            >
              Captura Manual
            </TabsTrigger>
            <TabsTrigger
              value="config"
              className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-slate-600 data-[state=active]:to-slate-800 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-700 dark:text-slate-300"
            >
              Configuración
            </TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard">
            <DashboardTab onIrAPersonal={() => setTab("personal")} />
          </TabsContent>
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
