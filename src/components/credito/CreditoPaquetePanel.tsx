import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PDFDocument } from "pdf-lib";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ExternalLink, Files, Loader2, Merge, Scissors, Sparkles, Trash2, Upload } from "lucide-react";

const BUCKET = "credit-docs";
const MAX_BYTES = 40 * 1024 * 1024;
const LOTE = 20;
const MAX_IA = 60;
const SIN_ASIGNAR = "__sin_asignar__";
const DESCARTAR = "__descartar__";

const CONFIANZA_COLOR: Record<string, string> = {
  alta: "bg-emerald-50 text-emerald-700 border-emerald-200",
  media: "bg-amber-50 text-amber-700 border-amber-200",
  baja: "bg-red-50 text-red-700 border-red-200",
};
const RANK: Record<string, number> = { baja: 0, media: 1, alta: 2 };

type Confianza = "alta" | "media" | "baja";
type PageSug = { n: number; doc_type_id: string | null; es_continuacion: boolean; confianza: Confianza; razon: string };
type Segmento = { key: string; start: number; end: number; docTypeId: string | null; destino: string; confianza: Confianza | null; razon: string; nombre: string };

const sanear = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_").slice(0, 120) || "archivo";

const nuevoKey = () => crypto.randomUUID();

function construirSegmentos(n: number, sug: PageSug[] | null, docTypes: any[]): Segmento[] {
  const nombreTipo = (id: string | null) => docTypes.find((d) => d.id === id)?.nombre ?? "";
  if (!sug || sug.length === 0) {
    return [{ key: nuevoKey(), start: 1, end: n, docTypeId: null, destino: SIN_ASIGNAR, confianza: null, razon: "", nombre: "" }];
  }
  const byN = new Map(sug.map((p) => [p.n, p]));
  const segs: Segmento[] = [];
  let prevId: string | null | undefined = undefined;
  for (let i = 1; i <= n; i++) {
    const p = byN.get(i) ?? { n: i, doc_type_id: null, es_continuacion: false, confianza: "baja" as Confianza, razon: "" };
    const nuevo = i === 1 || !p.es_continuacion || p.doc_type_id !== prevId;
    if (nuevo) {
      segs.push({
        key: nuevoKey(), start: i, end: i, docTypeId: p.doc_type_id,
        destino: p.doc_type_id ?? SIN_ASIGNAR, confianza: p.confianza, razon: p.razon || "",
        nombre: nombreTipo(p.doc_type_id),
      });
    } else {
      const s = segs[segs.length - 1];
      s.end = i;
      if (s.confianza && RANK[p.confianza] < RANK[s.confianza]) s.confianza = p.confianza;
    }
    prevId = p.doc_type_id;
  }
  return segs;
}

export function CreditoPaquetePanel({ creditId, docTypes, docs, onDocsChanged }: { creditId: string; docTypes: any[]; docs: any[]; onDocsChanged: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [revisar, setRevisar] = useState<any | null>(null);

  const { data: pendientes = [] } = useQuery({
    queryKey: ["credito-paquetes", creditId],
    enabled: !!creditId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credito_docs_intake")
        .select("*")
        .eq("credit_request_id", creditId)
        .eq("estatus", "pendiente")
        .in("origen", ["paquete_ejecutivo", "paquete_cliente", "segmento"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return toast.error("Solo se aceptan archivos PDF");
    if (f.size > MAX_BYTES) return toast.error("El archivo supera 40 MB");
    setSubiendo(true);
    try {
      const path = `${creditId}/paquetes/${crypto.randomUUID()}_${sanear(f.name)}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: "application/pdf" });
      if (upErr) throw upErr;
      const { data, error } = await supabase
        .from("credito_docs_intake")
        .insert({ credit_request_id: creditId, storage_path: path, nombre_archivo: f.name, mime_type: "application/pdf", origen: "paquete_ejecutivo", estatus: "pendiente" } as any)
        .select("*")
        .single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["credito-paquetes", creditId] });
      setRevisar(data);
    } catch (err: any) {
      toast.error(`No se pudo subir: ${err?.message || err}`);
    } finally {
      setSubiendo(false);
    }
  };

  const ver = async (row: any) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(row.storage_path, 600);
    if (error || !data?.signedUrl) return toast.error("No se pudo abrir el archivo");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const descartar = async (row: any) => {
    if (!confirm(`¿Descartar «${row.nombre_archivo}»? El archivo se conserva como respaldo.`)) return;
    const { error } = await supabase.from("credito_docs_intake").update({ estatus: "descartado" } as any).eq("id", row.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["credito-paquetes", creditId] });
  };

  const badgeOrigen = (row: any) =>
    row.origen === "paquete_cliente" ? "Subido por el cliente"
      : row.origen === "segmento" ? `Sin clasificar · págs ${row.pagina_inicio}–${row.pagina_fin}`
      : "Paquete";

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Files className="h-4 w-4 text-violet-600" />
          <span className="text-sm font-medium">Expediente en un solo archivo</span>
        </div>
        <Button size="sm" variant="outline" disabled={subiendo} onClick={() => fileRef.current?.click()}>
          {subiendo ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
          Subir expediente completo
        </Button>
        <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={onFile} />
      </div>
      <p className="text-xs text-muted-foreground font-light">Sube un PDF escaneado con todos los documentos; la IA propone cómo separarlo y tú lo revisas antes de guardar.</p>

      {pendientes.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Pendientes de separar</div>
          {pendientes.map((row) => (
            <div key={row.id} className="flex items-center gap-2 flex-wrap rounded border bg-background px-2 py-1.5">
              <span className="text-sm truncate max-w-[220px]" title={row.nombre_archivo}>{row.nombre_archivo}</span>
              <Badge variant="outline" className="text-[10px]">{badgeOrigen(row)}</Badge>
              <div className="ml-auto flex gap-1">
                <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => setRevisar(row)}>Revisar y separar</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => ver(row)}><ExternalLink className="h-3.5 w-3.5 mr-1" />Ver</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => descartar(row)}><Trash2 className="h-3.5 w-3.5 mr-1" />Descartar</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {revisar && (
        <RevisionDialog
          key={revisar.id}
          row={revisar}
          creditId={creditId}
          docTypes={docTypes}
          docs={docs}
          userId={user?.id ?? null}
          onClose={() => setRevisar(null)}
          onSaved={() => {
            setRevisar(null);
            qc.invalidateQueries({ queryKey: ["credito-paquetes", creditId] });
            onDocsChanged();
          }}
        />
      )}
    </div>
  );
}

function RevisionDialog({ row, creditId, docTypes, docs, userId, onClose, onSaved }: {
  row: any; creditId: string; docTypes: any[]; docs: any[]; userId: string | null; onClose: () => void; onSaved: () => void;
}) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [imgs, setImgs] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [estado, setEstado] = useState<string>("Descargando archivo…");
  const [progreso, setProgreso] = useState(0);
  const [preparando, setPreparando] = useState(true);
  const [clasificando, setClasificando] = useState(false);
  const [segs, setSegs] = useState<Segmento[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);

  const clasificar = async (pages: string[], n: number) => {
    if (n > MAX_IA) {
      toast.info(`El archivo tiene ${n} páginas; la sugerencia automática solo aplica hasta ${MAX_IA}. Sepáralo manualmente.`);
      return null;
    }
    setClasificando(true);
    try {
      const out: PageSug[] = [];
      let prev: { n: number; doc_type_id: string | null } | null = null;
      for (let a = 1; a <= n; a += LOTE) {
        const b = Math.min(n, a + LOTE - 1);
        setEstado(`Clasificando páginas ${a}–${b} de ${n}`);
        setProgreso(Math.round(((a - 1) / n) * 100));
        const lote = [];
        for (let i = a; i <= b; i++) lote.push({ n: i, b64: pages[i - 1].replace(/^data:image\/jpeg;base64,/, "") });
        const { data, error } = await supabase.functions.invoke("credito-clasificar-paginas", { body: { request_id: creditId, pages: lote, prev } });
        if (error || !data?.ok) throw new Error((data as any)?.error || error?.message || "error");
        out.push(...(data.pages as PageSug[]));
        const last = out[out.length - 1];
        prev = last ? { n: last.n, doc_type_id: last.doc_type_id } : null;
      }
      await supabase.from("credito_docs_intake").update({ extraccion_raw: { pages: out }, total_paginas: n } as any).eq("id", row.id);
      return out;
    } catch (e: any) {
      toast.info(`No se pudo obtener la sugerencia automática (${e?.message || e}). Continúa manualmente.`);
      return null;
    } finally {
      setClasificando(false);
      setEstado("");
    }
  };

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data: blob, error } = await supabase.storage.from(BUCKET).download(row.storage_path);
        if (error || !blob) throw error || new Error("No se pudo descargar");
        const buf = new Uint8Array(await blob.arrayBuffer());
        if (cancel) return;
        setBytes(buf);
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
        const pdf = await pdfjsLib.getDocument({ data: buf.slice() }).promise;
        const n = pdf.numPages;
        setTotal(n);
        const out: string[] = [];
        for (let i = 1; i <= n; i++) {
          if (cancel) return;
          setEstado(`Preparando página ${i} de ${n}`);
          setProgreso(Math.round((i / n) * 100));
          const page = await pdf.getPage(i);
          const v1 = page.getViewport({ scale: 1 });
          const scale = 1000 / Math.max(v1.width, v1.height);
          const vp = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(vp.width);
          canvas.height = Math.round(vp.height);
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport: vp, canvas } as any).promise;
          out.push(canvas.toDataURL("image/jpeg", 0.6));
        }
        if (cancel) return;
        setImgs(out);
        setPreparando(false);
        let sug: PageSug[] | null = (row.extraccion_raw?.pages as PageSug[]) ?? null;
        if (!sug && row.origen !== "segmento") sug = await clasificar(out, n);
        if (cancel) return;
        setSegs(construirSegmentos(n, sug, docTypes));
      } catch (e: any) {
        toast.error(`No se pudo leer el PDF: ${e?.message || e}`);
        setPreparando(false);
      }
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resugerir = async () => {
    const sug = await clasificar(imgs, total);
    if (sug) setSegs(construirSegmentos(total, sug, docTypes));
  };

  const nombreTipo = (id: string | null) => docTypes.find((d) => d.id === id)?.nombre ?? "";

  const setDestino = (key: string, destino: string) =>
    setSegs((ss) => ss.map((s) => {
      if (s.key !== key) return s;
      const isTipo = destino !== SIN_ASIGNAR && destino !== DESCARTAR;
      const prevDefault = !s.nombre || s.nombre === nombreTipo(s.docTypeId);
      return { ...s, destino, docTypeId: isTipo ? destino : null, nombre: isTipo && prevDefault ? nombreTipo(destino) : s.nombre };
    }));

  const cortar = (key: string, despuesDe: number) =>
    setSegs((ss) => ss.flatMap((s) => s.key !== key ? [s] : [{ ...s, end: despuesDe }, { ...s, key: nuevoKey(), start: despuesDe + 1 }]));

  const unir = (idx: number) =>
    setSegs((ss) => {
      if (idx <= 0) return ss;
      const a = ss[idx - 1], b = ss[idx];
      const conf = a.confianza && b.confianza ? (RANK[a.confianza] <= RANK[b.confianza] ? a.confianza : b.confianza) : a.confianza ?? b.confianza;
      const merged = { ...a, end: b.end, confianza: conf };
      return [...ss.slice(0, idx - 1), merged, ...ss.slice(idx + 1)];
    });

  const avisoDuplicado = useMemo(() => {
    const res = new Set<string>();
    const counts = new Map<string, number>();
    segs.forEach((s) => { if (s.docTypeId) counts.set(s.docTypeId, (counts.get(s.docTypeId) || 0) + 1); });
    segs.forEach((s) => {
      if (!s.docTypeId) return;
      const t = docTypes.find((d) => d.id === s.docTypeId);
      if (!t || t.permite_multiples !== false) return;
      if ((counts.get(s.docTypeId) || 0) > 1 || docs.some((d) => d.doc_type_id === s.docTypeId)) res.add(s.key);
    });
    return res;
  }, [segs, docTypes, docs]);

  const guardar = async () => {
    if (!bytes) return;
    if (segs.length === 1 && segs[0].destino === SIN_ASIGNAR && segs[0].start === 1 && segs[0].end === total) {
      onClose();
      return;
    }
    setGuardando(true);
    let guardados = 0, pendientes = 0;
    try {
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      for (const s of segs) {
        if (s.destino === DESCARTAR) continue;
        const out = await PDFDocument.create();
        const idxs = Array.from({ length: s.end - s.start + 1 }, (_, i) => s.start - 1 + i);
        const copied = await out.copyPages(src, idxs);
        copied.forEach((p) => out.addPage(p));
        const pdfBytes = await out.save();
        const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
        if (s.destino === SIN_ASIGNAR) {
          const path = `${creditId}/paquetes/${crypto.randomUUID()}_sin_clasificar_${s.start}-${s.end}.pdf`;
          const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "application/pdf" });
          if (upErr) throw upErr;
          const { error } = await supabase.from("credito_docs_intake").insert({
            credit_request_id: creditId, storage_path: path, nombre_archivo: `Sin clasificar págs ${s.start}-${s.end}.pdf`,
            mime_type: "application/pdf", origen: "segmento", paquete_id: row.paquete_id ?? row.id,
            pagina_inicio: s.start, pagina_fin: s.end, total_paginas: s.end - s.start + 1, estatus: "pendiente",
          } as any);
          if (error) throw error;
          pendientes++;
        } else {
          const nombre = (s.nombre || nombreTipo(s.docTypeId) || "Documento").trim();
          const path = `${creditId}/${crypto.randomUUID()}_${sanear(nombre)}.pdf`;
          const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "application/pdf" });
          if (upErr) throw upErr;
          const { error } = await supabase.from("credit_request_docs").insert({
            credit_request_id: creditId, doc_type_id: s.docTypeId, url_archivo: path, nombre_archivo: `${nombre}.pdf`,
            tipo_archivo: "application/pdf", estado: "recibido", visibilidad: "publica", subido_por: userId,
            subido_por_cliente: row.origen === "paquete_cliente",
            metadata: { fuente: "paquete", paquete_id: row.id, paginas: [s.start, s.end], confianza_ia: s.confianza },
          } as any);
          if (error) throw error;
          guardados++;
        }
      }
      const { error: updErr } = await supabase.from("credito_docs_intake")
        .update({ estatus: "aplicado", clasificado_por: userId, clasificado_at: new Date().toISOString() } as any)
        .eq("id", row.id);
      if (updErr) throw updErr;
      toast.success(`${guardados} documentos guardados, ${pendientes} pendientes`);
      onSaved();
    } catch (e: any) {
      toast.error(`Error al guardar: ${e?.message || e}`);
    } finally {
      setGuardando(false);
    }
  };

  const ocupado = preparando || clasificando || guardando;

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !guardando) onClose(); }}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-violet-50 to-blue-50">
          <DialogTitle>Separar expediente</DialogTitle>
          <DialogDescription className="font-light">{row.nombre_archivo}{total ? ` · ${total} páginas` : ""}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {(preparando || clasificando) && (
            <div className="space-y-2 py-6">
              <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{estado}</div>
              <Progress value={progreso} />
            </div>
          )}

          {!preparando && !clasificando && segs.map((s, idx) => {
            const paginas = Array.from({ length: s.end - s.start + 1 }, (_, i) => s.start + i);
            return (
              <div key={s.key} className="rounded-lg border p-3 space-y-2 bg-background">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Págs. {s.start}–{s.end}</span>
                  {s.confianza && (
                    <Badge variant="outline" className={`text-[10px] uppercase tracking-widest ${CONFIANZA_COLOR[s.confianza] || ""}`}>{s.confianza}</Badge>
                  )}
                  {s.razon && <span className="text-xs text-muted-foreground font-light">{s.razon}</span>}
                  {idx > 0 && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto" onClick={() => unir(idx)}>
                      <Merge className="h-3.5 w-3.5 mr-1" />Unir con el anterior
                    </Button>
                  )}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Destino</div>
                    <Select value={s.destino} onValueChange={(v) => setDestino(s.key, v)}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {docTypes.map((d) => <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>)}
                        <SelectItem value={SIN_ASIGNAR}>Sin asignar (dejar pendiente)</SelectItem>
                        <SelectItem value={DESCARTAR}>Descartar estas páginas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Nombre</div>
                    <Input className="h-8" value={s.nombre} disabled={!s.docTypeId}
                      onChange={(e) => setSegs((ss) => ss.map((x) => x.key === s.key ? { ...x, nombre: e.target.value } : x))} />
                  </div>
                </div>
                {avisoDuplicado.has(s.key) && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    <AlertTriangle className="h-3.5 w-3.5" />Ya existe un documento de este tipo
                  </div>
                )}
                <div className="flex items-start gap-1 overflow-x-auto pb-1">
                  {paginas.map((p, i) => (
                    <div key={p} className="flex items-center gap-1 shrink-0">
                      <button type="button" className="relative w-[130px] border rounded overflow-hidden hover:ring-2 hover:ring-violet-300" onClick={() => setZoom(p)}>
                        {imgs[p - 1] && <img src={imgs[p - 1]} alt={`Página ${p}`} className="w-full h-auto block" />}
                        <span className="absolute bottom-1 right-1 text-[10px] bg-background/90 border rounded px-1">{p}</span>
                      </button>
                      {i < paginas.length - 1 && (
                        <Button size="sm" variant="ghost" className="h-auto px-1 py-2 text-[10px] flex-col" title="Cortar aquí" onClick={() => cortar(s.key, p)}>
                          <Scissors className="h-3.5 w-3.5" /><span>Cortar aquí</span>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="px-6 py-3 border-t bg-muted/40 gap-2">
          {row.origen !== "segmento" && (
            <Button variant="outline" className="mr-auto" disabled={ocupado || imgs.length === 0} onClick={resugerir}>
              <Sparkles className="h-4 w-4 mr-1.5" />Volver a sugerir con IA
            </Button>
          )}
          <Button variant="ghost" disabled={guardando} onClick={onClose}>Cancelar</Button>
          <Button disabled={ocupado || segs.length === 0} onClick={guardar}>
            {guardando && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Guardar documentos
          </Button>
        </DialogFooter>

        {zoom !== null && imgs[zoom - 1] && (
          <div className="fixed inset-0 z-[60] bg-foreground/70 flex items-center justify-center p-6" onClick={() => setZoom(null)}>
            <img src={imgs[zoom - 1]} alt={`Página ${zoom}`} className="max-h-full max-w-full rounded shadow-lg bg-background" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
