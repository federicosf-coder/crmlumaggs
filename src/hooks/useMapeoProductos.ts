import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useHuerfanosCount() {
  return useQuery({
    queryKey: ["inv_huerfanos_count"],
    queryFn: async () => {
      const { data: niveles } = await (supabase as any)
        .from("inv_niveles_inventario")
        .select("codigo_producto")
        .gt("stock_total", 0);
      const { data: mapeos } = await (supabase as any)
        .from("inv_producto_proveedor")
        .select("codigo_contpaqi");
      const mapeados = new Set((mapeos || []).map((m: any) => m.codigo_contpaqi));
      return (niveles || []).filter((n: any) => !mapeados.has(n.codigo_producto)).length;
    },
    refetchInterval: 60_000,
  });
}
