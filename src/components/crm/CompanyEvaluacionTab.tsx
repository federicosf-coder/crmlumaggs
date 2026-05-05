import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Image as ImageIcon, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type CompProd = {
  id: string;
  company_id: string;
  producto_descripcion: string;
  marca_competencia: string | null;
  precio_actual: number | null;
  volumen_estimado: number | null;
  unidad_volumen: string | null;
  notas: string | null;
  fotos?: { id: string; url_foto: string }[];
};

const POTENCIAL_OPTS = [
  { value: "bajo", label: "Bajo", cls: "bg-slate-100 text-slate-700 border-slate-300" },
  { value: "medio", label: "Medio", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { value: "alto", label: "Alto", cls: "bg-green-50 text-green-700 border-green-200" },
];
const BARRERA_OPTS = [
  { value: "precio", label: "Precio" },
  { value: "relacion_comercial", label: "Relación comercial" },
  { value: "tecnico", label: "Técnico" },
  { value: "desconocida", label: "Desconocida" },
];
const UNIDAD_OPTS = ["litros", "cubetas", "tambos", "piezas"];

interface Props { companyId: string }

export function CompanyEvaluacionTab({ companyId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { session } = useAuth();

  const { data: company } = useQuery({
    queryKey: ["company-evaluacion", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, potencial_cliente, barrera_entrada")
        .eq("id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: productos = [] } = useQuery({
    queryKey: ["company-prod-comp", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_productos_competencia")
        .select("*, fotos:company_productos_competencia_fotos(id, url_foto)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CompProd[];
    },
  });

  const updateCompany = useMutation({
    mutationFn: async (patch: { potencial_cliente?: string; barrera_entrada?: string }) => {
      const { error } = await supabase.from("companies").update(patch).eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-evaluacion", companyId] }),
  });

  const deleteProd = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("company_productos_competencia").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Producto eliminado" });
      qc.invalidateQueries({ queryKey: ["company-prod-comp", companyId] });
    },
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CompProd | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (!companyId) {
    return <p className="text-sm text-muted-foreground">Asigna una empresa al negocio para evaluarla.</p>;
  }

  const potencial = company?.potencial_cliente || "";
  const barrera = company?.barrera_entrada || "";
  const potOpt = POTENCIAL_OPTS.find((p) => p.value === potencial);

  return (
    <div className="space-y-4">
      {/* Header eval fields */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Potencial</Label>
            <div className="flex items-center gap-2">
              <Select value={potencial} onValueChange={(v) => updateCompany.mutate({ potencial_cliente: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {POTENCIAL_OPTS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {potOpt && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${potOpt.cls}`}>{potOpt.label}</span>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Barrera de entrada</Label>
            <Select value={barrera} onValueChange={(v) => updateCompany.mutate({ barrera_entrada: v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {BARRERA_OPTS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Productos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold">Productos actuales del cliente (competencia)</h4>
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Agregar producto
          </Button>
        </div>
        {productos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin productos registrados.</p>
        ) : (
          <div className="space-y-2">
            {productos.map((p) => (
              <Card key={p.id} className="p-3">
                <div className="flex justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{p.producto_descripcion}</p>
                      {p.marca_competencia && (
                        <Badge variant="secondary">{p.marca_competencia}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                      {p.precio_actual != null && <span>Precio: ${Number(p.precio_actual).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>}
                      {p.volumen_estimado != null && <span>Volumen: {p.volumen_estimado} {p.unidad_volumen || ""}</span>}
                    </div>
                    {p.notas && <p className="text-sm mt-1 whitespace-pre-wrap">{p.notas}</p>}
                    {p.fotos && p.fotos.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {p.fotos.slice(0, 3).map((f) => (
                          <button key={f.id} type="button" onClick={() => setLightbox(f.url_foto)}>
                            <img src={f.url_foto} alt="foto" className="h-14 w-14 object-cover rounded border" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setFormOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if (confirm("¿Eliminar producto?")) deleteProd.mutate(p.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ProductoFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        companyId={companyId}
        userId={session?.user?.id || null}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["company-prod-comp", companyId] })}
      />

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-3xl">
          {lightbox && <img src={lightbox} alt="foto" className="w-full h-auto rounded" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductoFormDialog({
  open, onOpenChange, companyId, userId, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyId: string;
  userId: string | null;
  editing: CompProd | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [descripcion, setDescripcion] = useState("");
  const [marca, setMarca] = useState("");
  const [precio, setPrecio] = useState("");
  const [volumen, setVolumen] = useState("");
  const [unidad, setUnidad] = useState("litros");
  const [notas, setNotas] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [existingFotos, setExistingFotos] = useState<{ id: string; url_foto: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // Reset on open
  useState(() => {});
  useQuery({
    queryKey: ["__noop_reset", open, editing?.id],
    queryFn: async () => {
      if (open) {
        setDescripcion(editing?.producto_descripcion || "");
        setMarca(editing?.marca_competencia || "");
        setPrecio(editing?.precio_actual != null ? String(editing.precio_actual) : "");
        setVolumen(editing?.volumen_estimado != null ? String(editing.volumen_estimado) : "");
        setUnidad(editing?.unidad_volumen || "litros");
        setNotas(editing?.notas || "");
        setFiles([]);
        setExistingFotos(editing?.fotos || []);
      }
      return null;
    },
    enabled: open,
  });

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fs = Array.from(e.target.files || []);
    const max = 3 - existingFotos.length;
    setFiles(fs.slice(0, Math.max(0, max)));
  };

  const removeExisting = async (id: string) => {
    await supabase.from("company_productos_competencia_fotos").delete().eq("id", id);
    setExistingFotos((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSave = async () => {
    if (!descripcion.trim()) { toast({ title: "Descripción requerida", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload: any = {
        company_id: companyId,
        producto_descripcion: descripcion.trim(),
        marca_competencia: marca || null,
        precio_actual: precio ? Number(precio) : null,
        volumen_estimado: volumen ? Number(volumen) : null,
        unidad_volumen: unidad || null,
        notas: notas || null,
      };
      let prodId: string;
      if (editing) {
        const { error } = await supabase.from("company_productos_competencia").update(payload).eq("id", editing.id);
        if (error) throw error;
        prodId = editing.id;
      } else {
        payload.created_by = userId;
        const { data, error } = await supabase.from("company_productos_competencia").insert(payload).select("id").single();
        if (error) throw error;
        prodId = data.id;
      }
      // Upload photos
      for (const f of files) {
        const ext = f.name.split(".").pop() || "jpg";
        const path = `${companyId}/${prodId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("company-fotos").upload(path, f, { upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("company-fotos").getPublicUrl(path);
        await supabase.from("company_productos_competencia_fotos").insert({ producto_id: prodId, url_foto: pub.publicUrl });
      }
      toast({ title: editing ? "Producto actualizado" : "Producto agregado" });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar producto" : "Agregar producto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Descripción *</Label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Marca competencia</Label>
              <Input value={marca} onChange={(e) => setMarca(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Precio actual</Label>
              <Input type="number" step="any" value={precio} onChange={(e) => setPrecio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Volumen estimado</Label>
              <Input type="number" step="any" value={volumen} onChange={(e) => setVolumen(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Unidad</Label>
              <Select value={unidad} onValueChange={setUnidad}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIDAD_OPTS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Fotos (máx. 3)</Label>
            {existingFotos.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {existingFotos.map((f) => (
                  <div key={f.id} className="relative">
                    <img src={f.url_foto} alt="" className="h-16 w-16 object-cover rounded border" />
                    <button type="button" className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5" onClick={() => removeExisting(f.id)}>
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {existingFotos.length < 3 && (
              <Input type="file" accept="image/*" multiple onChange={handleFiles} />
            )}
            {files.length > 0 && (
              <p className="text-xs text-muted-foreground">{files.length} archivo(s) listo(s) para subir</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}