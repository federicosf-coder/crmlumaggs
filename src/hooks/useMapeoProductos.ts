import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMapeos() {
  return useQuery({
    queryKey: ["inv_producto_proveedor"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("inv_producto_proveedor")
        .select("*, productos(id, codigo, nombre_producto, presentacion_id, presentaciones(nombre))")
        .order("confirmado", { ascending: true })
        .order("codigo_contpaqi");
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useHuerfanosKardex() {
  return useQuery({
    queryKey: ["huerfanos_kardex"],
    queryFn: async () => {
      const { data: niveles, error } = await (supabase as any)
        .from("inv_niveles_inventario")
        .select("codigo_producto, nombre_producto, unidad, empresa_vendedora, presentacion, piezas_por_tarima, stock_almacen_1001, stock_almacen_1002, stock_almacen_1003, stock_almacen_1004, stock_total, clasificacion_abc, estatus_inventario")
        .gt("stock_total", 0)
        .order("stock_total", { ascending: false });
      if (error) throw error;
      const { data: mapeos } = await (supabase as any)
        .from("inv_producto_proveedor")
        .select("codigo_contpaqi");
      const mapeados = new Set((mapeos || []).map((m: any) => m.codigo_contpaqi));
      return (niveles || []).filter((n: any) => !mapeados.has(n.codigo_producto));
    },
    refetchInterval: 60_000,
  });
}

export function useFantasmasCatalogo() {
  return useQuery({
    queryKey: ["fantasmas_catalogo"],
    queryFn: async () => {
      const { data: prods, error } = await (supabase as any)
        .from("productos")
        .select("id, codigo, nombre_producto, presentaciones(nombre)")
        .eq("is_active", true)
        .order("codigo");
      if (error) throw error;
      const { data: niveles } = await (supabase as any)
        .from("inv_niveles_inventario")
        .select("codigo_producto, stock_total");
      const { data: mapeos } = await (supabase as any)
        .from("inv_producto_proveedor")
        .select("producto_id, codigo_contpaqi");
      const stockMap = new Map((niveles || []).map((n: any) => [n.codigo_producto, n.stock_total]));
      const mapeoByProducto = new Map((mapeos || []).map((m: any) => [m.producto_id, m.codigo_contpaqi]));
      return (prods || []).filter((p: any) => {
        const codigoContpaqi = mapeoByProducto.get(p.id) || p.codigo;
        const stock = stockMap.get(codigoContpaqi) ?? 0;
        return Number(stock) === 0;
      });
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
        .select("producto_id, codigo_contpaqi");
      const { data: niveles } = await (supabase as any)
        .from("inv_niveles_inventario")
        .select("codigo_producto, stock_almacen_1001, stock_almacen_1002, stock_almacen_1003, stock_almacen_1004, stock_total, estatus_inventario");
      const { data: prods } = await (supabase as any)
        .from("productos")
        .select("id, codigo");
      const nivelMap = new Map((niveles || []).map((n: any) => [n.codigo_producto, n]));
      const result = new Map<string, any>();
      // Match via mapeo table
      for (const m of (mapeos || [])) {
        const nivel = nivelMap.get(m.codigo_contpaqi);
        if (nivel && m.producto_id) result.set(m.producto_id, nivel);
      }
      // Fallback: match directly by producto.codigo === codigo_producto del kardex
      for (const p of (prods || [])) {
        if (result.has(p.id)) continue;
        const nivel = nivelMap.get(p.codigo);
        if (nivel) result.set(p.id, nivel);
      }
      return result;
    },
    refetchInterval: 300_000,
  });
}

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
    refetchInterval: 120_000,
  });
}