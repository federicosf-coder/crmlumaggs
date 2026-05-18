import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileCheck, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function CreditoList() {
  const { hasAnyRole } = useAuth();
  const canConfigure = hasAnyRole(["admin", "manager"]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FileCheck className="h-6 w-6 text-primary" />
            Solicitudes de Crédito
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona las solicitudes de crédito de clientes (Cescemex y Crédito Directo).
          </p>
        </div>
        <div className="flex gap-2">
          {canConfigure && (
            <Button variant="outline" asChild>
              <Link to="/credito/configuracion">
                <Settings className="h-4 w-4 mr-2" />
                Configurar documentos
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium text-foreground">Módulo en preparación</p>
          <p className="text-sm mt-2 max-w-md mx-auto">
            Base de datos y catálogo de documentos listos. La lista de solicitudes, el detalle
            con 5 pestañas y el portal del cliente se entregan en las siguientes fases.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}