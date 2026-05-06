import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, FileText, Image as ImageIcon, X, Upload, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Props {
  documentoId: string;
  tipoDocumento: string;
}

type ArchivoRow = {
  id: string;
  url_archivo: string;
  nombre_archivo: string;
  tipo_archivo: string;
  fecha_carga: string;
};

function isImage(mime: string) {
  return mime?.startsWith("image/");
}

function FileSection({
  documentoId,
  title,
  table,
  storagePrefix,
  queryKey,
}: {
  documentoId: string;
  title: string;
  table: "documento_orden_compra_archivos" | "documento_acuse_archivos";
  storagePrefix: string;
  queryKey: string;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: files = [] } = useQuery({
    queryKey: [queryKey, documentoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("documento_id", documentoId)
        .order("fecha_carga");
      if (error) throw error;
      return (data || []) as ArchivoRow[];
    },
  });

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar este archivo?")) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) {
      toast.error("Error al eliminar");
      return;
    }
    qc.invalidateQueries({ queryKey: [queryKey, documentoId] });
    toast.success("Archivo eliminado");
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const path = `${storagePrefix}/${documentoId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("documentos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        toast.error(`Error al subir: ${upErr.message}`);
        return;
      }
      const { data: pub } = supabase.storage.from("documentos").getPublicUrl(path);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) {
        toast.error("No se pudo obtener URL");
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      const { error: insErr } = await supabase.from(table).insert({
        documento_id: documentoId,
        url_archivo: publicUrl,
        nombre_archivo: file.name,
        tipo_archivo: file.type,
        usuario_carga: session?.user?.id || null,
      });
      if (insErr) {
        toast.error(`Error al guardar: ${insErr.message}`);
        return;
      }
      qc.invalidateQueries({ queryKey: [queryKey, documentoId] });
      toast.success("Archivo cargado");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-md border p-2">
              {isImage(f.tipo_archivo) ? (
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <FileText className="h-4 w-4 text-muted-foreground" />
              )}
              <a
                href={f.url_archivo}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate text-sm text-primary hover:underline"
              >
                {f.nombre_archivo}
              </a>
              <span className="text-xs text-muted-foreground">
                {format(new Date(f.fecha_carga), "dd/MM/yyyy")}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => handleDelete(f.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-4 text-sm text-muted-foreground hover:bg-muted/50"
      >
        {uploading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Subiendo…</span>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5" />
            <span>Haz clic para subir un archivo (PDF o imagen)</span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>
    </div>
  );
}

function FechaEntregaReal({ documentoId }: { documentoId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["doc_fecha_entrega", documentoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos")
        .select("fecha_entrega_real")
        .eq("id", documentoId)
        .single();
      if (error) throw error;
      return data as { fecha_entrega_real: string | null };
    },
  });

  const [value, setValue] = useState<string>("");
  const seededRef = useRef(false);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (data && !seededRef.current) {
      setValue(data.fecha_entrega_real || "");
      seededRef.current = true;
    }
  }, [data]);

  const onChange = (v: string) => {
    setValue(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const { error } = await supabase
        .from("documentos")
        .update({ fecha_entrega_real: v || null })
        .eq("id", documentoId);
      if (error) {
        toast.error("Error al guardar fecha");
        return;
      }
      qc.invalidateQueries({ queryKey: ["doc_fecha_entrega", documentoId] });
      toast.success("Fecha guardada");
    }, 800);
  };

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">Fecha de Entrega Real</h4>
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Sin registrar"
        className="max-w-xs"
      />
    </div>
  );
}

export function EntregaCorporativaSection({ documentoId, tipoDocumento }: Props) {
  if (tipoDocumento !== "entrega_corporativa") return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="h-5 w-5" />
          Entrega Corporativa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <FileSection
          documentoId={documentoId}
          title="Orden de Compra"
          table="documento_orden_compra_archivos"
          storagePrefix="orden_compra"
          queryKey="oc_archivos"
        />
        <Separator />
        <FileSection
          documentoId={documentoId}
          title="Comprobante Acuse"
          table="documento_acuse_archivos"
          storagePrefix="acuse"
          queryKey="acuse_archivos"
        />
        <Separator />
        <FechaEntregaReal documentoId={documentoId} />
      </CardContent>
    </Card>
  );
}