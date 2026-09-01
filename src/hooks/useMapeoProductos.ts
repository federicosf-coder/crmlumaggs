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
  return useStockPorProductoImpl();
}

export function useCostosSinProductoCount() {
  return useQuery({
    queryKey: ["inv_costos_producto", "sin_producto_count"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("inv_costos_producto")
        .select("codigo_producto")
        .eq("estado", "sin_producto");
      return new Set((data || []).map((r: any) => r.codigo_producto)).size;
    },
    refetchInterval: 60_000,
  });
}

export function useCostosSinProducto() {
  return useQuery({
    queryKey: ["inv_costos_producto", "sin_producto"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("inv_costos_producto")
        .select("codigo_producto, nombre_en_archivo, empresa, costo_efectivo, archivo_galper_id, archivo_lista_id, created_at")
        .eq("estado", "sin_producto")
        .order("created_at", { ascending: false });
      const dedup = new Map<string, any>();
      for (const r of (data || [])) {
        if (!dedup.has(r.codigo_producto)) dedup.set(r.codigo_producto, r);
      }
      const rows = Array.from(dedup.values());
      const { data: archivos } = await (supabase as any)
        .from("inv_archivos_referencia")
        .select("id, tipo");
      const tipoPorId = new Map((archivos || []).map((a: any) => [a.id, String(a.tipo || "").toLowerCase()]));
      return rows.map((r: any) => {
        const tipo = tipoPorId.get(r.archivo_lista_id) || tipoPorId.get(r.archivo_galper_id) || "";
        let marca_label = "Phillips 66 / Galsa";
        if (r.empresa === "lumaggs") marca_label = "Chevron";
        else if (r.empresa === "galsa" && String(tipo).includes("gonher")) marca_label = "Gonher";
        return { ...r, marca_label };
      });
    },
    refetchInterval: 60_000,
  });
}

export function useCostosIgnorados() {
  return useQuery({
    queryKey: ["inv_costos_producto_ignorados"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("inv_costos_producto_ignorados")
        .select("*")
        .order("ignorado_at", { ascending: false });
      return (data || []) as any[];
    },
  });
}

function useStockPorProductoImpl() {
  return useQuery({
    queryKey: ["stock_por_producto"],
    queryFn: async () => {
      const { data: mapeos } = await (supabase as any)
        .from("inv_producto_proveedor")
        .select("producto_id, codigo_contpaqi, piezas_por_tarima");
      const { data: productosBrand } = await supabase
        .from("productos")
        .select("id, marca:product_option_values!productos_marca_id_fkey(value)");
      const { data: niveles } = await (supabase as any)
        .from("inv_niveles_inventario")
        .select("codigo_producto, empresa_vendedora, stock_almacen_1001, stock_almacen_1002, stock_almacen_1003, stock_almacen_1004, stock_total, estatus_inventario");
      const productoEmpresaMap = new Map<string, string>();
      for (const p of (productosBrand || []) as any[]) {
        const marcaValue = String(p.marca?.value || "").toLowerCase();
        const empresa = marcaValue.includes("phillips") ? "galsa" : "lumaggs";
        productoEmpresaMap.set(p.id, empresa);
      }
      const nivelMap = new Map<string, any>((niveles || []).map((n: any) => [`${n.codigo_producto}::${n.empresa_vendedora}`, n]));
      const result = new Map<string, any>();
      for (const m of (mapeos || [])) {
        if (m.producto_id) {
          const empresa = productoEmpresaMap.get(m.producto_id) || "lumaggs";
          result.set(m.producto_id, {
            ...(nivelMap.get(`${m.codigo_contpaqi}::${empresa}`) || {}),
            piezas_por_tarima: m.piezas_por_tarima,
          });
        }
      }
      return result;
    },
    refetchInterval: 5 * 60 * 1000,
  });
}
