import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, MapPin, Tags, BoxesIcon, Pencil, Kanban, Trash2, ChevronDown, ChevronRight, Image, Upload, Loader2, FileText } from "lucide-react";

type ProductOptionType = "marca" | "aplicacion" | "uso" | "formula" | "viscosidad" | "categoria" | "linea";

const OPTION_TYPE_LABELS: Record<ProductOptionType, string> = {
  marca: "Marca", aplicacion: "Aplicación", uso: "Uso", formula: "Fórmula",
  viscosidad: "Viscosidad", categoria: "Categoría", linea: "Línea",
};
const ALL_OPTION_TYPES: ProductOptionType[] = ["marca", "aplicacion", "uso", "formula", "viscosidad", "categoria", "linea"];

const DEFAULT_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#6366f1", "#ec4899", "#14b8a6"];

// ─── Plazas Tab ──────────────────────────────────────────────
function PlazasTab() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["plazas_all"],
    queryFn: async () => { const { data, error } = await supabase.from("plazas").select("*").order("nombre"); if (error) throw error; return data; },
  });
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [editItem, setEditItem] = useState<any>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editActive, setEditActive] = useState(true);

  const add = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("plazas").insert({ nombre }); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["plazas_all"] }); qc.invalidateQueries({ queryKey: ["plazas"] }); setOpen(false); setNombre(""); toast.success("Plaza creada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("plazas").update({ nombre: editNombre, is_active: editActive }).eq("id", editItem.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["plazas_all"] }); qc.invalidateQueries({ queryKey: ["plazas"] }); setEditItem(null); toast.success("Plaza actualizada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (item: any) => { setEditItem(item); setEditNombre(item.nombre); setEditActive(item.is_active); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Plazas</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nueva</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva Plaza</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nombre</Label><Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Monterrey" /></div>
              <Button onClick={() => add.mutate()} disabled={!nombre || add.isPending}>{add.isPending ? "Guardando..." : "Guardar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Activo</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell><Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Sí" : "No"}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
              {items.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sin plazas</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={!!editItem} onOpenChange={v => { if (!v) setEditItem(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Plaza</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre</Label><Input value={editNombre} onChange={e => setEditNombre(e.target.value)} /></div>
            <div className="flex items-center gap-2"><Switch checked={editActive} onCheckedChange={setEditActive} /><Label>Activo</Label></div>
          </div>
          <DialogFooter><Button onClick={() => update.mutate()} disabled={!editNombre || update.isPending}>{update.isPending ? "Guardando..." : "Guardar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Presentaciones Tab ──────────────────────────────────────
function PresentacionesTab() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["presentaciones_all"],
    queryFn: async () => { const { data, error } = await supabase.from("presentaciones").select("*").order("nombre"); if (error) throw error; return data; },
  });
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [unidades, setUnidades] = useState("1");
  const [editItem, setEditItem] = useState<any>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editUnidades, setEditUnidades] = useState("1");
  const [editActive, setEditActive] = useState(true);

  const add = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("presentaciones").insert({ nombre, unidades_equivalentes: Number(unidades) }); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["presentaciones_all"] }); qc.invalidateQueries({ queryKey: ["presentaciones"] }); setOpen(false); setNombre(""); setUnidades("1"); toast.success("Presentación creada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("presentaciones").update({ nombre: editNombre, unidades_equivalentes: Number(editUnidades), is_active: editActive }).eq("id", editItem.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["presentaciones_all"] }); qc.invalidateQueries({ queryKey: ["presentaciones"] }); setEditItem(null); toast.success("Presentación actualizada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (item: any) => { setEditItem(item); setEditNombre(item.nombre); setEditUnidades(String(item.unidades_equivalentes)); setEditActive(item.is_active); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><BoxesIcon className="h-5 w-5" /> Presentaciones</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nueva</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva Presentación</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nombre</Label><Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Cubeta 19L" /></div>
              <div><Label>Unidades Equivalentes</Label><Input type="number" value={unidades} onChange={e => setUnidades(e.target.value)} /></div>
              <Button onClick={() => add.mutate()} disabled={!nombre || add.isPending}>{add.isPending ? "Guardando..." : "Guardar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Uds. Equiv.</TableHead><TableHead>Activo</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell>{p.unidades_equivalentes}</TableCell>
                  <TableCell><Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Sí" : "No"}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
              {items.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sin presentaciones</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={!!editItem} onOpenChange={v => { if (!v) setEditItem(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Presentación</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre</Label><Input value={editNombre} onChange={e => setEditNombre(e.target.value)} /></div>
            <div><Label>Unidades Equivalentes</Label><Input type="number" value={editUnidades} onChange={e => setEditUnidades(e.target.value)} /></div>
            <div className="flex items-center gap-2"><Switch checked={editActive} onCheckedChange={setEditActive} /><Label>Activo</Label></div>
          </div>
          <DialogFooter><Button onClick={() => update.mutate()} disabled={!editNombre || update.isPending}>{update.isPending ? "Guardando..." : "Guardar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Options Tab ─────────────────────────────────────────────
function OptionsTab() {
  const qc = useQueryClient();
  const [selectedType, setSelectedType] = useState<ProductOptionType>("marca");
  const [selectedMarcaId, setSelectedMarcaId] = useState<string>("");

  // Load marcas for the Línea filter
  const { data: marcas = [] } = useQuery({
    queryKey: ["product_option_values", "marca"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_option_values").select("*").eq("option_type", "marca").eq("is_active", true).order("value");
      if (error) throw error; return data;
    },
  });

  const isLinea = selectedType === "linea";

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["product_option_values", selectedType, isLinea ? selectedMarcaId : ""],
    queryFn: async () => {
      let query = supabase.from("product_option_values").select("*, parent:parent_id(id, value)").eq("option_type", selectedType).order("value");
      if (isLinea && selectedMarcaId) {
        query = query.eq("parent_id", selectedMarcaId);
      }
      const { data, error } = await query;
      if (error) throw error; return data;
    },
  });

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [newParentId, setNewParentId] = useState("");
  const [editItem, setEditItem] = useState<any>(null);
  const [editValue, setEditValue] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editParentId, setEditParentId] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const insertData: any = { option_type: selectedType, value };
      if (isLinea && newParentId) insertData.parent_id = newParentId;
      const { error } = await supabase.from("product_option_values").insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["product_option_values"] }); setOpen(false); setValue(""); setNewParentId(""); toast.success("Opción agregada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const updateData: any = { value: editValue, is_active: editActive };
      if (isLinea) updateData.parent_id = editParentId || null;
      const { error } = await supabase.from("product_option_values").update(updateData).eq("id", editItem.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["product_option_values"] }); setEditItem(null); toast.success("Opción actualizada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (item: any) => {
    setEditItem(item);
    setEditValue(item.value);
    setEditActive(item.is_active);
    setEditParentId(item.parent_id || "");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Tags className="h-5 w-5" /> Clasificaciones de Producto</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nueva Opción</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva Opción — {OPTION_TYPE_LABELS[selectedType]}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {isLinea && (
                <div>
                  <Label>Marca *</Label>
                  <Select value={newParentId} onValueChange={setNewParentId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar marca..." /></SelectTrigger>
                    <SelectContent>
                      {marcas.map(m => <SelectItem key={m.id} value={m.id}>{m.value}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div><Label>Valor</Label><Input value={value} onChange={e => setValue(e.target.value)} placeholder={isLinea ? "Ej: Delo, Havoline..." : "Ej: Chevron"} /></div>
              <Button onClick={() => add.mutate()} disabled={!value || (isLinea && !newParentId) || add.isPending}>{add.isPending ? "Guardando..." : "Guardar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {ALL_OPTION_TYPES.map(t => (
            <Button key={t} size="sm" variant={selectedType === t ? "default" : "outline"} onClick={() => { setSelectedType(t); setSelectedMarcaId(""); }}>
              {OPTION_TYPE_LABELS[t]}
            </Button>
          ))}
        </div>

        {isLinea && (
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">Filtrar por Marca:</Label>
            <Select value={selectedMarcaId} onValueChange={setSelectedMarcaId}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Todas las marcas" /></SelectTrigger>
              <SelectContent>
                {marcas.map(m => <SelectItem key={m.id} value={m.id}>{m.value}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedMarcaId && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedMarcaId("")}>Limpiar</Button>
            )}
          </div>
        )}

        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                {isLinea && <TableHead>Marca</TableHead>}
                <TableHead>Valor</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(o => (
                <TableRow key={o.id}>
                  {isLinea && <TableCell className="text-muted-foreground">{(o as any).parent?.value || "—"}</TableCell>}
                  <TableCell className="font-medium">{o.value}</TableCell>
                  <TableCell><Badge variant={o.is_active ? "default" : "secondary"}>{o.is_active ? "Sí" : "No"}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(o)}><Pencil className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
              {items.length === 0 && <TableRow><TableCell colSpan={isLinea ? 4 : 3} className="text-center text-muted-foreground">Sin opciones para {OPTION_TYPE_LABELS[selectedType]}</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={!!editItem} onOpenChange={v => { if (!v) setEditItem(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar {OPTION_TYPE_LABELS[selectedType]}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {isLinea && (
              <div>
                <Label>Marca</Label>
                <Select value={editParentId} onValueChange={setEditParentId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar marca..." /></SelectTrigger>
                  <SelectContent>
                    {marcas.map(m => <SelectItem key={m.id} value={m.id}>{m.value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Valor</Label><Input value={editValue} onChange={e => setEditValue(e.target.value)} /></div>
            <div className="flex items-center gap-2"><Switch checked={editActive} onCheckedChange={setEditActive} /><Label>Activo</Label></div>
          </div>
          <DialogFooter><Button onClick={() => update.mutate()} disabled={!editValue || update.isPending}>{update.isPending ? "Guardando..." : "Guardar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Embudos de Venta Tab ────────────────────────────────────
function EmbudosTab() {
  const qc = useQueryClient();
  const { data: pipelines = [], isLoading } = useQuery({
    queryKey: ["all_pipelines_catalog"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_pipelines").select("*").order("marca").order("nombre");
      if (error) throw error;
      return data;
    },
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: expandedStages = [] } = useQuery({
    queryKey: ["crm_pipeline_stages", expandedId],
    queryFn: async () => {
      if (!expandedId) return [];
      const { data, error } = await supabase.from("crm_pipeline_stages").select("*").eq("pipeline_id", expandedId).order("position");
      if (error) throw error;
      return data;
    },
    enabled: !!expandedId,
  });

  // Edit pipeline name
  const [editPipeline, setEditPipeline] = useState<any>(null);
  const [editNombre, setEditNombre] = useState("");

  const updatePipeline = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("crm_pipelines").update({ nombre: editNombre }).eq("id", editPipeline.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all_pipelines_catalog"] });
      qc.invalidateQueries({ queryKey: ["crm_pipelines"] });
      setEditPipeline(null);
      toast.success("Pipeline actualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Edit stage
  const [editStage, setEditStage] = useState<any>(null);
  const [editStageName, setEditStageName] = useState("");
  const [editStageColor, setEditStageColor] = useState("#3b82f6");

  const updateStage = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("crm_pipeline_stages").update({ name: editStageName, color: editStageColor }).eq("id", editStage.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_pipeline_stages"] });
      setEditStage(null);
      toast.success("Etapa actualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Add stage to existing pipeline
  const [addStageOpen, setAddStageOpen] = useState(false);
  const [addStagePipelineId, setAddStagePipelineId] = useState("");
  const [addStageName, setAddStageName] = useState("");
  const [addStageColor, setAddStageColor] = useState("#3b82f6");

  const addStage = useMutation({
    mutationFn: async () => {
      const maxPos = expandedStages.length > 0 ? Math.max(...expandedStages.map(s => s.position)) + 1 : 0;
      const { error } = await supabase.from("crm_pipeline_stages").insert({
        pipeline_id: addStagePipelineId,
        name: addStageName,
        color: addStageColor,
        position: maxPos,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_pipeline_stages"] });
      setAddStageOpen(false);
      setAddStageName("");
      toast.success("Etapa agregada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openAddStage = (pipelineId: string) => {
    setAddStagePipelineId(pipelineId);
    setAddStageColor(DEFAULT_COLORS[expandedStages.length % DEFAULT_COLORS.length]);
    setAddStageOpen(true);
  };

  // New pipeline
  const [newOpen, setNewOpen] = useState(false);
  const [newNombre, setNewNombre] = useState("");
  const [newMarca, setNewMarca] = useState("chevron");
  const [newStages, setNewStages] = useState([
    { name: "Prospecto", color: "#3b82f6" },
    { name: "Contactado", color: "#8b5cf6" },
    { name: "Propuesta", color: "#f59e0b" },
    { name: "Negociación", color: "#10b981" },
    { name: "Ganado", color: "#22c55e" },
    { name: "Perdido", color: "#ef4444" },
  ]);
  const [creatingPipeline, setCreatingPipeline] = useState(false);

  const handleCreatePipeline = async () => {
    if (!newNombre.trim()) return;
    const validStages = newStages.filter(s => s.name.trim());
    if (validStages.length === 0) { toast.error("Agrega al menos una etapa"); return; }
    setCreatingPipeline(true);
    const { data: newPipeline, error: pErr } = await supabase
      .from("crm_pipelines")
      .insert({ nombre: newNombre, marca: newMarca })
      .select("id")
      .single();
    if (pErr) { toast.error(pErr.message); setCreatingPipeline(false); return; }
    const stageInserts = validStages.map((s, i) => ({ pipeline_id: newPipeline.id, name: s.name, color: s.color, position: i }));
    const { error: sErr } = await supabase.from("crm_pipeline_stages").insert(stageInserts);
    setCreatingPipeline(false);
    if (sErr) { toast.error(sErr.message); return; }
    toast.success("Embudo creado");
    qc.invalidateQueries({ queryKey: ["all_pipelines_catalog"] });
    qc.invalidateQueries({ queryKey: ["crm_pipelines"] });
    setNewOpen(false);
    setNewNombre("");
    setNewStages([
      { name: "Prospecto", color: "#3b82f6" }, { name: "Contactado", color: "#8b5cf6" },
      { name: "Propuesta", color: "#f59e0b" }, { name: "Negociación", color: "#10b981" },
      { name: "Ganado", color: "#22c55e" }, { name: "Perdido", color: "#ef4444" },
    ]);
  };

  const marcaLabel = (m: string) => m === "chevron" ? "Chevron" : m === "phillips66" ? "Phillips 66" : m;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Kanban className="h-5 w-5" /> Embudos de Venta (Pipelines)</CardTitle>
        <Button size="sm" onClick={() => setNewOpen(true)}><Plus className="mr-1 h-4 w-4" /> Nuevo Embudo</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : pipelines.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No hay pipelines. Crea uno con el botón de arriba.</p>
        ) : (
          <div className="space-y-2">
            {pipelines.map((p) => (
              <div key={p.id} className="border rounded-lg">
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                >
                  <div className="flex items-center gap-2">
                    {expandedId === p.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="font-medium">{p.nombre}</span>
                    <Badge variant="outline">{marcaLabel(p.marca)}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditPipeline(p);
                      setEditNombre(p.nombre);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                {expandedId === p.id && (
                  <div className="border-t px-3 pb-3 pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-muted-foreground">Etapas</span>
                      <Button variant="outline" size="sm" onClick={() => openAddStage(p.id)}>
                        <Plus className="h-3 w-3 mr-1" /> Etapa
                      </Button>
                    </div>
                    {expandedStages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin etapas</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Color</TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead className="w-16"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {expandedStages.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell>{s.position + 1}</TableCell>
                              <TableCell>
                                <div className="w-6 h-6 rounded" style={{ backgroundColor: s.color }} />
                              </TableCell>
                              <TableCell className="font-medium">{s.name}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => { setEditStage(s); setEditStageName(s.name); setEditStageColor(s.color); }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Edit pipeline name */}
      <Dialog open={!!editPipeline} onOpenChange={(v) => { if (!v) setEditPipeline(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Pipeline</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre</Label><Input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => updatePipeline.mutate()} disabled={!editNombre || updatePipeline.isPending}>
              {updatePipeline.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit stage */}
      <Dialog open={!!editStage} onOpenChange={(v) => { if (!v) setEditStage(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Etapa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre</Label><Input value={editStageName} onChange={(e) => setEditStageName(e.target.value)} /></div>
            <div className="flex items-center gap-2">
              <Label>Color</Label>
              <input type="color" value={editStageColor} onChange={(e) => setEditStageColor(e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => updateStage.mutate()} disabled={!editStageName || updateStage.isPending}>
              {updateStage.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add stage */}
      <Dialog open={addStageOpen} onOpenChange={setAddStageOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva Etapa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre</Label><Input value={addStageName} onChange={(e) => setAddStageName(e.target.value)} placeholder="Ej: Seguimiento" /></div>
            <div className="flex items-center gap-2">
              <Label>Color</Label>
              <input type="color" value={addStageColor} onChange={(e) => setAddStageColor(e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => addStage.mutate()} disabled={!addStageName || addStage.isPending}>
              {addStage.isPending ? "Guardando..." : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New pipeline */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nuevo Embudo de Venta</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={newNombre} onChange={(e) => setNewNombre(e.target.value)} placeholder="Ej: Prospectos Nuevos" />
            </div>
            <div className="space-y-2">
              <Label>CRM (Marca)</Label>
              <Select value={newMarca} onValueChange={setNewMarca}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="chevron">Chevron</SelectItem>
                  <SelectItem value="phillips66">Phillips 66</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Etapas</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setNewStages(prev => [...prev, { name: "", color: DEFAULT_COLORS[prev.length % DEFAULT_COLORS.length] }])}>
                  <Plus className="h-3 w-3 mr-1" /> Etapa
                </Button>
              </div>
              <div className="space-y-2">
                {newStages.map((stage, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input type="color" value={stage.color} onChange={(e) => setNewStages(prev => prev.map((s, i) => i === idx ? { ...s, color: e.target.value } : s))} className="w-8 h-8 rounded border cursor-pointer flex-shrink-0" />
                    <Input value={stage.name} onChange={(e) => setNewStages(prev => prev.map((s, i) => i === idx ? { ...s, name: e.target.value } : s))} placeholder={`Etapa ${idx + 1}`} className="flex-1" />
                    {newStages.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => setNewStages(prev => prev.filter((_, i) => i !== idx))} className="flex-shrink-0">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreatePipeline} disabled={!newNombre.trim() || newStages.filter(s => s.name.trim()).length === 0 || creatingPipeline}>
              {creatingPipeline ? "Creando..." : "Crear Embudo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Logos Tab ────────────────────────────────────────────────
function LogosTab() {
  const qc = useQueryClient();
  const { data: logos = [], isLoading } = useQuery({
    queryKey: ["brand_logos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brand_logos").select("*").order("label");
      if (error) throw error;
      return data;
    },
  });

  const [uploading, setUploading] = useState<string | null>(null);

  const getPublicUrl = (path: string | null) => {
    if (!path) return null;
    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleUpload = async (logoId: string, logoKey: string, file: File) => {
    setUploading(logoId);
    const ext = file.name.split(".").pop();
    const filePath = `${logoKey}.${ext}`;

    // Upload file (upsert)
    const { error: uploadErr } = await supabase.storage.from("logos").upload(filePath, file, { upsert: true });
    if (uploadErr) {
      toast.error(uploadErr.message);
      setUploading(null);
      return;
    }

    // Update record
    const { error: updateErr } = await supabase.from("brand_logos").update({ storage_path: filePath, updated_at: new Date().toISOString() }).eq("id", logoId);
    if (updateErr) toast.error(updateErr.message);
    else toast.success("Logo actualizado");

    qc.invalidateQueries({ queryKey: ["brand_logos"] });
    setUploading(null);
  };

  // Add new logo entry
  const [addOpen, setAddOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const addLogo = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("brand_logos").insert({ key: newKey.toLowerCase().replace(/\s+/g, "_"), label: newLabel });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brand_logos"] });
      setAddOpen(false);
      setNewKey("");
      setNewLabel("");
      toast.success("Entrada de logo creada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Image className="h-5 w-5" /> Logos</CardTitle>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nuevo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Logo</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Identificador (clave)</Label><Input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="Ej: chevron" /></div>
              <div><Label>Nombre / Etiqueta</Label><Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Ej: Chevron" /></div>
            </div>
            <DialogFooter>
              <Button onClick={() => addLogo.mutate()} disabled={!newKey || !newLabel || addLogo.isPending}>
                {addLogo.isPending ? "Guardando..." : "Crear"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : logos.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No hay logos configurados.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {logos.map((logo) => {
              const url = getPublicUrl(logo.storage_path);
              return (
                <div key={logo.id} className="border rounded-lg p-4 flex flex-col items-center gap-3">
                  <p className="font-medium text-sm">{logo.label}</p>
                  <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-md overflow-hidden">
                    {url ? (
                      <img src={`${url}?t=${logo.updated_at}`} alt={logo.label} className="max-h-full max-w-full object-contain" />
                    ) : (
                      <Image className="h-10 w-10 text-muted-foreground/30" />
                    )}
                  </div>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(logo.id, logo.key, file);
                        e.target.value = "";
                      }}
                    />
                    <div className="flex items-center gap-1 text-sm text-primary hover:underline">
                      {uploading === logo.id ? (
                        <><Loader2 className="h-3 w-3 animate-spin" /> Subiendo...</>
                      ) : (
                        <><Upload className="h-3 w-3" /> {url ? "Cambiar" : "Subir"} logo</>
                      )}
                    </div>
                  </label>
                  <Badge variant="outline" className="text-xs">{logo.key}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function CatalogsManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Catálogos</h1>
        <p className="text-muted-foreground">Administra plazas, presentaciones, clasificaciones, embudos y logos.</p>
      </div>
      <Tabs defaultValue="plazas">
        <TabsList>
          <TabsTrigger value="plazas">Plazas</TabsTrigger>
          <TabsTrigger value="presentaciones">Presentaciones</TabsTrigger>
          <TabsTrigger value="clasificaciones">Clasificaciones</TabsTrigger>
          <TabsTrigger value="embudos">Embudos de Venta</TabsTrigger>
          <TabsTrigger value="logos">Logos</TabsTrigger>
        </TabsList>
        <TabsContent value="plazas"><PlazasTab /></TabsContent>
        <TabsContent value="presentaciones"><PresentacionesTab /></TabsContent>
        <TabsContent value="clasificaciones"><OptionsTab /></TabsContent>
        <TabsContent value="embudos"><EmbudosTab /></TabsContent>
        <TabsContent value="logos"><LogosTab /></TabsContent>
      </Tabs>
    </div>
  );
}
