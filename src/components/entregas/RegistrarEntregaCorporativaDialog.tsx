import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, PackageCheck, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cantidadPendiente, validarCapturaEntrega } from "@/lib/entregaCorporativaCantidades";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { reprogramarPendiente } from "@/lib/reprogramarPendienteEntrega";

type Entrega = { id: string; cliente: string; fecha_programada?: string; numero_pedido: string | null; ubicacion_id: string | null; evidencia_firmada_path: string | null; factura_referencia: string | null };
type Linea = { id: string; codigo_producto: string; nombre_producto: string | null; cantidad: number; cantidad_entregada?: number };

export function RegistrarEntregaCorporativaDialog({ entrega, initialMode, onClose, onSaved, onDetalle }: {
  entrega: Entrega | null; initialMode: "total" | "parcial"; onClose: () => void; onSaved: () => void; onDetalle: () => void;
}) {
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [mode, setMode] = useState(initialMode);
  const [captura, setCaptura] = useState<Record<string, string>>({});
  const [factura, setFactura] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [hasEvidence, setHasEvidence] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reprogramar, setReprogramar] = useState(false);
  useEffect(() => { setReprogramar(/kenworth/i.test(entrega?.cliente || "")); }, [entrega]);

  useEffect(() => {
    if (!entrega) return;
    let active = true;
    setMode(initialMode); setFiles([]); setError(null); setLineas([]); setLoading(true);
    setFactura(entrega.factura_referencia || ""); setHasEvidence(false);
    void Promise.all([
      (supabase as any).from("entregas_corporativas_lineas").select("id,codigo_producto,nombre_producto,cantidad,cantidad_entregada").eq("entrega_id", entrega.id).order("id"),
      (supabase as any).from("entregas_corporativas_evidencias").select("id").eq("entrega_id", entrega.id).limit(1),
    ]).then(([lin, ev]) => {
      if (!active) return;
      if (lin.error || ev.error) { setError("No se pudieron cargar los productos y evidencias."); return; }
      setLineas(lin.data || []);
      setCaptura(Object.fromEntries((lin.data || []).map((l: Linea) => [l.id, initialMode === "total" ? String(cantidadPendiente(l)) : "0"])));
      setHasEvidence(!!entrega.evidencia_firmada_path || !!ev.data?.length);
    }).catch(() => { if (active) setError("No se pudo cargar la entrega."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [entrega, initialMode]);

  const guardar = async () => {
    if (!entrega || busy || loading) return;
    const aviso = validarCapturaEntrega(lineas, captura);
    if (aviso) return setError(aviso);
    if (!entrega.ubicacion_id) return setError("Asigna una ubicación en el detalle de la entrega.");
    if (!hasEvidence && !files.length) return setError("Adjunta una evidencia de la entrega.");
    setBusy(true); setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Inicia sesión de nuevo para registrar la entrega.");
      for (const file of files) {
        const path = `${entrega.cliente}/evidencias/${crypto.randomUUID()}_${file.name}`;
        const { error: up } = await supabase.storage.from("entregas-corporativas").upload(path, file);
        if (up) throw up;
        const { error: insert } = await (supabase as any).from("entregas_corporativas_evidencias").insert({ entrega_id: entrega.id, storage_path: path, nombre_archivo: file.name, subido_por: userData.user.id });
        if (insert) { await supabase.storage.from("entregas-corporativas").remove([path]); throw insert; }
      }
      if (files.length) { setHasEvidence(true); setFiles([]); }
      const { data, error: saveError } = await (supabase as any).rpc("registrar_entrega_corporativa", {
        p_entrega_id: entrega.id, p_factura: factura,
        p_lineas: lineas.map((l) => ({ id: l.id, cantidad: Number(captura[l.id] || 0), previa: Number(l.cantidad_entregada || 0) })),
      });
      if (saveError) throw saveError;
      if (data === "entregada_parcial" && reprogramar && entrega.fecha_programada) {
        const fecha = await reprogramarPendiente(entrega.id, entrega.cliente, entrega.fecha_programada);
        toast.success(`Entrega parcial registrada; el faltante se sumó a la entrega del ${fecha}`);
      } else {
        toast.success(data === "entregada" ? "Entrega registrada como entregada" : "Entrega parcial registrada; el resto continúa pendiente");
      }
      onSaved(); onClose();
    } catch (e: any) { setError(e?.message || "No se pudo registrar la entrega."); }
    finally { setBusy(false); }
  };

  return <Dialog open={!!entrega} onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
      <DialogHeader className="px-5 py-4 border-b bg-muted/50 shrink-0">
        <DialogTitle>Registrar entrega</DialogTitle>
        <DialogDescription>{entrega?.cliente} · Pedido {entrega?.numero_pedido || "—"}</DialogDescription>
      </DialogHeader>
      <div className="px-5 py-5 space-y-5 overflow-y-auto flex-1 min-h-0 font-light">
        <ToggleGroup type="single" value={mode} disabled={busy || loading} className="justify-start flex-wrap" variant="outline" onValueChange={(v) => {
          if (v !== "total" && v !== "parcial") return;
          setMode(v); setCaptura(Object.fromEntries(lineas.map((l) => [l.id, v === "total" ? String(cantidadPendiente(l)) : "0"])));
        }}>
          <ToggleGroupItem value="total" className="gap-2"><CheckCircle2 className="h-4 w-4" />Entregado</ToggleGroupItem>
          <ToggleGroupItem value="parcial" className="gap-2"><PackageCheck className="h-4 w-4" />Entregado parcial</ToggleGroupItem>
        </ToggleGroup>
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : lineas.map((l) => <div key={l.id} className="border-b pb-3 space-y-2">
          <p className="text-sm font-medium break-words">{l.codigo_producto} · {l.nombre_producto || "—"}</p>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="text-xs text-muted-foreground">Solicitado: {Number(l.cantidad)} · Entregado: {Number(l.cantidad_entregada || 0)} · Pendiente: {cantidadPendiente(l)}</p>
            <div className="space-y-1">
              <Label htmlFor={`entrega-${l.id}`} className="text-xs">Entregado ahora</Label>
              <Input id={`entrega-${l.id}`} type="number" min={0} max={cantidadPendiente(l)} step="any" disabled={busy || mode === "total" || cantidadPendiente(l) === 0} className="h-9 w-32 font-light" value={captura[l.id] || "0"} onChange={(e) => setCaptura((prev) => ({ ...prev, [l.id]: e.target.value }))} />
            </div>
          </div>
        </div>)}
        {mode === "parcial" && <label className="flex items-start gap-2 text-sm rounded-md border border-violet-100 bg-violet-50/50 p-3">
          <Checkbox checked={reprogramar} disabled={busy} onCheckedChange={(v) => setReprogramar(!!v)} className="mt-0.5" />
          <span>Reprogramar lo no entregado a la siguiente fecha del calendario<span className="block text-xs text-muted-foreground">El faltante se suma a la próxima entrega programada de {entrega?.cliente} y esta queda cerrada.</span></span>
        </label>}
        {!entrega?.ubicacion_id && <div className="text-sm text-destructive">Falta ubicación. <Button variant="link" onClick={onDetalle} disabled={busy}>Asignar en detalle</Button></div>}
        <div className="space-y-2">
          <Label htmlFor="entrega-evidencia">Evidencia {hasEvidence ? "(ya adjunta)" : "*"}</Label>
          <Input id="entrega-evidencia" type="file" multiple disabled={busy || loading} accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.doc,.docx" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
          {files.map((f, i) => <p key={i} className="text-xs break-words"><Upload className="inline h-3 w-3 mr-1" />{f.name}</p>)}
        </div>
        <div className="space-y-1"><Label htmlFor="entrega-factura">Factura de referencia</Label><Input id="entrega-factura" value={factura} disabled={busy} onChange={(e) => setFactura(e.target.value)} className="h-9 font-light" /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter className="border-t bg-muted/30 px-5 py-3 shrink-0">
        <Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button>
        <Button onClick={guardar} disabled={loading || busy || !lineas.length || !entrega?.ubicacion_id}>{busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}Guardar entrega</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}