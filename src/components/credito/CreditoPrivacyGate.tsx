import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ShieldCheck, Eraser } from "lucide-react";
import { getPortalSession } from "@/lib/creditoPortalSession";

async function call(token: string, body: Record<string, any>) {
  const { data, error } = await supabase.functions.invoke("credito-portal", {
    body: { token, session: getPortalSession(token), ...body },
  });
  const d: any = data;
  if (d?.error) throw new Error(d.error);
  if (error) {
    let msg = error.message;
    try { const j = await (error as any).context?.json?.(); if (j?.error) msg = j.error; } catch { /* noop */ }
    throw new Error(msg);
  }
  return d;
}

/** Paso 0 del portal: el cliente firma el aviso de privacidad antes de ver o subir cualquier cosa. */
export function CreditoPrivacyGate({ token, children }: { token: string; children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "pending" | "ok" | "error">("loading");
  const [texto, setTexto] = useState("");
  const [hash, setHash] = useState("");
  const [leido, setLeido] = useState(false);
  const [acepta, setAcepta] = useState(false);
  const [nombre, setNombre] = useState("");
  const [puesto, setPuesto] = useState("");
  const [email, setEmail] = useState("");
  const [hasStroke, setHasStroke] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    call(token, { action: "privacy_status" })
      .then((r) => { if (r.signed) setState("ok"); else { setTexto(r.texto); setHash(r.hash); setState("pending"); } })
      .catch(() => setState("error"));
  }, [token]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current!.getContext("2d")!; const p = pos(e);
    drawing.current = true; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.strokeStyle = "#1e293b";
    ctx.beginPath(); ctx.moveTo(p.x, p.y); canvasRef.current!.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!; const p = pos(e);
    ctx.lineTo(p.x, p.y); ctx.stroke(); setHasStroke(true);
  };
  const clear = () => {
    const c = canvasRef.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setHasStroke(false);
  };

  const firmar = async () => {
    setErr(null);
    if (nombre.trim().length < 3) return setErr("Escribe tu nombre completo.");
    if (!hasStroke) return setErr("Dibuja tu firma en el recuadro.");
    if (!acepta) return setErr("Debes marcar la casilla de aceptación.");
    setBusy(true);
    try {
      await call(token, { action: "privacy_sign", nombre, puesto, email, acepta: true, hash, firma: canvasRef.current!.toDataURL("image/png") });
      setState("ok");
    } catch (e: any) { setErr(e.message || "No se pudo registrar la firma"); }
    finally { setBusy(false); }
  };

  if (state === "ok") return <>{children}</>;
  if (state === "loading") return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (state === "error") return <div className="min-h-screen flex items-center justify-center p-4 text-sm text-muted-foreground">No se pudo cargar el aviso de privacidad. Recarga la página.</div>;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="max-w-2xl w-full overflow-hidden border-border/60 shadow-sm">
        <CardHeader className="pb-3 bg-gradient-to-br from-violet-50 to-blue-50 border-b border-border/40">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-violet-700" />
            <CardTitle className="text-xl font-light tracking-tight">Paso 0 · Aviso de privacidad y confidencialidad</CardTitle>
          </div>
          <p className="text-xs font-light text-muted-foreground mt-1">Antes de continuar con tu solicitud, lee y firma el aviso. Es un requisito legal.</p>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          <div
            className="h-72 overflow-y-auto rounded-md border bg-background p-4 text-xs font-light leading-relaxed whitespace-pre-line"
            onScroll={(e) => { const t = e.currentTarget; if (t.scrollTop + t.clientHeight >= t.scrollHeight - 20) setLeido(true); }}
          >
            {texto}
          </div>
          {!leido && <p className="text-[11px] text-muted-foreground">Desplázate hasta el final del aviso para poder firmar.</p>}

          <div className="grid md:grid-cols-3 gap-3">
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Nombre completo *</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} disabled={!leido} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Puesto</Label>
              <Input value={puesto} onChange={(e) => setPuesto(e.target.value)} maxLength={200} disabled={!leido} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Correo</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} disabled={!leido} />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Firma *</Label>
              <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={!leido}><Eraser className="h-3.5 w-3.5 mr-1" />Borrar</Button>
            </div>
            <canvas
              ref={canvasRef} width={600} height={160}
              className={`w-full h-40 rounded-md border bg-background touch-none ${leido ? "cursor-crosshair" : "opacity-50 pointer-events-none"}`}
              onPointerDown={down} onPointerMove={move} onPointerUp={() => (drawing.current = false)} onPointerLeave={() => (drawing.current = false)}
            />
          </div>

          <label className="flex items-start gap-2 text-xs font-light">
            <Checkbox checked={acepta} onCheckedChange={(v) => setAcepta(!!v)} disabled={!leido} className="mt-0.5" />
            <span>He leído el aviso de privacidad y el convenio de confidencialidad, tengo facultades para firmar en nombre de la empresa y otorgo mi consentimiento expreso, incluido el tratamiento de datos patrimoniales y financieros.</span>
          </label>

          <p className="text-[10px] text-muted-foreground">Se registrará la fecha y hora, tu dirección IP, tu navegador y una huella digital del documento como evidencia de la firma.</p>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <Button className="w-full" onClick={firmar} disabled={busy || !leido}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Firmar y continuar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
