import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useHuerfanosCount() {
  return useQuery({
    queryKey: ["huerfanos_count"],
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

export function useHuerfanosKardex() {
  return useQuery({
    queryKey: ["huerfanos_kardex"],
    queryFn: async () => {
      const { data: niveles } = await (supabase as any)
        .from("inv_niveles_inventario")
        .select("*")
        .gt("stock_total", 0)
        .order("stock_total", { ascending: false });
      const { data: mapeos } = await (supabase as any)
        .from("inv_producto_proveedor")
        .select("codigo_contpaqi");
      const mapeados = new Set((mapeos || []).map((m: any) => m.codigo_contpaqi));
      return (niveles || []).filter((n: any) => !mapeados.has(n.codigo_producto));
    },
    refetchInterval: 30_000,
  });
}

export function useFantasmasCatalogo() {
  return useQuery({
    queryKey: ["fantasmas_catalogo"],
    queryFn: async () => {
      const { data: prods } = await supabase
        .from("productos")
        .select("id, codigo, nombre_producto, presentaciones(nombre), marca:product_option_values!productos_marca_id_fkey(value)")
        .eq("is_active", true)
        .order("codigo");
      const { data: mapeos } = await (supabase as any)
        .from("inv_producto_proveedor")
        .select("producto_id, codigo_contpaqi");
      const { data: niveles } = await (supabase as any)
        .from("inv_niveles_inventario")
        .select("codigo_producto, stock_total");
      const stockPorCodigo = new Map((niveles || []).map((n: any) => [n.codigo_producto, n.stock_total ?? 0]));
      const stockPorProducto = new Map((mapeos || []).map((m: any) => [m.producto_id, stockPorCodigo.get(m.codigo_contpaqi) ?? 0]));
      return (prods || []).filter((p: any) => !stockPorProducto.has(p.id) || stockPorProducto.get(p.id) === 0);
    },
    refetchInterval: 60_000,
  });
}

export function useMapeos() {
  return useQuery({
    queryKey: ["inv_producto_proveedor"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("inv_producto_proveedor")
        .select("*, productos(id, codigo, nombre_producto)")
        .order("created_at", { ascending: false });
      return data || [];
    },
    refetchInterval: 60_000,
  });
}

export function useStockPorProducto() {
  return useQuery({
    queryKey: ["stock_por_producto"],
    queryFn: async () => {
      const { data: mapeos } = await (supabase as any)
        .from("inv_producto_proveedor")
        .select("producto_id, codigo_contpaqi, piezas_por_tarima");
      const { data: niveles } = await (supabase as any)
        .from("inv_niveles_inventario")
        .select("codigo_producto, stock_almacen_1001, stock_almacen_1002, stock_almacen_1003, stock_almacen_1004, stock_total, estatus_inventario");
      const nivelMap = new Map((niveles || []).map((n: any) => [n.codigo_producto, n]));
      const result = new Map<string, any>();
      for (const m of (mapeos || [])) {
        if (m.producto_id) {
          result.set(m.producto_id, {
            ...nivelMap.get(m.codigo_contpaqi),
            piezas_por_tarima: m.piezas_por_tarima,
          });
        }
      }
      return result;
    },
    refetchInterval: 5 * 60 * 1000,
  });
}
