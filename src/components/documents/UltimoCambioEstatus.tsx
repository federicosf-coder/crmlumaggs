import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UltimoCambioEstatusProps {
  documentoId: string;
}

export default function UltimoCambioEstatus({ documentoId }: UltimoCambioEstatusProps) {
  const { data } = useQuery({
    queryKey: ["ultimo-cambio-estatus", documentoId],
    enabled: !!documentoId,
    queryFn: async () => {
      const { data: row, error } = await (supabase as any)
        .from("documentos_estatus_historial")
        .select("estatus_anterior, estatus_nuevo, cambiado_por, cambiado_at")
        .eq("documento_id", documentoId)
        .order("cambiado_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!row) return null;

      let nombre = "Sistema";
      if (row.cambiado_por) {
        const { data: perfil } = await (supabase as any)
          .from("profiles")
          .select("user_id, full_name")
          .eq("user_id", row.cambiado_por)
          .maybeSingle();
        nombre = perfil?.full_name || "Sistema";
      }
      return { ...row, nombre };
    },
  });

  if (!data) return null;

  const fecha = data.cambiado_at
    ? new Date(data.cambiado_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })
    : "";

  return (
    <p className="mt-1 text-[11px] text-muted-foreground">
      Último cambio de estatus: {data.nombre} · {fecha}
    </p>
  );
}
