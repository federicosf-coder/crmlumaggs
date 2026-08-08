import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Boxes } from "lucide-react";
import { KardexCargaTabContent } from "@/pages/inventario/KardexCarga";
import { MinMaxTabContent } from "@/pages/inventario/MinMaxInventario";
import { ReporteKardexTabContent } from "@/pages/inventario/ReporteKardex";
import { RotacionInventarioTabContent } from "@/pages/inventario/RotacionInventario";

export default function GestionKardex() {
  const [tab, setTab] = useState("carga");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Boxes className="h-6 w-6 text-primary" /> Gestión de Kárdex e Inventario
          </h1>
          <p className="text-sm text-muted-foreground font-light">
            Carga de reportes CONTPAQi, niveles de reorden y reporte consolidado de inventario.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="carga">Carga de Kárdex</TabsTrigger>
          <TabsTrigger value="minmax">Mínimos y Máximos</TabsTrigger>
          <TabsTrigger value="reporte">Reporte</TabsTrigger>
          <TabsTrigger value="rotacion">Rotación</TabsTrigger>
        </TabsList>

        <TabsContent value="carga" className="mt-4">
          <KardexCargaTabContent />
        </TabsContent>
        <TabsContent value="minmax" className="mt-4">
          <MinMaxTabContent />
        </TabsContent>
        <TabsContent value="reporte" className="mt-4">
          <ReporteKardexTabContent />
        </TabsContent>
        <TabsContent value="rotacion" className="mt-4">
          <RotacionInventarioTabContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}
