import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase as _supabaseTyped } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _supabaseTyped;
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Camera, Loader2, Trash2, ImageOff } from "lucide-react";
import { format } from "date-fns";
import { readExifCapturedAt } from "@/lib/exifCapturedAt";
import { cn } from "@/lib/utils";

const BUCKET = "visita-evidencias";
const MAX_BYTES = 20 * 1024 * 1024;

interface Evidencia {
  id: string;
  task_id: string;
  storage_path: string;
  file_name: string | null;
  captured_at: string | null;
  created_at: string;
  url?: string;
}

/** "Capturada el 01/09/2026 a las 10:35 AM" — sólo cuando hay EXIF. */
export function formatCapturedAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return `Capturada el ${format(d, "dd/MM/yyyy")} a las ${format(d, "hh:mm a")}`;
}

interface Props {
  taskId: string;
  className?: string;
}

export function VisitaEvidencias({ taskId, className }: Props) {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lightbox, setLightbox] = useState<Evidencia | null>(null);

  const { data: evidencias, isLoading } = useQuery({
    queryKey: ["crm_task_evidencias", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_task_evidencias")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data || []) as Evidencia[];
      const signed = await Promise.all(
        rows.map(async (r) => {
          const { data: s } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(r.storage_path, 60 * 60);
          return { ...r, url: s?.signedUrl as string | undefined };
        })
      );
      return signed;
    },
    enabled: !!taskId,
  });

  const upload = useCallback(
    async (file: File) => {
      if (!session?.user) return;
      if (!file.type.startsWith("image/")) {
        toast({ title: "Archivo no válido", description: "Selecciona una imagen.", variant: "destructive" });
        return;
      }
      if (file.size > MAX_BYTES) {
        toast({ title: "Imagen muy grande", description: "El máximo es 20 MB.", variant: "destructive" });
        return;
      }
      setUploading(true);
      try {
        // Lectura de EXIF: es opcional y nunca bloquea la subida.
        let capturedAt: Date | null = null;
        try {
          capturedAt = await readExifCapturedAt(file);
        } catch {
          capturedAt = null;
        }

        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${taskId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;

        const { error: insErr } = await supabase.from("crm_task_evidencias").insert({
          task_id: taskId,
          user_id: session.user.id,
          storage_path: path,
          file_name: file.name,
          captured_at: capturedAt ? capturedAt.toISOString() : null,
        });
        if (insErr) throw insErr;

        queryClient.invalidateQueries({ queryKey: ["crm_task_evidencias", taskId] });
        toast({
          title: "Evidencia subida",
          description: capturedAt
            ? formatCapturedAt(capturedAt.toISOString()) || undefined
            : "Sin metadatos de fecha de captura.",
        });
      } catch (e: any) {
        toast({ title: "Error al subir", description: e?.message || "Intenta de nuevo.", variant: "destructive" });
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [session?.user, taskId, queryClient, toast]
  );

  const remove = async (ev: Evidencia) => {
    try {
      await supabase.storage.from(BUCKET).remove([ev.storage_path]);
      const { error } = await supabase.from("crm_task_evidencias").delete().eq("id", ev.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["crm_task_evidencias", taskId] });
      toast({ title: "Evidencia eliminada" });
    } catch (e: any) {
      toast({ title: "No se pudo eliminar", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn(
          "rounded-lg border-2 border-dashed p-4 transition-colors text-center",
          dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/20"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="gap-1.5"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          {uploading ? "Subiendo…" : "Subir imagen de evidencia"}
        </Button>
        <p className="mt-1.5 text-[11px] text-muted-foreground font-light">
          Arrastra una foto o haz clic. Si la imagen conserva sus metadatos, se mostrará la fecha y hora de captura.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando evidencias…
        </div>
      ) : (evidencias?.length ?? 0) === 0 ? (
        <p className="text-[11px] text-muted-foreground font-light flex items-center gap-1.5">
          <ImageOff className="h-3.5 w-3.5" /> Aún no hay evidencias de esta visita.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {evidencias!.map((ev) => {
            const caption = formatCapturedAt(ev.captured_at);
            return (
              <figure key={ev.id} className="rounded-lg border overflow-hidden bg-background">
                <button
                  type="button"
                  className="block w-full aspect-[4/3] bg-muted"
                  onClick={() => setLightbox(ev)}
                  title="Ver imagen"
                >
                  {ev.url ? (
                    <img src={ev.url} alt={ev.file_name || "Evidencia de la visita"} className="w-full h-full object-cover" loading="lazy" />
                  ) : null}
                </button>
                <figcaption className="px-2 py-1.5 space-y-1">
                  {caption && (
                    <p className="text-[11px] text-muted-foreground font-light leading-tight">{caption}</p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[10px] text-muted-foreground/80">{ev.file_name}</span>
                    <button
                      type="button"
                      onClick={() => remove(ev)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      title="Eliminar evidencia"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-3xl p-2">
          {lightbox?.url && (
            <img src={lightbox.url} alt={lightbox.file_name || "Evidencia de la visita"} className="w-full h-auto rounded" />
          )}
          {lightbox && formatCapturedAt(lightbox.captured_at) && (
            <p className="text-xs text-muted-foreground font-light px-2 pb-1">
              {formatCapturedAt(lightbox.captured_at)}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
