import React, { useEffect, useMemo, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { BackButton } from "@/components/BackButton";
import { PageBanner } from "@/components/PageBanner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Search, TrendingUp, AlertTriangle, Calendar as CalendarIcon, ArrowUp, ArrowDown, Filter, ChevronDown, X, GripVertical, RotateCcw } from "lucide-react";
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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

  const [tab, setTab] = useState<"con_venta" | "sin_venta">("con_venta");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SeguimientoVentasRow | null>(null);
  const [sort, setSort] = useState<SortState | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [fEstatus, setFEstatus] = useState<string[]>([]);
  const [fRitmo, setFRitmo] = useState<string[]>([]);
  const [fDias, setFDias] = useState<string[]>([]);
  const [fPotencial, setFPotencial] = useState<string[]>([]);
  const [fEjecutivo, setFEjecutivo] = useState<string[]>([]);
  const [fPlaza, setFPlaza] = useState<string[]>([]);

  const tieneVenta = tab === "con_venta";

  // Al cambiar pestaña, limpiar filtros que no aplican
  useEffect(() => {
    setFEstatus([]);
    setFRitmo([]);
    setFDias([]);
    setFPotencial([]);
    setFEjecutivo([]);
    setFPlaza([]);
  }, [tieneVenta]);

  const { data: rows = [], isLoading } = useSeguimientoVentas({ empresaVendedora, tieneVenta });
  const { data: catalog = [] } = useSeguimientoEstatusCatalogo();

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

  const ambito = tieneVenta ? "con_venta" : "sin_venta";
  const estatusOptions = useMemo(
    () => catalog.filter((c) => c.ambito === ambito && c.familia === (tieneVenta ? "riesgo" : "gestion")),
    [catalog, ambito, tieneVenta]
  );
  const ritmoOptions = useMemo(
    () => catalog.filter((c) => c.ambito === "con_venta" && c.familia === "ritmo"),
    [catalog]
  );

  const toggleInArray = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const activeFiltersCount =
    fEstatus.length + fRitmo.length + fDias.length + fPotencial.length + fEjecutivo.length + fPlaza.length;

  const clearAllFilters = () => {
    setFEstatus([]);
    setFRitmo([]);
    setFDias([]);
    setFPotencial([]);
    setFEjecutivo([]);
    setFPlaza([]);
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
          id: "ritmo",
          label: "Ritmo",
          sortKey: "ritmo",
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
    let base = term
      ? rows.filter((r) => (r.companies?.name || "").toLowerCase().includes(term))
      : rows;

    if (fEstatus.length > 0) {
      base = base.filter((r) => {
        const id = tieneVenta ? r.estatus_riesgo_id : r.estatus_gestion_id;
        return id ? fEstatus.includes(id) : false;
      });
    }
    if (tieneVenta && fRitmo.length > 0) {
      base = base.filter((r) => (r.estatus_ritmo_id ? fRitmo.includes(r.estatus_ritmo_id) : false));
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
        case "estatus": {
          const ea = catalogMap.get(getEffectiveStatusId(a) || "");
          const eb = catalogMap.get(getEffectiveStatusId(b) || "");
          va = ea?.orden ?? 999;
          vb = eb?.orden ?? 999;
          break;
        }
        case "ritmo": {
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
  }, [rows, search, catalogMap, tieneVenta, sort, fEstatus, fRitmo, fDias, fPotencial, fEjecutivo, fPlaza, profileMap, companyPlazaMap, plazaNameMap]);

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
        </div>
      </div>

      {/* Panel de filtros colapsable */}
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
            <CardContent className="p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                      Ritmo
                    </p>
                    <MultiSelectFilter
                      label="Ritmo"
                      options={ritmoOptions.map((o) => ({ id: o.id, label: o.nombre, color: o.color }))}
                      selected={fRitmo}
                      onToggle={(id) => setFRitmo((arr) => toggleInArray(arr, id))}
                      onClear={() => setFRitmo([])}
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
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Lista mobile (cards) */}
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
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Ritmo</span>
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

      {/* Tabla desktop */}
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={orderedColumns.length} className="text-center text-muted-foreground py-8">
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={orderedColumns.length} className="text-center text-muted-foreground py-8">
                      Sin registros.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id} onClick={() => setSelected(r)} className="cursor-pointer">
                      {orderedColumns.map((col) => (
                        <TableCell
                          key={col.id}
                          className={`${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""} ${col.cellClassName || ""}`}
                        >
                          {col.render(r)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </DndContext>
        </Card>
      </div>

      <SeguimientoDetailDialog
        row={selected}
        empresaVendedora={empresaVendedora}
        onOpenChange={(o) => { if (!o) setSelected(null); }}
        catalog={catalog}
      />
    </div>
  );
}