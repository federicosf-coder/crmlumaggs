import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useNivelesInventario() {
  return useQuery({
    queryKey: ["inv_niveles_inventario"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("inv_niveles_inventario")
        .select("*")
        .order("codigo_producto", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 60_000,
  });
}

export function useKardexCargas() {
  return useQuery({
    queryKey: ["inv_kardex_cargas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("inv_kardex_cargas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export const ALMACEN_LABELS: Record<string, string> = {
  "1001": "Mexicali",
  "1002": "Tijuana",
  "1003": "Morelos",
  "1004": "Ensenada",
};

export const ALMACEN_BY_NAME: Record<string, string> = {
  mexicali: "1001",
  tijuana: "1002",
  morelos: "1003",
  ensenada: "1004",
};

export function statusColor(status?: string | null) {
  switch (status) {
    case "pedir": return "bg-red-100 text-red-800 border-red-200";
    case "ok": return "bg-green-100 text-green-800 border-green-200";
    case "sobrestock": return "bg-orange-100 text-orange-800 border-orange-200";
    case "muerto": return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "inactivo": return "bg-gray-100 text-gray-700 border-gray-200";
    default: return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

export function abcColor(abc?: string | null) {
  switch (abc) {
    case "A": return "bg-blue-100 text-blue-800 border-blue-200";
    case "B": return "bg-green-100 text-green-800 border-green-200";
    case "C": return "bg-gray-100 text-gray-700 border-gray-200";
    default: return "bg-gray-100 text-gray-600 border-gray-200";
  }
}