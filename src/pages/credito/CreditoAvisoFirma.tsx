import { useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { CreditoPrivacyGate } from "@/components/credito/CreditoPrivacyGate";

/** Liga pública: el cliente firma el aviso de privacidad sin contraseña. */
export default function CreditoAvisoFirma() {
  const { token } = useParams<{ token: string }>();
  if (!token) return null;
  return (
    <CreditoPrivacyGate token={token}>
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <div className="max-w-md text-center space-y-3">
          <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
          <h1 className="text-xl font-light tracking-tight">Aviso de privacidad firmado</h1>
          <p className="text-sm font-light text-muted-foreground">
            Gracias. Ya puedes enviar tus documentos respondiendo el correo que recibiste o escribiendo a credito@correo.lumaggs.com.mx con tu folio en el asunto.
          </p>
        </div>
      </div>
    </CreditoPrivacyGate>
  );
}
