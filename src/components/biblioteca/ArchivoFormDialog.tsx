import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Upload } from "lucide-react";

type Categoria = { id: string; nombre: string };
type Archivo = any;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categorias: Categoria[];
  archivo: Archivo | null;
  defaultCategoriaId?: string | null;
  onSaved: () => void;
}

export function ArchivoFormDialog({ open, onOpenChange, categorias, archivo, defaultCategoriaId, onSaved }: Props) {
  const { user } = useAuth();
  const isEdit = !!archivo;
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [marca, setMarca] = useState("na");
  const [estado, setEstado] = useState("vigente");
  const [vigDesde, setVigDesde] = useState("");
  const [vigHasta, setVigHasta] = useState("");
  const [etiquetas, setEtiquetas] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [notasCambio, setNotasCambio] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (archivo) {
      setNombre(archivo.nombre || "");
      setDescripcion(archivo.descripcion || "");
      setCategoriaId(archivo.categoria_id || "");
      setMarca(archivo.marca || "na");
      setEstado(archivo.estado || "vigente");
      setVigDesde(archivo.vigencia_desde || "");
      setVigHasta(archivo.vigencia_hasta || "");
      setEtiquetas((archivo.etiquetas || []).join(", "));
    } else {
      setNombre("");
      setDescripcion("");
      setCategoriaId(defaultCategoriaId || categorias[0]?.id || "");
      setMarca("na");
      setEstado("vigente");
      setVigDesde("");
      setVigHasta("");
      setEtiquetas("");
    }
    setFiles([]);
    setNotasCambio("");
  }, [archivo, open, defaultCategoriaId, categorias]);

  const handleSubmit = async () => {
    if (!nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (!isEdit && files.length === 0) {
      toast.error("Debes seleccionar al menos un archivo para subir");
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      const tags = etiquetas.split(",").map((t) => t.trim()).filter(Boolean);
      const payload = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        categoria_id: categoriaId || null,
        marca,
        estado,
        vigencia_desde: vigDesde || null,
        vigencia_hasta: vigHasta || null,
        etiquetas: tags,
      };

      let archivoId = archivo?.id as string | undefined;
      if (isEdit) {
        const { error } = await supabase.from("biblioteca_archivos" as any).update(payload).eq("id", archivoId!);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("biblioteca_archivos" as any)
          .insert({ ...payload, created_by: user.id })
          .select("id")
          .single();
        if (error) throw error;
        archivoId = (data as any).id;
      }

      // Upload files if provided (multiple supported as sub-archivos)
      if (files.length > 0 && archivoId) {
        // Get next version starting number
        const { data: lastVer } = await supabase
          .from("biblioteca_versiones" as any)
          .select("version")
          .eq("archivo_id", archivoId)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();
        let nextVersion = ((lastVer as any)?.version || 0) + 1;
        let lastInsertedId: string | null = null;

        for (const f of files) {
          const ext = f.name.split(".").pop() || "bin";
          const path = `${archivoId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const { error: upErr } = await supabase.storage.from("biblioteca").upload(path, f, {
            contentType: f.type || undefined,
            upsert: false,
          });
          if (upErr) throw upErr;

          const { data: verData, error: verErr } = await supabase
            .from("biblioteca_versiones" as any)
            .insert({
              archivo_id: archivoId,
              version: nextVersion,
              storage_path: path,
              nombre_archivo: f.name,
              size_bytes: f.size,
              mime_type: f.type || null,
              notas_cambio: notasCambio.trim() || null,
              subido_por: user.id,
            })
            .select("id")
            .single();
          if (verErr) throw verErr;
          lastInsertedId = (verData as any).id;
          nextVersion += 1;
        }

        if (lastInsertedId) {
          await supabase
            .from("biblioteca_archivos" as any)
            .update({ current_version_id: lastInsertedId })
            .eq("id", archivoId);
        }
      }

      toast.success(isEdit ? "Archivo actualizado" : "Archivo creado");
      onSaved();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 bg-gradient-to-r from-violet-50 to-blue-50 border-b">
          <DialogTitle className="text-xl font-light tracking-tight">
            {isEdit ? "Editar archivo" : "Subir archivo a la biblioteca"}
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto font-light">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nombre *</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Lista de Precios Chevron 2026 Q1" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Descripción</Label>
            <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Categoría</Label>
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
              >
                <option value="">— Sin categoría —</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Marca</Label>
              <select
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
              >
                <option value="na">N/A</option>
                <option value="chevron">Chevron</option>
                <option value="phillips66">Phillips 66</option>
                <option value="ambas">Ambas</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Estado</Label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
              >
                <option value="vigente">Vigente</option>
                <option value="obsoleto">Obsoleto</option>
                <option value="archivado">Archivado</option>
              </select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Vigente desde</Label>
              <Input type="date" value={vigDesde} onChange={(e) => setVigDesde(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Vigente hasta</Label>
              <Input type="date" value={vigHasta} onChange={(e) => setVigHasta(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Etiquetas</Label>
            <Input value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)} placeholder="industrial, 2026, q1 (separadas por coma)" />
          </div>

          <div className="border-t pt-5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {isEdit ? "Agregar sub-archivos (opcional)" : "Archivos * (puedes seleccionar varios)"}
            </Label>
            <div className="mt-2 border-2 border-dashed rounded-lg p-6 text-center">
              <input
                type="file"
                id="biblioteca-file"
                className="hidden"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
              />
              <label htmlFor="biblioteca-file" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                {files.length > 0 ? (
                  <div className="space-y-1 text-left max-h-40 overflow-y-auto">
                    <p className="text-xs font-medium text-center text-muted-foreground mb-2">
                      {files.length} archivo{files.length === 1 ? "" : "s"} seleccionado{files.length === 1 ? "" : "s"}
                    </p>
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-muted/40 rounded px-2 py-1">
                        <span className="truncate flex-1">{f.name}</span>
                        <span className="text-muted-foreground ml-2 shrink-0">{(f.size / 1024).toFixed(1)} KB</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Haz clic para seleccionar uno o varios archivos</p>
                )}
              </label>
            </div>
            {isEdit && files.length > 0 && (
              <div className="mt-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Notas del cambio</Label>
                <Input value={notasCambio} onChange={(e) => setNotasCambio(e.target.value)} placeholder="Ej. Actualización de precios Q1" />
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="px-6 py-3 bg-muted/30 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Guardando..." : isEdit ? "Guardar" : "Subir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}