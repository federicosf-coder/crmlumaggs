import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import AutorizacionPrecioCard from "./AutorizacionPrecioCard";

export default function AutorizacionPrecioDialog({
  open,
  onOpenChange,
  documentoId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentoId?: string | null;
}) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["autorizacion-precio-dialog", documentoId],
    enabled: open && !!documentoId,
    queryFn: async () => {
      const { data: rows, error } = await (supabase as any)
        .from("documento_autorizaciones_precio")
        .select(
          "id, documento_id, ronda, estatus, justificacion, costo_margen_snapshot, historico_snapshot, created_at, enviado_at, documentos(id, numero_pedido, fecha_documento, ejecutivo_venta_id, companies(id, name, razon_social))"
        )
        .eq("documento_id", documentoId)
        .order("ronda", { ascending: false })
        .limit(1);
      if (error) throw error;
      const row = (rows || [])[0] || null;
      let ejecutivo: string | null = null;
      if (row?.documentos?.ejecutivo_venta_id) {
        const { data: perfil } = await (supabase as any)
          .from("profiles")
          .select("full_name")
          .eq("user_id", row.documentos.ejecutivo_venta_id)
          .maybeSingle();
        ejecutivo = perfil?.full_name ?? null;
      }
      return { row, ejecutivo };
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4 border-b shrink-0">
          <DialogTitle className="text-lg font-semibold tracking-tight">Autorización de Precio</DialogTitle>
          <DialogDescription className="text-xs font-light">
            Revisa la justificación, adjunta evidencia y envía la solicitud.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 px-2 py-2">
          {isLoading ? (
            <div className="flex items-center gap-2 p-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
            </div>
          ) : !data?.row ? (
            <p className="p-6 text-sm text-muted-foreground">
              Este pedido no tiene una solicitud de autorización de precio.
            </p>
          ) : (
            <AutorizacionPrecioCard
              row={data.row}
              ejecutivo={data.ejecutivo}
              onRefetch={refetch}
              defaultOpen
              embedded
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
