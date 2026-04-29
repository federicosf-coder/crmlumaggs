import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  value: string | null;
  onChange: (publicUrl: string | null) => void;
  /** Aspect ratio CSS (e.g. "1.91/1" para WhatsApp header). */
  aspectRatio?: string;
  className?: string;
  disabled?: boolean;
}

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ["image/jpeg", "image/jpg", "image/png"];

/**
 * Drag & drop uploader que sube imágenes al bucket público `marketing-promos`
 * y devuelve la URL pública para usarla como header IMAGE en WhatsApp.
 */
export function MarketingPromoUpload({
  value,
  onChange,
  aspectRatio = "1.91/1",
  className,
  disabled,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      if (!ALLOWED.includes(file.type)) {
        toast.error("Solo JPG o PNG");
        return;
      }
      if (file.size > MAX_BYTES) {
        toast.error("La imagen no puede exceder 5 MB");
        return;
      }
      setUploading(true);
      try {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("marketing-promos")
          .upload(path, file, {
            contentType: file.type,
            upsert: false,
            cacheControl: "31536000",
          });
        if (upErr) {
          toast.error(`Error al subir: ${upErr.message}`);
          return;
        }
        // Espera explícita: pedimos la URL pública y validamos que responde.
        const { data: pub } = supabase.storage
          .from("marketing-promos")
          .getPublicUrl(path);
        const publicUrl = pub?.publicUrl;
        if (!publicUrl) {
          toast.error("No se pudo obtener URL pública");
          return;
        }
        // Validar accesibilidad (HEAD) antes de continuar — evita 'URL no encontrada' al enviar.
        try {
          const head = await fetch(publicUrl, { method: "HEAD" });
          if (!head.ok) {
            toast.error("La imagen aún no es accesible. Espera unos segundos e inténtalo de nuevo.");
            return;
          }
        } catch {
          // si HEAD falla por CORS aceptamos la URL — Meta la descargará server-side
        }
        onChange(publicUrl);
        toast.success("Imagen cargada");
      } finally {
        setUploading(false);
      }
    },
    [onChange],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  };

  const remove = () => {
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 border-dashed transition-colors overflow-hidden bg-muted/20",
        dragOver ? "border-primary bg-primary/5" : "border-border",
        disabled && "opacity-60 pointer-events-none",
        className,
      )}
      style={{ aspectRatio }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {value ? (
        <>
          <img src={value} alt="Promo" className="w-full h-full object-cover" />
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="absolute top-2 right-2 h-7 w-7"
            onClick={remove}
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <button
          type="button"
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Subiendo…</span>
            </>
          ) : (
            <>
              <Upload className="h-6 w-6" />
              <span className="font-medium">Arrastra una imagen aquí</span>
              <span className="text-xs">o haz clic para seleccionar (JPG/PNG · máx 5 MB)</span>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />
    </div>
  );
}

export function PromoPlaceholderHint() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <ImageIcon className="h-3.5 w-3.5" />
      <span>WhatsApp recomienda 1.91:1 (1200×628 px) para mejor visualización.</span>
    </div>
  );
}