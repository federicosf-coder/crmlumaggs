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
import { Plus, Search, Package, Tags, BoxesIcon, Pencil, Eye, Download, Upload, X } from "lucide-react";
import { Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SortMenu } from "@/components/SortMenu";
import PreciosConfigTab, { MARGIN_LEVELS, computePricesFromCost } from "./PreciosConfigTab";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const canImportExport = isAdmin || hasRole("manager");
  const [search, setSearch] = useState("");
  const [productSort, setProductSort] = useState("code_asc");
  const [selectedFilters, setSelectedFilters] = useState({
    marca: [] as string[],
    presentacion: [] as string[],
    aplicacion: [] as string[],
    uso: [] as string[],
    formula: [] as string[],
    viscosidad: [] as string[],
    categoria: [] as string[],
    linea: [] as string[],
    activo: ["true"] as string[],
  });
  const { data: productos = [], isLoading } = useProductos(search);
  const { data: presentaciones = [] } = usePresentaciones();
  const { data: allOptions = [] } = useOptionValues();
  const [open, setOpen] = useState(false);
  const [viewProduct, setViewProduct] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const optionsFor = (type: ProductOptionType) => allOptions.filter(o => o.option_type === type && o.is_active);

  // ─── Export ─────────────────────────────────────────
  const handleExport = () => {
    if (!productos.length) { toast.error("No hay productos para exportar"); return; }
    const headers = ["codigo","nombre_producto","descripcion","presentacion","marca","aplicacion","uso","formula","viscosidad","categoria","linea","is_active","costo_actual","precio_base_uf1","precio_uf2","precio_uf3","precio_uf4","precio_r1","precio_r2","precio_r3","precio_r4","precio_lista_galper"];
    const escCsv = (v: any) => { const s = String(v ?? ""); return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = productos.map((p: any) => [
      p.codigo, p.nombre_producto, p.descripcion ?? "",
      p.presentaciones?.nombre ?? "", p.marca?.value ?? "", p.aplicacion?.value ?? "",
      p.uso?.value ?? "", p.formula?.value ?? "", p.viscosidad?.value ?? "",
      p.categoria?.value ?? "", p.linea?.value ?? "", p.is_active ? "true" : "false",
      p.costo_actual, p.precio_base_uf1, p.precio_uf2, p.precio_uf3, p.precio_uf4,
      p.precio_r1, p.precio_r2, p.precio_r3, p.precio_r4, p.precio_lista_galper,
    ].map(escCsv).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `catalogo_productos_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${productos.length} productos exportados`);
  };

  // ─── Import ─────────────────────────────────────────
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { toast.error("El archivo está vacío"); return; }
      const headerLine = lines[0];
      // Detect delimiter (`;` or `,`) from header
      const delim = (headerLine.match(/;/g)?.length || 0) > (headerLine.match(/,/g)?.length || 0) ? ";" : ",";
      // Parse CSV respecting quotes
      const parseLine = (line: string): string[] => {
        const result: string[] = []; let cur = ""; let inQuote = false;
        for (let i = 0; i < line.length; i++) {
          const c = line[i];
          if (inQuote) { if (c === '"' && line[i+1] === '"') { cur += '"'; i++; } else if (c === '"') { inQuote = false; } else { cur += c; } }
          else { if (c === '"') { inQuote = true; } else if (c === delim) { result.push(cur.trim()); cur = ""; } else { cur += c; } }
        }
        result.push(cur.trim());
        return result;
      };
      const headers = parseLine(headerLine).map(h => h.toLowerCase().replace(/^\uFEFF/, "").trim());
      const codigoIdx = headers.indexOf("codigo");
      if (codigoIdx === -1) { toast.error("El archivo debe tener una columna 'codigo'"); return; }

      // Load lookup maps
      const { data: dbProducts } = await supabase.from("productos").select("id, codigo");
      const existingMap = new Map((dbProducts || []).map(p => [p.codigo.toLowerCase(), p.id]));

      const { data: dbPres } = await supabase.from("presentaciones").select("id, nombre");
      const presMap = new Map((dbPres || []).map(p => [p.nombre.toLowerCase(), p.id]));

      const { data: dbOpts } = await supabase.from("product_option_values").select("id, value, option_type");
      const optMap = new Map<string, Map<string, string>>();
      for (const o of dbOpts || []) {
        if (!optMap.has(o.option_type)) optMap.set(o.option_type, new Map());
        optMap.get(o.option_type)!.set(o.value.toLowerCase(), o.id);
      }
      const findOpt = (type: string, val: string) => val ? (optMap.get(type)?.get(val.toLowerCase()) || null) : null;

      const rows = lines.slice(1).map(l => parseLine(l));
      let updated = 0, created = 0, errors = 0, skipped = 0;

      const numFields = ["costo_actual","precio_base_uf1","precio_uf2","precio_uf3","precio_uf4","precio_r1","precio_r2","precio_r3","precio_r4","precio_lista_galper"];
      const textFields = new Set(["nombre_producto", "descripcion"]);
      const numFieldsSet = new Set(numFields);
      const lookupMap: Record<string, { field: string; resolve: (v: string) => string | null }> = {
        presentacion: { field: "presentacion_id", resolve: (v) => presMap.get(v.toLowerCase()) || null },
        marca:        { field: "marca_id",        resolve: (v) => findOpt("marca", v) },
        aplicacion:   { field: "aplicacion_id",   resolve: (v) => findOpt("aplicacion", v) },
        uso:          { field: "uso_id",          resolve: (v) => findOpt("uso", v) },
        formula:      { field: "formula_id",      resolve: (v) => findOpt("formula", v) },
        viscosidad:   { field: "viscosidad_id",   resolve: (v) => findOpt("viscosidad", v) },
        categoria:    { field: "categoria_id",    resolve: (v) => findOpt("categoria", v) },
        linea:        { field: "linea_id",        resolve: (v) => findOpt("linea", v) },
      };
      // Columns that are recognized but handled separately (codigo) or ignored as system fields
      const systemCols = new Set(["id", "created_at", "updated_at", "created_by"]);
      const unknownCols = new Set<string>();
      for (const h of headers) {
        if (!h) continue;
        if (h === "codigo") continue;
        if (h === "is_active") continue;
        if (textFields.has(h)) continue;
        if (numFieldsSet.has(h)) continue;
        if (lookupMap[h]) continue;
        if (systemCols.has(h)) continue;
        unknownCols.add(h);
      }

      // Helper: parse number that may include $, commas, spaces
      const toNum = (v: string): number | null => {
        if (v === "" || v == null) return null;
        const cleaned = String(v).replace(/[$\s]/g, "").replace(/,/g, "");
        if (cleaned === "" || cleaned === "-") return null;
        const n = Number(cleaned);
        return isFinite(n) ? n : null;
      };

      for (const cols of rows) {
        const get = (name: string) => { const i = headers.indexOf(name); return i >= 0 && i < cols.length ? cols[i] : ""; };
        const codigo = get("codigo");
        if (!codigo) { errors++; continue; }

        // Build a partial payload: only include fields that have a value in the CSV.
        // This mirrors the COALESCE behavior — empty cells do NOT overwrite existing data.
        const payload: any = {};

        // Iterate dynamically over CSV headers — only known columns are applied.
        for (let i = 0; i < headers.length; i++) {
          const h = headers[i];
          if (!h || h === "codigo") continue;
          const raw = i < cols.length ? cols[i] : "";
          if (raw === "" || raw == null) continue; // empty cells preserve current value

          if (textFields.has(h)) {
            payload[h] = raw;
          } else if (numFieldsSet.has(h)) {
            const n = toNum(raw);
            if (n !== null) payload[h] = n;
          } else if (h === "is_active") {
            payload.is_active = raw.toLowerCase() !== "false";
          } else if (lookupMap[h]) {
            const { field, resolve } = lookupMap[h];
            const id = resolve(raw);
            if (id) payload[field] = id;
          }
          // unknown columns: ignored (already collected in unknownCols)
        }

        const existingId = existingMap.get(codigo.toLowerCase());
        if (existingId) {
          // Skip update if there's nothing to change beyond the lookup key
          if (Object.keys(payload).length === 0) { skipped++; continue; }
          const { error } = await supabase.from("productos").update(payload).eq("id", existingId);
          if (error) { console.error(error); errors++; } else updated++;
        } else {
          // Insert needs minimum fields
          const insertPayload = { codigo, nombre_producto: payload.nombre_producto || codigo, ...payload };
          const { error } = await supabase.from("productos").insert(insertPayload);
          if (error) { console.error(error); errors++; } else created++;
        }
      }
      qc.invalidateQueries({ queryKey: ["productos"] });
      const parts = [`${created} creados`, `${updated} actualizados`];
      if (skipped) parts.push(`${skipped} sin cambios`);
      if (errors) parts.push(`${errors} errores`);
      toast.success(`Importación completada: ${parts.join(", ")}`);
      if (unknownCols.size > 0) {
        toast.info(`Columnas ignoradas (no existen en productos): ${Array.from(unknownCols).join(", ")}`);
      }
    } catch (err: any) {
      toast.error("Error al importar: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  const matchesMultiFilter = (value: string | null | undefined, selected: string[]) => {
    if (selected.length === 0) return true;
    const isEmpty = value == null || value === "";
    const hasEmptyFilter = selected.includes("__EMPTY__");
    const nonEmptySelected = selected.filter(s => s !== "__EMPTY__");
    if (isEmpty) return hasEmptyFilter;
    if (nonEmptySelected.length === 0) return false;
    return nonEmptySelected.includes(value as string);
  };

  const filteredProductos = productos
    .filter((p: any) =>
      matchesMultiFilter(p.marca_id, selectedFilters.marca) &&
      matchesMultiFilter(p.presentacion_id, selectedFilters.presentacion) &&
      matchesMultiFilter(p.aplicacion_id, selectedFilters.aplicacion) &&
      matchesMultiFilter(p.uso_id, selectedFilters.uso) &&
      matchesMultiFilter(p.formula_id, selectedFilters.formula) &&
      matchesMultiFilter(p.viscosidad_id, selectedFilters.viscosidad) &&
      matchesMultiFilter(p.categoria_id, selectedFilters.categoria) &&
      matchesMultiFilter(p.linea_id, selectedFilters.linea) &&
      matchesMultiFilter(String(!!p.is_active), selectedFilters.activo)
    )
    .sort((a: any, b: any) => {
      switch (productSort) {
        case "code_asc": return (a.codigo || "").localeCompare(b.codigo || "");
        case "code_desc": return (b.codigo || "").localeCompare(a.codigo || "");
        case "name_asc": return (a.nombre_producto || "").localeCompare(b.nombre_producto || "");
        case "price_desc": return Number(b.precio_base_uf1) - Number(a.precio_base_uf1);
        case "price_asc": return Number(a.precio_base_uf1) - Number(b.precio_base_uf1);
        default: return 0;
      }
    });

  const emptyProduct = {
    codigo: "", nombre_producto: "", descripcion: "", presentacion_id: "",
    is_active: true,
    marca_id: "", aplicacion_id: "", uso_id: "", formula_id: "", viscosidad_id: "", categoria_id: "", linea_id: "",
    precio_clasificacion_id: "",
    costo_actual: 0, precio_base_uf1: 0, precio_uf2: 0, precio_uf3: 0, precio_uf4: 0,
    precio_r1: 0, precio_r2: 0, precio_r3: 0, precio_r4: 0, precio_lista_galper: 0,
  };
  const [form, setForm] = useState(emptyProduct);
  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const { data: clasificaciones = [] } = useQuery({
    queryKey: ["precio_clasificaciones_active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("precio_clasificaciones")
        .select("*")
        .eq("activo", true)
        .order("nombre");
      if (error) throw error;
      return data;
    },
  });
  const [recalcOpen, setRecalcOpen] = useState(false);

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

  const filterDefs: { key: keyof typeof selectedFilters; label: string; opts: { id: string; value: string }[] }[] = [
    { key: "marca", label: "Marca", opts: [{ id: "__EMPTY__", value: "Sin valor" }, ...optionsFor("marca").map(o => ({ id: o.id, value: o.value }))] },
    { key: "presentacion", label: "Presentación", opts: [{ id: "__EMPTY__", value: "Sin valor" }, ...presentaciones.filter(p => p.is_active).map(p => ({ id: p.id, value: p.nombre }))] },
    { key: "aplicacion", label: "Aplicación", opts: [{ id: "__EMPTY__", value: "Sin valor" }, ...optionsFor("aplicacion").map(o => ({ id: o.id, value: o.value }))] },
    { key: "uso", label: "Uso", opts: [{ id: "__EMPTY__", value: "Sin valor" }, ...optionsFor("uso").map(o => ({ id: o.id, value: o.value }))] },
    { key: "formula", label: "Fórmula", opts: [{ id: "__EMPTY__", value: "Sin valor" }, ...optionsFor("formula").map(o => ({ id: o.id, value: o.value }))] },
    { key: "viscosidad", label: "Viscosidad", opts: [{ id: "__EMPTY__", value: "Sin valor" }, ...optionsFor("viscosidad").map(o => ({ id: o.id, value: o.value }))] },
    { key: "categoria", label: "Categoría", opts: [{ id: "__EMPTY__", value: "Sin valor" }, ...optionsFor("categoria").map(o => ({ id: o.id, value: o.value }))] },
    { key: "linea", label: "Línea", opts: [{ id: "__EMPTY__", value: "Sin valor" }, ...optionsFor("linea").map(o => ({ id: o.id, value: o.value }))] },
    { key: "activo", label: "Estado", opts: [{ id: "true", value: "Activo" }, { id: "false", value: "Inactivo" }] },
  ];
  const totalActiveFilters = filterDefs.reduce((acc, f) => acc + selectedFilters[f.key].length, 0);
  const addFilter = (key: keyof typeof selectedFilters, id: string) => {
    if (!id) return;
    setSelectedFilters(prev => prev[key].includes(id) ? prev : { ...prev, [key]: [...prev[key], id] });
  };
  const removeFilter = (key: keyof typeof selectedFilters, id: string) => {
    setSelectedFilters(prev => ({ ...prev, [key]: prev[key].filter(x => x !== id) }));
  };
  const clearAllFilters = () => setSelectedFilters({ marca: [], presentacion: [], aplicacion: [], uso: [], formula: [], viscosidad: [], categoria: [], linea: [], activo: [] });

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Catálogo de Productos</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8 w-60" placeholder="Buscar por código o nombre..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Filtros
                {totalActiveFilters > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{totalActiveFilters}</Badge>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[420px] max-w-[95vw] p-4" align="end">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Filtros</span>
                {totalActiveFilters > 0 && (
                  <Button size="sm" variant="ghost" className="h-7" onClick={clearAllFilters}>Limpiar todo</Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
                {filterDefs.map(f => (
                  <div key={f.key} className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">{f.label}</Label>
                    <Select value="" onValueChange={(v) => addFilter(f.key, v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={`Agregar ${f.label.toLowerCase()}`} /></SelectTrigger>
                      <SelectContent>
                        {f.opts.filter(o => !selectedFilters[f.key].includes(o.id)).map(o => (
                          <SelectItem key={o.id} value={o.id}>{o.value}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          {canImportExport && (
            <>
              <Button size="sm" variant="outline" onClick={handleExport}><Download className="mr-1 h-4 w-4" /> Exportar</Button>
              <Button size="sm" variant="outline" disabled={importing} asChild>
                <label className="cursor-pointer">
                  <Upload className="mr-1 h-4 w-4" /> {importing ? "Importando..." : "Importar"}
                  <input type="file" accept=".csv" className="hidden" onChange={handleImport} disabled={importing} />
                </label>
              </Button>
            </>
          )}
          <Button size="sm" onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> Nuevo Producto</Button>
          <SortMenu
            value={productSort}
            onChange={setProductSort}
            options={[
              { value: "code_asc", label: "Código A-Z" },
              { value: "code_desc", label: "Código Z-A" },
              { value: "name_asc", label: "Nombre A-Z" },
              { value: "price_desc", label: "Precio ↓" },
              { value: "price_asc", label: "Precio ↑" },
            ]}
          />
        </div>
        </div>
        {totalActiveFilters > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {filterDefs.flatMap(f =>
              selectedFilters[f.key].map(id => {
                const isEmptyFilter = id === "__EMPTY__";
                const opt = isEmptyFilter ? { value: "Sin valor" } : f.opts.find(o => o.id === id);
                return (
                  <Badge key={`${f.key}-${id}`} variant="secondary" className="gap-1">
                    <span className="text-xs">{f.label}: {opt?.value ?? id}</span>
                    <button type="button" onClick={() => removeFilter(f.key, id)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })
            )}
            <Button size="sm" variant="ghost" className="h-7" onClick={clearAllFilters}>Limpiar filtros</Button>
          </div>
        )}
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
                   <TableHead className="text-xs">Precios UF</TableHead>
                   <TableHead className="text-xs">Precios R</TableHead>
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
                    <TableCell className="text-xs whitespace-nowrap">
                      <div><span className="text-muted-foreground">UF1:</span> ${Number(p.precio_base_uf1 ?? 0).toFixed(2)}</div>
                      <div><span className="text-muted-foreground">UF2:</span> ${Number(p.precio_uf2 ?? 0).toFixed(2)}</div>
                      <div><span className="text-muted-foreground">UF3:</span> ${Number(p.precio_uf3 ?? 0).toFixed(2)}</div>
                      <div><span className="text-muted-foreground">UF4:</span> ${Number(p.precio_uf4 ?? 0).toFixed(2)}</div>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      <div><span className="text-muted-foreground">R1:</span> ${Number(p.precio_r1 ?? 0).toFixed(2)}</div>
                      <div><span className="text-muted-foreground">R2:</span> ${Number(p.precio_r2 ?? 0).toFixed(2)}</div>
                      <div><span className="text-muted-foreground">R3:</span> ${Number(p.precio_r3 ?? 0).toFixed(2)}</div>
                      <div><span className="text-muted-foreground">R4:</span> ${Number(p.precio_r4 ?? 0).toFixed(2)}</div>
                    </TableCell>
                    <TableCell><Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Sí" : "No"}</Badge></TableCell>
                  </TableRow>
                  );
                })}
                {filteredProductos.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin productos</TableCell></TableRow>}
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
                  <div key={k}><Label className="text-xs">{label}</Label><Input type="number" step="0.01" value={(form as any)[k]} onChange={e => set(k, Number(e.target.value))} /></div>
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
                    <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-mono">${Number(val ?? 0).toFixed(2)}</p></div>
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
        <TabsContent value="productos" className="min-h-[580px] overflow-y-auto"><ProductosTab /></TabsContent>
        <TabsContent value="presentaciones" className="min-h-[580px] overflow-y-auto"><PresentacionesTab /></TabsContent>
        <TabsContent value="opciones" className="min-h-[580px] overflow-y-auto"><OptionsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
