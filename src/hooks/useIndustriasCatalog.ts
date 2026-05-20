import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { INDUSTRIAS_OPTIONS } from "@/components/CompanyFormDialog";

export type IndustriaCatalogItem = {
  id: string;
  clave: string;
  etiqueta: string;
  is_active: boolean;
  ordering: number;
};

/**
 * Catálogo de industrias administrable.
 * - `clave` es lo que se guarda en companies.industrias[].
 * - `etiqueta` es el nombre visible.
 * Si la consulta falla o está vacía, se usa la lista hardcodeada como respaldo.
 */
export function useIndustriasCatalog(opts?: { onlyActive?: boolean }) {
  const onlyActive = opts?.onlyActive ?? true;
  return useQuery({
    queryKey: ["industrias_catalog", onlyActive],
    queryFn: async (): Promise<IndustriaCatalogItem[]> => {
      const { data, error } = await (supabase.from as any)("industrias_catalog")
        .select("*")
        .order("ordering", { ascending: true })
        .order("etiqueta", { ascending: true });
      if (error) throw error;
      const rows: IndustriaCatalogItem[] = (data || []) as any;
      const filtered = onlyActive ? rows.filter((r) => r.is_active) : rows;
      if (filtered.length > 0) return filtered;
      // Fallback a la lista hardcodeada
      return INDUSTRIAS_OPTIONS.map((s, i) => ({
        id: String(i),
        clave: s,
        etiqueta: s,
        is_active: true,
        ordering: i * 10,
      }));
    },
    staleTime: 1000 * 60 * 5,
  });
}

/** Devuelve la etiqueta visible para una clave guardada; si no se encuentra, regresa la clave. */
export function resolveIndustriaLabel(
  clave: string,
  catalog: IndustriaCatalogItem[] | undefined
): string {
  if (!catalog || catalog.length === 0) return clave;
  const hit = catalog.find((c) => c.clave === clave);
  return hit?.etiqueta || clave;
}
