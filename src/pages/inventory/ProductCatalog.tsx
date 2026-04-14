import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Package, Tags, BoxesIcon, Pencil, Eye } from "lucide-react";
import { SortMenu } from "@/components/SortMenu";

type ProductOptionType = "marca" | "aplicacion" | "uso" | "formula" | "viscosidad" | "categoria" | "linea";

const OPTION_TYPE_LABELS: Record<ProductOptionType, string> = {
  marca: "Marca",
  aplicacion: "Aplicación",
  uso: "Uso",
  formula: "Fórmula",
  viscosidad: "Viscosidad",
  categoria: "Categoría",
  linea: "Línea",
};

const ALL_OPTION_TYPES: ProductOptionType[] = ["marca", "aplicacion", "uso", "formula", "viscosidad", "categoria", "linea"];

// ─── Hooks ───────────────────────────────────────────────────
function usePresentaciones() {
  return useQuery({
    queryKey: ["presentaciones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("presentaciones").select("*").order("nombre");
      if (error) throw error;
      return data;
    },
  });
}

function useOptionValues(type?: ProductOptionType) {
  return useQuery({
    queryKey: ["product_option_values", type],
    queryFn: async () => {
      let q = supabase.from("product_option_values").select("*").order("value");
      if (type) q = q.eq("option_type", type);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

function useProductos(search: string) {
  return useQuery({
    queryKey: ["productos", search],
    queryFn: async () => {
      let q = supabase
        .from("productos")
        .select("*, presentaciones(nombre, unidades_equivalentes), marca:product_option_values!productos_marca_id_fkey(value), aplicacion:product_option_values!productos_aplicacion_id_fkey(value), uso:product_option_values!productos_uso_id_fkey(value), formula:product_option_values!productos_formula_id_fkey(value), viscosidad:product_option_values!productos_viscosidad_id_fkey(value), categoria:product_option_values!productos_categoria_id_fkey(value), linea:product_option_values!productos_linea_id_fkey(value)")
        .order("codigo");
      if (search) {
        q = q.or(`codigo.ilike.%${search}%,nombre_producto.ilike.%${search}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

// ─── Presentaciones Tab ──────────────────────────────────────
function PresentacionesTab() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = usePresentaciones();
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [unidades, setUnidades] = useState("1");

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("presentaciones").insert({ nombre, unidades_equivalentes: Number(unidades) });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["presentaciones"] }); setOpen(false); setNombre(""); setUnidades("1"); toast.success("Presentación creada"); },
    onError: (e: any) => toast.error(e.message),
  });

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
            <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Unidades Equiv.</TableHead><TableHead>Activo</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell>{p.unidades_equivalentes}</TableCell>
                  <TableCell><Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Sí" : "No"}</Badge></TableCell>
                </TableRow>
              ))}
              {items.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sin presentaciones</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Options Tab ─────────────────────────────────────────────
function OptionsTab() {
  const qc = useQueryClient();
  const [selectedType, setSelectedType] = useState<ProductOptionType>("marca");
  const { data: items = [], isLoading } = useOptionValues(selectedType);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("product_option_values").insert({ option_type: selectedType, value });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["product_option_values"] }); setOpen(false); setValue(""); toast.success("Opción agregada"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Tags className="h-5 w-5" /> Opciones de Producto</CardTitle>
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
            <TableHeader><TableRow><TableHead>Valor</TableHead><TableHead>Activo</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.value}</TableCell>
                  <TableCell><Badge variant={o.is_active ? "default" : "secondary"}>{o.is_active ? "Sí" : "No"}</Badge></TableCell>
                </TableRow>
              ))}
              {items.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Sin opciones para {OPTION_TYPE_LABELS[selectedType]}</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Products Tab ────────────────────────────────────────────
function ProductosTab() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [search, setSearch] = useState("");
  const [marcaFilter, setMarcaFilter] = useState<string>("all");
  const { data: productos = [], isLoading } = useProductos(search);
  const { data: presentaciones = [] } = usePresentaciones();
  const { data: allOptions = [] } = useOptionValues();
  const [open, setOpen] = useState(false);
  const [viewProduct, setViewProduct] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const optionsFor = (type: ProductOptionType) => allOptions.filter(o => o.option_type === type && o.is_active);
  const marcas = optionsFor("marca");
  const filteredProductos = marcaFilter === "all" ? productos : productos.filter((p: any) => p.marca_id === marcaFilter);

  const emptyProduct = {
    codigo: "", nombre_producto: "", descripcion: "", presentacion_id: "",
    is_active: true,
    marca_id: "", aplicacion_id: "", uso_id: "", formula_id: "", viscosidad_id: "", categoria_id: "", linea_id: "",
    costo_actual: 0, precio_base_uf1: 0, precio_uf2: 0, precio_uf3: 0, precio_uf4: 0,
    precio_r1: 0, precio_r2: 0, precio_r3: 0, precio_r4: 0, precio_lista_galper: 0,
  };
  const [form, setForm] = useState(emptyProduct);
  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyProduct);
    setOpen(true);
  };

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setForm({
      codigo: p.codigo || "",
      nombre_producto: p.nombre_producto || "",
      descripcion: p.descripcion || "",
      presentacion_id: p.presentacion_id || "",
      is_active: p.is_active ?? true,
      marca_id: p.marca_id || "",
      aplicacion_id: p.aplicacion_id || "",
      uso_id: p.uso_id || "",
      formula_id: p.formula_id || "",
      viscosidad_id: p.viscosidad_id || "",
      categoria_id: p.categoria_id || "",
      linea_id: p.linea_id || "",
      costo_actual: p.costo_actual ?? 0,
      precio_base_uf1: p.precio_base_uf1 ?? 0,
      precio_uf2: p.precio_uf2 ?? 0,
      precio_uf3: p.precio_uf3 ?? 0,
      precio_uf4: p.precio_uf4 ?? 0,
      precio_r1: p.precio_r1 ?? 0,
      precio_r2: p.precio_r2 ?? 0,
      precio_r3: p.precio_r3 ?? 0,
      precio_r4: p.precio_r4 ?? 0,
      precio_lista_galper: p.precio_lista_galper ?? 0,
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      for (const k of ["presentacion_id", "marca_id", "aplicacion_id", "uso_id", "formula_id", "viscosidad_id", "categoria_id", "linea_id"]) {
        if (!payload[k]) payload[k] = null;
      }
      if (editingId) {
        const { error } = await supabase.from("productos").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("productos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["productos"] });
      setOpen(false);
      setForm(emptyProduct);
      setEditingId(null);
      toast.success(editingId ? "Producto actualizado" : "Producto creado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const selectedPres = presentaciones.find(p => p.id === form.presentacion_id);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Catálogo de Productos</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={marcaFilter} onValueChange={setMarcaFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Marca" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las Marcas</SelectItem>
              {marcas.map(m => <SelectItem key={m.id} value={m.id}>{m.value}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8 w-60" placeholder="Buscar por código o nombre..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button size="sm" onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> Nuevo Producto</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                 <TableRow>
                   <TableHead className="w-10"></TableHead>
                   <TableHead>Descripción</TableHead>
                   <TableHead>Marca</TableHead>
                   <TableHead>Base UF1</TableHead>
                   <TableHead>Activo</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProductos.map((p: any) => {
                  const descripcionConcat = [p.codigo, p.nombre_producto, p.presentaciones?.nombre].filter(Boolean).join(" ");
                  return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewProduct(p)} title="Ver">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)} title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{descripcionConcat}</TableCell>
                    <TableCell>{p.marca?.value ?? "—"}</TableCell>
                    <TableCell>${p.precio_base_uf1}</TableCell>
                    <TableCell><Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Sí" : "No"}</Badge></TableCell>
                  </TableRow>
                  );
                })}
                {filteredProductos.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin productos</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyProduct); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar Producto" : "Nuevo Producto"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Código *</Label><Input value={form.codigo} onChange={e => set("codigo", e.target.value)} /></div>
            <div><Label>Nombre Producto *</Label><Input value={form.nombre_producto} onChange={e => set("nombre_producto", e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Descripción</Label><Textarea value={form.descripcion} onChange={e => set("descripcion", e.target.value)} /></div>

            <div>
              <Label>Presentación</Label>
              <Select value={form.presentacion_id} onValueChange={v => set("presentacion_id", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{presentaciones.filter(p => p.is_active).map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unidades Equivalentes</Label>
              <Input disabled value={selectedPres?.unidades_equivalentes ?? ""} />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => set("is_active", v)} />
              <Label>Activo</Label>
            </div>

            {ALL_OPTION_TYPES.map(t => (
              <div key={t}>
                <Label>{OPTION_TYPE_LABELS[t]}</Label>
                <Select value={(form as any)[`${t}_id`] || ""} onValueChange={v => set(`${t}_id`, v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>{optionsFor(t).map(o => <SelectItem key={o.id} value={o.id}>{o.value}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ))}

            <div className="md:col-span-2 border-t pt-3 mt-2">
              <h4 className="font-semibold text-sm mb-3">Precios</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {([
                  ...(isAdmin ? [["costo_actual", "Costo Actual"]] : []),
                  ["precio_base_uf1", "Base UF1"],
                  ["precio_uf2", "UF2"],
                  ["precio_uf3", "UF3"],
                  ["precio_uf4", "UF4"],
                  ["precio_r1", "R1"],
                  ["precio_r2", "R2"],
                  ["precio_r3", "R3"],
                  ["precio_r4", "R4"],
                  ["precio_lista_galper", "Lista Galper"],
                ] as string[][]).map(([k, label]) => (
                  <div key={k}><Label className="text-xs">{label}</Label><Input type="number" value={(form as any)[k]} onChange={e => set(k, Number(e.target.value))} /></div>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <Button onClick={() => save.mutate()} disabled={!form.codigo || !form.nombre_producto || save.isPending} className="w-full">
                {save.isPending ? "Guardando..." : editingId ? "Actualizar Producto" : "Guardar Producto"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Product Dialog */}
      <Dialog open={!!viewProduct} onOpenChange={(v) => { if (!v) setViewProduct(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detalle del Producto</DialogTitle></DialogHeader>
          {viewProduct && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div><p className="text-xs text-muted-foreground">Código</p><p className="font-mono font-medium">{viewProduct.codigo}</p></div>
                <div><p className="text-xs text-muted-foreground">Activo</p><Badge variant={viewProduct.is_active ? "default" : "secondary"}>{viewProduct.is_active ? "Sí" : "No"}</Badge></div>
                <div className="col-span-2"><p className="text-xs text-muted-foreground">Nombre</p><p className="font-medium">{viewProduct.nombre_producto}</p></div>
                {viewProduct.descripcion && <div className="col-span-2"><p className="text-xs text-muted-foreground">Descripción</p><p className="text-sm">{viewProduct.descripcion}</p></div>}
                <div><p className="text-xs text-muted-foreground">Presentación</p><p>{viewProduct.presentaciones?.nombre ?? "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Unidades Equiv.</p><p>{viewProduct.presentaciones?.unidades_equivalentes ?? "—"}</p></div>
              </div>

              <div className="border-t pt-3">
                <h4 className="font-semibold text-sm mb-2">Clasificación</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
                  {([
                    ["Marca", viewProduct.marca?.value],
                    ["Aplicación", viewProduct.aplicacion?.value],
                    ["Uso", viewProduct.uso?.value],
                    ["Fórmula", viewProduct.formula?.value],
                    ["Viscosidad", viewProduct.viscosidad?.value],
                    ["Categoría", viewProduct.categoria?.value],
                    ["Línea", viewProduct.linea?.value],
                  ] as [string, string | undefined][]).map(([label, val]) => (
                    <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm">{val ?? "—"}</p></div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-3">
                <h4 className="font-semibold text-sm mb-2">Precios</h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-2">
                  {([
                    ...(isAdmin ? [["Costo", viewProduct.costo_actual]] : []),
                    ["Base UF1", viewProduct.precio_base_uf1],
                    ["UF2", viewProduct.precio_uf2],
                    ["UF3", viewProduct.precio_uf3],
                    ["UF4", viewProduct.precio_uf4],
                    ["R1", viewProduct.precio_r1],
                    ["R2", viewProduct.precio_r2],
                    ["R3", viewProduct.precio_r3],
                    ["R4", viewProduct.precio_r4],
                    ["Lista Galper", viewProduct.precio_lista_galper],
                  ] as [string, number][]).map(([label, val]) => (
                    <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-mono">${val ?? 0}</p></div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setViewProduct(null)}>Cerrar</Button>
                <Button onClick={() => { openEdit(viewProduct); setViewProduct(null); }}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function ProductCatalog() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inventario — Catálogo de Productos</h1>
        <p className="text-muted-foreground">Gestiona el catálogo general de lubricantes Chevron y Phillips 66.</p>
      </div>
      <Tabs defaultValue="productos">
        <TabsList>
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="presentaciones">Presentaciones</TabsTrigger>
          <TabsTrigger value="opciones">Opciones</TabsTrigger>
        </TabsList>
        <TabsContent value="productos"><ProductosTab /></TabsContent>
        <TabsContent value="presentaciones"><PresentacionesTab /></TabsContent>
        <TabsContent value="opciones"><OptionsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
