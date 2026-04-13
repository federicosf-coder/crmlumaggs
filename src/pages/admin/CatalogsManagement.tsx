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
import { Plus, MapPin, Tags, BoxesIcon, Pencil } from "lucide-react";

type ProductOptionType = "marca" | "aplicacion" | "uso" | "formula" | "viscosidad" | "categoria" | "linea";

const OPTION_TYPE_LABELS: Record<ProductOptionType, string> = {
  marca: "Marca", aplicacion: "Aplicación", uso: "Uso", formula: "Fórmula",
  viscosidad: "Viscosidad", categoria: "Categoría", linea: "Línea",
};
const ALL_OPTION_TYPES: ProductOptionType[] = ["marca", "aplicacion", "uso", "formula", "viscosidad", "categoria", "linea"];

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
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["product_option_values", selectedType],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_option_values").select("*").eq("option_type", selectedType).order("value");
      if (error) throw error; return data;
    },
  });
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [editItem, setEditItem] = useState<any>(null);
  const [editValue, setEditValue] = useState("");
  const [editActive, setEditActive] = useState(true);

  const add = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("product_option_values").insert({ option_type: selectedType, value }); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["product_option_values"] }); setOpen(false); setValue(""); toast.success("Opción agregada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("product_option_values").update({ value: editValue, is_active: editActive }).eq("id", editItem.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["product_option_values"] }); setEditItem(null); toast.success("Opción actualizada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (item: any) => { setEditItem(item); setEditValue(item.value); setEditActive(item.is_active); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Tags className="h-5 w-5" /> Clasificaciones de Producto</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nueva Opción</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva Opción — {OPTION_TYPE_LABELS[selectedType]}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Valor</Label><Input value={value} onChange={e => setValue(e.target.value)} placeholder="Ej: Chevron" /></div>
              <Button onClick={() => add.mutate()} disabled={!value || add.isPending}>{add.isPending ? "Guardando..." : "Guardar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {ALL_OPTION_TYPES.map(t => (
            <Button key={t} size="sm" variant={selectedType === t ? "default" : "outline"} onClick={() => setSelectedType(t)}>
              {OPTION_TYPE_LABELS[t]}
            </Button>
          ))}
        </div>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Valor</TableHead><TableHead>Activo</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.value}</TableCell>
                  <TableCell><Badge variant={o.is_active ? "default" : "secondary"}>{o.is_active ? "Sí" : "No"}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(o)}><Pencil className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
              {items.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sin opciones para {OPTION_TYPE_LABELS[selectedType]}</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={!!editItem} onOpenChange={v => { if (!v) setEditItem(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar {OPTION_TYPE_LABELS[selectedType]}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Valor</Label><Input value={editValue} onChange={e => setEditValue(e.target.value)} /></div>
            <div className="flex items-center gap-2"><Switch checked={editActive} onCheckedChange={setEditActive} /><Label>Activo</Label></div>
          </div>
          <DialogFooter><Button onClick={() => update.mutate()} disabled={!editValue || update.isPending}>{update.isPending ? "Guardando..." : "Guardar"}</Button></DialogFooter>
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
        <p className="text-muted-foreground">Administra plazas, presentaciones y clasificaciones de productos.</p>
      </div>
      <Tabs defaultValue="plazas">
        <TabsList>
          <TabsTrigger value="plazas">Plazas</TabsTrigger>
          <TabsTrigger value="presentaciones">Presentaciones</TabsTrigger>
          <TabsTrigger value="clasificaciones">Clasificaciones</TabsTrigger>
        </TabsList>
        <TabsContent value="plazas"><PlazasTab /></TabsContent>
        <TabsContent value="presentaciones"><PresentacionesTab /></TabsContent>
        <TabsContent value="clasificaciones"><OptionsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
