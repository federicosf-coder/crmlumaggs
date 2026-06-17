import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { ProductMultiPicker, type ProductOption } from "./ProductMultiPicker";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresaId: string;
  contactoId?: string | null;
  conversationId?: string | null;
  empresaVendedora?: "lumaggs" | "galsa";
  productos: ProductOption[];
  userId?: string | null;
  onCreated: () => void;
}

export function NuevaSolicitudDialog({
  open, onOpenChange, empresaId, contactoId, conversationId,
  empresaVendedora, productos, userId, onCreated,
}: Props) {
  const [titulo, setTitulo] = useState("");
  const [productIds, setProductIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const reset = () => { setTitulo(""); setProductIds([]); };

  const save = async () => {
    if (!productIds.length) { toast.error("Agrega al menos un producto"); return; }
    setSaving(true);
    const sb: any = supabase;
    const { data: sol, error } = await sb
      .from("cliente_solicitudes")
      .insert({
        empresa_id: empresaId,
        contacto_id: contactoId || null,
        whatsapp_conversation_id: conversationId || null,
        empresa_vendedora: empresaVendedora || null,
        titulo: titulo.trim() || null,
        created_by: userId || null,
      })
      .select("id")
      .single();
    if (error || !sol) {
      setSaving(false);
      toast.error("No se pudo crear la solicitud: " + (error?.message || "error"));
      return;
    }
    const lineas = productIds.map((pid) => ({ solicitud_id: sol.id, producto_id: pid, cantidad: 1 }));
    const { error: lErr } = await sb.from("cliente_solicitud_lineas").insert(lineas);
    setSaving(false);
    if (lErr) { toast.error("No se pudieron guardar los productos: " + lErr.message); return; }
    toast.success("Solicitud creada");
    reset();
    onCreated();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4 border-b">
          <DialogTitle className="text-base font-semibold tracking-tight">Nueva solicitud del cliente</DialogTitle>
          <p className="text-xs text-muted-foreground font-light mt-0.5">
            Registra los productos que el cliente está pidiendo cotizar.
          </p>
        </div>
        <div className="px-5 py-5 space-y-4 font-light">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Título (opcional)</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej. Cotización mes de junio"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Productos</Label>
            <ProductMultiPicker productos={productos} value={productIds} onChange={setProductIds} />
          </div>
        </div>
        <div className="px-5 py-3 bg-muted/40 border-t flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={save} disabled={saving || !productIds.length}>
            {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Guardar solicitud
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}