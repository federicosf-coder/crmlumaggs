/**
 * Trae TODAS las filas de una consulta Supabase paginando en lotes de 1000
 * (evita el límite por defecto de 1000 filas por respuesta).
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => any,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}