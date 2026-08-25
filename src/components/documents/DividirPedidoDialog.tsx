import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Split } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/formatters";

export default function DividirPedidoDialog({
  open,
  onOpenChange,
  documentoId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentoId: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["dividir-pedido", documentoId],
    enabled: open && !!documentoId,
    queryFn: async () => {
      const { data: doc, error: docErr } = await (supabase as any)
        .from("documentos")
        .select("*")
        .eq("id", documentoId)
        .single();
      if (docErr) throw docErr;
      const { data: lineas, error: linErr } = await (supabase as any)
        .from("documento_productos")
        .select("*, productos(codigo, nombre_producto)")
        .eq("documento_id", documentoId);
      if (linErr) throw linErr;
      return { doc, lineas: lineas || [] };
    },
  });

  useEffect(() => {
    if (open) setCantidades({});
  }, [open, documentoId]);

  const lineas = data?.lineas || [];

  const seleccion = useMemo(
    () =>
      lineas
        .map((l: any) => ({ linea: l, mover: Number(cantidades[l.id] || 0) }))
        .filter((x) => x.mover > 0),
    [lineas, cantidades]
  );

  const totalNuevo = useMemo(
    () =>
      seleccion.reduce(
        (acc, { linea, mover }) => acc + (Number(linea.subtotal) / Number(linea.cantidad || 1)) * mover,
        0
      ),
    [seleccion]
  );

  const hayExceso = lineas.some((l: any) => Number(cantidades[l.id] || 0) > Number(l.cantidad));
  const mueveTodo =
    seleccion.length === lineas.length &&
    lineas.length > 0 &&
    lineas.every((l: any) => Number(cantidades[l.id] || 0) >= Number(l.cantidad));

  const recalcularTotales = async (docId: string, ivaPorcentaje: number) => {
    const { data: rows } = await (supabase as any)
      .from("documento_productos")
      .select("subtotal, unidades_equivalentes")
      .eq("documento_id", docId);
    const subtotal = (rows || []).reduce((a: number, r: any) => a + Number(r.subtotal || 0), 0);
    const unidades = (rows || []).reduce((a: number, r: any) => a + Number(r.unidades_equivalentes || 0), 0);
    const iva = subtotal * (Number(ivaPorcentaje || 0) / 100);
    await (supabase as any)
      .from("documentos")
      .update({
        subtotal,
        iva_importe: iva,
        total: subtotal + iva,
        unidades_equivalentes_total: unidades,
      })
      .eq("id", docId);
  };

  const dividir = async () => {
    if (!data?.doc) return;
    if (seleccion.length === 0) {
      toast.error("Indica al menos una cantidad a mover");
      return;
    }
    if (hayExceso) {
      toast.error("Una cantidad excede lo disponible en el pedido");
      return;
    }
    if (mueveTodo) {
      toast.error("No puedes mover el pedido completo; deja al menos una cantidad en el original");
      return;
    }
    setGuardando(true);
    try {
      const src = data.doc;
      const {
        id: _id,
        created_at,
        updated_at,
        numero_cotizacion,
        numero_pedido,
        numero_factura,
        pdf_url,
        subtotal,
        iva_importe,
        total,
        unidades_equivalentes_total,
        ...rest
      } = src;

      const { data: inserted, error: insErr } = await (supabase as any)
        .from("documentos")
        .insert({
          ...rest,
          created_by: user?.id ?? src.created_by,
          pdf_url: null,
          numero_cotizacion: null,
          numero_pedido: null,
          numero_factura: null,
          subtotal: 0,
          iva_importe: 0,
          total: 0,
          unidades_equivalentes_total: 0,
          dividido_de_id: src.id,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      // Líneas del nuevo pedido (proporcionales)
      const nuevasLineas = seleccion.map(({ linea, mover }) => {
        const factor = mover / Number(linea.cantidad || 1);
        return {
          documento_id: inserted.id,
          producto_id: linea.producto_id,
          cantidad: mover,
          precio_unitario: Number(linea.precio_unitario),
          descuento_porcentaje: Number(linea.descuento_porcentaje || 0),
          subtotal: Number(linea.subtotal) * factor,
          unidades_equivalentes: Number(linea.unidades_equivalentes || 0) * factor,
        };
      });
      const { error: linErr } = await (supabase as any).from("documento_productos").insert(nuevasLineas);
      if (linErr) throw linErr;

      // Ajustar líneas del pedido original
      for (const { linea, mover } of seleccion) {
        const restante = Number(linea.cantidad) - mover;
        if (restante <= 0) {
          await (supabase as any).from("documento_productos").delete().eq("id", linea.id);
        } else {
          const factor = restante / Number(linea.cantidad || 1);
          await (supabase as any)
            .from("documento_productos")
            .update({
              cantidad: restante,
              subtotal: Number(linea.subtotal) * factor,
              unidades_equivalentes: Number(linea.unidades_equivalentes || 0) * factor,
            })
            .eq("id", linea.id);
        }
      }

      await recalcularTotales(inserted.id, src.iva_porcentaje);
      await recalcularTotales(src.id, src.iva_porcentaje);

      // Copiar la autorización de precio vigente (si existe)
      const { data: autRows } = await (supabase as any)
        .from("documento_autorizaciones_precio")
        .select("*")
        .eq("documento_id", src.id)
        .order("ronda", { ascending: false })
        .limit(1);
      const aut = (autRows || [])[0];
      if (aut) {
        const { id: _aid, created_at: _ac, updated_at: _au, documento_id, ...autRest } = aut;
        await (supabase as any)
          .from("documento_autorizaciones_precio")
          .insert({ ...autRest, documento_id: inserted.id });
      }

      qc.invalidateQueries({ queryKey: ["documentos"] });
      qc.invalidateQueries({ queryKey: ["documento", src.id] });
      qc.invalidateQueries({ queryKey: ["documento_productos", src.id] });
      qc.invalidateQueries({ queryKey: ["divisiones-pedido", src.id] });
      toast.success("Pedido dividido");
      onOpenChange(false);
      navigate(`/documents/${inserted.id}`);
    } catch (e: any) {
      toast.error(e.message || "No se pudo dividir el pedido");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4 border-b shrink-0">
          <DialogTitle className="text-lg font-semibold tracking-tight">Dividir pedido</DialogTitle>
          <DialogDescription className="text-xs font-light">
            Indica qué cantidades se mueven al nuevo pedido. Se restarán del pedido actual y la autorización de precio
            se copiará al nuevo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
            </div>
          ) : lineas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Este pedido no tiene productos.</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="col-span-6">Producto</span>
                <span className="col-span-2 text-right">En pedido</span>
                <span className="col-span-2 text-right">Mover</span>
                <span className="col-span-2 text-right">Queda</span>
              </div>
              {lineas.map((l: any) => {
                const mover = Number(cantidades[l.id] || 0);
                const exceso = mover > Number(l.cantidad);
                return (
                  <div
                    key={l.id}
                    className="grid grid-cols-12 items-center gap-2 rounded-md border px-2 py-2 text-sm odd:bg-muted/30"
                  >
                    <div className="col-span-6 min-w-0">
                      <p className="truncate font-medium">{l.productos?.nombre_producto || "Producto"}</p>
                      <p className="truncate text-xs text-muted-foreground">{l.productos?.codigo}</p>
                    </div>
                    <span className="col-span-2 text-right tabular-nums">{Number(l.cantidad)}</span>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min={0}
                        max={Number(l.cantidad)}
                        step="any"
                        value={cantidades[l.id] ?? ""}
                        placeholder="0"
                        onChange={(e) => setCantidades((p) => ({ ...p, [l.id]: e.target.value }))}
                        className={`h-8 text-right ${exceso ? "border-destructive" : ""}`}
                      />
                    </div>
                    <span className="col-span-2 text-right tabular-nums">
                      {Math.max(0, Number(l.cantidad) - mover)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t bg-muted/40 px-5 py-3 shrink-0">
          <p className="text-xs text-muted-foreground">
            Subtotal del nuevo pedido: <span className="font-medium">{formatCurrency(totalNuevo)}</span>
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={dividir} disabled={guardando || seleccion.length === 0}>
              {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Split className="mr-2 h-4 w-4" />}
              Crear pedido dividido
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
