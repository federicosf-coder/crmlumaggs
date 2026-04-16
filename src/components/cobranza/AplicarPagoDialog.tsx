import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CobranzaPago } from "@/hooks/useCobranza";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pago: CobranzaPago | null;
  onSaved: () => void;
}

export function AplicarPagoDialog({ open, onOpenChange, pago, onSaved }: Props) {
  const { user } = useAuth();
  const [tipoDoc, setTipoDoc] = useState<"factura" | "pedido" | "cotizacion">("factura");
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [docId, setDocId] = useState("");
  const [monto, setMonto] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !pago) return;
    setDocId(""); setMonto(""); setObservaciones("");
    supabase
      .from("documentos")
      .select("id,tipo_documento,numero_factura,numero_pedido,numero_cotizacion,total,saldo_pendiente_cobranza,fecha_documento")
      .eq("empresa_id", pago.empresa_id)
      .eq("tipo_documento", tipoDoc)
      .eq("is_active", true)
      .gt("saldo_pendiente_cobranza", 0)
      .order("fecha_documento", { ascending: false })
      .then(({ data }) => setDocumentos(data || []));
  }, [open, pago, tipoDoc]);

  const selectedDoc = useMemo(() => documentos.find((d) => d.id === docId), [documentos, docId]);

  const docOptions = documentos.map((d) => {
    const folio = d.numero_factura || d.numero_pedido || d.numero_cotizacion || d.id.slice(0, 8);
    return { value: d.id, label: `${folio} — Total ${formatCurrency(Number(d.total))} · Saldo ${formatCurrency(Number(d.saldo_pendiente_cobranza))}` };
  });

  const handleSave = async () => {
    if (!pago || !docId) { toast.error("Selecciona un documento"); return; }
    const m = Number(monto);
    if (!m || m <= 0) { toast.error("Monto inválido"); return; }
    if (m > pago.monto_disponible) { toast.error("Excede el disponible del pago"); return; }
    if (selectedDoc && m > Number(selectedDoc.saldo_pendiente_cobranza)) {
      toast.error("Excede el saldo del documento"); return;
    }
    setSaving(true);
    const { error } = await supabase.from("cobranza_aplicaciones").insert({
      pago_id: pago.id,
      tipo_documento: tipoDoc,
      documento_id: docId,
      monto_aplicado: m,
      fecha_aplicacion: new Date().toISOString().split("T")[0],
      observaciones: observaciones || null,
      origen_aplicacion: tipoDoc,
      creado_por: user?.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Aplicación registrada");
    onSaved();
    onOpenChange(false);
  };

  if (!pago) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Aplicar pago</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Disponible: <span className="font-semibold text-foreground">{formatCurrency(pago.monto_disponible)}</span>
          </p>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tipo de documento *</Label>
            <Select value={tipoDoc} onValueChange={(v: any) => setTipoDoc(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="factura">Factura</SelectItem>
                <SelectItem value="pedido">Pedido</SelectItem>
                <SelectItem value="cotizacion">Cotización</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Documento *</Label>
            <SearchableSelect
              value={docId}
              onValueChange={setDocId}
              options={docOptions}
              placeholder={documentos.length ? "Buscar documento..." : "Sin documentos disponibles"}
            />
          </div>
          <div>
            <Label>Monto a aplicar *</Label>
            <Input type="number" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} max={pago.monto_disponible} />
            {selectedDoc && (
              <p className="text-xs text-muted-foreground mt-1">
                Saldo del documento: {formatCurrency(Number(selectedDoc.saldo_pendiente_cobranza))}
              </p>
            )}
          </div>
          <div>
            <Label>Observaciones</Label>
            <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Aplicando..." : "Aplicar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
