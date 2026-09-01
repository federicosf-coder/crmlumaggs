/**
 * Trae TODAS las filas de una consulta Supabase paginando en lotes de 1000
 * (que es el máximo que Supabase devuelve por respuesta por defecto).
 * Las páginas siguientes se piden en oleadas paralelas para reducir el tiempo
 * total en tablas grandes (p. ej. cotizaciones o facturas).
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => any,
  pageSize = 1000,
  concurrency = 4
): Promise<T[]> {
  const all: T[] = [];

  const getPage = async (from: number): Promise<T[]> => {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    return (data || []) as T[];
  };

  const first = await getPage(0);
  all.push(...first);
  if (first.length < pageSize) return all;

  let from = pageSize;
  while (true) {
    const offsets = Array.from({ length: concurrency }, (_, i) => from + i * pageSize);
    const pages = await Promise.all(offsets.map(getPage));
    let done = false;
    for (const page of pages) {
      all.push(...page);
      if (page.length < pageSize) done = true;
    }
    if (done) break;
    from += concurrency * pageSize;
  }

  return all;
}

