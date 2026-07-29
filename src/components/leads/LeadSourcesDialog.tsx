import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Plus, Power, KeyRound } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLeadSources, generateApiKey, sha256Hex } from "@/hooks/useLeads";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";

const FUNCTIONS_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/lead-intake`;

export function LeadSourcesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: sources = [] } = useLeadSources();
  const { data: plazas = [] } = useQuery({
    queryKey: ["plazas-simple"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("plazas").select("id, nombre").order("nombre");
      return data ?? [];
    },
  });

  const [nombre, setNombre] = useState("");
  const [dominio, setDominio] = useState("");
  const [plazaId, setPlazaId] = useState("");
  const [whats, setWhats] = useState("");
  const [nuevaKey, setNuevaKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const crear = async () => {
    if (!nombre.trim() || !plazaId) {
      toast.error("Nombre y plaza son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const key = generateApiKey();
      const hash = await sha256Hex(key);
      const { error } = await (supabase as any).from("lead_sources").insert({
        nombre: nombre.trim(),
        dominio_permitido: dominio.trim() || null,
        api_key_hash: hash,
        api_key_prefix: key.slice(0, 12),
        plaza_id: plazaId,
        notificar_whatsapp: whats.trim() || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      setNuevaKey(key);
      setNombre(""); setDominio(""); setWhats("");
      qc.invalidateQueries({ queryKey: ["lead-sources"] });
      toast.success("Fuente creada. Copia la clave, no se volverá a mostrar.");
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo crear la fuente");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: string, activo: boolean) => {
    await (supabase as any).from("lead_sources").update({ is_active: !activo }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["lead-sources"] });
  };

  const copiar = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success("Copiado");
  };

  const snippet = (key: string) => `fetch("${FUNCTIONS_URL}", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-api-key": "${key}" },
  body: JSON.stringify({
    nombre: "Nombre del prospecto",
    email: "correo@ejemplo.com",
    telefono: "6861234567",
    empresa: "Empresa S.A. de C.V.",
    mensaje: "Estoy interesado en lubricantes",
    utm_source: "google", utm_campaign: "verano",
    page_url: window.location.href
  })
});`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 px-6 py-4 border-b">
          <DialogTitle className="text-lg font-light flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Fuentes de captación de prospectos
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 space-y-6">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Nueva fuente</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div><Label className="text-xs">Nombre del sitio / landing</Label>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Landing Chevron Mexicali" /></div>
              <div><Label className="text-xs">Dominio permitido (opcional)</Label>
                <Input value={dominio} onChange={(e) => setDominio(e.target.value)} placeholder="lumaggs.com.mx" /></div>
              <div><Label className="text-xs">Plaza por defecto</Label>
                <Select value={plazaId} onValueChange={setPlazaId}>
                  <SelectTrigger><SelectValue placeholder="Selecciona plaza" /></SelectTrigger>
                  <SelectContent>
                    {plazas.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                  </SelectContent>
                </Select></div>
              <div><Label className="text-xs">WhatsApp de aviso (opcional)</Label>
                <Input value={whats} onChange={(e) => setWhats(e.target.value)} placeholder="526861234567" /></div>
            </div>
            <Button onClick={crear} disabled={saving} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Crear fuente y generar clave
            </Button>
          </div>

          {nuevaKey && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-4 space-y-3">
              <p className="text-xs font-medium text-amber-900">
                Guarda esta clave ahora, no se volverá a mostrar:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white border rounded px-2 py-1 break-all">{nuevaKey}</code>
                <Button size="sm" variant="outline" onClick={() => copiar(nuevaKey)}><Copy className="h-3 w-3" /></Button>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-amber-900">Snippet para la landing</p>
                <pre className="text-[10px] bg-white border rounded p-2 overflow-x-auto">{snippet(nuevaKey)}</pre>
                <Button size="sm" variant="outline" onClick={() => copiar(snippet(nuevaKey))}>
                  <Copy className="h-3 w-3 mr-1" /> Copiar snippet
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Fuentes registradas</p>
            <div className="rounded-md border divide-y">
              {sources.length === 0 && <p className="text-xs text-muted-foreground p-4">Aún no hay fuentes.</p>}
              {sources.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-blue-50/40">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.nombre}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {s.api_key_prefix}••••  {s.dominio_permitido ? `· ${s.dominio_permitido}` : ""}
                      {s.notificar_whatsapp ? ` · WA ${s.notificar_whatsapp}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "Activa" : "Revocada"}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => toggle(s.id, s.is_active)}>
                      <Power className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground space-y-1">
            <p><strong>Endpoint:</strong> {FUNCTIONS_URL}</p>
            <p>Método POST, header <code>x-api-key</code>. Campos aceptados: nombre, apellido, email, telefono, empresa, mensaje, interes, ciudad, estado, utm_*, page_url. Se ignoran envíos con el campo trampa <code>_hp</code>.</p>
            <a className="text-primary underline" href="/docs/api-prospectos.md" target="_blank" rel="noreferrer">
              Ver documentación completa para el desarrollador web
            </a>
          </div>
        </div>

        <DialogFooter className="bg-muted/40 px-6 py-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
