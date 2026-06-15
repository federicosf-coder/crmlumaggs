import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Paperclip, Upload, Trash2, Eye, Download, FileText, Loader2, FolderOpen } from "lucide-react";
import {
  ALLOWED_ATTACHMENT_MIME, MAX_ATTACHMENT_SIZE, TEMPLATE_ATTACHMENTS_BUCKET,
  TemplateAttachment, getAttachmentPublicUrl, isImageMime, listTemplateAttachments,
} from "@/lib/templates";
import { SelectCatalogDocumentDialog } from "./SelectCatalogDocumentDialog";

interface Props {
  templateId: string | null;
  /** Read-only mode: don't show upload/delete UI. */
  readOnly?: boolean;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function TemplateAttachmentsManager({ templateId, readOnly = false }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [openCatalog, setOpenCatalog] = useState(false);

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ["template-attachments", templateId],
    queryFn: () => (templateId ? listTemplateAttachments(templateId) : Promise.resolve([])),
    enabled: !!templateId,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["template-attachments", templateId] });

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !templateId || !user) return;

    // Validate
    const invalid: string[] = [];
    const tooBig: string[] = [];
    const valid: File[] = [];
    for (const f of Array.from(files)) {
      if (!ALLOWED_ATTACHMENT_MIME.includes(f.type)) { invalid.push(f.name); continue; }
      if (f.size > MAX_ATTACHMENT_SIZE) { tooBig.push(f.name); continue; }
      valid.push(f);
    }
    if (invalid.length) toast.error(`Tipo no permitido: ${invalid.join(", ")}. Solo PDF, JPG, PNG, WEBP.`);
    if (tooBig.length) toast.error(`Archivos > 10MB: ${tooBig.join(", ")}`);
    if (valid.length === 0) return;

    setUploading(true);
    try {
      for (const f of valid) {
        const ext = f.name.split(".").pop()?.toLowerCase() || "bin";
        const key = `${templateId}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from(TEMPLATE_ATTACHMENTS_BUCKET).upload(key, f, {
          contentType: f.type, upsert: false,
        });
        if (up.error) { toast.error(`Error subiendo ${f.name}: ${up.error.message}`); continue; }
        const ins = await (supabase as any).from("template_attachments").insert({
          template_id: templateId,
          file_name: f.name,
          file_path: key,
          mime_type: f.type,
          file_size: f.size,
          uploaded_by: user.id,
        });
        if (ins.error) {
          toast.error(`Error registrando ${f.name}: ${ins.error.message}`);
          // best-effort cleanup
          await supabase.storage.from(TEMPLATE_ATTACHMENTS_BUCKET).remove([key]);
        }
      }
      toast.success("Adjuntos guardados");
      refresh();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (a: TemplateAttachment) => {
    if (!confirm(`¿Eliminar adjunto "${a.file_name}"?`)) return;
    const { error } = await (supabase as any).from("template_attachments").delete().eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    await supabase.storage.from(TEMPLATE_ATTACHMENTS_BUCKET).remove([a.file_path]);
    toast.success("Adjunto eliminado");
    refresh();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <Paperclip className="h-4 w-4" /> Adjuntos de plantilla
        </Label>
        {!readOnly && templateId && (
          <div className="flex gap-2">
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => setOpenCatalog(true)}
              disabled={uploading}
              title="Elegir documentos del catálogo"
            >
              <FolderOpen className="h-4 w-4 mr-1" />
              Catálogo de Documentos
            </Button>
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              Subir archivos
            </Button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {!templateId ? (
        <p className="text-xs text-muted-foreground rounded border border-dashed p-3">
          Guarda la plantilla primero para poder adjuntar archivos.
        </p>
      ) : isLoading ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground rounded border border-dashed p-3">
          Sin adjuntos. Acepta PDF, JPG, PNG, WEBP. Máximo 10 MB por archivo.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {attachments.map((a) => {
            const url = getAttachmentPublicUrl(a.file_path);
            const img = isImageMime(a.mime_type);
            return (
              <div key={a.id} className="rounded border bg-card p-2 flex flex-col gap-2">
                <div className="aspect-video bg-muted rounded overflow-hidden flex items-center justify-center">
                  {img ? (
                    <img src={url} alt={a.file_name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="text-xs">
                  <div className="font-medium truncate" title={a.file_name}>{a.file_name}</div>
                  <div className="text-muted-foreground">{a.mime_type.split("/").pop()?.toUpperCase()} · {formatBytes(a.file_size)}</div>
                </div>
                <div className="flex gap-1">
                  <Button asChild type="button" variant="ghost" size="icon" className="h-7 w-7" title="Ver">
                    <a href={url} target="_blank" rel="noopener noreferrer"><Eye className="h-3.5 w-3.5" /></a>
                  </Button>
                  <Button asChild type="button" variant="ghost" size="icon" className="h-7 w-7" title="Descargar">
                    <a href={url} download={a.file_name}><Download className="h-3.5 w-3.5" /></a>
                  </Button>
                  {!readOnly && (
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 ml-auto"
                      onClick={() => handleDelete(a)} title="Eliminar">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {templateId && (
        <SelectCatalogDocumentDialog
          open={openCatalog}
          onOpenChange={setOpenCatalog}
          templateId={templateId}
          onAttached={refresh}
        />
      )}
    </div>
  );
}