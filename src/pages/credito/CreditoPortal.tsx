import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

export default function CreditoPortal() {
  const { token } = useParams<{ token: string }>();
  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="py-12 text-center space-y-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            PROCESADORA DE SERVICIOS MAGG'S
          </p>
          <h1 className="text-xl font-semibold">Portal de Solicitud de Crédito</h1>
          <p className="text-sm text-muted-foreground">
            El portal del cliente (acceso por código OTP, carga de documentos,
            firmas digitales y parseo automático de la CSF) se entrega en la Fase 3.
          </p>
          <p className="text-[10px] text-muted-foreground/70 break-all pt-4">
            Token: {token}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}