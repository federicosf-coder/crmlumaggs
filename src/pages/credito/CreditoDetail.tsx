import { BackButton } from "@/components/BackButton";
import { Card, CardContent } from "@/components/ui/card";
import { useParams } from "react-router-dom";

export default function CreditoDetail() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="container mx-auto py-6 space-y-4">
      <BackButton fallback="/credito" />
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <p className="font-medium text-foreground">Detalle de solicitud</p>
          <p className="text-xs mt-2">ID: {id}</p>
          <p className="text-sm mt-3 max-w-md mx-auto">
            Esta vista (5 pestañas: Formulario, Documentos, Formatos y Firmas, Seguimiento,
            Comentarios) se entrega en la Fase 2.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}