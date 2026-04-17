/** Normaliza nombres para comparación: lowercase, sin acentos, _→espacio, sin puntuación menor, espacios colapsados. */
export function normalizeName(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/[.,;:!?¿¡()"'`´]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Similitud de Dice (bigramas). 0..1 */
export function similarity(a: string, b: string): number {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;

  const bigrams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      m.set(bg, (m.get(bg) || 0) + 1);
    }
    return m;
  };
  const ba = bigrams(x);
  const bb = bigrams(y);
  let inter = 0;
  for (const [k, v] of ba) {
    const w = bb.get(k);
    if (w) inter += Math.min(v, w);
  }
  const total = (x.length - 1) + (y.length - 1);
  return (2 * inter) / total;
}

/** Encuentra el mejor match en una lista por similitud. */
export function bestMatch<T>(
  query: string,
  candidates: T[],
  getName: (c: T) => string,
  threshold = 0.85,
): { item: T; score: number } | null {
  let best: { item: T; score: number } | null = null;
  for (const c of candidates) {
    const s = similarity(query, getName(c));
    if (s >= threshold && (!best || s > best.score)) best = { item: c, score: s };
  }
  return best;
}
