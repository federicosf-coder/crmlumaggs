import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, KeyRound } from "lucide-react";
import { getPortalSession, setPortalSession } from "@/lib/creditoPortalSession";

async function call(body: Record<string, any>) {
  const { data, error } = await supabase.functions.invoke("credito-portal", { body });
  const d: any = data;
  if (d?.error) throw new Error(d.error);
  if (error) {
    let msg = error.message;
    try { const j = await (error as any).context?.json?.(); if (j?.error) msg = j.error; } catch { /* noop */ }
    throw new Error(msg);
  }
  return d;
}

const pwdValida = (p: string) => p.length >= 8 && /^[A-Za-z0-9]+$/.test(p) && /[A-Za-z]/.test(p) && /\d/.test(p);

export function CreditoPortalLock({ token, children }: { token: string; children: React.ReactNode }) {
  const [stage, setStage] = useState<"checking" | "login" | "change" | "ok" | "invalid">("checking");
  const [info, setInfo] = useState<{ folio: string; razon_social: string }>({ folio: "", razon_social: "" });
  const [pwd, setPwd] = useState("");
  const [np, setNp] = useState("");
  const [np2, setNp2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const st = await call({ action: "status", token });
        setInfo(st);
        const s = getPortalSession(token);
        if (s) {
          try { await call({ action: "ping", token, session: s }); setStage("ok"); return; }
          catch (e: any) { if (e.message === "must_change_password") { setStage("change"); return; } }
        }
        setStage("login");
      } catch { setStage("invalid"); }
    })();
  }, [token]);

  const login = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await call({ action: "login", token, password: pwd });
      setPortalSession(token, r.session);
      setStage(r.must_change ? "change" : "ok");
    } catch (e: any) { setErr(e.message || "No se pudo ingresar"); }
    finally { setBusy(false); }
  };

  const change = async () => {
    if (!pwdValida(np)) { setErr("Mínimo 8 caracteres, solo letras y números, con al menos una letra y un número."); return; }
    if (np !== np2) { setErr("Las contraseñas no coinciden."); return; }
    setBusy(true); setErr(null);
    try {
      const r = await call({ action: "change_password", token, session: getPortalSession(token), new_password: np });
      setPortalSession(token, r.session);
      setStage("ok");
    } catch (e: any) { setErr(e.message || "No se pudo cambiar la contraseña"); }
    finally { setBusy(false); }
  };

  if (stage === "ok") return <>{children}</>;
  if (stage === "checking") {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="max-w-md w-full overflow-hidden border-border/60 shadow-sm">
        <CardHeader className="pb-3 bg-gradient-to-br from-violet-50 to-blue-50 border-b border-border/40">
          <div className="flex items-center gap-2">
            {stage === "change" ? <KeyRound className="h-4 w-4 text-violet-700" /> : <Lock className="h-4 w-4 text-violet-700" />}
            <CardTitle className="text-xl font-light tracking-tight">
              {stage === "invalid" ? "Enlace no válido" : stage === "change" ? "Crea tu contraseña" : "Solicitud de crédito"}
            </CardTitle>
          </div>
          {stage !== "invalid" && (
            <div className="mt-2 space-y-0.5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Folio {info.folio || "—"}</p>
              <p className="text-xs font-light text-muted-foreground">{info.razon_social}</p>
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          {stage === "invalid" && <p className="text-sm font-light text-muted-foreground">Este enlace no existe o ya no está disponible. Contacta a tu ejecutivo.</p>}

          {stage === "login" && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); login(); }}>
              <p className="text-xs font-light text-muted-foreground">Ingresa la contraseña que te proporcionó tu ejecutivo. Si es tu primer acceso, usa la clave temporal.</p>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Contraseña</Label>
                <Input type="password" autoFocus value={pwd} onChange={(e) => setPwd(e.target.value)} maxLength={64} />
              </div>
              {err && <p className="text-xs text-destructive">{err}</p>}
              <Button type="submit" disabled={busy || !pwd} className="w-full">
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Ingresar
              </Button>
            </form>
          )}

          {stage === "change" && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); change(); }}>
              <p className="text-xs font-light text-muted-foreground">Por seguridad, crea una contraseña nueva antes de continuar: mínimo 8 caracteres, solo letras y números, con al menos una letra y un número.</p>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Nueva contraseña</Label>
                <Input type="password" autoFocus value={np} onChange={(e) => setNp(e.target.value)} maxLength={64} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Confirmar contraseña</Label>
                <Input type="password" value={np2} onChange={(e) => setNp2(e.target.value)} maxLength={64} />
              </div>
              {err && <p className="text-xs text-destructive">{err}</p>}
              <Button type="submit" disabled={busy || !np || !np2} className="w-full">
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Guardar y continuar
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
