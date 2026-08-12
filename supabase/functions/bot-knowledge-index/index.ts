// Indexa documentos técnicos (Spanish Digest, TDS, SDS...) del bucket `biblioteca`
// en fragmentos con embeddings, para la búsqueda semántica del asesor IA.
//
// Modo de uso (dos fases, reanudable):
//   { action: "extract", bucket?, path, title?, source_type? } -> crea doc + fragmentos sin vector
//   { action: "embed", doc_id, limit? }                        -> vectoriza pendientes, devuelve `remaining`
//   { action: "status", doc_id? }                              -> avance por documento
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";
import { embedTexts, EMBEDDING_BATCH, EMBEDDING_MODEL } from "../_shared/ai-embeddings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_CHARS = 1400;
const OVERLAP = 180;

function chunkPage(text: string): string[] {
  const clean = text.replace(/\u0000/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  if (clean.length <= MAX_CHARS) return [clean];
  const out: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + MAX_CHARS, clean.length);
    if (end < clean.length) {
      const brk = clean.lastIndexOf("\n", end);
      const dot = clean.lastIndexOf(". ", end);
      const cut = Math.max(brk, dot);
      if (cut > start + MAX_CHARS * 0.5) end = cut + 1;
    }
    const piece = clean.slice(start, end).trim();
    if (piece.length > 40) out.push(piece);
    if (end >= clean.length) break;
    start = Math.max(end - OVERLAP, start + 1);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "status");

    if (action === "status") {
      const { data: docs, error } = await admin
        .from("bot_knowledge_docs")
        .select("id,title,source_type,status,chunk_count,indexed_at,error_message,storage_path")
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json({ docs: docs ?? [] });
    }

    if (action === "extract") {
      const bucket = String(body?.bucket ?? "biblioteca");
      const path = String(body?.path ?? "");
      if (!path) return json({ error: "Falta `path` del archivo en la biblioteca" }, 400);
      const title = String(body?.title ?? path.split("/").pop() ?? path);
      const sourceType = String(body?.source_type ?? "digest");

      const { data: existing } = await admin
        .from("bot_knowledge_docs")
        .select("id")
        .eq("bucket", bucket)
        .eq("storage_path", path)
        .maybeSingle();

      let docId = existing?.id as string | undefined;
      if (docId) {
        await admin.from("bot_knowledge_chunks").delete().eq("doc_id", docId);
        await admin.from("bot_knowledge_docs")
          .update({ status: "extracting", title, source_type: sourceType, chunk_count: 0, error_message: null })
          .eq("id", docId);
      } else {
        const { data: created, error: createErr } = await admin
          .from("bot_knowledge_docs")
          .insert({ title, source_type: sourceType, bucket, storage_path: path, status: "extracting" })
          .select("id")
          .single();
        if (createErr) return json({ error: createErr.message }, 500);
        docId = created.id;
      }

      const { data: file, error: dlErr } = await admin.storage.from(bucket).download(path);
      if (dlErr || !file) {
        await admin.from("bot_knowledge_docs")
          .update({ status: "error", error_message: dlErr?.message ?? "No se pudo descargar el archivo" })
          .eq("id", docId!);
        return json({ error: dlErr?.message ?? "No se pudo descargar el archivo" }, 500);
      }

      const buf = new Uint8Array(await file.arrayBuffer());
      const pdf = await getDocumentProxy(buf);
      const { text: pages } = await extractText(pdf, { mergePages: false });
      const pageTexts = Array.isArray(pages) ? pages : [String(pages ?? "")];

      let total = 0;
      let pending: Array<Record<string, unknown>> = [];
      const flush = async () => {
        if (pending.length === 0) return;
        const { error } = await admin.from("bot_knowledge_chunks").insert(pending);
        if (error) throw new Error(error.message);
        total += pending.length;
        pending = [];
      };
      for (let p = 0; p < pageTexts.length; p++) {
        const chunks = chunkPage(String(pageTexts[p] ?? ""));
        chunks.forEach((content, i) => {
          pending.push({
            doc_id: docId,
            source_type: sourceType,
            title,
            page: p + 1,
            chunk_index: i,
            content,
            model_version: EMBEDDING_MODEL,
          });
        });
        if (pending.length >= 400) await flush();
      }
      await flush();

      await admin.from("bot_knowledge_docs")
        .update({ status: "embedding", chunk_count: total })
        .eq("id", docId!);
      return json({ doc_id: docId, pages: pageTexts.length, chunks: total, status: "embedding" });
    }

    if (action === "embed") {
      const docId = String(body?.doc_id ?? "");
      if (!docId) return json({ error: "Falta `doc_id`" }, 400);
      const limit = Math.min(Number(body?.limit ?? 200), 400);

      const { data: rows, error } = await admin
        .from("bot_knowledge_chunks")
        .select("id,content")
        .eq("doc_id", docId)
        .is("embedding", null)
        .limit(limit);
      if (error) return json({ error: error.message }, 500);

      let processed = 0;
      for (let i = 0; i < (rows?.length ?? 0); i += EMBEDDING_BATCH) {
        const batch = (rows ?? []).slice(i, i + EMBEDDING_BATCH);
        const vectors = await embedTexts(batch.map((r) => r.content as string));
        for (let k = 0; k < batch.length; k++) {
          const vec = vectors[k];
          if (!vec) continue;
          const { error: upErr } = await admin
            .from("bot_knowledge_chunks")
            .update({ embedding: JSON.stringify(vec) })
            .eq("id", batch[k].id);
          if (upErr) throw new Error(upErr.message);
          processed++;
        }
      }

      const { count: remaining } = await admin
        .from("bot_knowledge_chunks")
        .select("id", { count: "exact", head: true })
        .eq("doc_id", docId)
        .is("embedding", null);

      if ((remaining ?? 0) === 0) {
        await admin.from("bot_knowledge_docs")
          .update({ status: "ready", indexed_at: new Date().toISOString() })
          .eq("id", docId);
      }
      return json({ processed, remaining: remaining ?? 0 });
    }

    return json({ error: `Acción no soportada: ${action}` }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    console.error("[bot-knowledge-index]", message);
    return json({ error: message }, 500);
  }
});