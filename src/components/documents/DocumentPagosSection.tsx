import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { RegistrarPagoDialog } from "@/components/cobranza/RegistrarPagoDialog";

interface Props {
  documentoId: string;
  empresaId: string | null;
}

interface PagoRow {
  id: string;
  fecha_pago: string;
  monto_aplicado_doc: number;
  referencia_pago: string | null;
  estatus_pago: string;
  monto_total: number;
}

const ESTATUS_LABEL: Record<string, string> = {
  recibido: "Recibido",
  enviado_validar: "Enviado a Validar",
  validado: "Validado",
  aplicado: "Aplicado",
};

export function DocumentPagosSection({ documentoId, empresaId }: Props) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PagoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openRegistrar, setOpenRegistrar] = useState(false);

  const fetchPagos = useCallback(async () => {
    setLoading(true);
    const { data: aplics } = await supabase
      .from("cobranza_aplicaciones")
      .select("pago_id, monto_aplicado, estatus_aplicacion")
      .eq("documento_id", documentoId)
      .eq("estatus_aplicacion", "activa");
    const pagoIds = Array.from(new Set((aplics || []).map((a: any) => a.pago_id)));
    if (pagoIds.length === 0) { setRows([]); setLoading(false); return; }
    const { data: pagos } = await supabase
      .from("cobranza_pagos")
      .select("id, fecha_pago, referencia_pago, estatus_pago, monto_total")
      .in("id", pagoIds)
      .order("fecha_pago", { ascending: false });
    const sumByPago: Record<string, number> = {};
    (aplics || []).forEach((a: any) => {
      sumByPago[a.pago_id] = (sumByPago[a.pago_id] || 0) + Number(a.monto_aplicado || 0);
    });
    const merged: PagoRow[] = (pagos || []).map((p: any) => ({
      id: p.id,
      fecha_pago: p.fecha_pago,
      referencia_pago: p.referencia_pago,
      estatus_pago: p.estatus_pago,
      monto_total: Number(p.monto_total || 0),
      monto_aplicado_doc: sumByPago[p.id] || 0,
    }));
    setRows(merged);
    setLoading(false);
  }, [documentoId]);

  useEffect(() => { fetchPagos(); }, [fetchPagos]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Pagos</CardTitle>
          <Button size="sm" onClick={() => setOpenRegistrar(true)} disabled={!empresaId}>
            <Plus className="mr-1 h-4 w-4" /> Agregar pago
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Cargando pagos...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No hay pagos ligados a este documento.
          </p>
        ) : (
          <div className="border rounded-md divide-y">
            {rows.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate(`/cobranza?pagoId=${p.id}`)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 text-left transition-colors"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {p.referencia_pago || "Sin referencia"}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(p.fecha_pago)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{formatCurrency(p.monto_aplicado_doc)}</span>
                  <Badge variant="secondary">{ESTATUS_LABEL[p.estatus_pago] || p.estatus_pago}</Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
      <RegistrarPagoDialog
        open={openRegistrar}
        onOpenChange={setOpenRegistrar}
        defaultEmpresaId={empresaId || undefined}
        defaultDocumentoId={documentoId}
        onSaved={() => fetchPagos()}
      />
    </Card>
  );
}