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
      const { data, error } = await supabase.rpc("resolve_credit_short_code", { code });
      if (error || !data) setToken(null);
      else setToken(data as string);
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