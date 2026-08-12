import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Navigate, useSearchParams, useNavigate } from "react-router-dom";
import { BackButton } from "@/components/BackButton";
import { PageBanner } from "@/components/PageBanner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Search, TrendingUp, AlertTriangle, Calendar as CalendarIcon, ArrowUp, ArrowDown, Filter, ChevronDown, X, GripVertical, RotateCcw, MoreHorizontal, MessageCircle, Mail, ListPlus, UserCog, Loader2, EyeOff, Eye, ExternalLink } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDate } from "@/lib/formatters";
import {
  useSeguimientoVentas,
  useSeguimientoEstatusCatalogo,
  type EmpresaVendedora,
  type SeguimientoVentasRow,
  type SeguimientoEstatus,
} from "@/hooks/useSeguimientoVentas";
import { SeguimientoDetailDialog } from "@/components/seguimiento/SeguimientoDetailDialog";
import { CreateCrmTaskDialog } from "@/components/crm/CreateCrmTaskDialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useToast } from "@/hooks/use-toast";

type SortDir = "asc" | "desc";
interface SortState {
  key: string;
  dir: SortDir;
}

const DIAS_RANGES: { id: string; label: string; min: number; max: number | null }[] = [
  { id: "0-30", label: "0–30 días", min: 0, max: 30 },
  { id: "31-60", label: "31–60 días", min: 31, max: 60 },
  { id: "61-90", label: "61–90 días", min: 61, max: 90 },
  { id: "91-120", label: "91–120 días", min: 91, max: 120 },
  { id: "121+", label: "121+ días", min: 121, max: null },
];

const POTENCIAL_RANGES: { id: string; label: string; min: number; max: number | null }[] = [
  { id: "0-25", label: "0–25", min: 0, max: 25 },
  { id: "26-50", label: "26–50", min: 26, max: 50 },
  { id: "51-75", label: "51–75", min: 51, max: 75 },
  { id: "76-100", label: "76–100", min: 76, max: 100 },
  { id: "101-150", label: "101–150", min: 101, max: 150 },
  { id: "151+", label: "151+", min: 151, max: null },
];

const DIAS_COLORS: Record<string, string> = {
  "0-30": "#16a34a",
  "31-60": "#65a30d",
  "61-90": "#ca8a04",
  "91-120": "#ea580c",
  "121+": "#dc2626",
};

const POTENCIAL_COLORS: Record<string, string> = {
  "0-25": "#94a3b8",
  "26-50": "#0ea5e9",
  "51-75": "#2563eb",
  "76-100": "#7c3aed",
  "101-150": "#c026d3",
  "151+": "#db2777",
};

const EJECUTIVO_PALETTE = [
  "#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed",
  "#0891b2", "#db2777", "#ea580c", "#65a30d", "#9333ea",
  "#0ea5e9", "#e11d48", "#059669", "#ca8a04", "#6366f1",
];

function colorForIndex(i: number) {
  return EJECUTIVO_PALETTE[i % EJECUTIVO_PALETTE.length];
}

interface MSOption { id: string; label: string; color?: string; urgent?: boolean }

function MultiSelectFilter({
  label,
  options,
  selected,
  onToggle,
  onClear,
  emptyText = "Sin opciones",
  width = "w-full sm:w-64",
}: {
  label: string;
  options: MSOption[];
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  emptyText?: string;
  width?: string;
}) {
  const count = selected.length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`${width} justify-between font-normal h-9`}
        >
          <span className="truncate text-left">
            {count === 0 ? (
              <span className="text-muted-foreground">Todos</span>
            ) : count === 1 ? (
              <span
                style={{ color: options.find((o) => o.id === selected[0])?.color }}
                className="font-medium"
              >
                {options.find((o) => o.id === selected[0])?.label}
              </span>
            ) : (
              <span className="font-medium">{count} seleccionados</span>
            )}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide">{label}</span>
          {count > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-[10px] font-medium text-muted-foreground hover:text-foreground"
            >
              Limpiar
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.length === 0 ? (
          <div className="px-2 py-2 text-xs text-muted-foreground">{emptyText}</div>
        ) : (
          options.map((opt) => (
            <DropdownMenuCheckboxItem
              key={opt.id}
              checked={selected.includes(opt.id)}
              onCheckedChange={() => onToggle(opt.id)}
              onSelect={(e) => e.preventDefault()}
              className="font-medium"
              style={{ color: opt.color }}
            >
              <span className="inline-flex items-center gap-1">
                {opt.urgent && <AlertTriangle className="h-3 w-3" />}
                {opt.label}
              </span>
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StatusBadge({ estatus }: { estatus: SeguimientoEstatus | undefined | null }) {
  if (!estatus) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-widest text-white whitespace-nowrap"
      style={{ backgroundColor: estatus.color }}
      title={estatus.nombre}
    >
      {estatus.es_urgente && <AlertTriangle className="h-3 w-3" />}
      {estatus.nombre}
    </span>
  );
}

function SortableHead({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: string;
  sort: SortState | null;
  onSort: (key: string) => void;
  align?: "left" | "right" | "center";
}) {
  const active = sort?.key === sortKey;
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <TableHead className={`${alignClass} cursor-pointer select-none hover:bg-muted/40 transition-colors`} onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </span>
    </TableHead>
  );
}

function DraggableSortableHead({
  id,
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
}: {
  id: string;
  label: string;
  sortKey?: string;
  sort: SortState | null;
  onSort: (key: string) => void;
  align?: "left" | "right" | "center";
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const active = sortKey && sort?.key === sortKey;
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      className={`${alignClass} select-none hover:bg-muted/40 transition-colors group whitespace-nowrap ${isDragging ? "bg-violet-50" : ""}`}
    >
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="opacity-30 group-hover:opacity-100 cursor-grab active:cursor-grabbing touch-none"
          aria-label="Arrastrar columna"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3 w-3" />
        </button>
        <span
          className={sortKey ? "cursor-pointer" : ""}
          onClick={() => sortKey && onSort(sortKey)}
        >
          {label}
          {active && (sort.dir === "asc" ? <ArrowUp className="h-3 w-3 inline ml-1" /> : <ArrowDown className="h-3 w-3 inline ml-1" />)}
        </span>
      </span>
    </TableHead>
  );
}

function daysColor(days: number | null | undefined): string {
  if (days == null) return "text-muted-foreground";
  if (days < 15) return "text-emerald-600";
  if (days <= 30) return "text-amber-600";
  if (days <= 60) return "text-orange-600";
  return "text-red-600";
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });
}

export default function SeguimientoVentas() {
  const { brand } = useParams<{ brand: string }>();
  const invalidBrand = !!brand && brand !== "chevron" && brand !== "phillips66";
  const empresaVendedora: EmpresaVendedora =
    brand === "phillips66" ? "galsa_phillips66" : "lumaggs_chevron";
  const brandTitle = brand === "phillips66" ? "Seguimiento — Phillips 66" : "Seguimiento — Chevron";
  const brandSubtitle = brand === "phillips66" ? "Galsa" : "Lumaggs";

  // ─── Persistencia de filtros (sessionStorage) ───
  const filtrosKey = `seguimiento_filtros_${brand || "default"}`;
  const persisted = useMemo<any>(() => {
    try {
      const raw = sessionStorage.getItem(`seguimiento_filtros_${brand || "default"}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [tab, setTab] = useState<"con_venta" | "sin_venta" | "perdidos" | "recuperacion" | "productos">(
    () => persisted.tab ?? "con_venta"
  );
  const [search, setSearch] = useState(() => persisted.search ?? "");
  const [selected, setSelected] = useState<SeguimientoVentasRow | null>(null);
  const [sort, setSort] = useState<SortState | null>(() => persisted.sort ?? null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [fEstatus, setFEstatus] = useState<string[]>(() => persisted.fEstatus ?? []);
  const [fAvance, setFAvance] = useState<string[]>(() => persisted.fAvance ?? []);
  const [fDias, setFDias] = useState<string[]>(() => persisted.fDias ?? []);
  const [fPotencial, setFPotencial] = useState<string[]>(() => persisted.fPotencial ?? []);
  const [fEjecutivo, setFEjecutivo] = useState<string[]>(() => persisted.fEjecutivo ?? []);
  const [fPlaza, setFPlaza] = useState<string[]>(() => persisted.fPlaza ?? []);
  const [fRegistroFrom, setFRegistroFrom] = useState<string>(() => persisted.fRegistroFrom ?? "");
  const [fRegistroTo, setFRegistroTo] = useState<string>(() => persisted.fRegistroTo ?? "");

  const isPerdidos = tab === "perdidos";
  const tieneVenta = tab === "con_venta" || tab === "perdidos";
  const isRecuperacion = tab === "recuperacion";
  const isProductos = tab === "productos";
  const showLista = !isRecuperacion && !isProductos;
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Selección múltiple
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  useEffect(() => { setSelectedIds(new Set()); }, [tab, empresaVendedora]);

  // Ignorar clientes (Clientes con Venta / sin Venta)
  const [viewIgnorados, setViewIgnorados] = useState(false);
  const [ignoreDialogOpen, setIgnoreDialogOpen] = useState(false);
  const [ignoreRazon, setIgnoreRazon] = useState("");
  const [ignoreSaving, setIgnoreSaving] = useState(false);
  useEffect(() => { setSelectedIds(new Set()); }, [viewIgnorados]);

  // Diálogo crear tarea / actividad
  const [taskDialog, setTaskDialog] = useState<null | {
    companyId: string;
    contactId?: string;
    type: "call" | "whatsapp" | "email";
  }>(null);

  // Reasignar ejecutivo
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignUserId, setReassignUserId] = useState<string>("");
  const [reassigning, setReassigning] = useState(false);

  // Cambiar estatus masivo (para Perdidos)
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkStatusId, setBulkStatusId] = useState<string>("");
  const [bulkStatusSaving, setBulkStatusSaving] = useState(false);
  // Reactivar masivo
  const [bulkReactivating, setBulkReactivating] = useState(false);

  // Al cambiar pestaña, limpiar filtros que no aplican (no en el primer render: se restauran)
  const firstTabRun = useRef(true);
  useEffect(() => {
    if (firstTabRun.current) { firstTabRun.current = false; return; }
    setFEstatus([]);
    setFAvance([]);
    setFDias([]);
    setFPotencial([]);
    setFEjecutivo([]);
    setFPlaza([]);
    setFRegistroFrom("");
    setFRegistroTo("");
  }, [tab]);

  const { data: rows = [], isLoading } = useSeguimientoVentas({ empresaVendedora, tieneVenta, perdidos: isPerdidos });
  const { data: catalog = [] } = useSeguimientoEstatusCatalogo();

  // ─────────── Recuperación de Productos ───────────
  const [recSearch, setRecSearch] = useState(() => persisted.recSearch ?? "");
  const [recRangos, setRecRangos] = useState<string[]>(() => persisted.recRangos ?? []);
  const [recProducto, setRecProducto] = useState<string>(() => persisted.recProducto ?? "");
  const [recEjecutivo, setRecEjecutivo] = useState<string[]>(() => persisted.recEjecutivo ?? []);
  const [recSort, setRecSort] = useState<SortState | null>(() => persisted.recSort ?? null);
  const [recViewIgnorados, setRecViewIgnorados] = useState<boolean>(() => persisted.recViewIgnorados ?? false);
  const [recSelectedKeys, setRecSelectedKeys] = useState<Set<string>>(new Set());
  const [recIgnoreDialog, setRecIgnoreDialog] = useState<null | { keys: string[] }>(null);
  const [recIgnoreRazon, setRecIgnoreRazon] = useState("");
  const [recIgnoreSaving, setRecIgnoreSaving] = useState(false);

  useEffect(() => { setRecSelectedKeys(new Set()); }, [tab, empresaVendedora, recViewIgnorados]);

  const handleRecSort = (key: string) => {
    setRecSort((prev) => {
      if (prev?.key === key) return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      return { key, dir: "asc" };
    });
  };

  const { data: recActivos = [], isLoading: recActivosLoading } = useQuery({
    queryKey: ["recuperacion-activos", empresaVendedora],
    enabled: isRecuperacion,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seguimiento_ventas")
        .select("company_id, owner_id, companies:company_id(name)")
        .eq("empresa_vendedora", empresaVendedora)
        .or("perdido.is.null,perdido.eq.false")
        .limit(5000);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: recIgnorados = [] } = useQuery({
    queryKey: ["recuperacion-ignorados", empresaVendedora],
    enabled: isRecuperacion,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("seguimiento_recuperacion_ignorados")
        .select("id, company_id, producto_id, razon, ignorado_at, ignorado_por")
        .eq("empresa_vendedora", empresaVendedora)
        .eq("is_active", true)
        .limit(10000);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const recIgnoradosMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const i of recIgnorados as any[]) m.set(`${i.company_id}|${i.producto_id}`, i);
    return m;
  }, [recIgnorados]);

  // Clientes ignorados (nivel empresa)
  const { data: clientesIgnorados = [] } = useQuery({
    queryKey: ["ventas-ignorados", empresaVendedora],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("seguimiento_ventas_ignorados")
        .select("id, company_id, razon, ignorado_at, ignorado_por")
        .eq("empresa_vendedora", empresaVendedora)
        .eq("is_active", true)
        .limit(10000);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const clientesIgnoradosMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const i of clientesIgnorados as any[]) m.set(i.company_id, i);
    return m;
  }, [clientesIgnorados]);

  const { data: recFacturas = [], isLoading: recFacturasLoading } = useQuery({
    queryKey: ["recuperacion-facturas", empresaVendedora],
    enabled: isRecuperacion || isProductos,
    queryFn: async () => {
      const all: any[] = [];
      let from = 0;
      const size = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("documento_productos")
          .select("producto_id, cantidad, documentos!inner(empresa_id, fecha_documento, tipo_documento, estatus_factura, is_active, empresa_vendedora), productos:producto_id(nombre_producto, codigo)")
          .eq("documentos.tipo_documento", "factura")
          .neq("documentos.estatus_factura", "cancelada")
          .eq("documentos.is_active", true)
          .eq("documentos.empresa_vendedora", empresaVendedora)
          .range(from, from + size - 1);
        if (error) throw error;
        const page = (data || []) as any[];
        all.push(...page);
        if (page.length < size) break;
        from += size;
      }
      return all;
    },
  });

  const recLoading = recActivosLoading || recFacturasLoading;

  // ─────────── Productos ───────────
  const [prodSearch, setProdSearch] = useState(() => persisted.prodSearch ?? "");
  const [prodExpanded, setProdExpanded] = useState<string | null>(null);
  const [prodClienteSearch, setProdClienteSearch] = useState("");
  const [prodSelected, setProdSelected] = useState<Set<string>>(new Set());
  useEffect(() => { setProdSelected(new Set()); setProdExpanded(null); }, [tab, empresaVendedora]);

  // Guarda todos los filtros en sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(
        filtrosKey,
        JSON.stringify({
          tab, search, fEstatus, fAvance, fDias, fPotencial, fEjecutivo, fPlaza,
          fRegistroFrom, fRegistroTo, sort,
          recSearch, recRangos, recProducto, recEjecutivo, recSort, recViewIgnorados,
          prodSearch,
        })
      );
    } catch {}
  }, [
    filtrosKey, tab, search, fEstatus, fAvance, fDias, fPotencial, fEjecutivo, fPlaza,
    fRegistroFrom, fRegistroTo, sort,
    recSearch, recRangos, recProducto, recEjecutivo, recSort, recViewIgnorados,
    prodSearch,
  ]);

  const { data: prodCompanies = [] } = useQuery({
    queryKey: ["productos-companies"],
    enabled: isProductos,
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name").limit(10000);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const prodRows = useMemo(() => {
    if (!isProductos) return [] as any[];
    const names = new Map<string, string>();
    for (const c of prodCompanies as any[]) names.set(c.id, c.name || "—");
    const map = new Map<string, {
      producto_id: string; nombre: string; codigo: string; cantidad: number; ultima: string;
      clientesMap: Map<string, { empresa_id: string; empresa: string; cantidad: number; ultima: string }>;
    }>();
    for (const r of recFacturas as any[]) {
      const pid = r.producto_id;
      const empresaId = r.documentos?.empresa_id;
      const fecha = r.documentos?.fecha_documento;
      if (!pid || !empresaId || !fecha) continue;
      let p = map.get(pid);
      if (!p) {
        p = {
          producto_id: pid,
          nombre: r.productos?.nombre_producto || "—",
          codigo: r.productos?.codigo || "—",
          cantidad: 0,
          ultima: fecha,
          clientesMap: new Map(),
        };
        map.set(pid, p);
      }
      const cant = Number(r.cantidad || 0);
      p.cantidad += cant;
      if (fecha > p.ultima) p.ultima = fecha;
      const cli = p.clientesMap.get(empresaId);
      if (cli) {
        cli.cantidad += cant;
        if (fecha > cli.ultima) cli.ultima = fecha;
      } else {
        p.clientesMap.set(empresaId, { empresa_id: empresaId, empresa: names.get(empresaId) || "—", cantidad: cant, ultima: fecha });
      }
    }
    return Array.from(map.values())
      .map((p) => ({
        producto_id: p.producto_id,
        nombre: p.nombre,
        codigo: p.codigo,
        cantidad: p.cantidad,
        ultima: p.ultima,
        clientes: Array.from(p.clientesMap.values()).sort((a, b) => b.cantidad - a.cantidad),
      }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [isProductos, recFacturas, prodCompanies]);

  const prodFiltered = useMemo(() => {
    const s = prodSearch.trim().toLowerCase();
    if (!s) return prodRows;
    return prodRows.filter((p: any) =>
      (p.nombre || "").toLowerCase().includes(s) || (p.codigo || "").toLowerCase().includes(s));
  }, [prodRows, prodSearch]);

  const prodSelectedCompanyIds = useMemo(() => {
    const set = new Set<string>();
    for (const p of prodRows as any[]) {
      if (!prodSelected.has(p.producto_id)) continue;
      for (const c of p.clientes) set.add(c.empresa_id);
    }
    return Array.from(set);
  }, [prodRows, prodSelected]);

  const enviarWhatsappProductos = () => {
    const label = (prodRows as any[])
      .filter((p) => prodSelected.has(p.producto_id))
      .map((p) => p.nombre)
      .join(", ");
    sessionStorage.setItem("wa_campaign_preselect", JSON.stringify({ companyIds: prodSelectedCompanyIds, label }));
    navigate("/whatsapp/campaigns");
  };

  const recRows = useMemo(() => {
    if (!isRecuperacion) return [] as any[];
    const activos = new Map<string, { name: string; owner_id: string | null }>();
    for (const a of recActivos) {
      if (a.company_id) activos.set(a.company_id, { name: a.companies?.name || "—", owner_id: a.owner_id ?? null });
    }
    const grouped = new Map<string, {
      key: string; empresa_id: string; empresa: string; producto_id: string;
      producto: string; codigo: string; ultima: string; cantidad: number; owner_id: string | null;
    }>();
    for (const r of recFacturas as any[]) {
      const empresaId = r.documentos?.empresa_id;
      const fecha = r.documentos?.fecha_documento;
      if (!empresaId || !r.producto_id || !fecha) continue;
      if (!activos.has(empresaId)) continue;
      const key = `${empresaId}|${r.producto_id}`;
      const prev = grouped.get(key);
      if (prev) {
        prev.cantidad += Number(r.cantidad || 0);
        if (fecha > prev.ultima) prev.ultima = fecha;
      } else {
        grouped.set(key, {
          key,
          empresa_id: empresaId,
          empresa: activos.get(empresaId)?.name || "—",
          owner_id: activos.get(empresaId)?.owner_id ?? null,
          producto_id: r.producto_id,
          producto: r.productos?.nombre_producto || "—",
          codigo: r.productos?.codigo || "—",
          ultima: fecha,
          cantidad: Number(r.cantidad || 0),
        });
      }
    }
    const hoy = new Date();
    const out: (ReturnType<typeof Object> & any)[] = [];
    grouped.forEach((g) => {
      const [y, m, d] = String(g.ultima).slice(0, 10).split("-").map(Number);
      const last = new Date(y, (m || 1) - 1, d || 1);
      const dias = Math.floor((hoy.getTime() - last.getTime()) / 86400000);
      if (dias < 90) return;
      const rango = dias >= 180 ? "180+" : dias >= 120 ? "120-180" : "90-120";
      out.push({ ...g, dias, rango });
    });
    return out;
  }, [isRecuperacion, recActivos, recFacturas]);

  const recProductoOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of recRows) if (!m.has(r.producto_id)) m.set(r.producto_id, `${r.producto}${r.codigo && r.codigo !== "—" ? ` (${r.codigo})` : ""}`);
    return [{ value: "", label: "Todos los productos" }, ...Array.from(m.entries()).map(([value, label]) => ({ value, label }))];
  }, [recRows]);

  // Deep-link: ?company=<uuid> abre la ficha de esa empresa (crea registro si no existe)
  const [searchParams, setSearchParams] = useSearchParams();
  const deepCompanyId = searchParams.get("company");
  useEffect(() => {
    if (!deepCompanyId || invalidBrand) return;
    let cancel = false;
    (async () => {
      const { data: existing } = await (supabase as any)
        .from("seguimiento_ventas")
        .select("*, companies:company_id(id, name)")
        .eq("company_id", deepCompanyId)
        .eq("empresa_vendedora", empresaVendedora)
        .maybeSingle();
      if (cancel) return;
      if (existing) {
        setTab(existing.tiene_venta ? "con_venta" : "sin_venta");
        setSelected(existing as any);
      } else {
        const { data: created, error } = await (supabase as any)
          .from("seguimiento_ventas")
          .insert({ company_id: deepCompanyId, empresa_vendedora: empresaVendedora, tiene_venta: false })
          .select("*, companies:company_id(id, name)")
          .single();
        if (cancel) return;
        if (!error && created) {
          setTab("sin_venta");
          setSelected(created as any);
          queryClient.invalidateQueries({ queryKey: ["seguimiento_ventas"] });
        } else if (error) {
          toast({ title: "No se pudo abrir seguimiento", description: error.message, variant: "destructive" });
        }
      }
      // limpiar el query param para no reabrir al cerrar
      const next = new URLSearchParams(searchParams);
      next.delete("company");
      setSearchParams(next, { replace: true });
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepCompanyId, empresaVendedora, invalidBrand]);

  // Deep-link: ?seguimiento_id=<uuid> abre la ficha de ese seguimiento
  const deepSeguimientoId = searchParams.get("seguimiento_id");

  // Abre la ficha de una empresa en modal sin cambiar de pestaña
  const abrirFichaEmpresa = async (companyId: string) => {
    const { data: existing } = await (supabase as any)
      .from("seguimiento_ventas")
      .select("*, companies:company_id(id, name)")
      .eq("company_id", companyId)
      .eq("empresa_vendedora", empresaVendedora)
      .maybeSingle();
    if (existing) { setSelected(existing as any); return; }
    const { data: created, error } = await (supabase as any)
      .from("seguimiento_ventas")
      .insert({ company_id: companyId, empresa_vendedora: empresaVendedora, tiene_venta: false })
      .select("*, companies:company_id(id, name)")
      .single();
    if (!error && created) {
      setSelected(created as any);
      queryClient.invalidateQueries({ queryKey: ["seguimiento_ventas"] });
    } else if (error) {
      toast({ title: "No se pudo abrir la ficha", description: error.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    if (!deepSeguimientoId || invalidBrand) return;
    let cancel = false;
    (async () => {
      const { data: existing } = await (supabase as any)
        .from("seguimiento_ventas")
        .select("*, companies:company_id(id, name)")
        .eq("id", deepSeguimientoId)
        .eq("empresa_vendedora", empresaVendedora)
        .maybeSingle();
      if (cancel) return;
      if (existing) {
        setTab(existing.tiene_venta ? "con_venta" : "sin_venta");
        setSelected(existing as any);
      }
      const next = new URLSearchParams(searchParams);
      next.delete("seguimiento_id");
      next.delete("brand");
      setSearchParams(next, { replace: true });
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepSeguimientoId, empresaVendedora, invalidBrand]);

  // Filtro por matriz de permisos del módulo Seguimiento a Ventas (según ejecutivo / owner_id)
  const access = useModuleAccess("seguimiento_ventas");

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("is_active", true);
      if (error) throw error;
      return (data || []) as { user_id: string; full_name: string | null }[];
    },
    staleTime: 5 * 60_000,
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) m.set(p.user_id, p.full_name || "—");
    return m;
  }, [profiles]);

  const { data: plazasData = [] } = useQuery({
    queryKey: ["plazas_min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plazas")
        .select("id, nombre")
        .eq("is_active", true)
        .order("nombre");
      if (error) throw error;
      return (data || []) as { id: string; nombre: string }[];
    },
    staleTime: 5 * 60_000,
  });

  const { data: companyPlazas = [] } = useQuery({
    queryKey: ["company_plazas_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_plazas")
        .select("company_id, plaza_id");
      if (error) throw error;
      return (data || []) as { company_id: string; plaza_id: string }[];
    },
    staleTime: 5 * 60_000,
  });

  const plazaNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of plazasData) m.set(p.id, p.nombre);
    return m;
  }, [plazasData]);

  const companyPlazaMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const cp of companyPlazas) {
      const arr = m.get(cp.company_id) || [];
      arr.push(cp.plaza_id);
      m.set(cp.company_id, arr);
    }
    return m;
  }, [companyPlazas]);

  const getRowPlazaIds = (companyId: string): string[] => companyPlazaMap.get(companyId) || [];
  const getRowPlazaLabel = (companyId: string): string => {
    const ids = getRowPlazaIds(companyId);
    if (ids.length === 0) return "";
    return ids.map((id) => plazaNameMap.get(id) || "").filter(Boolean).join(", ");
  };

  const plazaOptions = useMemo(() => {
    const used = new Set<string>();
    for (const r of rows) for (const pid of getRowPlazaIds(r.company_id)) used.add(pid);
    return plazasData
      .filter((p) => used.has(p.id))
      .map((p, i) => ({ id: p.id, name: p.nombre, color: colorForIndex(i + 3) }));
  }, [rows, plazasData, companyPlazaMap]);

  const ejecutivoOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const r of rows) if (r.owner_id) ids.add(r.owner_id);
    return Array.from(ids)
      .map((id) => ({ id, name: profileMap.get(id) || "—" }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [rows, profileMap]);

  const recEjecutivoOptions = useMemo(() => {
    const ids = new Set<string>();
    let hasNone = false;
    for (const r of recRows) {
      if (r.owner_id) ids.add(r.owner_id);
      else hasNone = true;
    }
    const list = Array.from(ids)
      .map((id) => ({ id, name: profileMap.get(id) || "—" }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
    return hasNone ? [...list, { id: "__none__", name: "Sin asignar" }] : list;
  }, [recRows, profileMap]);

  const recFiltered = useMemo(() => {
    const q = recSearch.trim().toLowerCase();
    let list = recRows.filter((r) => {
      const isIgnorado = recIgnoradosMap.has(`${r.empresa_id}|${r.producto_id}`);
      if (recViewIgnorados ? !isIgnorado : isIgnorado) return false;
      if (recRangos.length > 0 && !recRangos.includes(r.rango)) return false;
      if (recProducto && r.producto_id !== recProducto) return false;
      if (recEjecutivo.length > 0 && !recEjecutivo.includes(r.owner_id || "__none__")) return false;
      if (q) {
        const words = q.split(/\s+/);
        const text = `${r.empresa} ${r.producto} ${r.codigo}`.toLowerCase();
        if (!words.every((w) => text.includes(w))) return false;
      }
      return true;
    });
    const key = recSort?.key;
    if (!key) {
      list = [...list].sort((a, b) => b.dias - a.dias);
    } else {
      const dir = recSort?.dir === "desc" ? -1 : 1;
      const val = (r: any) => {
        switch (key) {
          case "empresa": return String(r.empresa || "").toLowerCase();
          case "producto": return String(r.producto || "").toLowerCase();
          case "codigo": return String(r.codigo || "").toLowerCase();
          case "ejecutivo": return (r.owner_id ? profileMap.get(r.owner_id) || "" : "").toLowerCase();
          case "ultima": return String(r.ultima || "");
          case "dias": return r.dias as number;
          case "cantidad": return r.cantidad as number;
          default: return "";
        }
      };
      list = [...list].sort((a, b) => {
        const va = val(a); const vb = val(b);
        if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
        return String(va).localeCompare(String(vb), "es") * dir;
      });
    }
    return list;
  }, [recRows, recSearch, recRangos, recProducto, recEjecutivo, recSort, recIgnoradosMap, recViewIgnorados, profileMap]);

  const recTotal180 = useMemo(() => recFiltered.filter((r) => r.rango === "180+").length, [recFiltered]);

  const submitIgnorar = async () => {
    if (!recIgnoreDialog) return;
    setRecIgnoreSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const byKey = new Map(recRows.map((r: any) => [r.key, r]));
      const payload = recIgnoreDialog.keys
        .map((k) => byKey.get(k))
        .filter((r: any) => r && !recIgnoradosMap.has(`${r.empresa_id}|${r.producto_id}`))
        .map((r: any) => ({
          empresa_vendedora: empresaVendedora,
          company_id: r.empresa_id,
          producto_id: r.producto_id,
          razon: recIgnoreRazon.trim() || null,
          ignorado_por: auth?.user?.id ?? null,
        }));
      if (payload.length > 0) {
        const { error } = await (supabase as any).from("seguimiento_recuperacion_ignorados").insert(payload);
        if (error && !String(error.message || "").toLowerCase().includes("duplicate")) throw error;
      }
      toast({ title: "Productos ignorados", description: `${payload.length} combinación${payload.length === 1 ? "" : "es"} ignorada${payload.length === 1 ? "" : "s"}.` });
      setRecIgnoreDialog(null);
      setRecIgnoreRazon("");
      setRecSelectedKeys(new Set());
      queryClient.invalidateQueries({ queryKey: ["recuperacion-ignorados", empresaVendedora] });
    } catch (e: any) {
      toast({ title: "Error al ignorar", description: e?.message || "Intenta de nuevo.", variant: "destructive" });
    } finally {
      setRecIgnoreSaving(false);
    }
  };

  const restaurarIgnorado = async (row: any) => {
    const rec = recIgnoradosMap.get(`${row.empresa_id}|${row.producto_id}`);
    if (!rec) return;
    const { error } = await (supabase as any)
      .from("seguimiento_recuperacion_ignorados")
      .update({ is_active: false })
      .eq("id", rec.id);
    if (error) {
      toast({ title: "Error al restaurar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Producto restaurado" });
    queryClient.invalidateQueries({ queryKey: ["recuperacion-ignorados", empresaVendedora] });
  };

  const submitIgnorarClientes = async () => {
    setIgnoreSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const byId = new Map(rows.map((r) => [r.id, r]));
      const payload = Array.from(selectedIds)
        .map((id) => byId.get(id))
        .filter((r): r is SeguimientoVentasRow => !!r && !clientesIgnoradosMap.has(r.company_id))
        .map((r) => ({
          empresa_vendedora: empresaVendedora,
          company_id: r.company_id,
          razon: ignoreRazon.trim() || null,
          ignorado_por: auth?.user?.id ?? null,
        }));
      if (payload.length > 0) {
        const { error } = await (supabase as any).from("seguimiento_ventas_ignorados").insert(payload);
        if (error) throw error;
      }
      toast({ title: "Clientes ignorados", description: `${payload.length} cliente${payload.length === 1 ? "" : "s"} ignorado${payload.length === 1 ? "" : "s"}.` });
      setIgnoreDialogOpen(false);
      setIgnoreRazon("");
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["ventas-ignorados", empresaVendedora] });
    } catch (e: any) {
      toast({ title: "Error al ignorar", description: e?.message || "Intenta de nuevo.", variant: "destructive" });
    } finally {
      setIgnoreSaving(false);
    }
  };

  const restaurarClienteIgnorado = async (companyId: string) => {
    const rec = clientesIgnoradosMap.get(companyId);
    if (!rec) return;
    const { error } = await (supabase as any)
      .from("seguimiento_ventas_ignorados")
      .update({ is_active: false })
      .eq("id", rec.id);
    if (error) {
      toast({ title: "Error al restaurar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Cliente restaurado" });
    queryClient.invalidateQueries({ queryKey: ["ventas-ignorados", empresaVendedora] });
  };

  const ambito = tieneVenta ? "con_venta" : "sin_venta";
  const estatusOptions = useMemo(
    () => catalog.filter((c) => c.ambito === ambito && c.familia === (tieneVenta ? "riesgo" : "gestion")),
    [catalog, ambito, tieneVenta]
  );
  const avanceOptions = useMemo(
    () => catalog.filter((c) => c.ambito === "con_venta" && ["avance", "ritmo"].includes(c.familia as string)),
    [catalog]
  );

  const toggleInArray = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const activeFiltersCount =
    fEstatus.length + fAvance.length + fDias.length + fPotencial.length + fEjecutivo.length + fPlaza.length +
    (fRegistroFrom ? 1 : 0) + (fRegistroTo ? 1 : 0);

  const clearAllFilters = () => {
    setFEstatus([]);
    setFAvance([]);
    setFDias([]);
    setFPotencial([]);
    setFEjecutivo([]);
    setFPlaza([]);
    setFRegistroFrom("");
    setFRegistroTo("");
  };

  const catalogMap = useMemo(() => {
    const m = new Map<string, SeguimientoEstatus>();
    for (const c of catalog) m.set(c.id, c);
    return m;
  }, [catalog]);

  const getEffectiveStatusId = (row: SeguimientoVentasRow): string | null => {
    if (row.estatus_manual && row.estatus_manual_id) return row.estatus_manual_id;
    return tieneVenta ? row.estatus_riesgo_id : row.estatus_gestion_id;
  };

  const handleSort = (key: string) => {
    setSort((prev) => {
      if (prev?.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: "asc" };
    });
  };

  // ====== Columnas configurables (drag-and-drop) ======
  type ColDef = {
    id: string;
    label: string;
    sortKey?: string;
    align?: "left" | "right" | "center";
    cellClassName?: string;
    render: (r: SeguimientoVentasRow) => React.ReactNode;
  };

  const allColumns: ColDef[] = useMemo(() => {
    const base: ColDef[] = [
      {
        id: "empresa",
        label: "Empresa",
        sortKey: "empresa",
        cellClassName: "font-medium",
        render: (r) => r.companies?.name || "—",
      },
      {
        id: "ejecutivo",
        label: "Ejecutivo",
        sortKey: "ejecutivo",
        cellClassName: "text-xs font-light text-muted-foreground",
        render: (r) => r.owner_id ? (profileMap.get(r.owner_id) || "—") : <span className="italic">Sin asignar</span>,
      },
      {
        id: "plaza",
        label: "Plaza",
        sortKey: "plaza",
        cellClassName: "text-xs font-light text-muted-foreground",
        render: (r) => getRowPlazaLabel(r.company_id) || <span className="italic">—</span>,
      },
      {
        id: "registrada",
        label: "Registrada",
        sortKey: "registrada",
        cellClassName: "text-xs font-light text-muted-foreground whitespace-nowrap",
        render: (r) => r.companies?.created_at ? formatDate(r.companies.created_at) : <span className="italic">—</span>,
      },
      {
        id: "estatus",
        label: "Estatus",
        sortKey: "estatus",
        render: (r) => <StatusBadge estatus={catalogMap.get(getEffectiveStatusId(r) || "")} />,
      },
    ];
    if (tieneVenta) {
      return [
        ...base,
        {
          id: "avance",
          label: "Avance",
          sortKey: "avance",
          render: (r) => <StatusBadge estatus={r.estatus_ritmo_id ? catalogMap.get(r.estatus_ritmo_id) : null} />,
        },
        {
          id: "ultima_compra",
          label: "Última compra",
          sortKey: "ultima_compra",
          render: (r) => (
            <>
              <span className={`font-medium ${daysColor(r.dias_ultima_compra)}`}>
                {r.dias_ultima_compra != null ? `${r.dias_ultima_compra} d` : "—"}
              </span>
              {r.fecha_ultima_compra && (
                <span className="block text-[10px] text-muted-foreground">{formatDate(r.fecha_ultima_compra)}</span>
              )}
            </>
          ),
        },
        { id: "potencial", label: "Potencial", sortKey: "potencial", align: "right", render: (r) => fmtNum(r.potencial) },
        { id: "promedio_mensual", label: "Prom. mensual", sortKey: "promedio_mensual", align: "right", render: (r) => fmtNum(r.promedio_historico_mensual) },
        { id: "acum_mes", label: "Acum. mes", sortKey: "acum_mes", align: "right", render: (r) => fmtNum(r.acum_mes) },
        { id: "acum_mes_anterior", label: "Mes ant.", sortKey: "acum_mes_anterior", align: "right", render: (r) => fmtNum(r.acum_mes_anterior) },
        { id: "acum_anio", label: "Acum. año", sortKey: "acum_anio", align: "right", render: (r) => fmtNum(r.acum_anio) },
        { id: "actividades", label: "Activ.", sortKey: "actividades", align: "center", render: (r) => <Badge variant="outline">{r.actividades_activas}</Badge> },
        { id: "proxima_tarea", label: "Próx. tarea", sortKey: "proxima_tarea", cellClassName: "text-xs text-muted-foreground", render: (r) => r.proxima_tarea_fecha ? formatDate(r.proxima_tarea_fecha) : "—" },
      ];
    }
    return [
      ...base,
      {
        id: "ultima_actividad",
        label: "Últ. actividad",
        sortKey: "ultima_actividad",
        render: (r) => (
          <>
            <span className={`font-medium ${daysColor(r.dias_ultima_actividad)}`}>
              {r.dias_ultima_actividad != null ? `${r.dias_ultima_actividad} d` : "—"}
            </span>
            {r.ultima_actividad_fecha && (
              <span className="block text-[10px] text-muted-foreground">{formatDate(r.ultima_actividad_fecha)}</span>
            )}
          </>
        ),
      },
      { id: "cotizaciones", label: "Cotiz.", sortKey: "cotizaciones", align: "center", render: (r) => r.cotizaciones_total },
      {
        id: "ultima_cotizacion",
        label: "Últ. cotización",
        sortKey: "ultima_cotizacion",
        render: (r) => (
          <>
            <span className={`font-medium ${daysColor(r.dias_ultima_cotizacion)}`}>
              {r.dias_ultima_cotizacion != null ? `${r.dias_ultima_cotizacion} d` : "—"}
            </span>
            {r.ultima_cotizacion_fecha && (
              <span className="block text-[10px] text-muted-foreground">{formatDate(r.ultima_cotizacion_fecha)}</span>
            )}
          </>
        ),
      },
      { id: "actividades", label: "Activ.", sortKey: "actividades", align: "center", render: (r) => <Badge variant="outline">{r.actividades_activas}</Badge> },
      { id: "proxima_tarea", label: "Próx. tarea", sortKey: "proxima_tarea", cellClassName: "text-xs text-muted-foreground", render: (r) => r.proxima_tarea_fecha ? formatDate(r.proxima_tarea_fecha) : "—" },
    ];
  }, [tieneVenta, profileMap, catalogMap, companyPlazaMap, plazaNameMap]);

  const defaultOrderIds = useMemo(() => allColumns.map((c) => c.id), [allColumns]);
  const colsStorageKey = `seguimiento_cols_order_${tieneVenta ? "con_venta" : "sin_venta"}`;

  const [colOrder, setColOrder] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(`seguimiento_cols_order_${tieneVenta ? "con_venta" : "sin_venta"}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(colsStorageKey);
      setColOrder(raw ? JSON.parse(raw) : []);
    } catch {
      setColOrder([]);
    }
  }, [colsStorageKey]);

  const orderedColumns = useMemo(() => {
    if (!colOrder || colOrder.length === 0) return allColumns;
    const map = new Map(allColumns.map((c) => [c.id, c]));
    const seen = new Set<string>();
    const out: ColDef[] = [];
    for (const id of colOrder) {
      const c = map.get(id);
      if (c && !seen.has(id)) { out.push(c); seen.add(id); }
    }
    // append any new columns not yet in saved order
    for (const c of allColumns) if (!seen.has(c.id)) out.push(c);
    return out;
  }, [allColumns, colOrder]);

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleColumnDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const current = orderedColumns.map((c) => c.id);
    const oldIndex = current.indexOf(active.id as string);
    const newIndex = current.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(current, oldIndex, newIndex);
    setColOrder(next);
    try { localStorage.setItem(colsStorageKey, JSON.stringify(next)); } catch {}
  };

  const resetColumnOrder = () => {
    setColOrder([]);
    try { localStorage.removeItem(colsStorageKey); } catch {}
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    // Filtro por permisos: aplica antes de cualquier otro filtro
    let accessFiltered: SeguimientoVentasRow[] = rows;
    if (access.accessLevel === "ninguno") {
      accessFiltered = [];
    } else if (access.accessLevel === "propio") {
      accessFiltered = rows.filter((r) => r.owner_id && r.owner_id === access.userId);
    } else if (access.accessLevel === "equipo") {
      const allowed = new Set(access.teamMemberIds);
      accessFiltered = rows.filter((r) => r.owner_id && allowed.has(r.owner_id));
    }
    let base = term
      ? accessFiltered.filter((r) => (r.companies?.name || "").toLowerCase().includes(term))
      : accessFiltered;

    // Clientes ignorados (no aplica en Perdidos)
    if (!isPerdidos) {
      base = base.filter((r) => {
        const ign = clientesIgnoradosMap.has(r.company_id);
        return viewIgnorados ? ign : !ign;
      });
    }

    if (fEstatus.length > 0) {
      base = base.filter((r) => {
        // Usa el estatus EFECTIVO (manual si está activo, si no el calculado).
        const id = r.estatus_manual && r.estatus_manual_id
          ? r.estatus_manual_id
          : (tieneVenta ? r.estatus_riesgo_id : r.estatus_gestion_id);
        return id ? fEstatus.includes(id) : false;
      });
    }
    if (tieneVenta && fAvance.length > 0) {
      base = base.filter((r) => (r.estatus_ritmo_id ? fAvance.includes(r.estatus_ritmo_id) : false));
    }
    if (fDias.length > 0) {
      base = base.filter((r) => {
        const d = tieneVenta ? r.dias_ultima_compra : r.dias_ultima_actividad;
        if (d == null) return false;
        return fDias.some((id) => {
          const range = DIAS_RANGES.find((x) => x.id === id);
          if (!range) return false;
          return d >= range.min && (range.max == null || d <= range.max);
        });
      });
    }
    if (tieneVenta && fPotencial.length > 0) {
      base = base.filter((r) => {
        const p = r.potencial;
        if (p == null) return false;
        return fPotencial.some((id) => {
          const range = POTENCIAL_RANGES.find((x) => x.id === id);
          if (!range) return false;
          return p >= range.min && (range.max == null || p <= range.max);
        });
      });
    }
    if (fEjecutivo.length > 0) {
      base = base.filter((r) => {
        if (fEjecutivo.includes("__none__")) {
          if (!r.owner_id) return true;
        }
        return r.owner_id ? fEjecutivo.includes(r.owner_id) : false;
      });
    }
    if (fPlaza.length > 0) {
      base = base.filter((r) => {
        const ids = getRowPlazaIds(r.company_id);
        if (fPlaza.includes("__none__") && ids.length === 0) return true;
        return ids.some((id) => fPlaza.includes(id));
      });
    }
    if (fRegistroFrom) {
      const fromTs = new Date(fRegistroFrom + "T00:00:00").getTime();
      base = base.filter((r) => {
        const ca = r.companies?.created_at;
        return ca ? new Date(ca).getTime() >= fromTs : false;
      });
    }
    if (fRegistroTo) {
      const toTs = new Date(fRegistroTo + "T23:59:59").getTime();
      base = base.filter((r) => {
        const ca = r.companies?.created_at;
        return ca ? new Date(ca).getTime() <= toTs : false;
      });
    }

    if (!sort) {
      // Default: urgencia primero, luego recencia
      return [...base].sort((a, b) => {
        const ea = catalogMap.get(getEffectiveStatusId(a) || "");
        const eb = catalogMap.get(getEffectiveStatusId(b) || "");
        const ua = ea?.es_urgente ? 1 : 0;
        const ub = eb?.es_urgente ? 1 : 0;
        if (ua !== ub) return ub - ua;
        const da = tieneVenta ? (a.dias_ultima_compra ?? -1) : (a.dias_ultima_actividad ?? -1);
        const db = tieneVenta ? (b.dias_ultima_compra ?? -1) : (b.dias_ultima_actividad ?? -1);
        return db - da;
      });
    }

    const dir = sort.dir === "asc" ? 1 : -1;
    return [...base].sort((a, b) => {
      let va: any;
      let vb: any;

      switch (sort.key) {
        case "empresa":
          va = (a.companies?.name || "").toLowerCase();
          vb = (b.companies?.name || "").toLowerCase();
          break;
        case "ejecutivo":
          va = (a.owner_id ? profileMap.get(a.owner_id) || "" : "").toLowerCase();
          vb = (b.owner_id ? profileMap.get(b.owner_id) || "" : "").toLowerCase();
          break;
        case "plaza":
          va = getRowPlazaLabel(a.company_id).toLowerCase();
          vb = getRowPlazaLabel(b.company_id).toLowerCase();
          break;
        case "registrada":
          va = a.companies?.created_at ? new Date(a.companies.created_at).getTime() : 0;
          vb = b.companies?.created_at ? new Date(b.companies.created_at).getTime() : 0;
          break;
        case "estatus": {
          const ea = catalogMap.get(getEffectiveStatusId(a) || "");
          const eb = catalogMap.get(getEffectiveStatusId(b) || "");
          va = ea?.orden ?? 999;
          vb = eb?.orden ?? 999;
          break;
        }
        case "avance": {
          const ra = catalogMap.get(a.estatus_ritmo_id || "");
          const rb = catalogMap.get(b.estatus_ritmo_id || "");
          va = ra?.orden ?? 999;
          vb = rb?.orden ?? 999;
          break;
        }
        case "ultima_compra":
          va = a.dias_ultima_compra ?? -1;
          vb = b.dias_ultima_compra ?? -1;
          break;
        case "potencial":
          va = a.potencial ?? 0;
          vb = b.potencial ?? 0;
          break;
        case "promedio_mensual":
          va = a.promedio_historico_mensual ?? 0;
          vb = b.promedio_historico_mensual ?? 0;
          break;
        case "acum_mes":
          va = a.acum_mes ?? 0;
          vb = b.acum_mes ?? 0;
          break;
        case "acum_mes_anterior":
          va = a.acum_mes_anterior ?? 0;
          vb = b.acum_mes_anterior ?? 0;
          break;
        case "acum_anio":
          va = a.acum_anio ?? 0;
          vb = b.acum_anio ?? 0;
          break;
        case "actividades":
          va = a.actividades_activas ?? 0;
          vb = b.actividades_activas ?? 0;
          break;
        case "proxima_tarea":
          va = a.proxima_tarea_fecha ? new Date(a.proxima_tarea_fecha).getTime() : 0;
          vb = b.proxima_tarea_fecha ? new Date(b.proxima_tarea_fecha).getTime() : 0;
          break;
        case "ultima_actividad":
          va = a.dias_ultima_actividad ?? -1;
          vb = b.dias_ultima_actividad ?? -1;
          break;
        case "cotizaciones":
          va = a.cotizaciones_total ?? 0;
          vb = b.cotizaciones_total ?? 0;
          break;
        case "ultima_cotizacion":
          va = a.dias_ultima_cotizacion ?? -1;
          vb = b.dias_ultima_cotizacion ?? -1;
          break;
        default:
          return 0;
      }

      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [rows, search, catalogMap, tieneVenta, isPerdidos, viewIgnorados, clientesIgnoradosMap, sort, fEstatus, fAvance, fDias, fPotencial, fEjecutivo, fPlaza, fRegistroFrom, fRegistroTo, profileMap, companyPlazaMap, plazaNameMap, access.accessLevel, access.teamMemberIds, access.userId]);

  if (invalidBrand) return <Navigate to="/seguimiento" replace />;


  return (
    <div className="space-y-4">
      <BackButton fallback="/seguimiento" />
      <PageBanner
        title={brandTitle}
        description={brandSubtitle}
        avatar={
          <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <TrendingUp className="h-5 w-5" />
          </div>
        }
      />

      {/* Controles */}
      <div className="flex flex-col gap-3 items-start">
        <div className="inline-flex rounded-lg border bg-muted/30 p-1 self-start">
          <button
            onClick={() => setTab("con_venta")}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide rounded-md transition-colors ${
              tab === "con_venta"
                ? "bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Clientes con Venta
          </button>
          <button
            onClick={() => setTab("sin_venta")}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide rounded-md transition-colors ${
              tab === "sin_venta"
                ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Clientes sin Venta
          </button>
          <button
            onClick={() => setTab("perdidos")}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide rounded-md transition-colors ${
              tab === "perdidos"
                ? "bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Clientes Perdidos
          </button>
          <button
            onClick={() => setTab("recuperacion")}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide rounded-md transition-colors ${
              tab === "recuperacion"
                ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Recuperación de Productos
          </button>
          <button
            onClick={() => setTab("productos")}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide rounded-md transition-colors ${
              tab === "productos"
                ? "bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Productos
          </button>
        </div>
        {showLista && (
        <>
        {/* Botones de filtro siempre visibles (desde catálogo) */}
        <div className="w-full space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground w-16">Estatus</span>
            {estatusOptions.length === 0 ? (
              <span className="text-xs text-muted-foreground italic">Sin opciones</span>
            ) : estatusOptions.map((o) => {
              const sel = fEstatus.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setFEstatus((arr) => toggleInArray(arr, o.id))}
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-all"
                  style={
                    sel
                      ? { backgroundColor: o.color, color: "white", borderColor: o.color }
                      : { backgroundColor: `${o.color}14`, color: o.color, borderColor: `${o.color}55` }
                  }
                  aria-pressed={sel}
                >
                  {o.es_urgente && <AlertTriangle className="h-3 w-3" />}
                  {o.nombre}
                </button>
              );
            })}
            {fEstatus.length > 0 && (
              <button type="button" onClick={() => setFEstatus([])}
                className="text-[10px] text-muted-foreground hover:text-foreground underline ml-1">
                Limpiar
              </button>
            )}
          </div>
          {tieneVenta && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground w-16">Avance</span>
              {avanceOptions.map((o) => {
                const sel = fAvance.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setFAvance((arr) => toggleInArray(arr, o.id))}
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-all"
                    style={
                      sel
                        ? { backgroundColor: o.color, color: "white", borderColor: o.color }
                        : { backgroundColor: `${o.color}14`, color: o.color, borderColor: `${o.color}55` }
                    }
                    aria-pressed={sel}
                  >
                    {o.nombre}
                  </button>
                );
              })}
              {fAvance.length > 0 && (
                <button type="button" onClick={() => setFAvance([])}
                  className="text-[10px] text-muted-foreground hover:text-foreground underline ml-1">
                  Limpiar
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 font-light"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-9"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <Filter className="h-4 w-4" />
            Filtros
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">{activeFiltersCount}</Badge>
            )}
            <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
          </Button>
          {activeFiltersCount > 0 && (
            <Button variant="outline" size="sm" className="gap-2 h-9" onClick={clearAllFilters}>
              <RotateCcw className="h-4 w-4" /> Reiniciar filtros
            </Button>
          )}
          {(tab === "con_venta" || tab === "sin_venta") && (
            <Button variant="outline" size="sm" className="gap-2 h-9" onClick={() => setViewIgnorados((v) => !v)}>
              {viewIgnorados ? <><Eye className="h-4 w-4" /> Ver activos</> : <><EyeOff className="h-4 w-4" /> Ver ignorados</>}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Ejecutivo</p>
            <MultiSelectFilter
              label="Ejecutivo"
              options={[
                { id: "__none__", label: "Sin asignar", color: "#64748b" },
                ...ejecutivoOptions.map((opt, i) => ({ id: opt.id, label: opt.name, color: colorForIndex(i) })),
              ]}
              selected={fEjecutivo}
              onToggle={(id) => setFEjecutivo((arr) => toggleInArray(arr, id))}
              onClear={() => setFEjecutivo([])}
              emptyText="Sin ejecutivos"
              width="w-full sm:w-56"
            />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Plaza</p>
            <MultiSelectFilter
              label="Plaza"
              options={[
                { id: "__none__", label: "Sin plaza", color: "#64748b" },
                ...plazaOptions.map((p) => ({ id: p.id, label: p.name, color: p.color })),
              ]}
              selected={fPlaza}
              onToggle={(id) => setFPlaza((arr) => toggleInArray(arr, id))}
              onClear={() => setFPlaza([])}
              emptyText="Sin plazas"
              width="w-full sm:w-56"
            />
          </div>
        </div>
        </>
        )}
      </div>

      {/* Panel de filtros colapsable */}
      {showLista && (
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleContent>
          <Card className="border-violet-200/60">
            <div className="bg-gradient-to-r from-violet-50 to-blue-50 px-4 py-2.5 border-b flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-violet-900">
                <Filter className="h-3.5 w-3.5" /> Filtros rápidos
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 normal-case tracking-normal">
                    {activeFiltersCount} activos
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearAllFilters}>
                    <X className="h-3 w-3 mr-1" /> Limpiar
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setFiltersOpen(false)}>
                  Colapsar
                </Button>
              </div>
            </div>
            <CardContent className="p-3">
              <div className="grid grid-flow-row sm:grid-flow-col sm:grid-rows-3 lg:grid-rows-2 gap-x-4 gap-y-2 sm:gap-x-6 lg:gap-x-10 justify-start">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">
                    Estatus
                  </p>
                  <MultiSelectFilter
                    label="Estatus"
                    options={estatusOptions.map((o) => ({ id: o.id, label: o.nombre, color: o.color, urgent: o.es_urgente }))}
                    selected={fEstatus}
                    onToggle={(id) => setFEstatus((arr) => toggleInArray(arr, id))}
                    onClear={() => setFEstatus([])}
                  />
                </div>

                {tieneVenta && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">
                      Avance
                    </p>
                    <MultiSelectFilter
                      label="Avance"
                      options={avanceOptions.map((o) => ({ id: o.id, label: o.nombre, color: o.color }))}
                      selected={fAvance}
                      onToggle={(id) => setFAvance((arr) => toggleInArray(arr, id))}
                      onClear={() => setFAvance([])}
                    />
                  </div>
                )}

                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">
                    {tieneVenta ? "Última compra" : "Última actividad"} (30 días)
                  </p>
                  <MultiSelectFilter
                    label="Días"
                    options={DIAS_RANGES.map((r) => ({ id: r.id, label: r.label, color: DIAS_COLORS[r.id] }))}
                    selected={fDias}
                    onToggle={(id) => setFDias((arr) => toggleInArray(arr, id))}
                    onClear={() => setFDias([])}
                  />
                </div>

                {tieneVenta && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">
                      Potencial (rangos de 25)
                    </p>
                    <MultiSelectFilter
                      label="Potencial"
                      options={POTENCIAL_RANGES.map((r) => ({ id: r.id, label: r.label, color: POTENCIAL_COLORS[r.id] }))}
                      selected={fPotencial}
                      onToggle={(id) => setFPotencial((arr) => toggleInArray(arr, id))}
                      onClear={() => setFPotencial([])}
                    />
                  </div>
                )}

                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">
                    Ejecutivo
                  </p>
                  <MultiSelectFilter
                    label="Ejecutivo"
                    options={[
                      { id: "__none__", label: "Sin asignar", color: "#64748b" },
                      ...ejecutivoOptions.map((opt, i) => ({ id: opt.id, label: opt.name, color: colorForIndex(i) })),
                    ]}
                    selected={fEjecutivo}
                    onToggle={(id) => setFEjecutivo((arr) => toggleInArray(arr, id))}
                    onClear={() => setFEjecutivo([])}
                    emptyText="Sin ejecutivos"
                  />
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">
                    Plaza
                  </p>
                  <MultiSelectFilter
                    label="Plaza"
                    options={[
                      { id: "__none__", label: "Sin plaza", color: "#64748b" },
                      ...plazaOptions.map((p) => ({ id: p.id, label: p.name, color: p.color })),
                    ]}
                    selected={fPlaza}
                    onToggle={(id) => setFPlaza((arr) => toggleInArray(arr, id))}
                    onClear={() => setFPlaza([])}
                    emptyText="Sin plazas"
                  />
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">
                    Fecha de registro
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="date"
                      value={fRegistroFrom}
                      onChange={(e) => setFRegistroFrom(e.target.value)}
                      className="h-9 w-[140px] font-light"
                      placeholder="Desde"
                    />
                    <span className="text-xs text-muted-foreground">a</span>
                    <Input
                      type="date"
                      value={fRegistroTo}
                      onChange={(e) => setFRegistroTo(e.target.value)}
                      className="h-9 w-[140px] font-light"
                      placeholder="Hasta"
                    />
                    {(fRegistroFrom || fRegistroTo) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => { setFRegistroFrom(""); setFRegistroTo(""); }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
      )}

      {/* Barra de acciones masivas */}
      {showLista && selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-violet-50 dark:bg-violet-950/30 px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-violet-900 dark:text-violet-200">
            {selectedIds.size} seleccionado{selectedIds.size === 1 ? "" : "s"}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => { setReassignUserId(""); setReassignOpen(true); }}>
              <UserCog className="h-3.5 w-3.5" /> Reasignar ejecutivo
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => { setBulkStatusId(""); setBulkStatusOpen(true); }}>
              <Filter className="h-3.5 w-3.5" /> Cambiar estatus
            </Button>
            {!isPerdidos && !viewIgnorados && (
              <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => { setIgnoreRazon(""); setIgnoreDialogOpen(true); }}>
                <EyeOff className="h-3.5 w-3.5" /> Ignorar
              </Button>
            )}
            {isPerdidos && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                disabled={bulkReactivating}
                onClick={async () => {
                  const ids = Array.from(selectedIds);
                  if (ids.length === 0) return;
                  setBulkReactivating(true);
                  try {
                    const { error } = await supabase
                      .from("seguimiento_ventas")
                      .update({ perdido: false, fecha_perdida: null } as any)
                      .in("id", ids);
                    if (error) throw error;
                    toast({ title: "Registros reactivados", description: `${ids.length} cliente${ids.length === 1 ? "" : "s"} reactivado${ids.length === 1 ? "" : "s"}.` });
                    setSelectedIds(new Set());
                    queryClient.invalidateQueries({ queryKey: ["seguimiento_ventas"] });
                  } catch (e: any) {
                    toast({ title: "Error al reactivar", description: e?.message || "Intenta de nuevo.", variant: "destructive" });
                  } finally {
                    setBulkReactivating(false);
                  }
                }}
              >
                {bulkReactivating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Reactivar
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => setSelectedIds(new Set())}>
              <X className="h-3.5 w-3.5" /> Limpiar
            </Button>
          </div>
        </div>
      )}

      {isRecuperacion && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Combinaciones</p>
                <p className="text-2xl font-semibold">{recFiltered.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Rango 180+</p>
                <p className="text-2xl font-semibold text-red-600">{recTotal180}</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="relative flex-1 sm:w-72 sm:flex-none">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empresa o producto..."
                value={recSearch}
                onChange={(e) => setRecSearch(e.target.value)}
                className="pl-8 h-9 font-light"
              />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Rango</p>
              <MultiSelectFilter
                label="Rango"
                options={[
                  { id: "90-120", label: "90–120 días", color: "#f59e0b" },
                  { id: "120-180", label: "120–180 días", color: "#ea580c" },
                  { id: "180+", label: "180+ días", color: "#dc2626" },
                ]}
                selected={recRangos}
                onToggle={(id) => setRecRangos((arr) => toggleInArray(arr, id))}
                onClear={() => setRecRangos([])}
                width="w-full sm:w-48"
              />
            </div>
            <div className="w-full sm:w-72">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Producto</p>
              <SearchableSelect
                value={recProducto}
                onValueChange={setRecProducto}
                options={recProductoOptions}
                placeholder="Producto"
              />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Ejecutivo</p>
              <MultiSelectFilter
                label="Ejecutivo"
                options={recEjecutivoOptions.map((opt, i) => ({ id: opt.id, label: opt.name, color: colorForIndex(i) }))}
                selected={recEjecutivo}
                onToggle={(id) => setRecEjecutivo((arr) => toggleInArray(arr, id))}
                onClear={() => setRecEjecutivo([])}
                width="w-full sm:w-56"
              />
            </div>
            {(recSearch || recRangos.length > 0 || recProducto || recEjecutivo.length > 0) && (
              <Button
                size="sm"
                variant="outline"
                className="h-9 gap-1"
                onClick={() => { setRecSearch(""); setRecRangos([]); setRecProducto(""); setRecEjecutivo([]); }}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reiniciar filtros
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-9 gap-1"
              onClick={() => setRecViewIgnorados((v) => !v)}
            >
              {recViewIgnorados ? <><Eye className="h-3.5 w-3.5" /> Ver por recuperar</> : <><EyeOff className="h-3.5 w-3.5" /> Ver ignorados</>}
            </Button>
          </div>

          {!recViewIgnorados && recSelectedKeys.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-violet-50 dark:bg-violet-950/30 px-3 py-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-violet-900 dark:text-violet-200">
                {recSelectedKeys.size} seleccionado{recSelectedKeys.size === 1 ? "" : "s"}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => { setRecIgnoreRazon(""); setRecIgnoreDialog({ keys: Array.from(recSelectedKeys) }); }}>
                  <EyeOff className="h-3.5 w-3.5" /> Ignorar seleccionados
                </Button>
                <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => setRecSelectedKeys(new Set())}>
                  <X className="h-3.5 w-3.5" /> Limpiar
                </Button>
              </div>
            </div>
          )}

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={recFiltered.length > 0 && recFiltered.every((r) => recSelectedKeys.has(r.key))}
                      onCheckedChange={(v) =>
                        setRecSelectedKeys(v ? new Set(recFiltered.map((r) => r.key)) : new Set())
                      }
                      aria-label="Seleccionar todos"
                    />
                  </TableHead>
                  <SortableHead label="Empresa" sortKey="empresa" sort={recSort} onSort={handleRecSort} />
                  <SortableHead label="Producto" sortKey="producto" sort={recSort} onSort={handleRecSort} />
                  <SortableHead label="Código" sortKey="codigo" sort={recSort} onSort={handleRecSort} />
                  <SortableHead label="Ejecutivo" sortKey="ejecutivo" sort={recSort} onSort={handleRecSort} />
                  <SortableHead label="Última compra" sortKey="ultima" sort={recSort} onSort={handleRecSort} />
                  <SortableHead label="Días sin comprar" sortKey="dias" sort={recSort} onSort={handleRecSort} align="right" />
                  <SortableHead label="Cantidad histórica" sortKey="cantidad" sort={recSort} onSort={handleRecSort} align="right" />
                  <TableHead className="text-center">Rango</TableHead>
                  {recViewIgnorados && <TableHead>Razón</TableHead>}
                  {recViewIgnorados && <TableHead>Fecha ignorado</TableHead>}
                  <TableHead className="text-center w-28">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recLoading ? (
                  <TableRow><TableCell colSpan={recViewIgnorados ? 12 : 10} className="text-center text-muted-foreground py-8">Cargando…</TableCell></TableRow>
                ) : recFiltered.length === 0 ? (
                  <TableRow><TableCell colSpan={recViewIgnorados ? 12 : 10} className="text-center text-muted-foreground py-8">Sin registros.</TableCell></TableRow>
                ) : (
                  recFiltered.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={recSelectedKeys.has(r.key)}
                          onCheckedChange={(v) =>
                            setRecSelectedKeys((prev) => {
                              const next = new Set(prev);
                              if (v) next.add(r.key); else next.delete(r.key);
                              return next;
                            })
                          }
                          aria-label="Seleccionar fila"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <button
                          type="button"
                          className="text-left hover:underline text-primary"
                          onClick={(e) => { e.stopPropagation(); abrirFichaEmpresa(r.empresa_id); }}
                        >
                          {r.empresa}
                        </button>
                      </TableCell>
                      <TableCell className="font-light">{r.producto}</TableCell>
                      <TableCell className="font-light text-xs">{r.codigo}</TableCell>
                      <TableCell className="font-light">
                        {r.owner_id ? (profileMap.get(r.owner_id) || "—") : <span className="italic text-muted-foreground">Sin asignar</span>}
                      </TableCell>
                      <TableCell className="font-light">{formatDate(r.ultima)}</TableCell>
                      <TableCell className="text-right font-medium">{r.dias}</TableCell>
                      <TableCell className="text-right font-light">{fmtNum(r.cantidad)}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={
                            r.rango === "180+"
                              ? "bg-red-100 text-red-700 border-red-200"
                              : r.rango === "120-180"
                                ? "bg-orange-100 text-orange-700 border-orange-200"
                                : "bg-amber-100 text-amber-700 border-amber-200"
                          }
                        >
                          {r.rango}
                        </Badge>
                      </TableCell>
                      {recViewIgnorados && (
                        <TableCell className="font-light text-xs">
                          {recIgnoradosMap.get(`${r.empresa_id}|${r.producto_id}`)?.razon || "—"}
                        </TableCell>
                      )}
                      {recViewIgnorados && (
                        <TableCell className="font-light text-xs">
                          {(() => {
                            const at = recIgnoradosMap.get(`${r.empresa_id}|${r.producto_id}`)?.ignorado_at;
                            return at ? formatDate(at) : "—";
                          })()}
                        </TableCell>
                      )}
                      <TableCell className="text-center">
                        {recViewIgnorados ? (
                          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => restaurarIgnorado(r)}>
                            <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                          </Button>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setTaskDialog({ companyId: r.empresa_id, type: "whatsapp" })}>
                                <MessageCircle className="h-3.5 w-3.5 mr-2" /> Reofrecer
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  const next = new URLSearchParams(searchParams);
                                  next.set("company", r.empresa_id);
                                  setSearchParams(next, { replace: false });
                                }}
                              >
                                <ExternalLink className="h-3.5 w-3.5 mr-2" /> Abrir seguimiento a ventas
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setRecIgnoreRazon(""); setRecIgnoreDialog({ keys: [r.key] }); }}>
                                <EyeOff className="h-3.5 w-3.5 mr-2" /> Ignorar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          <Dialog open={!!recIgnoreDialog} onOpenChange={(o) => { if (!o) { setRecIgnoreDialog(null); setRecIgnoreRazon(""); } }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Ignorar producto(s) por recuperar</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <Label className="text-xs uppercase tracking-wide">Razón (opcional)</Label>
                <Textarea
                  value={recIgnoreRazon}
                  onChange={(e) => setRecIgnoreRazon(e.target.value)}
                  placeholder="Motivo por el que se ignora…"
                  className="font-light"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setRecIgnoreDialog(null); setRecIgnoreRazon(""); }}>Cancelar</Button>
                <Button onClick={submitIgnorar} disabled={recIgnoreSaving}>
                  {recIgnoreSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Confirmar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Lista mobile (cards) */}
      {isProductos && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={prodSearch}
                onChange={(e) => setProdSearch(e.target.value)}
                placeholder="Buscar producto por nombre o código…"
                className="pl-9 h-9 font-light"
              />
            </div>
            {prodSearch && (
              <Button size="sm" variant="outline" className="h-9 gap-1" onClick={() => { setProdSearch(""); setProdExpanded(null); }}>
                <RotateCcw className="h-3.5 w-3.5" /> Reiniciar
              </Button>
            )}
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead className="text-right"># Clientes</TableHead>
                  <TableHead className="text-right">Cantidad total</TableHead>
                  <TableHead>Última venta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recFacturasLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
                ) : prodFiltered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">Sin productos.</TableCell></TableRow>
                ) : (
                  prodFiltered.map((p: any) => {
                    const open = prodExpanded === p.producto_id;
                    const cs = prodClienteSearch.trim().toLowerCase();
                    const clientes = open && cs
                      ? p.clientes.filter((c: any) => (c.empresa || "").toLowerCase().includes(cs))
                      : p.clientes;
                    return (
                      <React.Fragment key={p.producto_id}>
                        <TableRow
                          className="cursor-pointer"
                          onClick={() => { setProdExpanded(open ? null : p.producto_id); setProdClienteSearch(""); }}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={prodSelected.has(p.producto_id)}
                              onCheckedChange={(v) =>
                                setProdSelected((prev) => {
                                  const next = new Set(prev);
                                  if (v) next.add(p.producto_id); else next.delete(p.producto_id);
                                  return next;
                                })
                              }
                              aria-label="Seleccionar producto"
                            />
                          </TableCell>
                          <TableCell className="font-light">
                            <span className="inline-flex items-center gap-1">
                              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`} />
                              {p.nombre}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{p.codigo}</TableCell>
                          <TableCell className="text-right font-light">{p.clientes.length}</TableCell>
                          <TableCell className="text-right font-light">{fmtNum(p.cantidad)}</TableCell>
                          <TableCell className="font-light">{formatDate(p.ultima)}</TableCell>
                        </TableRow>
                        {open && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={6} className="p-3">
                              <div className="relative w-full sm:w-72 mb-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                  value={prodClienteSearch}
                                  onChange={(e) => setProdClienteSearch(e.target.value)}
                                  placeholder="Buscar cliente…"
                                  className="pl-8 h-8 text-xs font-light"
                                />
                              </div>
                              <div className="rounded-md border bg-background">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-[10px] uppercase tracking-widest">Cliente</TableHead>
                                      <TableHead className="text-right text-[10px] uppercase tracking-widest">Cantidad</TableHead>
                                      <TableHead className="text-[10px] uppercase tracking-widest">Última compra</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {clientes.length === 0 ? (
                                      <TableRow><TableCell colSpan={3} className="text-center py-4 text-xs text-muted-foreground">Sin clientes.</TableCell></TableRow>
                                    ) : clientes.map((c: any) => (
                                      <TableRow key={c.empresa_id}>
                                        <TableCell className="text-xs font-light">{c.empresa}</TableCell>
                                        <TableCell className="text-xs text-right font-light">{fmtNum(c.cantidad)}</TableCell>
                                        <TableCell className="text-xs font-light">{formatDate(c.ultima)}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>

          {prodSelected.size > 0 && (
            <div className="sticky bottom-3 z-30 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-cyan-50 dark:bg-cyan-950/40 px-4 py-3 shadow-lg">
              <div className="text-xs font-semibold uppercase tracking-wide text-cyan-900 dark:text-cyan-200">
                {prodSelected.size} producto(s) seleccionado(s) · {prodSelectedCompanyIds.length} clientes únicos
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-8 gap-1" onClick={enviarWhatsappProductos}>
                  <MessageCircle className="h-3.5 w-3.5" /> Enviar WhatsApp
                </Button>
                <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => setProdSelected(new Set())}>
                  <X className="h-3.5 w-3.5" /> Limpiar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {showLista && (
      <div className="grid gap-3 md:hidden">
        {isLoading ? (
          <p className="text-center text-sm text-muted-foreground py-8">Cargando…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">Sin registros.</p>
        ) : (
          filtered.map((r) => {
            const eff = catalogMap.get(getEffectiveStatusId(r) || "");
            const ritmo = r.estatus_ritmo_id ? catalogMap.get(r.estatus_ritmo_id) : null;
            return (
              <Card
                key={r.id}
                className="cursor-pointer hover:shadow-md transition-shadow border-border/60"
                onClick={() => setSelected(r)}
              >
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-tight">{r.companies?.name || "—"}</p>
                    <StatusBadge estatus={eff} />
                  </div>
                  <p className="text-[11px] text-muted-foreground font-light">
                    Ejecutivo: <span className="text-foreground">{r.owner_id ? (profileMap.get(r.owner_id) || "—") : "Sin asignar"}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground font-light">
                    Plaza: <span className="text-foreground">{getRowPlazaLabel(r.company_id) || "—"}</span>
                  </p>
                  {tieneVenta ? (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-light">
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Última compra</span>
                        <p className={`font-medium ${daysColor(r.dias_ultima_compra)}`}>
                          {r.dias_ultima_compra != null ? `${r.dias_ultima_compra} d` : "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Avance</span>
                        <div><StatusBadge estatus={ritmo} /></div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Prom. mensual</span>
                        <p>{fmtNum(r.promedio_historico_mensual)}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Acum. mes</span>
                        <p>{fmtNum(r.acum_mes)}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Potencial</span>
                        <p>{fmtNum(r.potencial)}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Actividades</span>
                        <p>{r.actividades_activas}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-light">
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Última actividad</span>
                        <p className={`font-medium ${daysColor(r.dias_ultima_actividad)}`}>
                          {r.dias_ultima_actividad != null ? `${r.dias_ultima_actividad} d` : "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Cotizaciones</span>
                        <p>{r.cotizaciones_total}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Últ. cotización</span>
                        <p className={`font-medium ${daysColor(r.dias_ultima_cotizacion)}`}>
                          {r.dias_ultima_cotizacion != null ? `${r.dias_ultima_cotizacion} d` : "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Actividades</span>
                        <p>{r.actividades_activas}</p>
                      </div>
                    </div>
                  )}
                  {r.proxima_tarea_fecha && (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <CalendarIcon className="h-3 w-3" /> Próx. tarea: {formatDate(r.proxima_tarea_fecha)}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
      )}

      {/* Tabla desktop */}
      {showLista && (
      <div className="hidden md:block">
        <Card>
          <div className="flex justify-end p-2 border-b bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={resetColumnOrder}
              title="Restaurar el orden original de las columnas"
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Restaurar columnas
            </Button>
          </div>
          <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleColumnDragEnd}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id))}
                      onCheckedChange={(v) => {
                        if (v) setSelectedIds(new Set(filtered.map((r) => r.id)));
                        else setSelectedIds(new Set());
                      }}
                      aria-label="Seleccionar todos"
                    />
                  </TableHead>
                  <SortableContext items={orderedColumns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
                    {orderedColumns.map((col) => (
                      <DraggableSortableHead
                        key={col.id}
                        id={col.id}
                        label={col.label}
                        sortKey={col.sortKey}
                        sort={sort}
                        onSort={handleSort}
                        align={col.align}
                      />
                    ))}
                  </SortableContext>
                  {viewIgnorados && !isPerdidos && <TableHead>Razón</TableHead>}
                  {viewIgnorados && !isPerdidos && <TableHead>Fecha ignorado</TableHead>}
                  <TableHead className="w-14 text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={orderedColumns.length + (viewIgnorados && !isPerdidos ? 4 : 2)} className="text-center text-muted-foreground py-8">
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={orderedColumns.length + (viewIgnorados && !isPerdidos ? 4 : 2)} className="text-center text-muted-foreground py-8">
                      Sin registros.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id} onClick={() => setSelected(r)} className="cursor-pointer">
                      <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(r.id)}
                          onCheckedChange={(v) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (v) next.add(r.id); else next.delete(r.id);
                              return next;
                            });
                          }}
                          aria-label={`Seleccionar ${r.companies?.name || ""}`}
                        />
                      </TableCell>
                      {orderedColumns.map((col) => (
                        <TableCell
                          key={col.id}
                          className={`${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""} ${col.cellClassName || ""}`}
                        >
                          {col.render(r)}
                        </TableCell>
                      ))}
                      {viewIgnorados && !isPerdidos && (
                        <TableCell className="font-light text-xs">
                          {clientesIgnoradosMap.get(r.company_id)?.razon || "—"}
                        </TableCell>
                      )}
                      {viewIgnorados && !isPerdidos && (
                        <TableCell className="font-light text-xs">
                          {(() => {
                            const at = clientesIgnoradosMap.get(r.company_id)?.ignorado_at;
                            return at ? formatDate(at) : "—";
                          })()}
                        </TableCell>
                      )}
                      <TableCell className="w-14 text-center" onClick={(e) => e.stopPropagation()}>
                        {viewIgnorados && !isPerdidos ? (
                          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => restaurarClienteIgnorado(r.company_id)}>
                            <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                          </Button>
                        ) : (
                          <RowActionsMenu
                            row={r}
                            onOpenTask={(type) => setTaskDialog({ companyId: r.company_id, type })}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </DndContext>
        </Card>
      </div>
      )}

      {/* Diálogo: ignorar clientes */}
      <Dialog open={ignoreDialogOpen} onOpenChange={(o) => { if (!o) { setIgnoreDialogOpen(false); setIgnoreRazon(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ignorar cliente(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs uppercase tracking-wide">Razón (opcional)</Label>
            <Textarea
              value={ignoreRazon}
              onChange={(e) => setIgnoreRazon(e.target.value)}
              placeholder="Motivo por el que se ignora…"
              className="font-light"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIgnoreDialogOpen(false); setIgnoreRazon(""); }}>Cancelar</Button>
            <Button onClick={submitIgnorarClientes} disabled={ignoreSaving}>
              {ignoreSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SeguimientoDetailDialog
        row={selected}
        empresaVendedora={empresaVendedora}
        brand={brand}
        onOpenChange={(o) => { if (!o) setSelected(null); }}
        catalog={catalog}
      />

      {/* Diálogo crear tarea/actividad pre-cargado */}
      {taskDialog && (
        <CreateCrmTaskDialog
          open={!!taskDialog}
          onOpenChange={(o) => { if (!o) setTaskDialog(null); }}
          defaultCompanyId={taskDialog.companyId}
          defaultTaskType={taskDialog.type}
          defaultBrands={[empresaVendedora]}
        />
      )}

      {/* Diálogo reasignar ejecutivo */}
      <Dialog open={reassignOpen} onOpenChange={(o) => { if (!reassigning) setReassignOpen(o); }}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4 border-b">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <UserCog className="h-4 w-4" /> Reasignar ejecutivo
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5 font-light">
                Se actualizará el ejecutivo de {selectedIds.size} cliente{selectedIds.size === 1 ? "" : "s"} y se recalculará su seguimiento.
              </p>
            </DialogHeader>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Nuevo ejecutivo</p>
              <SearchableSelect
                value={reassignUserId || "none"}
                onValueChange={(v) => setReassignUserId(v === "none" ? "" : v)}
                options={[
                  { value: "none", label: "Selecciona…" },
                  ...profiles.map((p) => ({ value: p.user_id, label: p.full_name || p.user_id })),
                ]}
                placeholder="Buscar ejecutivo…"
              />
            </div>
          </div>
          <DialogFooter className="px-5 py-3 bg-muted/30 border-t">
            <Button variant="outline" onClick={() => setReassignOpen(false)} disabled={reassigning}>
              Cancelar
            </Button>
            <Button
              disabled={!reassignUserId || reassigning}
              onClick={async () => {
                if (!reassignUserId) return;
                setReassigning(true);
                try {
                  const rowsToUpdate = filtered.filter((r) => selectedIds.has(r.id));
                  const companyIds = Array.from(new Set(rowsToUpdate.map((r) => r.company_id)));
                  // Reemplaza ejecutivos por el nuevo (patrón usado en CompanyFormDialog)
                  for (const cid of companyIds) {
                    await (supabase as any).from("company_ejecutivos").delete().eq("company_id", cid);
                    await (supabase as any).from("company_ejecutivos").insert({ company_id: cid, user_id: reassignUserId });
                  }
                  // Recalcula seguimiento por cada (company, empresa_vendedora)
                  for (const r of rowsToUpdate) {
                    try {
                      await (supabase as any).rpc("recompute_seguimiento_ventas", {
                        _company_id: r.company_id,
                        _ev: r.empresa_vendedora,
                      });
                    } catch (err) {
                      console.warn("[recompute] failed", r.company_id, err);
                    }
                  }
                  toast({ title: "Ejecutivo reasignado", description: `${rowsToUpdate.length} cliente${rowsToUpdate.length === 1 ? "" : "s"} actualizado${rowsToUpdate.length === 1 ? "" : "s"}.` });
                  setSelectedIds(new Set());
                  setReassignOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["seguimiento_ventas"] });
                  queryClient.invalidateQueries({ queryKey: ["company_ejecutivos"] });
                } catch (e: any) {
                  toast({ title: "Error al reasignar", description: e?.message || "Intenta de nuevo.", variant: "destructive" });
                } finally {
                  setReassigning(false);
                }
              }}
            >
              {reassigning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo cambiar estatus masivo */}
      <Dialog open={bulkStatusOpen} onOpenChange={(o) => { if (!bulkStatusSaving) setBulkStatusOpen(o); }}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4 border-b">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <Filter className="h-4 w-4" /> Cambiar estatus
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5 font-light">
                Se fijará el estatus manual de {selectedIds.size} cliente{selectedIds.size === 1 ? "" : "s"}.
              </p>
            </DialogHeader>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Nuevo estatus</p>
              <SearchableSelect
                value={bulkStatusId || "__auto__"}
                onValueChange={(v) => setBulkStatusId(v)}
                options={[
                  { value: "__auto__", label: "Automático (quitar manual)" },
                  ...estatusOptions.map((o) => ({ value: o.id, label: o.nombre })),
                ]}
                placeholder="Selecciona estatus…"
              />
            </div>
          </div>
          <DialogFooter className="px-5 py-3 bg-muted/30 border-t">
            <Button variant="outline" onClick={() => setBulkStatusOpen(false)} disabled={bulkStatusSaving}>
              Cancelar
            </Button>
            <Button
              disabled={!bulkStatusId || bulkStatusSaving}
              onClick={async () => {
                const ids = Array.from(selectedIds);
                if (ids.length === 0) return;
                setBulkStatusSaving(true);
                try {
                  const payload = bulkStatusId === "__auto__"
                    ? { estatus_manual: false, estatus_manual_id: null }
                    : { estatus_manual: true, estatus_manual_id: bulkStatusId };
                  const { error } = await supabase
                    .from("seguimiento_ventas")
                    .update(payload as any)
                    .in("id", ids);
                  if (error) throw error;
                  toast({ title: "Estatus actualizado", description: `${ids.length} cliente${ids.length === 1 ? "" : "s"} actualizado${ids.length === 1 ? "" : "s"}.` });
                  setSelectedIds(new Set());
                  setBulkStatusOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["seguimiento_ventas"] });
                } catch (e: any) {
                  toast({ title: "Error al actualizar", description: e?.message || "Intenta de nuevo.", variant: "destructive" });
                } finally {
                  setBulkStatusSaving(false);
                }
              }}
            >
              {bulkStatusSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RowActionsMenu({
  row, onOpenTask,
}: {
  row: SeguimientoVentasRow;
  onOpenTask: (type: "call" | "whatsapp" | "email") => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Acciones
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onOpenTask("whatsapp"); }}>
          <MessageCircle className="h-4 w-4 mr-2 text-emerald-600" /> Enviar WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onOpenTask("email"); }}>
          <Mail className="h-4 w-4 mr-2 text-blue-600" /> Enviar correo
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onOpenTask("call"); }}>
          <ListPlus className="h-4 w-4 mr-2 text-violet-600" /> Registrar tarea
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}