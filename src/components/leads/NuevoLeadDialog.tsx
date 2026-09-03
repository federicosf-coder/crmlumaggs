import { useRef, useState } from "react";
import { Camera, ImageIcon, Loader2, Plus, Sparkles } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const MANUAL_SOURCE_ID = "7d615fa2-be2a-4e13-bcc3-e49452b7865e";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface FormState {
  nombre: string;
  empresa: string;
  telefono: string;
  email: string;
  notas: string;
}

const EMPTY: FormState = { nombre: "", empresa: "", telefono: "", email: "", notas: "" };

export function NuevoLeadDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState("manual");
  const [manual, setManual] = useState<FormState>(EMPTY);
  const [foto, setFoto] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const [preview, setPreview] = useState<string | null>(null);
  const [fotoPath, setFotoPath] = useState<string | null>(null);
  const [extraccion, setExtraccion] = useState<any>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [analizando, setAnalizando] = useState(false);

  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setManual(EMPTY); setFoto(EMPTY); setPreview(null); setFotoPath(null);
    setExtraccion(null); setSubiendo(false); setAnalizando(false); setTab("manual");
  };

  const close = () => { reset(); onOpenChange(false); };

  const guardar = async (form: FormState, payload?: Record<string, unknown>) => {
    if (!form.nombre.trim()) { toast.error("El nombre es obligatorio"); return; }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("leads").insert({
        source_id: MANUAL_SOURCE_ID,
        estatus: "nuevo",
        responsable_id: userData?.user?.id ?? null,
        nombre: form.nombre.trim(),
        empresa_nombre: form.empresa.trim() || null,
        telefono: form.telefono.trim() || null,
        email: form.email.trim() || null,
        mensaje: form.notas.trim() || null,
        ...(payload ? { payload } : {}),
      });
      if (error) throw error;
      toast.success("Prospecto creado");
      qc.invalidateQueries({ queryKey: ["leads"] });
      close();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar el prospecto");
    } finally {
      setSaving(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setExtraccion(null);
    setFotoPath(null);
    setSubiendo(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("Sesión no válida");
      const safeName = file.name.replace(/[^\w.\-]/g, "_");
      const path = `${uid}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("leads-fotos").upload(path, file, {
        contentType: file.type || "image/jpeg",
      });
      if (upErr) throw upErr;
      setFotoPath(path);
      setSubiendo(false);

      setAnalizando(true);
      const { data, error } = await supabase.functions.invoke("lead-foto-extract", {
        body: { file_path: path },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const ex = (data as any)?.extracted ?? {};
      setExtraccion(ex);
      setFoto({
        nombre: ex.nombre_contacto ?? "",
        empresa: ex.empresa_nombre ?? "",
        telefono: ex.telefono ?? "",
        email: "",
        notas: [ex.giro_negocio, ex.notas].filter(Boolean).join(" — "),
      });
      toast.success("Datos extraídos de la imagen");
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo procesar la imagen");
    } finally {
      setSubiendo(false);
      setAnalizando(false);
    }
  };


  const renderCampos = (value: FormState, onChange: (v: FormState) => void) => (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Nombre *</Label>
        <Input value={value.nombre} onChange={(e) => onChange({ ...value, nombre: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Empresa</Label>
        <Input value={value.empresa} onChange={(e) => onChange({ ...value, empresa: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Teléfono</Label>
        <Input value={value.telefono} onChange={(e) => onChange({ ...value, telefono: e.target.value })} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Email</Label>
        <Input type="email" value={value.email} onChange={(e) => onChange({ ...value, email: e.target.value })} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Notas</Label>
        <Textarea rows={3} value={value.notas} onChange={(e) => onChange({ ...value, notas: e.target.value })} />
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-xl p-0 overflow-hidden">
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 px-6 py-4 space-y-1">
          <DialogTitle className="text-lg font-light flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nuevo prospecto
          </DialogTitle>
          <DialogDescription className="text-xs">
            Captura manual o desde una foto tomada en campo.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 max-h-[65vh] overflow-y-auto font-light">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="manual">Manual</TabsTrigger>
              <TabsTrigger value="foto">Foto</TabsTrigger>
            </TabsList>

            <TabsContent value="manual">
              {renderCampos(manual, setManual)}
            </TabsContent>

            <TabsContent value="foto" className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => camRef.current?.click()} disabled={subiendo || analizando}>
                  <Camera className="h-4 w-4 mr-1" /> Tomar foto
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={subiendo || analizando}>
                  <ImageIcon className="h-4 w-4 mr-1" /> Subir imagen
                </Button>
                <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
              </div>

              {preview && (
                <img src={preview} alt="Foto del prospecto" className="max-h-56 rounded-md border object-contain" />
              )}

              {(subiendo || analizando) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {subiendo ? "Subiendo imagen..." : "Analizando con IA..."}
                </div>
              )}

              {extraccion && (
                <div className="flex items-center gap-2 text-xs text-violet-700">
                  <Sparkles className="h-3.5 w-3.5" /> Revisa y corrige los datos antes de guardar.
                </div>
              )}

              {(extraccion || fotoPath) && renderCampos(foto, setFoto)}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="bg-muted/40 px-6 py-3 border-t">
          <Button variant="outline" onClick={close} disabled={saving}>Cancelar</Button>
          <Button
            onClick={() =>
              tab === "manual"
                ? guardar(manual)
                : guardar(foto, { foto_path: fotoPath, extraccion_ia: extraccion })
            }
            disabled={saving || subiendo || analizando}
          >
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Guardar prospecto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
