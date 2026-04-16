import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, MapPin, Tags, BoxesIcon, Pencil, Kanban, Trash2, ChevronDown, ChevronRight, Image, Upload, Loader2, FileText, Building2, Truck, User, Mail } from "lucide-react";
import { EmailGroupsTab } from "@/components/admin/EmailGroupsTab";
import { SystemSettingsTab } from "@/components/admin/SystemSettingsTab";

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

// ─── Condiciones Comerciales Tab ─────────────────────────────
const EMPRESA_LABELS: Record<string, string> = {
  lumaggs_chevron: "Lumaggs (Chevron)",
  galsa_phillips66: "Galsa (Phillips 66)",
};

function CondicionesTab() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["condiciones_comerciales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("condiciones_comerciales").select("*").order("empresa_vendedora");
      if (error) throw error;
      return data;
    },
  });

  const [editItem, setEditItem] = useState<any>(null);
  const [editContenido, setEditContenido] = useState("");

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("condiciones_comerciales").update({ contenido: editContenido }).eq("id", editItem.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["condiciones_comerciales"] });
      setEditItem(null);
      toast.success("Condiciones actualizadas");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (item: any) => {
    setEditItem(item);
    setEditContenido(item.contenido || "");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Condiciones Comerciales</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{EMPRESA_LABELS[item.empresa_vendedora] || item.empresa_vendedora}</h3>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {item.contenido || <span className="italic">Sin condiciones configuradas</span>}
                </p>
              </div>
            ))}
            {items.length === 0 && <p className="text-center text-muted-foreground">Sin condiciones configuradas</p>}
          </div>
        )}
      </CardContent>
      <Dialog open={!!editItem} onOpenChange={v => { if (!v) setEditItem(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Condiciones — {editItem ? (EMPRESA_LABELS[editItem.empresa_vendedora] || editItem.empresa_vendedora) : ""}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Condiciones Comerciales</Label>
              <Textarea
                value={editContenido}
                onChange={e => setEditContenido(e.target.value)}
                placeholder="Ingresa las condiciones comerciales..."
                rows={10}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => update.mutate()} disabled={update.isPending}>
              {update.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Marcas por Empresa Tab ──────────────────────────────────
function EmpresaMarcasTab() {
  const qc = useQueryClient();
  const EMPRESAS: { v: "lumaggs_chevron" | "galsa_phillips66"; l: string }[] = [
    { v: "lumaggs_chevron", l: "Lumaggs (Chevron)" },
    { v: "galsa_phillips66", l: "Galsa (Phillips 66)" },
  ];

  const { data: marcas = [] } = useQuery({
    queryKey: ["option_marcas"],
    queryFn: async () => {
      const { data } = await supabase.from("product_option_values").select("id, value").eq("option_type", "marca").eq("is_active", true).order("value");
      return data || [];
    },
  });

  const { data: asignaciones = [], isLoading } = useQuery({
    queryKey: ["empresa_marcas"],
    queryFn: async () => {
      const { data } = await supabase.from("empresa_marcas").select("*, product_option_values(value)");
      return data || [];
    },
  });

  const [selectedEmpresa, setSelectedEmpresa] = useState<string>("lumaggs_chevron");
  const [selectedMarca, setSelectedMarca] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("empresa_marcas").insert({ empresa_vendedora: selectedEmpresa as any, marca_id: selectedMarca });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["empresa_marcas"] }); setSelectedMarca(""); toast.success("Marca asignada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("empresa_marcas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["empresa_marcas"] }); toast.success("Marca removida"); },
    onError: (e: any) => toast.error(e.message),
  });

  const marcasAsignadas = asignaciones.filter((a: any) => a.empresa_vendedora === selectedEmpresa);
  const marcasDisponibles = marcas.filter((m: any) => !marcasAsignadas.some((a: any) => a.marca_id === m.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Marcas por Empresa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {EMPRESAS.map(e => (
            <Button key={e.v} variant={selectedEmpresa === e.v ? "default" : "outline"} size="sm" onClick={() => setSelectedEmpresa(e.v)}>
              {e.l}
            </Button>
          ))}
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label>Agregar Marca</Label>
            <Select value={selectedMarca} onValueChange={setSelectedMarca}>
              <SelectTrigger><SelectValue placeholder="Seleccionar marca..." /></SelectTrigger>
              <SelectContent>{marcasDisponibles.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.value}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={() => add.mutate()} disabled={!selectedMarca || add.isPending} size="sm"><Plus className="mr-1 h-4 w-4" /> Asignar</Button>
        </div>

        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Marca</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
            <TableBody>
              {marcasAsignadas.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Sin marcas asignadas</TableCell></TableRow>
              ) : marcasAsignadas.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{(a.product_option_values as any)?.value || "—"}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => remove.mutate(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Vehiculos Tab ───────────────────────────────────────────
function VehiculosTab() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["vehiculos_all"],
    queryFn: async () => { const { data, error } = await supabase.from("vehiculos").select("*").order("nombre"); if (error) throw error; return data; },
  });
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [placas, setPlacas] = useState("");
  const [tipo, setTipo] = useState("");
  const [editItem, setEditItem] = useState<any>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editPlacas, setEditPlacas] = useState("");
  const [editTipo, setEditTipo] = useState("");
  const [editActive, setEditActive] = useState(true);

  const add = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("vehiculos").insert({ nombre, placas: placas || null, tipo: tipo || null }); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehiculos_all"] }); setOpen(false); setNombre(""); setPlacas(""); setTipo(""); toast.success("Vehículo creado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vehiculos").update({ nombre: editNombre, placas: editPlacas || null, tipo: editTipo || null, is_active: editActive }).eq("id", editItem.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehiculos_all"] }); setEditItem(null); toast.success("Vehículo actualizado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (item: any) => { setEditItem(item); setEditNombre(item.nombre); setEditPlacas(item.placas || ""); setEditTipo(item.tipo || ""); setEditActive(item.is_active); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Vehículos</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nuevo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Vehículo</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nombre *</Label><Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Camioneta 1" /></div>
              <div><Label>Placas</Label><Input value={placas} onChange={e => setPlacas(e.target.value)} placeholder="Ej: ABC-123" /></div>
              <div><Label>Tipo</Label><Input value={tipo} onChange={e => setTipo(e.target.value)} placeholder="Ej: Camioneta, Camión" /></div>
              <Button onClick={() => add.mutate()} disabled={!nombre || add.isPending}>{add.isPending ? "Guardando..." : "Guardar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Placas</TableHead><TableHead>Tipo</TableHead><TableHead>Activo</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map(v => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.nombre}</TableCell>
                  <TableCell>{v.placas || "—"}</TableCell>
                  <TableCell>{v.tipo || "—"}</TableCell>
                  <TableCell><Badge variant={v.is_active ? "default" : "secondary"}>{v.is_active ? "Sí" : "No"}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
              {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin vehículos</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={!!editItem} onOpenChange={v => { if (!v) setEditItem(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Vehículo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre</Label><Input value={editNombre} onChange={e => setEditNombre(e.target.value)} /></div>
            <div><Label>Placas</Label><Input value={editPlacas} onChange={e => setEditPlacas(e.target.value)} /></div>
            <div><Label>Tipo</Label><Input value={editTipo} onChange={e => setEditTipo(e.target.value)} /></div>
            <div className="flex items-center gap-2"><Switch checked={editActive} onCheckedChange={setEditActive} /><Label>Activo</Label></div>
          </div>
          <DialogFooter><Button onClick={() => update.mutate()} disabled={!editNombre || update.isPending}>{update.isPending ? "Guardando..." : "Guardar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Repartidores Tab ────────────────────────────────────────
function RepartidoresTab() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["repartidores_all"],
    queryFn: async () => { const { data, error } = await supabase.from("repartidores").select("*").order("nombre"); if (error) throw error; return data; },
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_for_repartidores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, full_name, email").eq("is_active", true).order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [licencia, setLicencia] = useState("");
  const [editItem, setEditItem] = useState<any>(null);
  const [editUserId, setEditUserId] = useState<string>("");
  const [editNombre, setEditNombre] = useState("");
  const [editTelefono, setEditTelefono] = useState("");
  const [editLicencia, setEditLicencia] = useState("");
  const [editActive, setEditActive] = useState(true);

  const usedUserIds = new Set(items.map((r: any) => r.user_id).filter(Boolean));
  const availableProfilesNew = profiles.filter((p: any) => !usedUserIds.has(p.user_id));
  const availableProfilesEdit = profiles.filter((p: any) => !usedUserIds.has(p.user_id) || p.user_id === editItem?.user_id);

  const profileLabel = (p: any) => p.full_name?.trim() ? `${p.full_name} (${p.email || "sin correo"})` : (p.email || p.user_id);
  const profileById = (uid: string) => profiles.find((p: any) => p.user_id === uid);

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("repartidores").insert({
        nombre,
        telefono: telefono || null,
        licencia: licencia || null,
        user_id: userId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["repartidores_all"] });
      setOpen(false); setUserId(""); setNombre(""); setTelefono(""); setLicencia("");
      toast.success("Repartidor creado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("repartidores").update({
        nombre: editNombre,
        telefono: editTelefono || null,
        licencia: editLicencia || null,
        is_active: editActive,
        user_id: editUserId || null,
      }).eq("id", editItem.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["repartidores_all"] }); setEditItem(null); toast.success("Repartidor actualizado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (item: any) => {
    setEditItem(item);
    setEditUserId(item.user_id || "");
    setEditNombre(item.nombre);
    setEditTelefono(item.telefono || "");
    setEditLicencia(item.licencia || "");
    setEditActive(item.is_active);
  };

  const handlePickUserNew = (uid: string) => {
    setUserId(uid);
    const p = profileById(uid);
    if (p && !nombre) setNombre(p.full_name || p.email || "");
  };

  const handlePickUserEdit = (uid: string) => {
    setEditUserId(uid);
    const p = profileById(uid);
    if (p && (!editNombre || editNombre === editItem?.nombre)) setEditNombre(p.full_name || p.email || editNombre);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Repartidores</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nuevo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo Repartidor</DialogTitle>
              <DialogDescription>Vincula un usuario registrado. Se le asignará automáticamente el rol Delivery.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Usuario *</Label>
                <Select value={userId} onValueChange={handlePickUserNew}>
                  <SelectTrigger><SelectValue placeholder="Selecciona un usuario" /></SelectTrigger>
                  <SelectContent>
                    {availableProfilesNew.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">No hay usuarios disponibles</div>}
                    {availableProfilesNew.map((p: any) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{profileLabel(p)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Nombre a mostrar *</Label><Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Juan López" /></div>
              <div><Label>Teléfono</Label><Input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej: 55 1234 5678" /></div>
              <div><Label>Licencia</Label><Input value={licencia} onChange={e => setLicencia(e.target.value)} placeholder="Ej: LIC-12345" /></div>
              <Button onClick={() => add.mutate()} disabled={!nombre || !userId || add.isPending}>{add.isPending ? "Guardando..." : "Guardar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Usuario</TableHead><TableHead>Teléfono</TableHead><TableHead>Licencia</TableHead><TableHead>Activo</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map((r: any) => {
                const p = r.user_id ? profileById(r.user_id) : null;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.nombre}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p ? (p.email || p.full_name) : <Badge variant="outline">Sin usuario</Badge>}</TableCell>
                    <TableCell>{r.telefono || "—"}</TableCell>
                    <TableCell>{r.licencia || "—"}</TableCell>
                    <TableCell><Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Sí" : "No"}</Badge></TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                );
              })}
              {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin repartidores</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={!!editItem} onOpenChange={v => { if (!v) setEditItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Repartidor</DialogTitle>
            <DialogDescription>Vincula o cambia el usuario asociado a este repartidor.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Usuario</Label>
              <Select value={editUserId || "__none__"} onValueChange={(v) => handlePickUserEdit(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Sin usuario vinculado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin usuario vinculado</SelectItem>
                  {availableProfilesEdit.map((p: any) => (
                    <SelectItem key={p.user_id} value={p.user_id}>{profileLabel(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Nombre</Label><Input value={editNombre} onChange={e => setEditNombre(e.target.value)} /></div>
            <div><Label>Teléfono</Label><Input value={editTelefono} onChange={e => setEditTelefono(e.target.value)} /></div>
            <div><Label>Licencia</Label><Input value={editLicencia} onChange={e => setEditLicencia(e.target.value)} /></div>
            <div className="flex items-center gap-2"><Switch checked={editActive} onCheckedChange={setEditActive} /><Label>Activo</Label></div>
          </div>
          <DialogFooter><Button onClick={() => update.mutate()} disabled={!editNombre || update.isPending}>{update.isPending ? "Guardando..." : "Guardar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Tipos de Dirección ──────────────────────────────────────
function TiposDireccionTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [clave, setClave] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [editItem, setEditItem] = useState<any>(null);
  const [editClave, setEditClave] = useState("");
  const [editEtiqueta, setEditEtiqueta] = useState("");
  const [editActive, setEditActive] = useState(true);

  const { data = [], isLoading } = useQuery({
    queryKey: ["tipos_direccion_all"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("tipos_direccion").select("*").order("etiqueta");
      return data || [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from as any)("tipos_direccion").insert({
        clave: clave.trim().toLowerCase(),
        etiqueta: etiqueta.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tipos_direccion_all"] });
      qc.invalidateQueries({ queryKey: ["tipos_direccion_catalog"] });
      setOpen(false); setClave(""); setEtiqueta(""); toast.success("Tipo creado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from as any)("tipos_direccion")
        .update({ clave: editClave.trim().toLowerCase(), etiqueta: editEtiqueta.trim(), is_active: editActive })
        .eq("id", editItem.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tipos_direccion_all"] });
      qc.invalidateQueries({ queryKey: ["tipos_direccion_catalog"] });
      setEditItem(null); toast.success("Tipo actualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)("tipos_direccion").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tipos_direccion_all"] });
      qc.invalidateQueries({ queryKey: ["tipos_direccion_catalog"] });
      toast.success("Tipo eliminado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (item: any) => {
    setEditItem(item); setEditClave(item.clave); setEditEtiqueta(item.etiqueta); setEditActive(item.is_active);
  };

  return (
    <Card>
      <CardHeader className="flex-row justify-between items-center">
        <CardTitle>Tipos de Dirección</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Nuevo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Tipo de Dirección</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Clave (sin espacios)</Label><Input value={clave} onChange={e => setClave(e.target.value)} placeholder="Ej: bodega" /></div>
              <div><Label>Etiqueta</Label><Input value={etiqueta} onChange={e => setEtiqueta(e.target.value)} placeholder="Ej: Bodega" /></div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={!clave || !etiqueta || create.isPending}>{create.isPending ? "Creando..." : "Crear"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Cargando...</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Clave</TableHead><TableHead>Etiqueta</TableHead><TableHead>Activo</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.clave}</TableCell>
                  <TableCell>{t.etiqueta}</TableCell>
                  <TableCell>{t.is_active ? "Sí" : "No"}</TableCell>
                  <TableCell className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm(`¿Eliminar "${t.etiqueta}"?`)) remove.mutate(t.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!editItem} onOpenChange={v => !v && setEditItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Tipo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Clave</Label><Input value={editClave} onChange={e => setEditClave(e.target.value)} /></div>
            <div><Label>Etiqueta</Label><Input value={editEtiqueta} onChange={e => setEditEtiqueta(e.target.value)} /></div>
            <div className="flex items-center gap-2"><Switch checked={editActive} onCheckedChange={setEditActive} /><Label>Activo</Label></div>
          </div>
          <DialogFooter><Button onClick={() => update.mutate()} disabled={!editClave || !editEtiqueta || update.isPending}>{update.isPending ? "Guardando..." : "Guardar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function CatalogsManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Catálogos</h1>
        <p className="text-muted-foreground">Administra plazas, presentaciones, clasificaciones, embudos, logos, condiciones, marcas por empresa, vehículos, repartidores y tipos de dirección.</p>
      </div>
      <Tabs defaultValue="plazas">
        <TabsList className="flex-wrap">
          <TabsTrigger value="plazas">Plazas</TabsTrigger>
          <TabsTrigger value="presentaciones">Presentaciones</TabsTrigger>
          <TabsTrigger value="clasificaciones">Clasificaciones</TabsTrigger>
          <TabsTrigger value="embudos">Embudos de Venta</TabsTrigger>
          <TabsTrigger value="logos">Logos</TabsTrigger>
          <TabsTrigger value="condiciones">Condiciones</TabsTrigger>
          <TabsTrigger value="empresa_marcas">Marcas por Empresa</TabsTrigger>
          <TabsTrigger value="vehiculos">Vehículos</TabsTrigger>
          <TabsTrigger value="repartidores">Repartidores</TabsTrigger>
          <TabsTrigger value="tipos_direccion">Tipos de Dirección</TabsTrigger>
          <TabsTrigger value="email_groups">Grupos de Correo</TabsTrigger>
          <TabsTrigger value="system_settings">Parámetros</TabsTrigger>
        </TabsList>
        <TabsContent value="plazas"><PlazasTab /></TabsContent>
        <TabsContent value="presentaciones"><PresentacionesTab /></TabsContent>
        <TabsContent value="clasificaciones"><OptionsTab /></TabsContent>
        <TabsContent value="embudos"><EmbudosTab /></TabsContent>
        <TabsContent value="logos"><LogosTab /></TabsContent>
        <TabsContent value="condiciones"><CondicionesTab /></TabsContent>
        <TabsContent value="empresa_marcas"><EmpresaMarcasTab /></TabsContent>
        <TabsContent value="vehiculos"><VehiculosTab /></TabsContent>
        <TabsContent value="repartidores"><RepartidoresTab /></TabsContent>
        <TabsContent value="tipos_direccion"><TiposDireccionTab /></TabsContent>
        <TabsContent value="email_groups"><EmailGroupsTab /></TabsContent>
        <TabsContent value="system_settings"><SystemSettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
