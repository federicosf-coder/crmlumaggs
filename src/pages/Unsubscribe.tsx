import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State =
  | { status: "loading" }
  | { status: "valid" }
  | { status: "already" }
  | { status: "invalid"; message?: string }
  | { status: "success" }
  | { status: "error"; message?: string };

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>({ status: "loading" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setState({ status: "invalid", message: "Falta el token en la URL." });
      return;
    }
    const validate = async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON } }
        );
        const data = await res.json();
        if (!res.ok) {
          setState({ status: "invalid", message: data?.error });
          return;
        }
        if (data?.valid === false && data?.reason === "already_unsubscribed") {
          setState({ status: "already" });
          return;
        }
        if (data?.valid) {
          setState({ status: "valid" });
        } else {
          setState({ status: "invalid", message: data?.error });
        }
      } catch (e: any) {
        setState({ status: "error", message: e?.message });
      }
    };
    validate();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "handle-email-unsubscribe",
        { body: { token } }
      );
      if (error) {
        setState({ status: "error", message: error.message });
        return;
      }
      if (data?.success) {
        setState({ status: "success" });
      } else if (data?.reason === "already_unsubscribed") {
        setState({ status: "already" });
      } else {
        setState({ status: "error", message: data?.error });
      }
    } catch (e: any) {
      setState({ status: "error", message: e?.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Cancelar suscripción
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {state.status === "loading" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Validando enlace...
            </div>
          )}
          {state.status === "valid" && (
            <>
              <p>
                ¿Confirmas que deseas dejar de recibir correos de este sistema?
              </p>
              <Button onClick={confirm} disabled={submitting} className="w-full">
                {submitting ? "Procesando..." : "Confirmar cancelación"}
              </Button>
            </>
          )}
          {state.status === "already" && (
            <div className="flex items-start gap-2 text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <p>Ya habías cancelado tu suscripción anteriormente.</p>
            </div>
          )}
          {state.status === "success" && (
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <p>Listo. No recibirás más correos en esta dirección.</p>
            </div>
          )}
          {state.status === "invalid" && (
            <div className="flex items-start gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              <p>{state.message || "Enlace inválido o expirado."}</p>
            </div>
          )}
          {state.status === "error" && (
            <div className="flex items-start gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              <p>{state.message || "Ocurrió un error. Inténtalo de nuevo."}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
