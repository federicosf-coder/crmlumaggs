import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, BadgeDollarSign } from "lucide-react";
import AutorizacionPrecioCard from "@/components/documents/AutorizacionPrecioCard";

type Autorizacion = any;

export default function AutorizacionPrecios() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["autorizaciones-precio"],
    queryFn: async () => {
      const { data: rows, error } = await (supabase as any)
        .from("documento_autorizaciones_precio")
        .select(
          "id, documento_id, ronda, estatus, justificacion, costo_margen_snapshot, historico_snapshot, datos_cliente_snapshot, created_at, enviado_at, margen_reportado_texto, margen_respondido_por, margen_respondido_at, autorizado, autorizado_por_texto, motivo, autorizacion_respondido_at, pospuesto, pospuesto_at, documentos(id, numero_pedido, numero_factura, fecha_documento, ejecutivo_venta_id, companies(id, name, razon_social, industrias, tipo_destino_lubricante, lista_precios, limite_credito, tipo_pago, forma_pago, metodo_pago, uso_cfdi))"
        )
        .in("estatus", ["pendiente_revision", "enviado"])
        .order("created_at", { ascending: true });
      if (error) throw error;

      const ids = Array.from(
        new Set((rows || []).map((r: any) => r.documentos?.ejecutivo_venta_id).filter(Boolean))
      );
      let mapa: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await (supabase as any)
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", ids);
        mapa = Object.fromEntries((profs || []).map((p: any) => [p.user_id, p.full_name]));
      }
      return { rows: (rows || []) as Autorizacion[], ejecutivos: mapa };
    },
  });

  const rows = data?.rows || [];
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("id");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && highlightId && rows.some((r) => r.id === highlightId)) {
      const el = document.getElementById(highlightId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedId(highlightId);
      }
    }
  }, [isLoading, highlightId, rows]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <BadgeDollarSign className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Autorización de Precios</h1>
          <p className="text-sm text-muted-foreground">
            Revisa, documenta y envía las solicitudes de autorización de precio.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay pedidos pendientes de autorización de precio.
          </CardContent>
        </Card>
      ) : (
        rows.map((row) => (
          <AutorizacionPrecioCard
            key={row.id}
            row={row}
            ejecutivo={row.documentos?.ejecutivo_venta_id ? data?.ejecutivos?.[row.documentos.ejecutivo_venta_id] : null}
            onRefetch={refetch}
            isHighlighted={highlightedId === row.id}
          />
        ))
      )}
    </div>
  );
}
