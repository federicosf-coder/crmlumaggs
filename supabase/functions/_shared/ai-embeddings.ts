// Embeddings a través del Lovable AI Gateway (uso exclusivo en el servidor).
const GATEWAY = "https://ai.gateway.lovable.dev/v1/embeddings";
export const EMBEDDING_MODEL = "google/gemini-embedding-001";
/** Gemini acepta como máximo 100 entradas por petición. */
export const EMBEDDING_BATCH = 50;

export async function embedTexts(inputs: string[]): Promise<number[][]> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY no está configurada");
  if (inputs.length === 0) return [];
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: inputs }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Embeddings ${res.status}: ${body.slice(0, 500)}`);
  const json = JSON.parse(body);
  const rows = (json?.data ?? []) as Array<{ index: number; embedding: number[] }>;
  const out: number[][] = new Array(inputs.length);
  for (const r of rows) out[r.index ?? 0] = r.embedding;
  return out;
}

export async function embedOne(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  return v;
}