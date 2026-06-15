import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileText, Pencil, Plus, Trash2, Upload, Eye, Download, Loader2 } from "lucide-react";
import {
  TEMPLATE_DOCUMENT_CATALOG_BUCKET,
  ALLOWED_CATALOG_MIME,
  MAX_CATALOG_FILE_SIZE,
  listTemplateDocumentCatalog,
  openTemplateDocumentCatalogSignedUrl,
  type TemplateCatalogDocument,
} from "@/lib/templateDocumentCatalog";

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentosPlantillaCatalogoTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["template-document-catalog"],
    queryFn: listTemplateDocumentCatalog,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["template-document-catalog"] });

  // Create
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const resetCreate = () => { setName(""); setDescription(""); setFile(null); if (fileRef.current) fileRef.current.value = ""; };

  const handleCreate = async () => {
    if (!user || !name.trim() || !file) return;
    if (file.size > MAX_CATALOG_FILE_SIZE) { toast.error("Archivo > 25 MB"); return; }
    setSaving(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const key = `${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from(TEMPLATE_DOCUMENT_CATALOG_BUCKET).upload(key, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (up.error) { toast.error(up.error.message); return; }
      const ins = await (supabase as any).from("template_document_catalog").insert({
        name: name.trim(),
        description: description.trim() || null,
        file_path: key,
        file_name: file.name,
        mime_type: file.type || "application/octet-stream",
        file_size: file.size,
        created_by: user.id,
      });
      if (ins.error) {
        toast.error(ins.error.message);
        await supabase.storage.from(TEMPLATE_DOCUMENT_CATALOG_BUCKET).remove([key]);
        return;
      }
      toast.success("Documento agregado al catálogo");
      setOpen(false);
      resetCreate();
      refresh();
    } finally { setSaving(false); }
  };

  // Edit
  const [editItem, setEditItem] = useState<TemplateCatalogDocument | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const openEdit = (it: TemplateCatalogDocument) => {
    setEditItem(it);
    setEditName(it.name);
    setEditDescription(it.description || "");
    setEditActive(it.is_active);
    setEditFile(null);
    if (editFileRef.current) editFileRef.current.value = "";
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    setEditSaving(true);
    try {
      const update: any = {
        name: editName.trim(),
        description: editDescription.trim() || null,
        is_active: editActive,
      };
      if (editFile) {
        if (editFile.size > MAX_CATALOG_FILE_SIZE) { toast.error("Archivo > 25 MB"); setEditSaving(false); return; }
        const ext = editFile.name.split(".").pop()?.toLowerCase() || "bin";
        const key = `${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from(TEMPLATE_DOCUMENT_CATALOG_BUCKET).upload(key, editFile, {
          contentType: editFile.type || "application/octet-stream", upsert: false,
        });
        if (up.error) { toast.error(up.error.message); return; }
        update.file_path = key;
        update.file_name = editFile.name;
        update.mime_type = editFile.type || "application/octet-stream";
        update.file_size = editFile.size;
      }
      const { error } = await (supabase as any).from("template_document_catalog").update(update).eq("id", editItem.id);
      if (error) { toast.error(error.message); return; }
      if (editFile && editItem.file_path) {
        await supabase.storage.from(TEMPLATE_DOCUMENT_CATALOG_BUCKET).remove([editItem.file_path]);
      }
      toast.success("Documento actualizado");
      setEditItem(null);
      refresh();
    } finally { setEditSaving(false); }
  };

  const handleDelete = async (it: TemplateCatalogDocument) => {
    if (!confirm(`¿Eliminar "${it.name}" del catálogo?`)) return;
    const { error } = await (supabase as any).from("template_document_catalog").delete().eq("id", it.id);
    if (error) { toast.error(error.message); return; }
    await supabase.storage.from(TEMPLATE_DOCUMENT_CATALOG_BUCKET).remove([it.file_path]);
    toast.success("Documento eliminado");
    refresh();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Documentos para Plantillas</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" /> Nuevo</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Archivo</TableHead>
                <TableHead>Tamaño</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead className="w-28 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>
                    <div className="font-medium">{it.name}</div>
                    {it.description && <div className="text-xs text-muted-foreground">{it.description}</div>}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="truncate max-w-[260px]" title={it.file_name}>{it.file_name}</div>
                    <div className="text-muted-foreground">{it.mime_type}</div>
                  </TableCell>
                  <TableCell className="text-xs">{formatBytes(it.file_size)}</TableCell>
                  <TableCell><Badge variant={it.is_active ? "default" : "secondary"}>{it.is_active ? "Sí" : "No"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" title="Ver / Descargar" onClick={() => openTemplateDocumentCatalogSignedUrl(it.file_path)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(it)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Eliminar" onClick={() => handleDelete(it)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin documentos</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetCreate(); }}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-r from-violet-50 to-blue-50 border-b">
            <DialogTitle className="font-light">Nuevo Documento</DialogTitle>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
              Acepta PDF, Word, Excel, PowerPoint, imágenes. Máx. 25 MB.
            </p>
          </DialogHeader>
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nombre *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Catálogo Chevron 2026" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Descripción</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Archivo *</Label>
              <Input ref={fileRef} type="file" accept={ALLOWED_CATALOG_MIME.join(",")} onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {file && <div className="text-xs text-muted-foreground">{file.name} · {formatBytes(file.size)}</div>}
            </div>
          </div>
          <DialogFooter className="px-6 py-3 border-t bg-muted/40">
            <Button variant="ghost" onClick={() => { setOpen(false); resetCreate(); }} disabled={saving}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!name.trim() || !file || saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editItem} onOpenChange={(v) => { if (!v) setEditItem(null); }}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-r from-violet-50 to-blue-50 border-b">
            <DialogTitle className="font-light">Editar Documento</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nombre</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Descripción</Label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editActive} onCheckedChange={setEditActive} />
              <Label>Activo</Label>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Reemplazar archivo (opcional)</Label>
              <Input ref={editFileRef} type="file" accept={ALLOWED_CATALOG_MIME.join(",")} onChange={(e) => setEditFile(e.target.files?.[0] || null)} />
              {!editFile && editItem && (
                <div className="text-xs text-muted-foreground">Actual: {editItem.file_name} · {formatBytes(editItem.file_size)}</div>
              )}
              {editFile && <div className="text-xs text-muted-foreground">Nuevo: {editFile.name} · {formatBytes(editFile.size)}</div>}
            </div>
          </div>
          <DialogFooter className="px-6 py-3 border-t bg-muted/40">
            <Button variant="ghost" onClick={() => setEditItem(null)} disabled={editSaving}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={!editName.trim() || editSaving}>
              {editSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}