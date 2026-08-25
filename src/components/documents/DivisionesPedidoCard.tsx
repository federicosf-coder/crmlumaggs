import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Split } from "lucide-react";

export default function DivisionesPedidoCard({ documentoId }: { documentoId: string }) {
  const { data } = useQuery({
    queryKey: ["divisiones-pedido", documentoId],
    enabled: !!documentoId,
    queryFn: async () => {
      const { data: doc } = await (supabase as any)
        .from("documentos")
        .select("id, dividido_de_id")
        .eq("id", documentoId)
        .maybeSingle();

      let origen: any = null;
      if (doc?.dividido_de_id) {
        const { data: o } = await (supabase as any)
          .from("documentos")
          .select("id, numero_pedido, numero_factura")
          .eq("id", doc.dividido_de_id)
          .maybeSingle();
        origen = o;
      }

      const { data: hijos } = await (supabase as any)
        .from("documentos")
        .select("id, numero_pedido, numero_factura")
        .eq("dividido_de_id", documentoId)
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      return { origen, hijos: hijos || [] };
    },
  });

  const origen = data?.origen;
  const hijos = data?.hijos || [];
  if (!origen && hijos.length === 0) return null;

  const etiqueta = (d: any) => d.numero_pedido || d.numero_factura || "Sin número";

  return (
    <Card className="mb-4 border border-violet-300 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-950/20">
      <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
        <div className="flex items-center gap-2">
          <Split className="h-4 w-4 text-violet-600" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-300">
            Pedidos relacionados
          </span>
        </div>
        {origen && (
          <p className="text-sm">
            Dividido de{" "}
            <Link to={`/documents/${origen.id}`} className="font-medium underline underline-offset-2">
              {etiqueta(origen)}
            </Link>
          </p>
        )}
        {hijos.length > 0 && (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span>Divisiones:</span>
            {hijos.map((h: any) => (
              <Link
                key={h.id}
                to={`/documents/${h.id}`}
                className="font-medium underline underline-offset-2"
              >
                {etiqueta(h)}
              </Link>
            ))}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
