import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
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
import { Plus, Search, Package, Tags, BoxesIcon, Pencil, Eye, Download, Upload, X, Users, ArrowUp, ArrowDown, Filter, Merge } from "lucide-react";
import { MergeDuplicatesDialog } from "@/components/directory/MergeDuplicatesDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SortMenu } from "@/components/SortMenu";
import { ProductoBaseCombobox } from "@/components/inventory/ProductoBaseCombobox";
import PreciosConfigTab, { MARGIN_LEVELS, computePricesFromCost } from "./PreciosConfigTab";
import { useStockPorProducto } from "@/hooks/useMapeoProductos";
import { useCanViewCostos } from "@/hooks/useCanViewCostos";
import { ALMACEN_LABELS, useKardexCargas } from "@/hooks/useInventario";
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
function ProductClientsDialog({
  product,
  onClose,
  onOpenSeguimiento,
}: {
  product: any | null;
  onClose: () => void;
  onOpenSeguimiento: (companyId: string, marca?: string) => void;
}) {
  const productId = product?.id as string | undefined;
  const marcaValue = product?.marca?.value as string | undefined;
  const empresaVendedora =
    String(marcaValue || "").toLowerCase().includes("phillips")
      ? "galsa_phillips66"
      : "lumaggs_chevron";

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["product-clients", productId, empresaVendedora],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documento_productos")
        .select(
          "cantidad, documentos!inner(empresa_id, empresa_vendedora, tipo_documento, is_active, fecha_documento, companies:empresa_id(id, name))"
        )
        .eq("producto_id", productId!)
        .eq("documentos.tipo_documento", "factura")
        .eq("documentos.is_active", true)
        .eq("documentos.empresa_vendedora", empresaVendedora);
      if (error) throw error;
      const map = new Map<string, { company_id: string; name: string; cantidad: number; ultima: string | null }>();
      for (const r of (data || []) as any[]) {
        const doc = r.documentos;
        if (!doc?.empresa_id) continue;
        const id = doc.empresa_id as string;
        const cur = map.get(id) || {
          company_id: id,
          name: doc.companies?.name || "—",
          cantidad: 0,
          ultima: null as string | null,
        };
        cur.cantidad += Number(r.cantidad || 0);
        if (doc.fecha_documento && (!cur.ultima || doc.fecha_documento > cur.ultima)) {
          cur.ultima = doc.fecha_documento;
        }
        map.set(id, cur);
      }
      return Array.from(map.values());
    },
  });

  const [sort, setSort] = useState<{ key: "name" | "cantidad" | "ultima"; dir: "asc" | "desc" }>({
    key: "cantidad",
    dir: "desc",
  });
  const sorted = [...rows].sort((a, b) => {
    let va: any = a[sort.key];
    let vb: any = b[sort.key];
    if (sort.key === "name") {
      va = (va || "").toString().toLowerCase();
      vb = (vb || "").toString().toLowerCase();
    } else if (sort.key === "ultima") {
      va = va || "";
      vb = vb || "";
    } else {
      va = Number(va || 0);
      vb = Number(vb || 0);
    }
    if (va < vb) return sort.dir === "asc" ? -1 : 1;
    if (va > vb) return sort.dir === "asc" ? 1 : -1;
    return 0;
  });
  const toggle = (key: "name" | "cantidad" | "ultima") =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  const SortIcon = ({ k }: { k: "name" | "cantidad" | "ultima" }) =>
    sort.key === k ? (
      sort.dir === "asc" ? <ArrowUp className="inline h-3 w-3 ml-1" /> : <ArrowDown className="inline h-3 w-3 ml-1" />
    ) : null;

  return (
    <Dialog open={!!product} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Clientes que han comprado este producto</DialogTitle>
        </DialogHeader>
        {product && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{product.nombre_producto}</span>
              {" · "}
              <span className="font-mono">{product.codigo}</span>
            </p>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : sorted.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No hay facturas registradas con este producto.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggle("name")}>
                      Cliente <SortIcon k="name" />
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggle("cantidad")}>
                      Cantidad acum. <SortIcon k="cantidad" />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggle("ultima")}>
                      Última compra <SortIcon k="ultima" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((r) => (
                    <TableRow
                      key={r.company_id}
                      className="cursor-pointer"
                      onClick={() => onOpenSeguimiento(r.company_id, marcaValue)}
                    >
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right font-mono">{r.cantidad}</TableCell>
                      <TableCell>{r.ultima || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={onClose}>Cerrar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProductosTab() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { hasRole, user } = useAuth();
  const isAdmin = hasRole("admin");
  const canImportExport = isAdmin || hasRole("manager");
  const canViewCostos = useCanViewCostos();
  const [search, setSearch] = useState("");
  const { data: stockMap = new Map<string, any>() } = useStockPorProducto();
  const { data: kardexCargas = [] } = useKardexCargas();
  const ultimaCargaUnidades = kardexCargas.find((c: any) => c.tipo === "inventario_unidades" && c.estatus === "completado");
  const ultimaFechaInventario = ultimaCargaUnidades?.fecha_archivo
    ? new Date(ultimaCargaUnidades.fecha_archivo).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
    : null;
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
  const [precioMin, setPrecioMin] = useState<number | "">("");
  const [precioMax, setPrecioMax] = useState<number | "">("");
  const { data: productos = [], isLoading } = useProductos(search);
  const { data: presentaciones = [] } = usePresentaciones();
  const { data: allOptions = [] } = useOptionValues();
  const [open, setOpen] = useState(false);
  const [viewProduct, setViewProduct] = useState<any>(null);
  const [clientsProduct, setClientsProduct] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [huerfanoContext, setHuerfanoContext] = useState<{ codigo: string; proveedor: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [porLlegarCodigo, setPorLlegarCodigo] = useState<{ codigo: string; nombre: string } | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);

  // ─── Mercancía por llegar (pedidos abiertos) ─────────
  const { data: porLlegarLineas = [] } = useQuery({
    queryKey: ["inv_pedido_lineas_por_llegar_catalogo"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("inv_pedido_lineas")
        .select("codigo_producto, cantidad_solicitada, cantidad_confirmada, cantidad_recibida, inv_pedidos!inner(numero_po_interno, almacen_destino, fecha_pedido, fecha_entrega_estimada, estatus)")
        .not("inv_pedidos.estatus", "in", "(cerrado,cancelado,recibido)");
      if (error) throw error;
      return ((data || []) as any[])
        .map((l) => ({
          ...l,
          cantidad_pendiente: Math.max(
            0,
            (Number(l.cantidad_confirmada ?? l.cantidad_solicitada ?? 0) || 0) - (Number(l.cantidad_recibida ?? 0) || 0),
          ),
        }))
        .filter((l) => l.cantidad_pendiente > 0);
    },
    refetchInterval: 60_000,
  });

  const porLlegarPorCodigo = new Map<string, number>();
  (porLlegarLineas as any[]).forEach((l) => {
    if (!l.codigo_producto) return;
    const cant = Number(l.cantidad_pendiente ?? 0) || 0;
    porLlegarPorCodigo.set(l.codigo_producto, (porLlegarPorCodigo.get(l.codigo_producto) || 0) + cant);
  });

  const detallePorLlegar = porLlegarCodigo
    ? (porLlegarLineas as any[])
        .filter((l) => l.codigo_producto === porLlegarCodigo.codigo)
        .sort((a, b) => String(a.inv_pedidos?.fecha_entrega_estimada || "9999").localeCompare(String(b.inv_pedidos?.fecha_entrega_estimada || "9999")))
    : [];

  const optionsFor = (type: ProductOptionType) => allOptions.filter(o => o.option_type === type && o.is_active);

  // ─── Export ─────────────────────────────────────────
  const handleExport = () => {
    if (!productos.length) { toast.error("No hay productos para exportar"); return; }
    const headers = ["codigo","nombre_producto","descripcion","presentacion","marca","aplicacion","uso","formula","viscosidad","categoria","linea","is_active",...(canViewCostos ? ["costo_actual"] : []),"precio_base_uf1","precio_uf2","precio_uf3","precio_uf4","precio_r1","precio_r2","precio_r3","precio_r4","precio_lista_galper"];
    const escCsv = (v: any) => { const s = String(v ?? ""); return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = productos.map((p: any) => [
      p.codigo, p.nombre_producto, p.descripcion ?? "",
      p.presentaciones?.nombre ?? "", p.marca?.value ?? "", p.aplicacion?.value ?? "",
      p.uso?.value ?? "", p.formula?.value ?? "", p.viscosidad?.value ?? "",
      p.categoria?.value ?? "", p.linea?.value ?? "", p.is_active ? "true" : "false",
      ...(canViewCostos ? [p.costo_actual] : []), p.precio_base_uf1, p.precio_uf2, p.precio_uf3, p.precio_uf4,
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

      const numFields = [...(canViewCostos ? ["costo_actual"] : []),"precio_base_uf1","precio_uf2","precio_uf3","precio_uf4","precio_r1","precio_r2","precio_r3","precio_r4","precio_lista_galper"];
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
      const systemCols = new Set(["id", "created_at", "updated_at", "created_by", ...(canViewCostos ? [] : ["costo_actual"])]);
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
      matchesMultiFilter(String(!!p.is_active), selectedFilters.activo) &&
      (precioMin === "" || Number(p.precio_base_uf1 ?? 0) >= precioMin) &&
      (precioMax === "" || Number(p.precio_base_uf1 ?? 0) <= precioMax)
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
    producto_base_id: "",
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

  useEffect(() => {
    const prefill = (location.state as any)?.prefillHuerfano;
    if (!prefill) return;
    if (!presentaciones.length) return;
    let cancelled = false;
    (async () => {
      const unidad = String(prefill.unidad || "").trim().toLowerCase();
      const match = presentaciones.find((p: any) => String(p.nombre || "").trim().toLowerCase() === unidad);
      let costo = 0;
      const { data: costoRow } = await (supabase as any)
        .from("inv_costos_producto")
        .select("costo_efectivo")
        .eq("codigo_producto", prefill.codigo)
        .in("estado", ["aplicado", "autorizado", "pendiente", "sin_producto"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (costoRow?.costo_efectivo != null) costo = Number(costoRow.costo_efectivo);
      if (cancelled) return;
      setForm({
        ...emptyProduct,
        codigo: prefill.codigo || "",
        nombre_producto: prefill.nombre_producto || "",
        presentacion_id: match?.id || "",
        costo_actual: costo,
      });
      setEditingId(null);
      setHuerfanoContext({ codigo: prefill.codigo, proveedor: prefill.proveedor });
      setOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, presentaciones.length]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyProduct);
    setHuerfanoContext(null);
    setOpen(true);
  };

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setHuerfanoContext(null);
    setForm({
      codigo: p.codigo || "",
      nombre_producto: p.nombre_producto || "",
      descripcion: p.descripcion || "",
      presentacion_id: p.presentacion_id || "",
      is_active: p.is_active ?? true,
      producto_base_id: p.producto_base_id || "",
      marca_id: p.marca_id || "",
      aplicacion_id: p.aplicacion_id || "",
      uso_id: p.uso_id || "",
      formula_id: p.formula_id || "",
      viscosidad_id: p.viscosidad_id || "",
      categoria_id: p.categoria_id || "",
      linea_id: p.linea_id || "",
      precio_clasificacion_id: p.precio_clasificacion_id || "",
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
    mutationFn: async (overrides?: Record<string, number>) => {
      const payload: any = { ...form, ...(overrides || {}) };
      for (const k of ["presentacion_id", "producto_base_id", "marca_id", "aplicacion_id", "uso_id", "formula_id", "viscosidad_id", "categoria_id", "linea_id", "precio_clasificacion_id"]) {
        if (!payload[k]) payload[k] = null;
      }
      if (editingId) {
        const { error } = await supabase.from("productos").update(payload).eq("id", editingId);
        if (error) throw error;
        return editingId as string;
      } else {
        const { data: created, error } = await supabase.from("productos").insert(payload).select("id").single();
        if (error) throw error;
        if (huerfanoContext && created?.id) {
          const { error: mapError } = await (supabase as any).from("inv_producto_proveedor").insert({
            producto_id: created.id,
            proveedor: huerfanoContext.proveedor,
            codigo_proveedor: huerfanoContext.codigo,
            codigo_contpaqi: huerfanoContext.codigo,
            confirmado: true,
            creado_por: user?.id ?? null,
          });
          if (mapError) throw mapError;
        }
        return (created?.id as string) || null;
      }
    },
    onSuccess: (createdId) => {
      const wasHuerfano = !!huerfanoContext;
      qc.invalidateQueries({ queryKey: ["productos"] });
      setRecalcOpen(false);
      if (wasHuerfano) {
        for (const key of ["huerfanos_kardex", "huerfanos_count", "fantasmas_catalogo", "stock_por_producto"]) {
          qc.invalidateQueries({ queryKey: [key] });
        }
        // Mantener el diálogo abierto para seguir editando; no navegar.
        if (createdId) setEditingId(createdId);
        toast.success("Producto guardado y vinculado al kardex correctamente");
      } else {
        setOpen(false);
        setForm(emptyProduct);
        setEditingId(null);
        toast.success(editingId ? "Producto actualizado" : "Producto creado");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSaveClick = () => {
    save.mutate(undefined);
  };

  const roundPrice = (n: number) => {
    if (!isFinite(n) || n <= 0) return 0;
    return Math.ceil(n / 5) * 5;
  };


  const saveWithRecalc = async () => {
    try {
      const costo = Number(form.costo_actual ?? 0);
      let margins: any = null;
      // 1) Buscar por Línea de Producto en el catálogo "Márgenes por Línea"
      if (form.linea_id) {
        const { data, error } = await supabase
          .from("producto_linea_margenes")
          .select("*")
          .eq("linea_id", form.linea_id)
          .eq("activo", true)
          .maybeSingle();
        if (error) throw error;
        margins = data;
      }
      // 2) Fallback: fila "General" del mismo catálogo (linea_id NULL)
      if (!margins) {
        const { data, error } = await supabase
          .from("producto_linea_margenes")
          .select("*")
          .is("linea_id", null)
          .maybeSingle();
        if (error) throw error;
        margins = data;
      }
      // 3) Compatibilidad: si tampoco existe, intentar la clasificación legacy o márgenes globales
      if (!margins && form.precio_clasificacion_id) {
        margins = clasificaciones.find((c: any) => c.id === form.precio_clasificacion_id) || null;
      }
      if (!margins) {
        const { data, error } = await supabase
          .from("precio_config_global").select("*").limit(1).maybeSingle();
        if (error) throw error;
        margins = data;
      }
      const marginRecord: Record<string, number> = {};
      for (const lvl of MARGIN_LEVELS) marginRecord[lvl.key] = Number(margins?.[lvl.key] ?? 0);
      const raw = computePricesFromCost(costo, marginRecord);
      const newPrices: Record<string, number> = {};
      for (const [k, v] of Object.entries(raw)) newPrices[k] = roundPrice(Number(v));
      setForm(prev => ({ ...prev, ...newPrices } as any));
      save.mutate(newPrices);
    } catch (e: any) {
      toast.error("Error al recalcular precios: " + e.message);
    }
  };

  const selectedPres = presentaciones.find(p => p.id === form.presentacion_id);

  const filterDefs: { key: keyof typeof selectedFilters; label: string; opts: { id: string; value: string }[]; inPopover?: boolean }[] = [
    { key: "marca", label: "Marca", opts: [{ id: "__EMPTY__", value: "Sin valor" }, ...optionsFor("marca").map(o => ({ id: o.id, value: o.value }))], inPopover: true },
    { key: "presentacion", label: "Presentación", opts: [{ id: "__EMPTY__", value: "Sin valor" }, ...presentaciones.filter(p => p.is_active).map(p => ({ id: p.id, value: p.nombre }))], inPopover: true },
    { key: "aplicacion", label: "Aplicación", opts: [{ id: "__EMPTY__", value: "Sin valor" }, ...optionsFor("aplicacion").map(o => ({ id: o.id, value: o.value }))], inPopover: true },
    { key: "uso", label: "Uso", opts: [{ id: "__EMPTY__", value: "Sin valor" }, ...optionsFor("uso").map(o => ({ id: o.id, value: o.value }))], inPopover: true },
    { key: "formula", label: "Fórmula", opts: [{ id: "__EMPTY__", value: "Sin valor" }, ...optionsFor("formula").map(o => ({ id: o.id, value: o.value }))], inPopover: true },
    { key: "viscosidad", label: "Viscosidad", opts: [{ id: "__EMPTY__", value: "Sin valor" }, ...optionsFor("viscosidad").map(o => ({ id: o.id, value: o.value }))], inPopover: true },
    { key: "categoria", label: "Categoría", opts: [{ id: "__EMPTY__", value: "Sin valor" }, ...optionsFor("categoria").map(o => ({ id: o.id, value: o.value }))] },
    { key: "segmento", label: "Segmento", opts: SEGMENTOS.map(s => ({ id: s.key, value: s.label })) },
    { key: "linea", label: "Línea", opts: [{ id: "__EMPTY__", value: "Sin valor" }, ...optionsFor("linea").map(o => ({ id: o.id, value: o.value }))], inPopover: true },
    { key: "activo", label: "Estado", opts: [{ id: "true", value: "Activo" }, { id: "false", value: "Inactivo" }], inPopover: true },
  ];
  const totalActiveFilters = filterDefs.reduce((acc, f) => acc + selectedFilters[f.key].length, 0) +
    (precioMin !== "" ? 1 : 0) + (precioMax !== "" ? 1 : 0);
  const addFilter = (key: keyof typeof selectedFilters, id: string) => {
    if (!id) return;
    setSelectedFilters(prev => prev[key].includes(id) ? prev : { ...prev, [key]: [...prev[key], id] });
  };
  const removeFilter = (key: keyof typeof selectedFilters, id: string) => {
    setSelectedFilters(prev => ({ ...prev, [key]: prev[key].filter(x => x !== id) }));
  };
  const clearAllFilters = () => {
    setSelectedFilters({ marca: [], presentacion: [], aplicacion: [], uso: [], formula: [], viscosidad: [], categoria: [], segmento: [], linea: [], activo: [] });
    setPrecioMin("");
    setPrecioMax("");
  };


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
                <div className="col-span-2 flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Rango de precio (UF1)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      placeholder="Desde"
                      value={precioMin}
                      onChange={e => setPrecioMin(e.target.value === "" ? "" : Number(e.target.value))}
                      className="h-8 text-xs"
                    />
                    <span className="text-xs text-muted-foreground">—</span>
                    <Input
                      type="number"
                      min={0}
                      placeholder="Hasta"
                      value={precioMax}
                      onChange={e => setPrecioMax(e.target.value === "" ? "" : Number(e.target.value))}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
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
          <Button size="sm" variant="outline" onClick={() => setMergeOpen(true)}><Merge className="mr-1 h-4 w-4" /> Fusionar duplicados</Button>
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
            {precioMin !== "" && (
              <Badge variant="secondary" className="gap-1">
                <span className="text-xs">Precio min: ${precioMin}</span>
                <button type="button" onClick={() => setPrecioMin("")} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {precioMax !== "" && (
              <Badge variant="secondary" className="gap-1">
                <span className="text-xs">Precio max: ${precioMax}</span>
                <button type="button" onClick={() => setPrecioMax("")} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            <Button size="sm" variant="ghost" className="h-7" onClick={clearAllFilters}>Limpiar filtros</Button>
          </div>
        )}
        <div className="flex items-start gap-3 flex-wrap border-t pt-3">
          <div className="flex-1 min-w-[240px] space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Categorías</span>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {optionsFor("categoria").map(o => {
                const active = selectedFilters.categoria.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => (active ? removeFilter("categoria", o.id) : addFilter("categoria", o.id))}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all ${catColor(o.value)} ${active ? "ring-2 ring-offset-1 ring-primary brightness-95" : "opacity-80 hover:opacity-100"}`}
                  >
                    {o.value}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Segmento</span>
            <div className="flex gap-1.5 flex-wrap">
              {SEGMENTOS.map(s => {
                const active = selectedFilters.segmento.includes(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSelectedFilters(prev => ({
                      ...prev,
                      segmento: active ? prev.segmento.filter(x => x !== s.key) : [...prev.segmento, s.key],
                    }))}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${active ? s.badge + " border-transparent" : "bg-muted/40 hover:bg-muted"}`}
                  >
                    <s.icon className="h-3 w-3" />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground block">Vista</span>
            <div className="flex gap-1">
              <Button size="icon" variant={vista === "tabla" ? "default" : "outline"} className="h-8 w-8" onClick={() => setVista("tabla")} title="Tabla"><TableIcon className="h-4 w-4" /></Button>
              <Button size="icon" variant={vista === "cards" ? "default" : "outline"} className="h-8 w-8" onClick={() => setVista("cards")} title="Tarjetas"><LayoutGrid className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : vista === "cards" ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProductos.map((p: any) => {
              const stock = stockMap.get(p.id);
              return (
                <div key={p.id} className="rounded-lg border bg-card p-3 flex flex-col gap-2 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm leading-tight truncate" title={p.nombre_producto}>{p.nombre_producto}</p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">{p.codigo}{p.presentaciones?.nombre ? ` · ${p.presentaciones.nombre}` : ""}</p>
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewProduct(p)} title="Ver"><Eye className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)} title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {p.categoria?.value && <Badge variant="outline" className={`border-0 text-[10px] ${catColor(p.categoria.value)}`}>{p.categoria.value}</Badge>}
                    {SEGMENTOS.filter(s => p[s.field]).map(s => (
                      <Badge key={s.key} variant="outline" className={`border-0 text-[10px] gap-1 ${s.badge}`}><s.icon className="h-3 w-3" />{s.short}</Badge>
                    ))}
                  </div>
                  <div className="text-[11px] text-muted-foreground space-y-0.5">
                    {p.marca?.value && <div>Marca: <span className="text-foreground">{p.marca.value}</span></div>}
                    {p.viscosidad?.value && <div>Viscosidad: <span className="text-foreground">{p.viscosidad.value}</span></div>}
                    {p.formula?.value && <div>Base: <span className="text-foreground">{p.formula.value}</span></div>}
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-1 border-t">
                    <Badge variant="outline" className="text-[10px]">{stock?.stock_total ?? 0} uds</Badge>
                    <span className="text-sm font-semibold tabular-nums">${Number(p.precio_base_uf1 ?? 0).toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
            {filteredProductos.length === 0 && <p className="col-span-full text-center text-muted-foreground py-6">Sin productos</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">

            <Table>
              <TableHeader>
                 <TableRow>
                   <TableHead className="w-10"></TableHead>
                   <TableHead>Descripción</TableHead>
                   <TableHead>Marca</TableHead>
                   <TableHead>
                     <div>Inventario</div>
                     {ultimaFechaInventario && (
                       <div className="text-[10px] font-normal text-muted-foreground leading-tight">{ultimaFechaInventario}</div>
                     )}
                   </TableHead>
                   <TableHead className="text-right">Mercancía por llegar</TableHead>
                   <TableHead className="text-xs">Precios UF</TableHead>
                   <TableHead className="text-xs">Precios R</TableHead>
                   <TableHead>Activo</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProductos.map((p: any) => {
                  const descripcionConcat = [p.codigo, p.nombre_producto, p.presentaciones?.nombre].filter(Boolean).join(" ");
                  const stock = stockMap.get(p.id);
                  const porLlegar = porLlegarPorCodigo.get(p.codigo) || 0;
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
                    <TableCell className="font-medium">
                      <div>{descripcionConcat}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {p.categoria?.value && <Badge variant="outline" className={`border-0 text-[10px] ${catColor(p.categoria.value)}`}>{p.categoria.value}</Badge>}
                        {SEGMENTOS.filter(s => p[s.field]).map(s => (
                          <Badge key={s.key} variant="outline" className={`border-0 text-[10px] gap-1 ${s.badge}`}><s.icon className="h-3 w-3" />{s.short}</Badge>
                        ))}
                      </div>
                    </TableCell>

                    <TableCell>{p.marca?.value ?? "—"}</TableCell>
                    <TableCell className="text-xs tabular-nums whitespace-nowrap">
                      {stock ? (
                        <div className="flex items-center gap-2">
                          <div className="space-y-0.5">
                            <div><span className="text-muted-foreground">TJ:</span> <span className="font-medium">{stock.stock_almacen_1002 ?? 0}</span></div>
                            <div><span className="text-muted-foreground">MXL:</span> <span className="font-medium">{stock.stock_almacen_1001 ?? 0}</span></div>
                            <div><span className="text-muted-foreground">MOR:</span> <span className="font-medium">{stock.stock_almacen_1003 ?? 0}</span></div>
                            <div><span className="text-muted-foreground">ENS:</span> <span className="font-medium">{stock.stock_almacen_1004 ?? 0}</span></div>
                          </div>
                          <Badge variant="outline" className={
                            stock.estatus_inventario === 'pedir' ? 'bg-red-50 text-red-700 text-[10px]' :
                            stock.estatus_inventario === 'sobrestock' ? 'bg-orange-50 text-orange-700 text-[10px]' :
                            stock.estatus_inventario === 'ok' ? 'bg-green-50 text-green-700 text-[10px]' :
                            'bg-gray-50 text-gray-600 text-[10px]'
                          }>{stock.stock_total ?? 0} uds</Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">Sin datos</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {porLlegar > 0 ? (
                        <button
                          type="button"
                          className="font-medium text-blue-600 hover:underline"
                          title="Ver pedidos por llegar"
                          onClick={() => setPorLlegarCodigo({ codigo: p.codigo, nombre: descripcionConcat })}
                        >
                          {porLlegar}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
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
                {filteredProductos.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Sin productos</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!porLlegarCodigo} onOpenChange={(v) => { if (!v) setPorLlegarCodigo(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4 border-b shrink-0">
            <DialogTitle className="text-lg font-semibold tracking-tight">Mercancía por llegar</DialogTitle>
            <p className="text-xs text-muted-foreground font-light">{porLlegarCodigo?.nombre}</p>
          </DialogHeader>
          <div className="px-5 py-4 overflow-y-auto flex-1">
            <Table>
              <TableHeader className="bg-gradient-to-r from-violet-50 to-blue-50">
                <TableRow>
                  <TableHead className="uppercase tracking-wide text-xs font-medium">PO</TableHead>
                  <TableHead className="uppercase tracking-wide text-xs font-medium">Fecha estimada</TableHead>
                  <TableHead className="uppercase tracking-wide text-xs font-medium">Almacén</TableHead>
                  <TableHead className="uppercase tracking-wide text-xs font-medium text-right">Cantidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detallePorLlegar.map((l: any, i: number) => (
                  <TableRow key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                    <TableCell className="font-mono text-xs">{l.inv_pedidos?.numero_po_interno || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {l.inv_pedidos?.fecha_entrega_estimada || <span className="text-amber-600">Sin fecha ⚠</span>}
                    </TableCell>
                    <TableCell className="text-sm">{ALMACEN_LABELS[l.inv_pedidos?.almacen_destino || ""] || l.inv_pedidos?.almacen_destino || "—"}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{Number(l.cantidad_pendiente ?? l.cantidad_confirmada ?? l.cantidad_solicitada ?? 0)}</TableCell>
                  </TableRow>
                ))}
                {detallePorLlegar.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sin pedidos abiertos</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="border-t bg-muted/30 px-5 py-3 flex justify-end shrink-0">
            <Button variant="outline" onClick={() => setPorLlegarCodigo(null)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyProduct); setHuerfanoContext(null); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar Producto" : "Nuevo Producto"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Código *</Label><Input value={form.codigo} onChange={e => set("codigo", e.target.value)} /></div>
            <div><Label>Nombre Producto *</Label><Input value={form.nombre_producto} onChange={e => set("nombre_producto", e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Descripción</Label><Textarea value={form.descripcion} onChange={e => set("descripcion", e.target.value)} /></div>

            <div className="md:col-span-2">
              <Label>Producto Base *</Label>
              <ProductoBaseCombobox
                value={form.producto_base_id}
                marcaId={form.marca_id}
                onChange={v => set("producto_base_id", v)}
              />
              {!form.producto_base_id && (
                <p className="text-xs text-muted-foreground mt-1 font-light">
                  Requerido: agrupa todas las presentaciones del mismo producto.
                </p>
              )}
            </div>

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

            <div className="md:col-span-2">
              <Label>Clasificación de Precio</Label>
              <Select
                value={form.precio_clasificacion_id || "__none__"}
                onValueChange={v => set("precio_clasificacion_id", v === "__none__" ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="Sin clasificación (usa márgenes generales)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin clasificación (márgenes generales)</SelectItem>
                  {clasificaciones.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 border-t pt-3 mt-2">
              <h4 className="font-semibold text-sm mb-3">Precios</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {([
                  ...(canViewCostos ? [["costo_actual", "Costo Actual"]] : []),
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

            <div className="md:col-span-2 flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleSaveClick}
                disabled={!form.codigo || !form.nombre_producto || !form.producto_base_id || save.isPending}
                className="flex-1"
              >
                {save.isPending ? "Guardando..." : editingId ? "Actualizar Producto" : "Guardar Producto"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setRecalcOpen(true)}
                disabled={save.isPending || !form.producto_base_id || !(Number(form.costo_actual ?? 0) > 0)}
                className="flex-1"
                title={!(Number(form.costo_actual ?? 0) > 0) ? "Requiere Costo Actual > 0" : ""}
              >
                Actualizar Precios
              </Button>
              {huerfanoContext && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={save.isPending}
                  className="flex-1"
                  onClick={async () => {
                    if (form.codigo && form.nombre_producto && form.producto_base_id) {
                      try { await save.mutateAsync(undefined); } catch { return; }
                    }
                    setOpen(false);
                    setForm(emptyProduct);
                    setEditingId(null);
                    setHuerfanoContext(null);
                    navigate("/inventario/costos?tab=listas");
                  }}
                >
                  Guardar y regresar a Listas por Marca
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={recalcOpen} onOpenChange={setRecalcOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Actualizar precios?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Deseas actualizar los 8 precios de este producto conforme al costo registrado
              {form.precio_clasificacion_id
                ? ` (usando la clasificación "${(clasificaciones.find((c: any) => c.id === form.precio_clasificacion_id) as any)?.nombre || "asignada"}")?`
                : " (usando los márgenes generales)?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRecalcOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => { saveWithRecalc(); }}>
              Sí, actualizar precios
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Product Dialog */}
      <Dialog open={!!viewProduct} onOpenChange={(v) => { if (!v) setViewProduct(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <DialogTitle>Detalle del Producto</DialogTitle>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setClientsProduct(viewProduct)}
              >
                <Users className="h-4 w-4" /> Clientes que lo compran
              </Button>
            </div>
          </DialogHeader>
          {viewProduct && (
            <div className="space-y-4">
              {viewProduct.creado_automaticamente && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">Este producto fue creado automáticamente por el sistema al importar una factura XML.</div>
              )}
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
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      {label === "Categoría" && val
                        ? <Badge variant="outline" className={`border-0 ${catColor(val)}`}>{val}</Badge>
                        : <p className="text-sm">{val ?? "—"}</p>}
                    </div>
                  ))}

                </div>
              </div>

              <div className="border-t pt-3">
                <h4 className="font-semibold text-sm mb-2">Inventario</h4>
                {(() => {
                  const stock = stockMap.get(viewProduct.id);
                  if (!stock) return <p className="text-sm text-muted-foreground italic">Sin datos de inventario — sube el kardex para ver existencias</p>;
                  const rows: Array<[string, number, string]> = [
                    [`${ALMACEN_LABELS["1002"]} (hub)`, stock.stock_almacen_1002 ?? 0, stock.estatus_inventario || ""],
                    [`${ALMACEN_LABELS["1001"]} (hub)`, stock.stock_almacen_1001 ?? 0, stock.estatus_inventario || ""],
                    [ALMACEN_LABELS["1003"], stock.stock_almacen_1003 ?? 0, ""],
                    [ALMACEN_LABELS["1004"], stock.stock_almacen_1004 ?? 0, ""],
                  ];
                  return (
                    <div className="space-y-1 text-sm">
                      {rows.map(([label, val, st]) => (
                        <div key={label} className="flex items-center justify-between border-b last:border-0 py-1">
                          <span className="text-muted-foreground">{label}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{val} uds</span>
                            {st && (
                              <Badge variant="outline" className={
                                st === 'pedir' ? 'bg-red-50 text-red-700 text-[10px]' :
                                st === 'sobrestock' ? 'bg-orange-50 text-orange-700 text-[10px]' :
                                st === 'ok' ? 'bg-green-50 text-green-700 text-[10px]' :
                                'bg-gray-50 text-gray-600 text-[10px]'
                              }>{st.toUpperCase()}</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between pt-1 font-medium">
                        <span>Total</span>
                        <span className="font-mono">{stock.stock_total ?? 0} uds</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="border-t pt-3">
                <h4 className="font-semibold text-sm mb-2">Precios</h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-2">
                  {([
                    ...(canViewCostos ? [["Costo", viewProduct.costo_actual]] : []),
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

              {canViewCostos && <ReferenciasCostoSection codigo={viewProduct.codigo} />}

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

      <MergeDuplicatesDialog open={mergeOpen} onOpenChange={setMergeOpen} entity="productos" onMerged={() => qc.invalidateQueries({ queryKey: ["productos"] })} />

      <ProductClientsDialog
        product={clientsProduct}
        onClose={() => setClientsProduct(null)}
        onOpenSeguimiento={(companyId, marca) => {
          const brand = String(marca || "").toLowerCase().includes("phillips") ? "phillips66" : "chevron";
          setClientsProduct(null);
          setViewProduct(null);
          navigate(`/seguimiento/${brand}?company=${companyId}`);
        }}
      />
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────
function ReferenciasCostoSection({ codigo }: { codigo: string }) {
  const { data: ref } = useQuery({
    queryKey: ["inv_costos_ref", codigo],
    enabled: !!codigo,
    queryFn: async () => {
      const { data } = await supabase
        .from("inv_costos_producto")
        .select("*")
        .eq("codigo_producto", codigo)
        .in("estado", ["aplicado", "autorizado", "pendiente"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
  if (!ref) return (
    <div className="border-t pt-3">
      <h4 className="font-semibold text-sm mb-2">Referencias de Costo</h4>
      <p className="text-xs text-muted-foreground italic">Sin referencias. Sube archivos en /inventario/costos para generarlas.</p>
    </div>
  );
  return (
    <div className="border-t pt-3">
      <h4 className="font-semibold text-sm mb-2">Referencias de Costo</h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Costo Galper</p>
          <p className="font-mono">{ref.costo_galper ? `$${Number(ref.costo_galper).toFixed(2)}` : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Precio Especial</p>
          <p className="font-mono">{ref.costo_especial ? `$${Number(ref.costo_especial).toFixed(2)}` : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Lista General</p>
          <p className="font-mono">{ref.costo_lista ? `$${Number(ref.costo_lista).toFixed(2)}` : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Costo Efectivo</p>
          <p className="font-mono font-semibold">${Number(ref.costo_efectivo || 0).toFixed(2)}</p>
          <Badge variant="secondary" className="text-[10px] mt-1">{ref.costo_efectivo_fuente}</Badge>
        </div>
        {ref.costo_manual && (
          <div className="col-span-2 sm:col-span-4 mt-1">
            <Badge className="bg-orange-100 text-orange-800 border-orange-300">🔒 Costo Manual: ${Number(ref.costo_manual).toFixed(2)}</Badge>
            {ref.costo_manual_notas && <p className="text-xs text-muted-foreground mt-1">{ref.costo_manual_notas}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProductCatalog() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
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
          {isAdmin && <TabsTrigger value="precios">Configuración de Precios</TabsTrigger>}
        </TabsList>
        <TabsContent value="productos" className="min-h-[580px] overflow-y-auto"><ProductosTab /></TabsContent>
        <TabsContent value="presentaciones" className="min-h-[580px] overflow-y-auto"><PresentacionesTab /></TabsContent>
        <TabsContent value="opciones" className="min-h-[580px] overflow-y-auto"><OptionsTab /></TabsContent>
        {isAdmin && <TabsContent value="precios" className="min-h-[580px] overflow-y-auto"><PreciosConfigTab /></TabsContent>}
      </Tabs>
    </div>
  );
}
