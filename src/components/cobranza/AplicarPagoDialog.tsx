import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CobranzaPago } from "@/hooks/useCobranza";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pago: CobranzaPago | null;
  onSaved: () => void;
}

interface DocOption {
  id: string;
  tipo_documento: "factura" | "pedido" | "cotizacion";
  numero: string;
  fecha_documento: string;
  total: number;
  saldo: number;
}

/** Tolerancia en pesos para diferencias mínimas al aplicar pagos */
const TOLERANCIA = 5;

const TIPO_LABEL: Record<string, string> = {
  factura: "Factura",
  pedido: "Pedido",
  cotizacion: "Cotización",
};

export function AplicarPagoDialog({ open, onOpenChange, pago, onSaved }: Props) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<DocOption[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [seleccion, setSeleccion] = useState<Record<string, string>>({}); // doc_id -> monto a aplicar
  const [tipoFiltro, setTipoFiltro] = useState<"factura" | "pedido" | "cotizacion">("factura");
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmAjuste, setConfirmAjuste] = useState(false);

  useEffect(() => {
    if (!open || !pago) return;
    setSeleccion({}); setObservaciones(""); setTipoFiltro("factura");
    setLoadingDocs(true);
    supabase
      .from("documentos")
      .select("id,tipo_documento,numero_factura,numero_pedido,numero_cotizacion,fecha_documento,total,saldo_pendiente_cobranza,estatus_factura")
      .eq("empresa_id", pago.empresa_id)
      .eq("is_active", true)
      .gt("saldo_pendiente_cobranza", 0)
      .in("tipo_documento", ["factura", "pedido", "cotizacion"])
      .order("fecha_documento", { ascending: false })
      .then(({ data }) => {
        const mapped: DocOption[] = (data || [])
          .filter((d: any) => {
            const status = (d.estatus_factura || "").toLowerCase();
            return status !== "pagada" && status !== "cancelada";
          })
          .map((d: any) => ({
            id: d.id,
            tipo_documento: d.tipo_documento,
            numero: d.numero_factura || d.numero_pedido || d.numero_cotizacion || "—",
            fecha_documento: d.fecha_documento,
            total: Number(d.total || 0),
            saldo: Number(d.saldo_pendiente_cobranza ?? d.total ?? 0),
          }));
        setDocs(mapped);
        setLoadingDocs(false);
      });
  }, [open, pago]);

  const totalAsignado = useMemo(
    () => Object.values(seleccion).reduce((s, v) => s + (Number(v) || 0), 0),
    [seleccion]
  );
  const disponible = pago?.monto_disponible ?? 0;
  const diferencia = disponible - totalAsignado;

  const toggleDoc = (doc: DocOption, checked: boolean) => {
    setSeleccion((prev) => {
      const next = { ...prev };
      if (checked) {
        const restante = Math.max(0, disponible - totalAsignado);
        let sugerido = disponible > 0 ? Math.min(doc.saldo, restante || doc.saldo) : doc.saldo;
        if (disponible > 0 && restante > doc.saldo && restante - doc.saldo <= TOLERANCIA) sugerido = restante;
        next[doc.id] = String(sugerido.toFixed(2));
      } else {
        delete next[doc.id];
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!pago) return;
    const aplicaciones = Object.entries(seleccion)
      .map(([doc_id, v]) => ({ doc_id, monto: Number(v) || 0 }))
      .filter((a) => a.monto > 0);
    if (aplicaciones.length === 0) { toast.error("Selecciona al menos un documento con monto"); return; }
    if (totalAsignado > disponible + TOLERANCIA) { toast.error("La suma asignada excede el disponible del pago"); return; }
    for (const a of aplicaciones) {
      const doc = docs.find((d) => d.id === a.doc_id);
      if (doc && a.monto > doc.saldo + TOLERANCIA) {
        toast.error(`El monto de ${doc.numero} excede su saldo`); return;
      }
    }
    setSaving(true);
    const fecha = new Date().toISOString().split("T")[0];
    const rows = aplicaciones.map((a) => {
      const doc = docs.find((d) => d.id === a.doc_id)!;
      return {
        pago_id: pago.id,
        tipo_documento: doc.tipo_documento,
        documento_id: a.doc_id,
        monto_aplicado: a.monto,
        fecha_aplicacion: fecha,
        observaciones: observaciones || null,
        origen_aplicacion: doc.tipo_documento,
        creado_por: user?.id,
      };
    });
    const { error } = await supabase.from("cobranza_aplicaciones").insert(rows as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Aplicación registrada");
    onSaved();
    onOpenChange(false);
  };

  if (!pago) return null;

  const seleccionadosIds = Object.keys(seleccion);
  const showAjuste = pago.monto_disponible > 0 && pago.monto_disponible < 25;
  const puedeAjuste = seleccionadosIds.length === 1;

  const handleAjusteManual = async () => {
    if (!pago || seleccionadosIds.length !== 1) { toast.error("Selecciona un solo documento"); return; }
    const docId = seleccionadosIds[0];
    const doc = docs.find((d) => d.id === docId);
    setSaving(true);
    const { error } = await supabase.from("cobranza_aplicaciones").insert({
      pago_id: pago.id,
      tipo_documento: (doc?.tipo_documento || "factura") as any,
      documento_id: docId,
      monto_aplicado: pago.monto_disponible,
      fecha_aplicacion: new Date().toISOString().split("T")[0],
      observaciones: "Ajuste Contable Diferencias",
      origen_aplicacion: "ajuste_manual",
      creado_por: user?.id,
    });
    setSaving(false);
    setConfirmAjuste(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Ajuste contable aplicado");
    onSaved();
    onOpenChange(false);
  };

  const visibles = docs.filter((d) => d.tipo_documento === tipoFiltro);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Aplicar pago</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Disponible: <span className="font-semibold text-foreground">{formatCurrency(pago.monto_disponible)}</span>
          </p>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <Label>Documentos a ligar</Label>
              <div className="text-xs text-muted-foreground">
                Asignado: <span className="font-medium text-foreground">{formatCurrency(totalAsignado)}</span> /{" "}
                {formatCurrency(disponible)}{" "}
                {Math.abs(diferencia) > 0.01 && (
                  <span className={diferencia < 0 ? "text-destructive" : "text-amber-600"}>
                    ({diferencia > 0 ? "+" : ""}{formatCurrency(diferencia)})
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-1 mb-2">
              {(["factura", "pedido", "cotizacion"] as const).map((t) => {
                const count = docs.filter((d) => d.tipo_documento === t).length;
                return (
                  <Button
                    key={t}
                    type="button"
                    size="sm"
                    variant={tipoFiltro === t ? "default" : "outline"}
                    onClick={() => setTipoFiltro(t)}
                  >
                    {TIPO_LABEL[t]}s <span className="ml-1 opacity-70">({count})</span>
                  </Button>
                );
              })}
            </div>
            <div className="border rounded-md">
              {loadingDocs && (
                <div className="p-6 text-sm text-center text-muted-foreground">Cargando documentos...</div>
              )}
              {!loadingDocs && visibles.length === 0 && (
                <div className="p-6 text-sm text-center text-muted-foreground">No hay {TIPO_LABEL[tipoFiltro].toLowerCase()}s con saldo para esta empresa</div>
              )}
              {!loadingDocs && visibles.length > 0 && (
                <ScrollArea className="h-64">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/50 border-b">
                      <tr className="text-left">
                        <th className="p-2 w-8"></th>
                        <th className="p-2">Folio</th>
                        <th className="p-2">Fecha</th>
                        <th className="p-2 text-right">Total</th>
                        <th className="p-2 text-right">Saldo</th>
                        <th className="p-2 text-right w-32">Aplicar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibles.map((d) => {
                        const checked = seleccion[d.id] !== undefined;
                        return (
                          <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="p-2">
                              <Checkbox checked={checked} onCheckedChange={(v) => toggleDoc(d, !!v)} />
                            </td>
                            <td className="p-2 font-mono text-xs">{d.numero}</td>
                            <td className="p-2 text-xs">{formatDate(d.fecha_documento)}</td>
                            <td className="p-2 text-right">{formatCurrency(d.total)}</td>
                            <td className="p-2 text-right font-medium">{formatCurrency(d.saldo)}</td>
                            <td className="p-2 text-right">
                              <Input
                                type="number"
                                step="0.01"
                                disabled={!checked}
                                value={seleccion[d.id] ?? ""}
                                onChange={(e) => setSeleccion((p) => ({ ...p, [d.id]: e.target.value }))}
                                className="h-8 text-right"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
            </div>
          </div>
          <div>
            <Label>Observaciones</Label>
            <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {showAjuste && (
            <Button
              variant="secondary"
              onClick={() => setConfirmAjuste(true)}
              disabled={saving || !puedeAjuste}
              title={!puedeAjuste ? "Marca exactamente un documento" : ""}
            >
              Ajuste Manual ({formatCurrency(pago.monto_disponible)})
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>{saving ? "Aplicando..." : "Aplicar"}</Button>
        </DialogFooter>
        <AlertDialog open={confirmAjuste} onOpenChange={setConfirmAjuste}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Ajuste Manual</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Aplicar {formatCurrency(pago.monto_disponible)} como Ajuste Contable Diferencias?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleAjusteManual} disabled={saving}>
                {saving ? "Aplicando..." : "Confirmar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
