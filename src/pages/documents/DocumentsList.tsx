import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, FileText, Download, Pencil, Copy, LayoutList, Columns, Truck, Upload, FileDown, Trash2, CheckSquare, Columns3, Filter, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SortMenu } from "@/components/SortMenu";
import { downloadCotizacionPdf } from "@/lib/generateCotizacionPdf";
import { format } from "date-fns";
import { toast } from "sonner";
import { DocumentKanban } from "@/components/documents/DocumentKanban";
import { BulkEditDialog } from "@/components/BulkEditDialog";
import { ExportFieldsDialog, ExportField } from "@/components/documents/ExportFieldsDialog";
import { ExportFilterDialog, ExportFilters } from "@/components/documents/ExportFilterDialog";
import { fetchAllRows } from "@/lib/supabasePagination";
import { openDocFilesSignedUrl } from "@/lib/storageSignedUrl";

// Column visibility config per document type
type ColumnKey = "numero" | "cliente" | "ejecutivo" | "plaza" | "fecha" | "fecha_vencimiento" | "fecha_programada" | "total" | "estatus" | "pdf" | "oc_cliente" | "tipo_pago";
const ALL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "numero", label: "Número" },
  { key: "cliente", label: "Cliente" },
  { key: "ejecutivo", label: "Ejecutivo" },
  { key: "plaza", label: "Plaza" },
  { key: "fecha", label: "Fecha Documento" },
  { key: "fecha_vencimiento", label: "Fecha Vencimiento" },
  { key: "fecha_programada", label: "Fecha Programada" },
  { key: "oc_cliente", label: "Núm. OC Cliente" },
  { key: "tipo_pago", label: "Tipo de Pago" },
  { key: "total", label: "Total" },
  { key: "estatus", label: "Estatus" },
  { key: "pdf", label: "PDF" },
];
const DEFAULT_COLS_BY_TIPO: Record<string, ColumnKey[]> = {
  cotizacion: ["numero", "cliente", "ejecutivo", "fecha", "tipo_pago", "total", "estatus", "pdf"],
  pedido: ["cliente", "ejecutivo", "fecha", "fecha_programada", "tipo_pago", "total", "estatus", "pdf"],
  factura: ["numero", "cliente", "ejecutivo", "plaza", "fecha", "fecha_vencimiento", "tipo_pago", "total", "estatus", "pdf"],
  entrega_corporativa: ["cliente", "ejecutivo", "fecha", "fecha_programada", "oc_cliente", "estatus"],
};
const colsStorageKey = (userId: string, tipo: string) => `doc-cols:${userId}:${tipo}`;

const ESTATUS_COT_LABELS: Record<string, string> = {
  borrador: "Borrador", impresa: "Impresa", enviada: "Enviada",
  aceptada: "Aceptada", rechazada: "Rechazada", vencida: "Vencida",
};
const ESTATUS_PED_LABELS: Record<string, string> = {
  confirmado_cliente: "Confirmado Cliente", espera_autorizacion_precio: "Espera Autoriz.",
  precio_autorizado: "Precio Autoriz.", validado_contabilidad: "Validado Contab.",
  programado_entrega: "Prog. Entrega", entregado: "Entregado", cancelado: "Cancelado",
};
const PEDIDO_STATUS_CHIP_LABELS: Record<string, string> = {
  confirmado_cliente: "Confirmado",
  espera_autorizacion_precio: "Autorización",
  precio_autorizado: "Precio OK",
  validado_contabilidad: "Contabilidad",
  programado_entrega: "Programado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};
const PEDIDO_STATUS_ORDER = [
  "confirmado_cliente",
  "espera_autorizacion_precio",
  "precio_autorizado",
  "validado_contabilidad",
  "programado_entrega",
  "entregado",
  "cancelado",
];
const ESTATUS_FAC_LABELS: Record<string, string> = {
  vigente: "Vigente", pendiente: "Vigente", pagada: "Pagada", parcial: "Parcial",
  vencida: "Vencida", cancelada: "Cancelada",
};
const ESTATUS_ENT_CORP_LABELS: Record<string, string> = {
  solicitada: "Solicitadas", programada: "Programadas",
  entregada: "Entregadas", acuse_enviado: "Acuse Enviado",
};

function getEstatusLabel(doc: any) {
  if (doc.tipo_documento === "cotizacion") return ESTATUS_COT_LABELS[doc.estatus_cotizacion] || "-";
  if (doc.tipo_documento === "pedido") return ESTATUS_PED_LABELS[doc.estatus_pedido] || "-";
  if (doc.tipo_documento === "factura") return ESTATUS_FAC_LABELS[doc.estatus_factura] || "-";
  if (doc.tipo_documento === "entrega_corporativa") return ESTATUS_ENT_CORP_LABELS[doc.estatus_entrega_corporativa] || "-";
  return "-";
}

function getEstatusVariant(doc: any): "default" | "secondary" | "destructive" | "outline" {
  const st = doc.tipo_documento === "cotizacion" ? doc.estatus_cotizacion
    : doc.tipo_documento === "pedido" ? doc.estatus_pedido
    : doc.tipo_documento === "factura" ? doc.estatus_factura
    : doc.estatus_entrega_corporativa;
  if (["aceptada", "confirmado_cliente", "pagada", "entregado", "impresa", "precio_autorizado", "vigente"].includes(st)) return "default";
  if (["rechazada", "cancelado", "cancelada", "vencida"].includes(st)) return "destructive";
  if (["validado_contabilidad", "programado_entrega"].includes(st)) return "outline";
  return "secondary";
}

// Color config per tab type
const TAB_COLORS: Record<string, { active: string; badge: string; border: string }> = {
  cotizacion: { active: "bg-blue-600 text-white hover:bg-blue-700", badge: "bg-blue-100 text-blue-800", border: "border-blue-500" },
  pedido: { active: "bg-amber-500 text-white hover:bg-amber-600", badge: "bg-amber-100 text-amber-800", border: "border-amber-500" },
  factura: { active: "bg-emerald-600 text-white hover:bg-emerald-700", badge: "bg-emerald-100 text-emerald-800", border: "border-emerald-500" },
  entrega_corporativa: { active: "bg-purple-600 text-white hover:bg-purple-700", badge: "bg-purple-100 text-purple-800", border: "border-purple-500" },
};

// Shared capsule color tokens
import { EMPRESA_STYLES, plazaColor } from "./documentStyles";

// Tipo de documento (capsule colors mirrored from TAB_COLORS)
const TIPO_DOC_PILL: Record<string, { cls: string; label: string }> = {
  cotizacion: { cls: "bg-blue-50 text-blue-700 border-blue-200", label: "Cotización" },
  pedido: { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "Pedido" },
  factura: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Factura" },
  entrega_corporativa: { cls: "bg-purple-50 text-purple-700 border-purple-200", label: "Entrega Corp." },
};

// Status badge colors
function getStatusBadgeClass(doc: any): string {
  const st = doc.tipo_documento === "cotizacion" ? doc.estatus_cotizacion
    : doc.tipo_documento === "pedido" ? doc.estatus_pedido
    : doc.tipo_documento === "factura" ? doc.estatus_factura
    : doc.estatus_entrega_corporativa;
  const map: Record<string, string> = {
    borrador: "bg-slate-100 text-slate-700 border-slate-300",
    impresa: "bg-blue-50 text-blue-700 border-blue-200",
    enviada: "bg-sky-50 text-sky-700 border-sky-200",
    aceptada: "bg-green-50 text-green-700 border-green-200",
    rechazada: "bg-red-50 text-red-700 border-red-200",
    vencida: "bg-red-50 text-red-700 border-red-200",
    confirmado_cliente: "bg-blue-50 text-blue-700 border-blue-200",
    espera_autorizacion_precio: "bg-yellow-50 text-yellow-700 border-yellow-200",
    precio_autorizado: "bg-teal-50 text-teal-700 border-teal-200",
    validado_contabilidad: "bg-indigo-50 text-indigo-700 border-indigo-200",
    programado_entrega: "bg-purple-50 text-purple-700 border-purple-200",
    entregado: "bg-green-50 text-green-700 border-green-200",
    cancelado: "bg-red-50 text-red-700 border-red-200",
    pendiente: "bg-slate-100 text-slate-700 border-slate-300",
    pagada: "bg-green-50 text-green-700 border-green-200",
    parcial: "bg-amber-50 text-amber-700 border-amber-200",
    vigente: "bg-blue-50 text-blue-700 border-blue-200",
    cancelada: "bg-red-50 text-red-700 border-red-200",
    solicitada: "bg-slate-100 text-slate-700 border-slate-300",
    programada: "bg-amber-50 text-amber-700 border-amber-200",
    entregada: "bg-green-50 text-green-700 border-green-200",
    acuse_enviado: "bg-blue-50 text-blue-700 border-blue-200",
  };
  return map[st] || "bg-slate-100 text-slate-700 border-slate-300";
}

// Tipo de Pago helpers
function getTipoPagoInfo(valor: any): { label: string; cls: string } {
  const v = String(valor || "").trim().toLowerCase();
  if (!v) return { label: "-", cls: "" };
  if (v === "credito_cescemex") return { label: "Crédito Cescemex", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  if (v === "credito_directo") return { label: "Crédito Directo", cls: "bg-purple-50 text-purple-700 border-purple-200" };
  if (v === "contado") return { label: "Contado", cls: "bg-blue-50 text-blue-700 border-blue-200" };
  if (v === "credito") return { label: "Crédito (sin clasificar)", cls: "bg-slate-100 text-slate-700 border-slate-300" };
  return { label: "-", cls: "" };
}

// Capsule styles for status keys used in dropdowns
const STATUS_PILL_MAP: Record<string, string> = {
  borrador: "bg-slate-100 text-slate-700 border-slate-300",
  impresa: "bg-blue-50 text-blue-700 border-blue-200",
  enviada: "bg-sky-50 text-sky-700 border-sky-200",
  aceptada: "bg-green-50 text-green-700 border-green-200",
  rechazada: "bg-red-50 text-red-700 border-red-200",
  vencida: "bg-red-50 text-red-700 border-red-200",
  confirmado_cliente: "bg-blue-50 text-blue-700 border-blue-200",
  espera_autorizacion_precio: "bg-yellow-50 text-yellow-700 border-yellow-200",
  precio_autorizado: "bg-teal-50 text-teal-700 border-teal-200",
  validado_contabilidad: "bg-indigo-50 text-indigo-700 border-indigo-200",
  programado_entrega: "bg-purple-50 text-purple-700 border-purple-200",
  entregado: "bg-green-50 text-green-700 border-green-200",
  cancelado: "bg-red-50 text-red-700 border-red-200",
  pendiente: "bg-slate-100 text-slate-700 border-slate-300",
  pagada: "bg-green-50 text-green-700 border-green-200",
  parcial: "bg-amber-50 text-amber-700 border-amber-200",
  vigente: "bg-blue-50 text-blue-700 border-blue-200",
  cancelada: "bg-red-50 text-red-700 border-red-200",
  solicitada: "bg-slate-100 text-slate-700 border-slate-300",
  programada: "bg-amber-50 text-amber-700 border-amber-200",
  entregada: "bg-green-50 text-green-700 border-green-200",
  acuse_enviado: "bg-blue-50 text-blue-700 border-blue-200",
};
const NEUTRAL_PILL = "bg-slate-100 text-slate-700 border-slate-300";
function Pill({ cls, children }: { cls: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cls.split(" ").find(c => c.startsWith("text-"))?.replace("text-", "bg-") || "bg-slate-500"}`} />
      {children}
    </span>
  );
}

function toYMD(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function DocumentsList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasRole, user, profile } = useAuth();
  const isAdmin = hasRole("admin");
  const qc = useQueryClient();

  // Persist filters via URL search params
  const tipoFilter = searchParams.get("tipo") || "cotizacion";
  const empresaFilter = searchParams.get("empresa") || "lumaggs_chevron";
  const ejecutivoFilter = searchParams.get("ejecutivo") || "all";
  const plazaFilter = searchParams.get("plaza") || "";

  const [search, setSearch] = useState("");
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState(tipoFilter === "factura" ? "numero_factura_desc" : "date_desc");

  // Reset to default sort when document type changes (or on mount/refresh)
  useEffect(() => {
    setSortBy(tipoFilter === "factura" ? "numero_factura_desc" : "date_desc");
  }, [tipoFilter]);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // Pagination
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  useEffect(() => { setCurrentPage(1); }, [tipoFilter, empresaFilter, ejecutivoFilter, plazaFilter, search, pageSize]);

  // Extra filter toolbar state
  const [tipoPagoFilter, setTipoPagoFilter] = useState<string>("all");
  const [fechaDesde, setFechaDesde] = useState<string>("");
  const [fechaHasta, setFechaHasta] = useState<string>("");
  const [estatusCotFilter, setEstatusCotFilter] = useState<string>("all");
  const [estatusPedFilter, setEstatusPedFilter] = useState<string>(searchParams.get("estatus") || "all");
  const [estatusFacFilter, setEstatusFacFilter] = useState<string>("all");
  const [estatusCobFilter, setEstatusCobFilter] = useState<string>("all");
  const clearFilters = () => {
    setTipoPagoFilter("all");
    setFechaDesde("");
    setFechaHasta("");
    setEstatusCotFilter("all");
    setEstatusPedFilter("all");
    setEstatusFacFilter("all");
    setEstatusCobFilter("all");
  };
  const activeFiltersCount =
    (tipoPagoFilter !== "all" ? 1 : 0) +
    (fechaDesde ? 1 : 0) +
    (fechaHasta ? 1 : 0) +
    (tipoFilter === "cotizacion" && estatusCotFilter !== "all" ? 1 : 0) +
    (tipoFilter === "pedido" && estatusPedFilter !== "all" ? 1 : 0) +
    (tipoFilter === "factura" && estatusFacFilter !== "all" ? 1 : 0) +
    (tipoFilter === "factura" && estatusCobFilter !== "all" ? 1 : 0);

  const setFilter = useCallback((key: string, value: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set(key, value);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Column visibility (persisted in localStorage by user + tipo_documento)
  const [visibleCols, setVisibleCols] = useState<Set<ColumnKey>>(new Set(DEFAULT_COLS_BY_TIPO[tipoFilter] || []));
  useEffect(() => {
    if (!user?.id) return;
    try {
      const raw = localStorage.getItem(colsStorageKey(user.id, tipoFilter));
      if (raw) {
        const arr = JSON.parse(raw) as ColumnKey[];
        if (Array.isArray(arr)) setVisibleCols(new Set(arr));
        else setVisibleCols(new Set(DEFAULT_COLS_BY_TIPO[tipoFilter] || []));
      } else {
        setVisibleCols(new Set(DEFAULT_COLS_BY_TIPO[tipoFilter] || []));
      }
    } catch {
      setVisibleCols(new Set(DEFAULT_COLS_BY_TIPO[tipoFilter] || []));
    }
  }, [user?.id, tipoFilter]);
  const toggleCol = (key: ColumnKey) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      if (user?.id) {
        try { localStorage.setItem(colsStorageKey(user.id, tipoFilter), JSON.stringify(Array.from(next))); } catch {}
      }
      return next;
    });
  };
  const isColVisible = (key: ColumnKey) => visibleCols.has(key);

  // Determine module based on tipoFilter
  const docModule = tipoFilter === "factura" ? "facturacion" as const : "cotizaciones" as const;
  const access = useModuleAccess(docModule);

  // Companies assigned to the current user (matches RLS: documentos.empresa_id IN ejecutivos)
  const { data: assignedCompanyIds = [] } = useQuery({
    queryKey: ["my-assigned-companies", access.userId],
    queryFn: async () => {
      if (!access.userId) return [] as string[];
      const { data, error } = await supabase
        .from("company_ejecutivos")
        .select("company_id")
        .eq("user_id", access.userId);
      if (error) throw error;
      return (data || []).map((r: any) => r.company_id);
    },
    enabled: !!access.userId,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-for-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: plazas = [] } = useQuery({
    queryKey: ["plazas-for-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plazas")
        .select("id, nombre")
        .eq("is_active", true)
        .order("nombre");
      if (error) throw error;
      return data;
    },
  });

  // No aplicamos plaza por defecto: el filtro inicia en "Todas" para no ocultar
  // documentos del usuario que pertenezcan a otra plaza. El usuario puede
  // seleccionar manualmente una plaza si lo desea.

  const { data: docs = [], isLoading, refetch } = useQuery({
    queryKey: ["documentos", search, tipoFilter, empresaFilter, ejecutivoFilter, plazaFilter, tipoPagoFilter, fechaDesde, fechaHasta, estatusCotFilter, estatusPedFilter, estatusFacFilter, estatusCobFilter, access.accessLevel, access.teamMemberIds, assignedCompanyIds],
    queryFn: async () => {
      if (!access.canView) return [];
      let q = supabase
        .from("documentos")
        .select("*, companies(name), contacts(first_name, last_name), plazas(nombre)")
        .eq("is_active", true)
        .eq("empresa_vendedora", empresaFilter as any)
        .order("created_at", { ascending: false });
      if (tipoFilter !== "all") q = q.eq("tipo_documento", tipoFilter as any);
      if (ejecutivoFilter !== "all") q = q.eq("ejecutivo_venta_id", ejecutivoFilter);
      if (plazaFilter && plazaFilter !== "all") q = q.or(`plaza_id.eq.${plazaFilter},plaza_id.is.null`);
      if (tipoPagoFilter === "contado") q = q.eq("tipo_pago", "contado" as any);
      else if (tipoPagoFilter === "directo") q = q.eq("tipo_pago", "credito_directo" as any);
      else if (tipoPagoFilter === "cescemex") q = q.eq("tipo_pago", "credito_cescemex" as any);
      else if (tipoPagoFilter === "sin_clasificar") q = q.eq("tipo_pago", "credito" as any);
      if (fechaDesde) q = q.gte("fecha_documento", fechaDesde);
      if (fechaHasta) q = q.lte("fecha_documento", fechaHasta);
      if (tipoFilter === "cotizacion" && estatusCotFilter !== "all") q = q.eq("estatus_cotizacion", estatusCotFilter as any);
      if (tipoFilter === "pedido" && estatusPedFilter !== "all") q = q.eq("estatus_pedido", estatusPedFilter as any);
      if (tipoFilter === "factura" && estatusFacFilter !== "all") {
        if (estatusFacFilter === "vigente") {
          q = q.in("estatus_factura", ["vigente", "pendiente"] as any);
        } else {
          q = q.eq("estatus_factura", estatusFacFilter as any);
        }
      }
      if (tipoFilter === "factura" && estatusCobFilter !== "all") q = q.eq("estado_cobranza", estatusCobFilter as any);
      if (access.accessLevel === "propio" && access.userId) {
        const parts = [
          `created_by.eq.${access.userId}`,
          `ejecutivo_venta_id.eq.${access.userId}`,
        ];
        if (assignedCompanyIds.length > 0) {
          parts.push(`empresa_id.in.(${assignedCompanyIds.join(",")})`);
        }
        q = q.or(parts.join(","));
      } else if (access.accessLevel === "equipo" && access.teamMemberIds.length > 0) {
        const parts = [
          `created_by.in.(${access.teamMemberIds.join(",")})`,
          `ejecutivo_venta_id.in.(${access.teamMemberIds.join(",")})`,
        ];
        if (assignedCompanyIds.length > 0) {
          parts.push(`empresa_id.in.(${assignedCompanyIds.join(",")})`);
        }
        q = q.or(parts.join(","));
      }
      const data = await fetchAllRows<any>((from, to) => q.range(from, to));
      if (search) {
        const s = search.toLowerCase();
        return data.filter((doc: any) => {
          const num = (doc.numero_cotizacion || doc.numero_pedido || doc.numero_factura || "").toLowerCase();
          const clientName = ((doc.companies as any)?.name || "").toLowerCase();
          return num.includes(s) || clientName.includes(s);
        });
      }
      return data;
    },
    enabled: !access.isLoading,
  });

  const sortedDocs = [...docs].sort((a: any, b: any) => {
    switch (sortBy) {
      case "date_desc": return new Date(b.fecha_documento).getTime() - new Date(a.fecha_documento).getTime();
      case "date_asc": return new Date(a.fecha_documento).getTime() - new Date(b.fecha_documento).getTime();
      case "created_desc": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "created_asc": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "total_desc": return Number(b.total) - Number(a.total);
      case "total_asc": return Number(a.total) - Number(b.total);
      case "client_asc": return ((a.companies as any)?.name || "").localeCompare((b.companies as any)?.name || "");
      case "client_desc": return ((b.companies as any)?.name || "").localeCompare((a.companies as any)?.name || "");
      case "numero_asc": {
        const na = a.numero_cotizacion || a.numero_pedido || a.numero_factura || "";
        const nb = b.numero_cotizacion || b.numero_pedido || b.numero_factura || "";
        return String(na).localeCompare(String(nb), undefined, { numeric: true });
      }
      case "numero_desc": {
        const na = a.numero_cotizacion || a.numero_pedido || a.numero_factura || "";
        const nb = b.numero_cotizacion || b.numero_pedido || b.numero_factura || "";
        return String(nb).localeCompare(String(na), undefined, { numeric: true });
      }
      case "numero_factura_asc": {
        const na = a.numero_factura || "";
        const nb = b.numero_factura || "";
        return String(na).localeCompare(String(nb), undefined, { numeric: true });
      }
      case "numero_factura_desc": {
        const na = a.numero_factura || "";
        const nb = b.numero_factura || "";
        return String(nb).localeCompare(String(na), undefined, { numeric: true });
      }
      case "ejecutivo_asc": return getEjecutivoName(a.ejecutivo_venta_id).localeCompare(getEjecutivoName(b.ejecutivo_venta_id));
      case "ejecutivo_desc": return getEjecutivoName(b.ejecutivo_venta_id).localeCompare(getEjecutivoName(a.ejecutivo_venta_id));
      case "estatus_asc": return getEstatusLabel(a).localeCompare(getEstatusLabel(b));
      case "estatus_desc": return getEstatusLabel(b).localeCompare(getEstatusLabel(a));
      case "plaza_asc": return ((a.plazas as any)?.nombre || "").localeCompare((b.plazas as any)?.nombre || "");
      case "plaza_desc": return ((b.plazas as any)?.nombre || "").localeCompare((a.plazas as any)?.nombre || "");
      case "vencimiento_asc": return new Date(a.fecha_vencimiento || 0).getTime() - new Date(b.fecha_vencimiento || 0).getTime();
      case "vencimiento_desc": return new Date(b.fecha_vencimiento || 0).getTime() - new Date(a.fecha_vencimiento || 0).getTime();
      case "programada_asc": return new Date(a.fecha_programada || 0).getTime() - new Date(b.fecha_programada || 0).getTime();
      case "programada_desc": return new Date(b.fecha_programada || 0).getTime() - new Date(a.fecha_programada || 0).getTime();
      case "tipo_pago_asc": return String(a.tipo_pago || "").localeCompare(String(b.tipo_pago || ""));
      case "tipo_pago_desc": return String(b.tipo_pago || "").localeCompare(String(a.tipo_pago || ""));
      default: return 0;
    }
  });

  const totalDocs = sortedDocs.length;
  const totalPages = Math.max(1, Math.ceil(totalDocs / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedDocs = sortedDocs.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Helper for clickable sortable column headers
  const cycleSort = (ascKey: string, descKey: string) => {
    setSortBy(prev => prev === descKey ? ascKey : prev === ascKey ? descKey : descKey);
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

  const handleDuplicate = async (e: React.MouseEvent, doc: any) => {
    e.stopPropagation();
    if (duplicating) return;
    setDuplicating(doc.id);
    try {
      const { data: srcDoc, error: srcErr } = await supabase.from("documentos").select("*").eq("id", doc.id).single();
      if (srcErr || !srcDoc) throw srcErr || new Error("No encontrado");
      const { data: srcItems } = await supabase.from("documento_productos").select("*").eq("documento_id", doc.id);
      const { id: _id, created_at, updated_at, numero_cotizacion, numero_pedido, numero_factura, pdf_url, estatus_cotizacion, ...rest } = srcDoc;
      const hoy = toYMD(new Date());
      const vencimiento = srcDoc.fecha_vencimiento ? toYMD(new Date(Date.now() + 6 * 24 * 60 * 60 * 1000)) : null;
      const newDoc: any = {
        ...rest, pdf_url: null,
        fecha_documento: hoy,
        fecha_vencimiento: vencimiento,
        estatus_cotizacion: srcDoc.tipo_documento === "cotizacion" ? "borrador" : null,
        numero_cotizacion: null, numero_pedido: null, numero_factura: null,
        cotizacion_original_id: srcDoc.tipo_documento === "cotizacion" ? doc.id : (srcDoc.cotizacion_original_id || null),
      };
      const { data: inserted, error: insErr } = await supabase.from("documentos").insert(newDoc).select("id").single();
      if (insErr) throw insErr;
      if (srcItems && srcItems.length > 0) {
        const newItems = srcItems.map(({ id: _iid, created_at: _ca, documento_id, ...itemRest }: any) => ({
          ...itemRest, documento_id: inserted.id,
        }));
        await supabase.from("documento_productos").insert(newItems);
      }
      refetch();
      toast.success("Documento duplicado");
      navigate(`/documents/${inserted.id}`);
    } catch (err: any) {
      toast.error("Error al duplicar: " + (err.message || "Error"));
    } finally {
      setDuplicating(null);
    }
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
      toast.error("Error al eliminar: " + (err.message || "Error"));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const [exportData, setExportData] = useState<any[]>([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportFilterOpen, setExportFilterOpen] = useState(false);

  const handleExport = () => {
    setExportFilterOpen(true);
  };

  const runExportWithFilters = async (filters: ExportFilters) => {
    setExportLoading(true);
    try {
      let q = supabase
        .from("documentos")
        .select("*, companies(name, razon_social), contacts(first_name, last_name), plazas(nombre)")
        .eq("is_active", true)
        .eq("empresa_vendedora", empresaFilter as any)
        .in("tipo_documento", filters.tipos as any)
        .order("created_at", { ascending: false });
      if (!filters.allRecords) {
        if (filters.startDate) q = q.gte("fecha_documento", filters.startDate);
        if (filters.endDate) q = q.lte("fecha_documento", filters.endDate);
      }
      if (ejecutivoFilter !== "all") q = q.eq("ejecutivo_venta_id", ejecutivoFilter);
      if (access.accessLevel === "propio" && access.userId) {
        const parts = [
          `created_by.eq.${access.userId}`,
          `ejecutivo_venta_id.eq.${access.userId}`,
        ];
        if (assignedCompanyIds.length > 0) parts.push(`empresa_id.in.(${assignedCompanyIds.join(",")})`);
        q = q.or(parts.join(","));
      } else if (access.accessLevel === "equipo" && access.teamMemberIds.length > 0) {
        const parts = [
          `created_by.in.(${access.teamMemberIds.join(",")})`,
          `ejecutivo_venta_id.in.(${access.teamMemberIds.join(",")})`,
        ];
        if (assignedCompanyIds.length > 0) parts.push(`empresa_id.in.(${assignedCompanyIds.join(",")})`);
        q = q.or(parts.join(","));
      }
      const data = await fetchAllRows<any>((from, to) => q.range(from, to));
      if (!data || data.length === 0) { toast.error("No hay datos para exportar"); return; }
      setExportData(data);
      setExportFilterOpen(false);
      setExportOpen(true);
    } catch (err: any) {
      toast.error("Error al exportar: " + (err.message || "Error"));
    } finally {
      setExportLoading(false);
    }
  };

  const exportFields: ExportField[] = [
    { key: "id", label: "ID", importable: false },
    { key: "tipo_documento", label: "Tipo Documento", importable: true },
    { key: "numero_cotizacion", label: "No. Cotización", importable: true },
    { key: "numero_pedido", label: "No. Pedido", importable: true },
    { key: "numero_factura", label: "No. Factura", importable: true },
    { key: "numero_oc_cliente", label: "No. OC Cliente", importable: true },
    { key: "empresa_vendedora", label: "Empresa Vendedora", importable: true },
    { key: "empresa_id", label: "Empresa ID", importable: true },
    { key: "cliente", label: "Cliente", accessor: (d) => (d.companies as any)?.name || "", importable: false },
    { key: "razon_social", label: "Razón Social", accessor: (d) => (d.companies as any)?.razon_social || "", importable: false },
    { key: "contacto_id", label: "Contacto ID", importable: true },
    { key: "contacto", label: "Contacto", accessor: (d) => {
      const c = d.contacts as any;
      return c ? `${c.first_name || ""} ${c.last_name || ""}`.trim() : "";
    }, importable: false },
    { key: "ejecutivo_venta_id", label: "Ejecutivo ID", importable: true },
    { key: "ejecutivo", label: "Ejecutivo", accessor: (d) => getEjecutivoName(d.ejecutivo_venta_id), importable: false },
    { key: "plaza_id", label: "Plaza ID", importable: true },
    { key: "plaza", label: "Plaza", accessor: (d) => (d.plazas as any)?.nombre || "", importable: false },
    { key: "fecha_documento", label: "Fecha Documento", importable: true },
    { key: "fecha_vencimiento", label: "Fecha Vencimiento", importable: true },
    { key: "fecha_entrega_programada", label: "Fecha Entrega Prog.", importable: true },
    { key: "subtotal", label: "Subtotal", importable: true },
    { key: "iva_porcentaje", label: "IVA %", importable: true },
    { key: "iva_importe", label: "IVA Importe", importable: false },
    { key: "total", label: "Total", importable: false },
    { key: "saldo_pendiente_cobranza", label: "Saldo Pendiente", importable: false },
    { key: "unidades_equivalentes_total", label: "Unidades Equiv. Total", importable: false },
    { key: "estatus_cotizacion", label: "Estatus Cotización", importable: true },
    { key: "estatus_pedido", label: "Estatus Pedido", importable: true },
    { key: "estatus_factura", label: "Estatus Factura", importable: true },
    { key: "estado_cobranza", label: "Estado Cobranza", importable: false },
    { key: "tipo_pago", label: "Tipo de Pago", importable: true },
    { key: "metodo_pago", label: "Método de Pago", importable: true },
    { key: "uso_cfdi", label: "Uso CFDI", importable: true },
    { key: "direccion_envio", label: "Dirección de Envío", importable: true },
    { key: "direccion_envio_lat", label: "Dirección Envío Lat", importable: true },
    { key: "direccion_envio_lng", label: "Dirección Envío Lng", importable: true },
    { key: "negocio_crm", label: "Negocio CRM", importable: true },
    { key: "notas", label: "Notas", importable: true },
    { key: "pdf_url", label: "URL PDF", importable: false },
    { key: "cotizacion_original_id", label: "Cotización Original ID", importable: true },
    { key: "is_active", label: "Activo", importable: true },
    { key: "created_by", label: "Creado por", importable: false },
    { key: "created_at", label: "Creado", importable: false },
    { key: "updated_at", label: "Actualizado", importable: false },
  ];

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const lines = text.split("\n").filter((l: string) => l.trim());
        if (lines.length < 2) { toast.error("Archivo vacío o sin datos"); return; }
        toast.info(`Archivo cargado con ${lines.length - 1} registros. Importación pendiente de implementación completa.`);
      } catch (err: any) {
        toast.error("Error al leer archivo: " + err.message);
      }
    };
    input.click();
  };

  const getEjecutivoName = (ejecutivoId: string | null) => {
    if (!ejecutivoId) return "-";
    const profile = profiles.find((p) => p.user_id === ejecutivoId);
    return profile?.full_name || "-";
  };

  const tabColor = TAB_COLORS[tipoFilter] || TAB_COLORS.cotizacion;
  const isPedido = tipoFilter === "pedido";
  const showsScheduledDate = tipoFilter === "pedido" || tipoFilter === "entrega_corporativa";
  const hidesNumber = tipoFilter === "pedido" || tipoFilter === "entrega_corporativa";

  // Reset selection when tab/filter changes
  useEffect(() => { setSelectedIds(new Set()); }, [tipoFilter, empresaFilter, ejecutivoFilter]);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === sortedDocs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedDocs.map((d: any) => d.id)));
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

  const getDocBulkFields = () => {
    const fields: { key: string; label: string; type: "select" | "text"; options?: { value: string; label: string }[] }[] = [
      {
        key: "ejecutivo_venta_id",
        label: "Ejecutivo de venta",
        type: "select",
        options: profiles.map((p) => ({ value: p.user_id, label: p.full_name || p.user_id })),
      },
      {
        key: "empresa_vendedora",
        label: "Empresa vendedora",
        type: "select",
        options: [
          { value: "lumaggs_chevron", label: "Lumaggs Chevron" },
          { value: "galsa_phillips66", label: "Galsa Phillips 66" },
        ],
      },
      {
        key: "plaza_id",
        label: "Plaza",
        type: "select",
        options: plazas.map((p: any) => ({ value: p.id, label: p.nombre })),
      },
    ];
    if (tipoFilter === "cotizacion") {
      fields.push({
        key: "estatus_cotizacion",
        label: "Estatus",
        type: "select",
        options: Object.entries(ESTATUS_COT_LABELS).map(([v, l]) => ({ value: v, label: l })),
      });
    } else if (tipoFilter === "pedido") {
      fields.push({
        key: "estatus_pedido",
        label: "Estatus",
        type: "select",
        options: Object.entries(ESTATUS_PED_LABELS).map(([v, l]) => ({ value: v, label: l })),
      });
    } else if (tipoFilter === "factura") {
      fields.push({
        key: "estatus_factura",
        label: "Estatus",
        type: "select",
        options: Object.entries(ESTATUS_FAC_LABELS).map(([v, l]) => ({ value: v, label: l })),
      });
    } else if (tipoFilter === "entrega_corporativa") {
      fields.push({
        key: "estatus_entrega_corporativa",
        label: "Estatus",
        type: "select",
        options: Object.entries(ESTATUS_ENT_CORP_LABELS).map(([v, l]) => ({ value: v, label: l })),
      });
    }
    return fields;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documentos</h1>
          <p className="text-muted-foreground text-sm">Cotizaciones, pedidos y facturas</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && (
            <>
              <Button size="sm" onClick={handleImport}>
                <Upload className="mr-1 h-4 w-4" /> Importar
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <FileDown className="mr-1 h-4 w-4" /> Exportar
              </Button>
            </>
          )}
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
          <Button variant="outline" size="sm" onClick={() => navigate("/delivery/schedule")}>
            <Truck className="mr-1 h-4 w-4" /> Programar Entregas
          </Button>
          <Button onClick={() => navigate(`/documents/new${tipoFilter && tipoFilter !== "all" ? `?tipo=${tipoFilter}` : ""}`)} size="sm">
            <Plus className="mr-1 h-4 w-4" /> Nuevo
          </Button>
        </div>
      </div>

      {/* Empresa filter */}
      <div className="flex gap-2">
        {[
          { value: "lumaggs_chevron", label: "Lumaggs Chevron" },
          { value: "galsa_phillips66", label: "Galsa Phillips 66" },
        ].map((emp) => (
          (() => {
            const st = EMPRESA_STYLES[emp.value];
            const isActive = empresaFilter === emp.value;
            return (
              <button
                key={emp.value}
                type="button"
                onClick={() => setFilter("empresa", emp.value)}
                className={`inline-flex items-center h-9 px-4 rounded-full border text-sm font-medium transition-all ${isActive ? st.active + " shadow-sm" : st.idle}`}
              >
                {emp.label}
              </button>
            );
          })()
        ))}
      </div>

      {/* Tipo tabs with color coding + view toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {[
            { value: "cotizacion", label: "Cotizaciones" },
            { value: "pedido", label: "Pedidos" },
            { value: "factura", label: "Facturas" },
            { value: "entrega_corporativa", label: "Entrega Corporativa" },
          ].map((tipo) => {
            const isActive = tipoFilter === tipo.value;
            const colors = TAB_COLORS[tipo.value];
            return (
              <button
                key={tipo.value}
                type="button"
                onClick={() => setFilter("tipo", tipo.value)}
                className={`inline-flex items-center h-9 px-4 rounded-full border text-sm font-medium transition-all ${isActive ? colors.active + " shadow-sm border-transparent" : `${colors.badge} border-transparent hover:opacity-80`}`}
              >
                {tipo.label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-1">
          <Button variant={viewMode === "list" ? "default" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setViewMode("list")}>
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button variant={viewMode === "kanban" ? "default" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setViewMode("kanban")}>
            <Columns className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Plaza filter buttons */}
      {plazas.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setFilter("plaza", "all")}
            className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full border text-xs font-medium transition-all ${plazaFilter === "all" ? "bg-slate-800 text-white border-slate-800" : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"}`}
          >
            Todas
          </button>
          {plazas.map((p: any) => {
            const c = plazaColor(p.id);
            const isActive = plazaFilter === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setFilter("plaza", p.id)}
                className={`inline-flex items-center h-7 px-3 rounded-full border text-xs font-medium transition-all ${isActive ? c.active : c.idle}`}
              >
                {p.nombre}
              </button>
            );
          })}
        </div>
      )}

      {/* Kanban view */}
      {viewMode === "kanban" ? (
        <div>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Cargando...</p>
          ) : (
            <DocumentKanban documents={sortedDocs} tipoFilter={tipoFilter} />
          )}
        </div>
      ) : (
        <Card className={`border-t-2 ${tabColor.border}`}>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número o cliente..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {tipoFilter !== "entrega_corporativa" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-1.5">
                      <Filter className="h-4 w-4" />
                      Filtros
                      {activeFiltersCount > 0 && (
                        <Badge variant="secondary" className="ml-1">{activeFiltersCount}</Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-[min(92vw,640px)] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <Filter className="h-4 w-4" /> Filtros
                        {activeFiltersCount > 0 && (
                          <Badge variant="secondary" className="ml-1">{activeFiltersCount}</Badge>
                        )}
                      </div>
                      {activeFiltersCount > 0 && (
                        <Button variant="ghost" size="sm" className="h-8" onClick={clearFilters}>
                          <X className="h-3.5 w-3.5 mr-1" /> Limpiar
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground">Tipo de Pago</label>
                        <Select value={tipoPagoFilter} onValueChange={setTipoPagoFilter}>
                          <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all"><Pill cls={NEUTRAL_PILL}>Todos</Pill></SelectItem>
                            <SelectItem value="contado"><Pill cls="bg-blue-50 text-blue-700 border-blue-200">Contado</Pill></SelectItem>
                            <SelectItem value="directo"><Pill cls="bg-purple-50 text-purple-700 border-purple-200">Crédito Directo</Pill></SelectItem>
                            <SelectItem value="sin_clasificar"><Pill cls="bg-slate-100 text-slate-700 border-slate-300">Crédito (sin clasificar)</Pill></SelectItem>
                            <SelectItem value="cescemex"><Pill cls="bg-amber-50 text-amber-700 border-amber-200">Crédito Cescemex</Pill></SelectItem>
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
                      {tipoFilter === "cotizacion" && (
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted-foreground">Estatus cotización</label>
                          <Select value={estatusCotFilter} onValueChange={setEstatusCotFilter}>
                            <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all"><Pill cls={NEUTRAL_PILL}>Todos</Pill></SelectItem>
                              {Object.entries(ESTATUS_COT_LABELS).map(([v, l]) => (
                                <SelectItem key={v} value={v}><Pill cls={STATUS_PILL_MAP[v] || NEUTRAL_PILL}>{l}</Pill></SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {tipoFilter === "pedido" && (
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted-foreground">Estatus pedido</label>
                          <Select value={estatusPedFilter} onValueChange={setEstatusPedFilter}>
                            <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all"><Pill cls={NEUTRAL_PILL}>Todos</Pill></SelectItem>
                              <SelectItem value="confirmado_cliente"><Pill cls={STATUS_PILL_MAP.confirmado_cliente}>Confirmado cliente</Pill></SelectItem>
                              <SelectItem value="validado_contabilidad"><Pill cls={STATUS_PILL_MAP.validado_contabilidad}>Validado contabilidad</Pill></SelectItem>
                              <SelectItem value="programado_entrega"><Pill cls={STATUS_PILL_MAP.programado_entrega}>Programado entrega</Pill></SelectItem>
                              <SelectItem value="entregado"><Pill cls={STATUS_PILL_MAP.entregado}>Entregado</Pill></SelectItem>
                              <SelectItem value="cancelado"><Pill cls={STATUS_PILL_MAP.cancelado}>Cancelado</Pill></SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {tipoFilter === "factura" && (
                        <>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">Estatus factura</label>
                            <Select value={estatusFacFilter} onValueChange={setEstatusFacFilter}>
                              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all"><Pill cls={NEUTRAL_PILL}>Todos</Pill></SelectItem>
                                <SelectItem value="vigente"><Pill cls={STATUS_PILL_MAP.vigente}>Vigente</Pill></SelectItem>
                                <SelectItem value="pagada"><Pill cls={STATUS_PILL_MAP.pagada}>Pagada</Pill></SelectItem>
                                <SelectItem value="vencida"><Pill cls={STATUS_PILL_MAP.vencida}>Vencida</Pill></SelectItem>
                                <SelectItem value="cancelada"><Pill cls={STATUS_PILL_MAP.cancelada}>Cancelada</Pill></SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">Estatus cobranza</label>
                            <Select value={estatusCobFilter} onValueChange={setEstatusCobFilter}>
                              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all"><Pill cls={NEUTRAL_PILL}>Todos</Pill></SelectItem>
                                <SelectItem value="pendiente"><Pill cls={STATUS_PILL_MAP.pendiente}>Pendiente</Pill></SelectItem>
                                <SelectItem value="parcial"><Pill cls={STATUS_PILL_MAP.parcial}>Parcial</Pill></SelectItem>
                                <SelectItem value="pagada"><Pill cls={STATUS_PILL_MAP.pagada}>Pagada</Pill></SelectItem>
                                <SelectItem value="vencida"><Pill cls={STATUS_PILL_MAP.vencida}>Vencida</Pill></SelectItem>
                                <SelectItem value="cancelada"><Pill cls={STATUS_PILL_MAP.cancelada}>Cancelada</Pill></SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              <Select value={ejecutivoFilter} onValueChange={v => setFilter("ejecutivo", v)}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Ejecutivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los ejecutivos</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.full_name || p.user_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <SortMenu
                value={sortBy}
                onChange={setSortBy}
                options={[
                  { value: "date_desc", label: "Fecha Documento ↓" },
                  { value: "date_asc", label: "Fecha Documento ↑" },
                  { value: "created_desc", label: "Fecha Creación ↓" },
                  { value: "created_asc", label: "Fecha Creación ↑" },
                  { value: "numero_desc", label: "Número ↓" },
                  { value: "numero_asc", label: "Número ↑" },
                  { value: "total_desc", label: "Total ↓" },
                  { value: "total_asc", label: "Total ↑" },
                  { value: "client_asc", label: "Cliente A-Z" },
                  { value: "client_desc", label: "Cliente Z-A" },
                  { value: "ejecutivo_asc", label: "Ejecutivo A-Z" },
                  { value: "estatus_asc", label: "Estatus A-Z" },
                ]}
              />
            </div>
            {/* Filter toolbar */}
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            {/* Bulk action bar */}
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
            ) : docs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">
                  {tipoFilter === "cotizacion" ? "No hay cotizaciones"
                    : tipoFilter === "pedido" ? "No hay pedidos"
                    : tipoFilter === "factura" ? "No hay facturas"
                    : "No hay entregas corporativas"}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">Crea un nuevo documento para comenzar</p>
              </div>
            ) : (
              <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={sortedDocs.length > 0 && selectedIds.size === sortedDocs.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      {!hidesNumber && isColVisible("numero") && (
                        <SortableHead
                          ascKey={tipoFilter === "factura" ? "numero_factura_asc" : "numero_asc"}
                          descKey={tipoFilter === "factura" ? "numero_factura_desc" : "numero_desc"}
                        >
                          {tipoFilter === "factura" ? "No. Factura" : "Número"}
                        </SortableHead>
                      )}
                      {isColVisible("cliente") && (
                        <SortableHead ascKey="client_asc" descKey="client_desc" className="min-w-[180px]">Cliente</SortableHead>
                      )}
                      {isColVisible("ejecutivo") && (
                        <SortableHead ascKey="ejecutivo_asc" descKey="ejecutivo_desc" className="hidden sm:table-cell">Ejecutivo</SortableHead>
                      )}
                      {tipoFilter === "factura" && isColVisible("plaza") && (
                        <SortableHead ascKey="plaza_asc" descKey="plaza_desc" className="hidden md:table-cell">Plaza</SortableHead>
                      )}
                      {isColVisible("fecha") && (
                        <SortableHead ascKey="date_asc" descKey="date_desc" className="whitespace-nowrap">
                          {tipoFilter === "cotizacion" ? "Fecha" : "Fecha Documento"}
                        </SortableHead>
                      )}
                      {tipoFilter === "factura" && isColVisible("fecha_vencimiento") && (
                        <SortableHead ascKey="vencimiento_asc" descKey="vencimiento_desc" className="whitespace-nowrap">Fecha Vencimiento</SortableHead>
                      )}
                      {showsScheduledDate && isColVisible("fecha_programada") && (
                        <SortableHead ascKey="programada_asc" descKey="programada_desc" className="hidden md:table-cell">Fecha Programada</SortableHead>
                      )}
                      {tipoFilter === "entrega_corporativa" && isColVisible("oc_cliente") && (
                        <TableHead className="hidden md:table-cell">Núm. OC Cliente</TableHead>
                      )}
                      {tipoFilter !== "entrega_corporativa" && isColVisible("tipo_pago") && (
                        <SortableHead ascKey="tipo_pago_asc" descKey="tipo_pago_desc" className="whitespace-nowrap">Tipo de Pago</SortableHead>
                      )}
                      {isColVisible("total") && (
                        <SortableHead ascKey="total_asc" descKey="total_desc">Total</SortableHead>
                      )}
                      {isColVisible("estatus") && (
                        <SortableHead ascKey="estatus_asc" descKey="estatus_desc">
                          {tipoFilter === "factura" ? "Estatus Factura" : "Estatus"}
                        </SortableHead>
                      )}
                      {isColVisible("pdf") && <TableHead className="hidden sm:table-cell">PDF</TableHead>}
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedDocs.map((doc: any) => (
                      <TableRow
                        key={doc.id}
                        className={`cursor-pointer transition-colors duration-150 hover:bg-muted/50 ${selectedIds.has(doc.id) ? "bg-muted/30" : ""}`}
                          onClick={() => navigate(`/documents/${doc.id}`)}
                      >
                        <TableCell className="w-10" onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(doc.id)}
                            onCheckedChange={() => {
                              setSelectedIds(prev => {
                                const next = new Set(prev);
                                next.has(doc.id) ? next.delete(doc.id) : next.add(doc.id);
                                return next;
                              });
                            }}
                          />
                        </TableCell>
                        {!hidesNumber && isColVisible("numero") && (
                          <TableCell className="font-medium whitespace-nowrap">
                            {tipoFilter === "factura"
                              ? (doc.numero_factura || "-")
                              : (doc.numero_cotizacion || doc.numero_pedido || doc.numero_factura || "-")}
                          </TableCell>
                        )}
                        {isColVisible("cliente") && <TableCell>{(doc.companies as any)?.name || "-"}</TableCell>}
                        {isColVisible("ejecutivo") && (
                          <TableCell className="hidden sm:table-cell">
                            {getEjecutivoName(doc.ejecutivo_venta_id)}
                          </TableCell>
                        )}
                        {tipoFilter === "factura" && isColVisible("plaza") && (
                          <TableCell className="hidden md:table-cell">
                            {(doc.plazas as any)?.nombre ? (() => {
                              const c = plazaColor(doc.plaza_id);
                              return (
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${c.pill}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                                  {(doc.plazas as any).nombre}
                                </span>
                              );
                            })() : <span className="text-muted-foreground">-</span>}
                          </TableCell>
                        )}
                        {isColVisible("fecha") && (
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(doc.fecha_documento), "dd/MM/yyyy")}
                          </TableCell>
                        )}
                        {tipoFilter === "factura" && isColVisible("fecha_vencimiento") && (
                          <TableCell className="whitespace-nowrap">
                            {doc.fecha_vencimiento
                              ? format(new Date(doc.fecha_vencimiento), "dd/MM/yyyy")
                              : "-"}
                          </TableCell>
                        )}
                        {showsScheduledDate && isColVisible("fecha_programada") && (
                          <TableCell className="hidden md:table-cell whitespace-nowrap">
                            {doc.fecha_entrega_programada
                              ? format(new Date(doc.fecha_entrega_programada), "dd/MM/yyyy")
                              : "-"}
                          </TableCell>
                        )}
                        {tipoFilter === "entrega_corporativa" && isColVisible("oc_cliente") && (
                          <TableCell className="hidden md:table-cell whitespace-nowrap">
                            {doc.numero_oc_cliente || "-"}
                          </TableCell>
                        )}
                        {tipoFilter !== "entrega_corporativa" && isColVisible("tipo_pago") && (() => {
                          const tp = getTipoPagoInfo(doc.tipo_pago ?? doc.condiciones_pago);
                          return (
                            <TableCell>
                              {tp.cls ? (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${tp.cls}`}>{tp.label}</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          );
                        })()}
                        {isColVisible("total") && (
                          <TableCell className="whitespace-nowrap">
                            ${Number(doc.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </TableCell>
                        )}
                        {isColVisible("estatus") && (
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeClass(doc)}`}>
                              {getEstatusLabel(doc)}
                            </span>
                          </TableCell>
                        )}
                        {isColVisible("pdf") && (
                          <TableCell className="hidden sm:table-cell">
                            {doc.pdf_url ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Ver PDF"
                                onClick={(e) => { e.stopPropagation(); openDocFilesSignedUrl(doc.pdf_url!); }}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            ) : doc.tipo_documento === "cotizacion" ? (
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); downloadCotizacionPdf(doc.id, () => refetch()); }} title="Generar PDF">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            ) : null}
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(`/documents/${doc.id}`); }} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" disabled={duplicating === doc.id} onClick={(e) => handleDuplicate(e, doc)} title="Duplicar">
                              <Copy className="h-4 w-4" />
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
                    ))}
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
                      type="number"
                      min={1}
                      max={totalPages}
                      value={safePage}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isNaN(n)) setCurrentPage(Math.min(Math.max(1, n), totalPages));
                      }}
                      className="h-8 w-16 text-center"
                    />
                    <span className="text-muted-foreground">de {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>›</Button>
                    <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setCurrentPage(totalPages)}>»</Button>
                  </div>
                </div>
              )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar documento</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar este documento? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirmation dialog */}
      <Dialog open={bulkDeleteConfirm} onOpenChange={(open) => !open && setBulkDeleteConfirm(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar {selectedIds.size} documento(s)</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar los documentos seleccionados? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteConfirm(false)} disabled={bulkDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk edit dialog */}
      <BulkEditDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        selectedIds={Array.from(selectedIds)}
        table="documentos"
        fields={getDocBulkFields()}
        onSuccess={() => { setSelectedIds(new Set()); refetch(); }}
      />

      <ExportFilterDialog
        open={exportFilterOpen}
        onOpenChange={setExportFilterOpen}
        onConfirm={runExportWithFilters}
        loading={exportLoading}
      />
      {/* Export field selection dialog */}
      <ExportFieldsDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        data={exportData}
        fields={exportFields}
        defaultSelected={exportFields.map((f) => f.key)}
        filenameBase={`documentos_${empresaFilter}`}
      />
    </div>
  );
}
