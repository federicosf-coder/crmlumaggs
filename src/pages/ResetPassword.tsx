import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle } from "lucide-react";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updating, setUpdating] = useState(false);
  const [validating, setValidating] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      try {
        // 1) PKCE flow: ?code=...
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            setSessionReady(true);
            // Clean URL
            window.history.replaceState({}, document.title, "/reset-password");
            return;
          }
        }

        // 2) Implicit/hash flow: #access_token=...&type=recovery or #token_hash=...&type=recovery
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.substring(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(hash);
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");
        const token_hash = hashParams.get("token_hash") || url.searchParams.get("token_hash");
        const type = hashParams.get("type") || url.searchParams.get("type");

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (!error) {
            setSessionReady(true);
            window.history.replaceState({}, document.title, "/reset-password");
            return;
          }
        }

        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as "recovery",
          });
          if (!error) {
            setSessionReady(true);
            window.history.replaceState({}, document.title, "/reset-password");
            return;
          }
        }

        // 3) Already-signed-in fallback (user navigated here manually)
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setSessionReady(true);
          return;
        }

        setSessionReady(false);
      } finally {
        setValidating(false);
      }
    };
    init();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({
        title: "Las contraseñas no coinciden",
        description: "Por favor verifica que ambas contraseñas sean idénticas.",
        variant: "destructive",
      });
      return;
    }
    if (password.length < 6) {
      toast({ title: "La contraseña debe tener al menos 6 caracteres", variant: "destructive" });
      return;
    }

    setUpdating(true);
    const { error } = await supabase.auth.updateUser({ password });
    setUpdating(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Contraseña actualizada", description: "Ya puedes iniciar sesión con tu nueva contraseña." });
      await supabase.auth.signOut();
      navigate("/auth");
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">Validando enlace de recuperación...</p>
        </div>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md border-destructive/20 shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive mb-2">
              <AlertCircle className="h-5 w-5" />
              <CardTitle>Enlace Inválido</CardTitle>
            </div>
            <CardDescription>
              No se ha podido validar el enlace de recuperación. Esto puede ocurrir si el enlace ya fue usado o ha expirado.
              Solicita un nuevo enlace desde "¿Olvidaste tu contraseña?".
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/auth")} className="w-full" variant="outline">
              Volver al inicio de sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md shadow-xl border-primary/10">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center text-primary">Nueva Contraseña</CardTitle>
          <CardDescription className="text-center">
            Introduce tu nueva contraseña para recuperar el acceso a tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña Nueva</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                className="focus-visible:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                required
                minLength={6}
                className="focus-visible:ring-primary"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-sm text-destructive">Las contraseñas no coinciden</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full py-6 text-lg font-semibold transition-all hover:scale-[1.02]"
              disabled={updating || !password || password !== confirmPassword}
            >
              {updating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Actualizando...
                </>
              ) : (
                "Establecer Nueva Contraseña"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
