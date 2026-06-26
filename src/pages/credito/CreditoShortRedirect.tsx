import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function CreditoShortRedirect() {
  const { code } = useParams<{ code: string }>();
  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!code) { setToken(null); return; }
    (async () => {
      // 1) ¿Es un código de portal de crédito?
      const { data: creditToken } = await supabase.rpc("resolve_credit_short_code", { code });
      if (creditToken) { setToken(creditToken as string); return; }
      // 2) ¿Es un código genérico (PDFs, estados de cuenta, etc.)?
      const { data: target } = await supabase.rpc("resolve_short_link" as any, { _code: code });
      if (target && typeof target === "string") {
        window.location.replace(target);
        return;
      }
      setToken(null);
    })();
  }, [code]);

  if (token === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Abriendo tu portal...
      </div>
    );
  }
  if (!token) return <Navigate to="/" replace />;
  return <Navigate to={`/portal/credito/${token}`} replace />;
}