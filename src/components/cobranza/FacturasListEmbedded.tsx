import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Pencil, Trash2, CheckSquare, Columns3, Filter, X, Download, FileText, List, Users, ChevronDown, ChevronRight, MoreHorizontal, MessageCircle, Mail, Receipt } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { fetchAllRows } from "@/lib/supabasePagination";
import { openDocFilesSignedUrl } from "@/lib/storageSignedUrl";
import { downloadCotizacionPdf } from "@/lib/generateCotizacionPdf";
import { BulkEditDialog } from "@/components/BulkEditDialog";
import { SortMenu } from "@/components/SortMenu";
import { fireAutomation } from "@/hooks/useFireAutomation";
import * as XLSX from "xlsx";

/**
 * Lista embebida de Facturas — espejo del listado en Documentos > Facturas.
 * Mantiene mismas columnas, filtros, selección y paginación. Acepta prefiltros
 * para casos especializados (Cobranza: vencidas, crédito directo, crédito cescemex).
 */

type ColumnKey = "numero" | "cliente" | "ejecutivo" | "plaza" | "fecha" | "fecha_vencimiento" | "total" | "saldo" | "estatus" | "pdf" | "tipo_pago";
const ALL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "numero", label: "No. Factura" },
  { key: "cliente", label: "Cliente" },
  { key: "ejecutivo", label: "Ejecutivo" },
  { key: "plaza", label: "Plaza" },
  { key: "fecha", label: "Fecha Documento" },
  { key: "fecha_vencimiento", label: "Fecha Vencimiento" },
  { key: "tipo_pago", label: "Tipo de Pago" },
  { key: "total", label: "Total" },
  { key: "saldo", label: "Saldo" },
  { key: "estatus", label: "Estatus" },
  { key: "pdf", label: "PDF" },
];
const DEFAULT_COLS: ColumnKey[] = ["numero", "cliente", "ejecutivo", "plaza", "fecha", "fecha_vencimiento", "tipo_pago", "total", "saldo", "estatus", "pdf"];
const colsStorageKey = (userId: string) => `doc-cols:${userId}:factura`;

const ESTATUS_FAC_LABELS: Record<string, string> = {
  vigente: "Vigente",
  pagada: "Pagada",
  vencida: "Vencida",
  cancelada: "Cancelada",
};
// Compat: facturas antiguas pueden tener estos valores en BD
const ESTATUS_FAC_LABELS_DISPLAY: Record<string, string> = {
  ...ESTATUS_FAC_LABELS,
  pendiente: "Vigente",
  parcial: "Vigente",
};

function getStatusBadgeClass(st: string): string {
  const map: Record<string, string> = {
    pendiente: "bg-slate-100 text-slate-700 border-slate-300",
    vigente: "bg-blue-50 text-blue-700 border-blue-200",
    pagada: "bg-green-50 text-green-700 border-green-200",
    parcial: "bg-amber-50 text-amber-700 border-amber-200",
    vencida: "bg-red-50 text-red-700 border-red-200",
    cancelada: "bg-red-50 text-red-700 border-red-200",
  };
  return map[st] || "bg-slate-100 text-slate-700 border-slate-300";
}

function getTipoPagoInfo(valor: any): { label: string; cls: string } {
  const v = String(valor || "").trim().toLowerCase();
  if (!v) return { label: "-", cls: "" };
  if (v.includes("cescemex")) return { label: "Crédito Cescemex", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  if (v.includes("directo")) return { label: "Crédito Directo", cls: "bg-purple-50 text-purple-700 border-purple-200" };
  if (v.includes("credito")) return { label: "Crédito Directo", cls: "bg-purple-50 text-purple-700 border-purple-200" };
  if (v.includes("contado")) return { label: "Contado", cls: "bg-blue-50 text-blue-700 border-blue-200" };
  return { label: "-", cls: "" };
}

export type CobranzaPrefilter = "none" | "vencidas" | "credito_directo" | "credito_cescemex";
export type DaysBucket = "vencidas" | "hoy" | "1-5" | "6-10" | "11-20" | "21-30" | "+30";

interface Props {
  empresaVendedora: "lumaggs_chevron" | "galsa_phillips66";
  plazaId?: string | null;
  prefilter?: CobranzaPrefilter;
  daysBucket?: DaysBucket;
  /** Si true, oculta facturas pagadas/canceladas y con saldo 0 */
  onlyConSaldo?: boolean;
  /** Modo de vista inicial: lista o agrupado por cliente */
  initialViewMode?: "list" | "grouped";
}

function fechaVencimientoEfectiva(f: { fecha_documento?: string | null; fecha_vencimiento?: string | null; tipo_pago?: string | null }): string | null {
  const tp = (f.tipo_pago || "").toLowerCase();
  if (!f.fecha_documento) return f.fecha_vencimiento ?? null;
  if (tp === "contado") return f.fecha_documento;
  if (tp.includes("credito") || tp.includes("cescemex")) {
    const d = new Date(f.fecha_documento + "T12:00:00");
    // 30 días de crédito a partir de la fecha del documento
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }
  return f.fecha_vencimiento ?? null;
}

function diasParaVencer(fechaVenc: string | null): number | null {
  if (!fechaVenc) return null;
  // Parsear la fecha como fecha LOCAL (evita el corrimiento de 1 día que provoca
  // `new Date("YYYY-MM-DD")`, que se interpreta como UTC en zonas con offset negativo).
  const [y, m, d] = String(fechaVenc).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const v = new Date(y, m - 1, d); v.setHours(0, 0, 0, 0);
  return Math.round((v.getTime() - hoy.getTime()) / 86400000);
}

function inDaysBucket(d: number | null, bucket: DaysBucket): boolean {
  if (d === null) return false;
  switch (bucket) {
    case "vencidas": return d < 0;
    case "hoy": return d === 0;
    case "1-5": return d >= 1 && d <= 5;
    case "6-10": return d >= 6 && d <= 10;
    case "11-20": return d >= 11 && d <= 20;
    case "21-30": return d >= 21 && d <= 30;
    case "+30": return d > 30;
  }
}

export function FacturasListEmbedded({ empresaVendedora, plazaId, prefilter = "none", daysBucket, onlyConSaldo = true, initialViewMode = "list" }: Props) {
  const navigate = useNavigate();
  const { hasRole, user } = useAuth();
  const isAdmin = hasRole("admin");
  const access = useModuleAccess("facturacion");

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("numero_factura_desc");
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  // Toolbar filters
  const [tipoPagoFilter, setTipoPagoFilter] = useState<string>(
    prefilter === "credito_directo" ? "directo" :
    prefilter === "credito_cescemex" ? "cescemex" : "all"
  );
  const [fechaDesde, setFechaDesde] = useState<string>("");
  const [fechaHasta, setFechaHasta] = useState<string>("");
  const [estatusFacFilter, setEstatusFacFilter] = useState<string>(
    prefilter === "vencidas" || daysBucket === "vencidas" ? "vencida" : "all"
  );
  const [estatusCobFilter, setEstatusCobFilter] = useState<string>(prefilter === "vencidas" ? "vencida" : "all");
  const [viewMode, setViewMode] = useState<"list" | "grouped">(initialViewMode);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  useEffect(() => {
    setTipoPagoFilter(
      prefilter === "credito_directo" ? "directo" :
      prefilter === "credito_cescemex" ? "cescemex" : "all"
    );
    setEstatusCobFilter(prefilter === "vencidas" ? "vencida" : "all");
    setEstatusFacFilter(prefilter === "vencidas" || daysBucket === "vencidas" ? "vencida" : "all");
  }, [prefilter, daysBucket]);

  const clearFilters = () => {
    setTipoPagoFilter("all");
    setFechaDesde("");
    setFechaHasta("");
    setEstatusFacFilter("all");
    setEstatusCobFilter("all");
  };
  const activeFiltersCount =
    (tipoPagoFilter !== "all" ? 1 : 0) +
    (fechaDesde ? 1 : 0) + (fechaHasta ? 1 : 0) +
    (estatusFacFilter !== "all" ? 1 : 0) + (estatusCobFilter !== "all" ? 1 : 0);

  // Column visibility
  const [visibleCols, setVisibleCols] = useState<Set<ColumnKey>>(new Set(DEFAULT_COLS));
  useEffect(() => {
    if (!user?.id) return;
    try {
      const raw = localStorage.getItem(colsStorageKey(user.id));
      if (raw) {
        const arr = JSON.parse(raw) as ColumnKey[];
        if (Array.isArray(arr)) setVisibleCols(new Set(arr));
      }
    } catch {}
  }, [user?.id]);
  const toggleCol = (key: ColumnKey) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      if (user?.id) {
        try { localStorage.setItem(colsStorageKey(user.id), JSON.stringify(Array.from(next))); } catch {}
      }
      return next;
    });
  };
  const isColVisible = (key: ColumnKey) => visibleCols.has(key);

  const { data: assignedCompanyIds = [] } = useQuery({
    queryKey: ["my-assigned-companies", access.userId],
    queryFn: async () => {
      if (!access.userId) return [] as string[];
      const { data } = await supabase.from("company_ejecutivos").select("company_id").eq("user_id", access.userId);
      return (data || []).map((r: any) => r.company_id);
    },
    enabled: !!access.userId,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-for-filter"],
    queryFn: async () => {
      const data = await fetchAllRows<any>((from, to) => supabase.from("profiles").select("user_id, full_name").eq("is_active", true).order("full_name").range(from, to));
      return data;
    },
  });
  const getEjecutivoName = (id: string | null) => {
    if (!id) return "-";
    return (profiles.find((p: any) => p.user_id === id) as any)?.full_name || "-";
  };

  const { data: docs = [], isLoading, refetch } = useQuery({
    queryKey: ["cobranza-facturas-embedded", empresaVendedora, plazaId, search, tipoPagoFilter, fechaDesde, fechaHasta, estatusFacFilter, estatusCobFilter, access.accessLevel, access.teamMemberIds, assignedCompanyIds],
    queryFn: async () => {
      if (!access.canView) return [];
      let q = supabase.from("documentos")
        .select("*, companies(name), contacts(first_name, last_name), plazas(nombre)")
        .eq("is_active", true)
        .eq("tipo_documento", "factura" as any)
        .eq("empresa_vendedora", empresaVendedora as any)
        .order("created_at", { ascending: false });
      if (plazaId) q = q.or(`plaza_id.eq.${plazaId},plaza_id.is.null`);
      if (tipoPagoFilter === "contado") q = q.eq("tipo_pago", "contado" as any);
      else if (tipoPagoFilter === "cescemex") q = q.eq("tipo_pago", "credito_cescemex" as any);
      if (fechaDesde) q = q.gte("fecha_documento", fechaDesde);
      if (fechaHasta) q = q.lte("fecha_documento", fechaHasta);
      if (estatusFacFilter !== "all") q = q.eq("estatus_factura", estatusFacFilter as any);
      if (estatusCobFilter !== "all") q = q.eq("estado_cobranza", estatusCobFilter as any);
      if (access.accessLevel === "propio" && access.userId) {
        const parts = [`created_by.eq.${access.userId}`, `ejecutivo_venta_id.eq.${access.userId}`];
        if (assignedCompanyIds.length > 0) parts.push(`empresa_id.in.(${assignedCompanyIds.join(",")})`);
        q = q.or(parts.join(","));
      } else if (access.accessLevel === "equipo" && access.teamMemberIds.length > 0) {
        const parts = [`created_by.in.(${access.teamMemberIds.join(",")})`, `ejecutivo_venta_id.in.(${access.teamMemberIds.join(",")})`];
        if (assignedCompanyIds.length > 0) parts.push(`empresa_id.in.(${assignedCompanyIds.join(",")})`);
        q = q.or(parts.join(","));
      }
      const data = await fetchAllRows<any>((from, to) => q.range(from, to));
      if (search) {
        const s = search.toLowerCase();
        return data.filter((doc: any) => (doc.numero_factura || "").toLowerCase().includes(s) || ((doc.companies as any)?.name || "").toLowerCase().includes(s));
      }
      return data;
    },
    enabled: !access.isLoading,
  });

  // Aplica prefiltros adicionales y bucket de días en cliente
  const filtered = useMemo(() => {
    return (docs as any[]).filter((d) => {
      if (onlyConSaldo) {
        const ef = (d.estatus_factura || "").toLowerCase();
        if (ef === "cancelada" || ef === "pagada") return false;
        if (Number(d.saldo_pendiente_cobranza || 0) <= 0) return false;
      }
      if (tipoPagoFilter === "directo") {
        // Crédito Directo = todo lo que NO sea Cescemex (coincide con el KPI del dashboard).
        const tp = (d.tipo_pago || "").toLowerCase();
        if (tp.includes("cescemex")) return false;
      } else if (tipoPagoFilter === "cescemex") {
        const tp = (d.tipo_pago || "").toLowerCase();
        if (!tp.includes("cescemex")) return false;
      } else if (tipoPagoFilter === "contado") {
        const tp = (d.tipo_pago || "").toLowerCase();
        if (tp !== "contado") return false;
      }
      if (prefilter === "vencidas") {
        if ((d.estatus_factura || "").toLowerCase() !== "vencida") return false;
      } else if (prefilter === "credito_directo") {
        // Crédito Directo = todo lo que NO sea Cescemex (coincide con el KPI del dashboard).
        const tp = (d.tipo_pago || "").toLowerCase();
        if (tp.includes("cescemex")) return false;
      } else if (prefilter === "credito_cescemex") {
        const tp = (d.tipo_pago || "").toLowerCase();
        if (!tp.includes("cescemex")) return false;
      }
      if (daysBucket) {
        if (daysBucket === "vencidas") {
          if ((d.estatus_factura || "").toLowerCase() !== "vencida") return false;
        } else {
          // Para los demás buckets usamos la fecha_vencimiento almacenada como referencia.
          const dd = diasParaVencer(d.fecha_vencimiento ?? null);
          if (!inDaysBucket(dd, daysBucket)) return false;
        }
      }
      return true;
    });
  }, [docs, prefilter, daysBucket, onlyConSaldo, tipoPagoFilter]);

  const sortedDocs = [...filtered].sort((a: any, b: any) => {
    switch (sortBy) {
      case "date_desc": return new Date(b.fecha_documento).getTime() - new Date(a.fecha_documento).getTime();
      case "date_asc": return new Date(a.fecha_documento).getTime() - new Date(b.fecha_documento).getTime();
      case "total_desc": return Number(b.total) - Number(a.total);
      case "total_asc": return Number(a.total) - Number(b.total);
      case "client_asc": return ((a.companies as any)?.name || "").localeCompare((b.companies as any)?.name || "");
      case "client_desc": return ((b.companies as any)?.name || "").localeCompare((a.companies as any)?.name || "");
      case "numero_factura_asc": return String(a.numero_factura || "").localeCompare(String(b.numero_factura || ""), undefined, { numeric: true });
      case "numero_factura_desc": return String(b.numero_factura || "").localeCompare(String(a.numero_factura || ""), undefined, { numeric: true });
      case "vencimiento_asc": return new Date(fechaVencimientoEfectiva(a) || 0).getTime() - new Date(fechaVencimientoEfectiva(b) || 0).getTime();
      case "vencimiento_desc": return new Date(fechaVencimientoEfectiva(b) || 0).getTime() - new Date(fechaVencimientoEfectiva(a) || 0).getTime();
      default: return 0;
    }
  });

  useEffect(() => { setCurrentPage(1); }, [search, tipoPagoFilter, fechaDesde, fechaHasta, estatusFacFilter, estatusCobFilter, prefilter, daysBucket, pageSize]);

  const totalDocs = sortedDocs.length;
  const totalPages = Math.max(1, Math.ceil(totalDocs / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedDocs = sortedDocs.slice((safePage - 1) * pageSize, safePage * pageSize);

  const cycleSort = (ascKey: string, descKey: string) => {
    setSortBy(prev => prev === descKey ? ascKey : prev === ascKey ? descKey : descKey);
  };

  const handleExportExcel = () => {
    if (sortedDocs.length === 0) {
      toast.error("No hay facturas para exportar");
      return;
    }
    const rows = sortedDocs.map((d: any) => {
      const tp = getTipoPagoInfo(d.tipo_pago).label;
      const fv = fechaVencimientoEfectiva(d);
      return {
        "No. Factura": d.numero_factura || "",
        "Cliente": (d.companies as any)?.name || "",
        "Ejecutivo": (d.profiles as any)?.full_name || (d.ejecutivo as any)?.full_name || "",
        "Plaza": (d.plazas as any)?.nombre || (d.plaza as any)?.nombre || "",
        "Fecha Documento": d.fecha_documento || "",
        "Fecha Vencimiento": fv || "",
        "Tipo de Pago": tp,
        "Total": Number(d.total) || 0,
        "Saldo": Number(d.saldo_pendiente_cobranza) || 0,
        "Estatus Factura": ESTATUS_FAC_LABELS_DISPLAY[(d.estatus_factura || "").toLowerCase()] || d.estatus_factura || "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 14 }, { wch: 36 }, { wch: 22 }, { wch: 16 },
      { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    ];
    const range = XLSX.utils.decode_range(ws["!ref"]!);
    for (let R = range.s.r + 1; R <= range.e.r; R++) {
      for (const C of [7, 8]) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr];
        if (cell && typeof cell.v === "number") { cell.t = "n"; cell.z = '"$"#,##0.00'; }
      }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Facturas");
    const brand = empresaVendedora === "lumaggs_chevron" ? "Chevron" : "Phillips66";
    const fname = `Facturas_${brand}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fname);
    toast.success(`Exportadas ${rows.length} facturas`);
  };

  const SortableHead = ({ ascKey, descKey, children, className }: { ascKey: string; descKey: string; children: React.ReactNode; className?: string }) => {
    const active = sortBy === ascKey || sortBy === descKey;
    const arrow = sortBy === ascKey ? " ↑" : sortBy === descKey ? " ↓" : "";
    return (
      <TableHead
        className={`cursor-pointer select-none hover:text-foreground ${active ? "text-foreground font-semibold" : ""} ${className || ""}`}
        onClick={() => cycleSort(ascKey, descKey)}
      >
        {children}{arrow}
      </TableHead>
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedDocs.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(sortedDocs.map((d: any) => d.id)));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("documentos").update({ is_active: false }).eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success("Documento eliminado");
      refetch();
    } catch (err: any) {
      toast.error("Error: " + (err.message || "Error"));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!isAdmin || selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from("documentos").update({ is_active: false }).in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} documento(s) eliminados`);
      setSelectedIds(new Set());
      refetch();
    } catch (err: any) {
      toast.error("Error: " + (err.message || "Error"));
    } finally {
      setBulkDeleting(false);
      setBulkDeleteConfirm(false);
    }
  };

  const bulkFields = [
    { key: "ejecutivo_venta_id", label: "Ejecutivo de venta", type: "select" as const,
      options: profiles.map((p: any) => ({ value: p.user_id, label: p.full_name || p.user_id })) },
    { key: "estatus_factura", label: "Estatus", type: "select" as const,
      options: Object.entries(ESTATUS_FAC_LABELS).map(([v, l]) => ({ value: v, label: l })) },
  ];

  return (
    <Card className="border-t-2 border-emerald-500">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por número o cliente..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <SortMenu
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: "numero_factura_desc", label: "No. Factura ↓" },
              { value: "numero_factura_asc", label: "No. Factura ↑" },
              { value: "date_desc", label: "Fecha Documento ↓" },
              { value: "date_asc", label: "Fecha Documento ↑" },
              { value: "vencimiento_asc", label: "Fecha Vencimiento ↑" },
              { value: "vencimiento_desc", label: "Fecha Vencimiento ↓" },
              { value: "total_desc", label: "Total ↓" },
              { value: "total_asc", label: "Total ↑" },
              { value: "client_asc", label: "Cliente A-Z" },
              { value: "client_desc", label: "Cliente Z-A" },
            ]}
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 className="mr-1 h-4 w-4" /> Columnas
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56">
              <p className="text-sm font-medium mb-2">Columnas visibles</p>
              <div className="space-y-2">
                {ALL_COLUMNS.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={visibleCols.has(c.key)} onCheckedChange={() => toggleCol(c.key)} />
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={handleExportExcel} title="Exportar a Excel">
            <Download className="mr-1 h-4 w-4" /> Excel
          </Button>
          <div className="flex rounded-md border overflow-hidden">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "list" ? "default" : "ghost"}
              className="rounded-none h-8"
              onClick={() => setViewMode("list")}
              title="Vista lista"
            >
              <List className="h-4 w-4 mr-1" /> Lista
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "grouped" ? "default" : "ghost"}
              className="rounded-none h-8"
              onClick={() => setViewMode("grouped")}
              title="Agrupar por cliente"
            >
              <Users className="h-4 w-4 mr-1" /> Por cliente
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2 p-3 rounded-md border bg-muted/30">
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground mr-1">
            <Filter className="h-4 w-4" /> Filtros
            {activeFiltersCount > 0 && <Badge variant="secondary" className="ml-1">{activeFiltersCount}</Badge>}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Tipo de Pago</label>
            <Select value={tipoPagoFilter} onValueChange={setTipoPagoFilter}>
              <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="contado">Contado</SelectItem>
                <SelectItem value="directo">Crédito Directo</SelectItem>
                <SelectItem value="cescemex">Crédito Cescemex</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Fecha desde</label>
            <Input type="date" className="h-8 w-40" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Fecha hasta</label>
            <Input type="date" className="h-8 w-40" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Estatus factura</label>
            <Select value={estatusFacFilter} onValueChange={setEstatusFacFilter}>
              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="vigente">Vigente</SelectItem>
                <SelectItem value="pagada">Pagada</SelectItem>
                <SelectItem value="vencida">Vencida</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" className="h-8" onClick={clearFilters}>
              <X className="h-3.5 w-3.5 mr-1" /> Limpiar filtros
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-0 sm:px-6">
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 mb-2 bg-muted rounded-md">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{selectedIds.size} seleccionado(s)</span>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Deseleccionar</Button>
            <Button variant="outline" size="sm" onClick={() => setBulkEditOpen(true)}>
              <Pencil className="h-4 w-4 mr-1" /> Editar seleccionados
            </Button>
            {isAdmin && (
              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteConfirm(true)}>
                <Trash2 className="h-4 w-4 mr-1" /> Eliminar seleccionados
              </Button>
            )}
          </div>
        )}
        {isLoading ? (
          <p className="text-center py-8 text-muted-foreground">Cargando...</p>
        ) : sortedDocs.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-2 text-muted-foreground">No hay facturas</p>
          </div>
        ) : (
          viewMode === "grouped" ? (
            <GroupedByClient
              docs={sortedDocs}
              expanded={expandedGroups}
              onToggle={toggleGroup}
              onRowClick={(id) => navigate(`/documents/${id}`)}
              fechaVencimientoEfectiva={fechaVencimientoEfectiva}
            />
          ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={sortedDocs.length > 0 && selectedIds.size === sortedDocs.length} onCheckedChange={toggleSelectAll} />
                    </TableHead>
                    {isColVisible("numero") && <SortableHead ascKey="numero_factura_asc" descKey="numero_factura_desc">No. Factura</SortableHead>}
                    {isColVisible("cliente") && <SortableHead ascKey="client_asc" descKey="client_desc" className="min-w-[180px]">Cliente</SortableHead>}
                    {isColVisible("ejecutivo") && <TableHead className="hidden sm:table-cell">Ejecutivo</TableHead>}
                    {isColVisible("plaza") && <TableHead className="hidden md:table-cell">Plaza</TableHead>}
                    {isColVisible("fecha") && <SortableHead ascKey="date_asc" descKey="date_desc" className="whitespace-nowrap">Fecha Documento</SortableHead>}
                    {isColVisible("fecha_vencimiento") && <SortableHead ascKey="vencimiento_asc" descKey="vencimiento_desc" className="whitespace-nowrap">Fecha Vencimiento</SortableHead>}
                    {isColVisible("tipo_pago") && <TableHead className="whitespace-nowrap">Tipo de Pago</TableHead>}
                    {isColVisible("total") && <SortableHead ascKey="total_asc" descKey="total_desc">Total</SortableHead>}
                    {isColVisible("saldo") && <TableHead className="whitespace-nowrap">Saldo</TableHead>}
                    {isColVisible("estatus") && <TableHead>Estatus Factura</TableHead>}
                    {isColVisible("pdf") && <TableHead className="hidden sm:table-cell">PDF</TableHead>}
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedDocs.map((doc: any) => {
                    const fv = doc.fecha_vencimiento ?? fechaVencimientoEfectiva(doc);
                    return (
                      <TableRow
                        key={doc.id}
                        className={`cursor-pointer transition-colors duration-150 hover:bg-muted/50 ${selectedIds.has(doc.id) ? "bg-muted/30" : ""}`}
                        onClick={() => navigate(`/documents/${doc.id}`)}
                      >
                        <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(doc.id)}
                            onCheckedChange={() => {
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                next.has(doc.id) ? next.delete(doc.id) : next.add(doc.id);
                                return next;
                              });
                            }}
                          />
                        </TableCell>
                        {isColVisible("numero") && <TableCell className="font-medium whitespace-nowrap">{doc.numero_factura || "-"}</TableCell>}
                        {isColVisible("cliente") && <TableCell>{(doc.companies as any)?.name || "-"}</TableCell>}
                        {isColVisible("ejecutivo") && <TableCell className="hidden sm:table-cell">{getEjecutivoName(doc.ejecutivo_venta_id)}</TableCell>}
                        {isColVisible("plaza") && <TableCell className="hidden md:table-cell">{(doc.plazas as any)?.nombre || "-"}</TableCell>}
                        {isColVisible("fecha") && <TableCell className="whitespace-nowrap">{format(new Date(doc.fecha_documento + "T12:00:00"), "dd/MM/yyyy")}</TableCell>}
                        {isColVisible("fecha_vencimiento") && (
                          <TableCell className="whitespace-nowrap">
                            {fv ? format(new Date(fv + "T12:00:00"), "dd/MM/yyyy") : "-"}
                          </TableCell>
                        )}
                        {isColVisible("tipo_pago") && (() => {
                          const tp = getTipoPagoInfo(doc.tipo_pago);
                          return (
                            <TableCell>
                              {tp.cls ? (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${tp.cls}`}>{tp.label}</span>
                              ) : (<span className="text-muted-foreground">-</span>)}
                            </TableCell>
                          );
                        })()}
                        {isColVisible("total") && (
                          <TableCell className="whitespace-nowrap">${Number(doc.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</TableCell>
                        )}
                        {isColVisible("saldo") && (() => {
                          const saldo = doc.saldo_pendiente_cobranza != null
                            ? Number(doc.saldo_pendiente_cobranza)
                            : Number(doc.total || 0) - Number(doc.monto_pagado || 0);
                          return (
                            <TableCell className="whitespace-nowrap font-medium">
                              ${saldo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </TableCell>
                          );
                        })()}
                        {isColVisible("estatus") && (
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeClass(doc.estatus_factura)}`}>
                              {ESTATUS_FAC_LABELS_DISPLAY[doc.estatus_factura] || "-"}
                            </span>
                          </TableCell>
                        )}
                        {isColVisible("pdf") && (
                          <TableCell className="hidden sm:table-cell">
                            {doc.pdf_url ? (
                              <Button variant="ghost" size="icon" title="Ver PDF" onClick={(e) => { e.stopPropagation(); openDocFilesSignedUrl(doc.pdf_url!); }}>
                                <Download className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex gap-1">
                            <RowActions doc={doc} />
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); window.open(`/documents/${doc.id}`, "_blank"); }} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={(e) => { e.stopPropagation(); setDeleteTarget(doc); }}
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {totalDocs > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Mostrar</span>
                  <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                    <SelectTrigger className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground">
                    {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, totalDocs)} de {totalDocs}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setCurrentPage(1)}>«</Button>
                  <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>‹</Button>
                  <span className="text-muted-foreground">Página</span>
                  <Input
                    type="number" min={1} max={totalPages} value={safePage}
                    onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) setCurrentPage(Math.min(Math.max(1, n), totalPages)); }}
                    className="h-8 w-16 text-center"
                  />
                  <span className="text-muted-foreground">de {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>›</Button>
                  <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setCurrentPage(totalPages)}>»</Button>
                </div>
              </div>
            )}
          </>
          )
        )}
      </CardContent>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar documento</DialogTitle>
            <DialogDescription>¿Estás seguro de eliminar este documento? Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? "Eliminando..." : "Eliminar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteConfirm} onOpenChange={(open) => !open && setBulkDeleteConfirm(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar {selectedIds.size} documento(s)</DialogTitle>
            <DialogDescription>¿Estás seguro? Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteConfirm(false)} disabled={bulkDeleting}>Cancelar</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>{bulkDeleting ? "Eliminando..." : "Eliminar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkEditDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        selectedIds={Array.from(selectedIds)}
        table="documentos"
        fields={bulkFields}
        onSuccess={() => { setSelectedIds(new Set()); refetch(); }}
      />
    </Card>
  );
}

function GroupedByClient({
  docs, expanded, onToggle, onRowClick, fechaVencimientoEfectiva,
}: {
  docs: any[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
  onRowClick: (id: string) => void;
  fechaVencimientoEfectiva: (d: any) => string | null;
}) {
  const groups = new Map<string, { name: string; docs: any[]; total: number }>();
  for (const d of docs) {
    const name = (d.companies as any)?.name || "Sin cliente";
    const id = d.empresa_id || d.company_id || `__name__:${name}`;
    if (!groups.has(id)) groups.set(id, { name, docs: [], total: 0 });
    const g = groups.get(id)!;
    g.docs.push(d);
    g.total += Number(d.total || 0);
  }
  const arr = Array.from(groups.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name, "es"));
  return (
    <div className="space-y-2 px-2 sm:px-0">
      {arr.map(([id, g]) => {
        const isOpen = expanded.has(id);
        return (
          <div key={id} className="border rounded-md">
            <div
              role="button"
              tabIndex={0}
              onClick={() => onToggle(id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(id); } }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/40 cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="font-medium truncate">{g.name}</span>
                <Badge variant="secondary">{g.docs.length}</Badge>
              </div>
              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                <span className="text-sm font-medium tabular-nums">
                  ${g.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
                <ClientActions empresaId={g.docs[0]?.empresa_id || g.docs[0]?.company_id || null} clientName={g.name} docIds={g.docs.map((d: any) => d.id)} />
              </div>
            </div>
            {isOpen && (
              <div className="border-t overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No. Factura</TableHead>
                      <TableHead>Fecha Documento</TableHead>
                      <TableHead>Fecha Vencimiento</TableHead>
                      <TableHead>Tipo de Pago</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Saldo</TableHead>
                      <TableHead>Estatus</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.docs.map((doc: any) => {
                      const fv = doc.fecha_vencimiento ?? fechaVencimientoEfectiva(doc);
                      const tp = getTipoPagoInfo(doc.tipo_pago);
                      return (
                        <TableRow key={doc.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onRowClick(doc.id)}>
                          <TableCell className="font-medium whitespace-nowrap">{doc.numero_factura || "-"}</TableCell>
                          <TableCell className="whitespace-nowrap">{format(new Date(doc.fecha_documento + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                          <TableCell className="whitespace-nowrap">{fv ? format(new Date(fv + "T12:00:00"), "dd/MM/yyyy") : "-"}</TableCell>
                          <TableCell>
                            {tp.cls ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${tp.cls}`}>{tp.label}</span>
                            ) : (<span className="text-muted-foreground">-</span>)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">${Number(doc.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="whitespace-nowrap font-medium">
                            ${(doc.saldo_pendiente_cobranza != null
                              ? Number(doc.saldo_pendiente_cobranza)
                              : Number(doc.total || 0) - Number(doc.monto_pagado || 0)
                            ).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeClass(doc.estatus_factura)}`}>
                              {ESTATUS_FAC_LABELS_DISPLAY[doc.estatus_factura] || "-"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <RowActions doc={doc} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RowActions({ doc }: { doc: any }) {
  const handleFire = async (e: React.MouseEvent, key: string, label: string) => {
    e.stopPropagation();
    const res = await fireAutomation({
      trigger_type: "existing_button_click",
      entity_type: "document",
      entity_id: doc.id,
      trigger_key: key,
      context: { empresa_id: doc.empresa_id || null, numero_factura: doc.numero_factura || null },
    });
    if (res && res.matched > 0) {
      const ok = res.runs.filter((r: any) => r.status === "success").length;
      toast.success(`${label}: ${ok > 0 ? `automatización ejecutada (${ok})` : "sin éxito"}`);
    } else {
      toast.message(`${label}: no hay automatización configurada`);
    }
  };
  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="WhatsApp"
        aria-label="WhatsApp"
        onClick={(e) => handleFire(e, "cobranza.relacion.send_whatsapp", "WhatsApp desde relación cobranza")}
      >
        <MessageCircle className="h-4 w-4 text-green-600" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="Correo"
        aria-label="Correo"
        onClick={(e) => handleFire(e, "cobranza.relacion.send_email", "Correo desde relación cobranza")}
      >
        <Mail className="h-4 w-4 text-blue-600" />
      </Button>
    </div>
  );
}

function ClientActions({ empresaId, clientName, docIds }: { empresaId: string | null; clientName: string; docIds: string[] }) {
  const navigate = useNavigate();
  const handleFire = async (e: React.MouseEvent, key: string, label: string) => {
    e.stopPropagation();
    const res = await fireAutomation({
      trigger_type: "existing_button_click",
      entity_type: "company",
      entity_id: empresaId || undefined,
      trigger_key: key,
      context: { empresa_id: empresaId, cliente_nombre: clientName, document_ids: docIds, total_documentos: docIds.length },
    });
    if (res && res.matched > 0) {
      const ok = res.runs.filter((r: any) => r.status === "success").length;
      toast.success(`${label}: ${ok > 0 ? `automatización ejecutada (${ok})` : "sin éxito"}`);
    } else {
      toast.message(`${label}: no hay automatización configurada`);
    }
  };
  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {empresaId && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Ver Estado de Cuenta"
          aria-label="Ver Estado de Cuenta"
          onClick={(e) => {
            e.stopPropagation();
            const back = `${window.location.pathname}${window.location.search}`;
            navigate(`/directory?tab=companies&select=${empresaId}&subtab=credito&back=${encodeURIComponent(back)}`);
          }}
        >
          <Receipt className="h-4 w-4 text-primary" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="WhatsApp por Cliente"
        aria-label="WhatsApp por Cliente"
        onClick={(e) => handleFire(e, "cobranza.relacion.send_whatsapp_cliente", "WhatsApp por Cliente")}
      >
        <MessageCircle className="h-4 w-4 text-green-600" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="Correo por Cliente"
        aria-label="Correo por Cliente"
        onClick={(e) => handleFire(e, "cobranza.relacion.send_email_cliente", "Correo por Cliente")}
      >
        <Mail className="h-4 w-4 text-blue-600" />
      </Button>
    </div>
  );
}