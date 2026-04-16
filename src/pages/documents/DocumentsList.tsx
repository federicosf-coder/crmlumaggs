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
import { Plus, Search, FileText, Download, Pencil, Copy, LayoutList, Columns, Truck, Upload, FileDown, Trash2, CheckSquare } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { SortMenu } from "@/components/SortMenu";
import { downloadCotizacionPdf } from "@/lib/generateCotizacionPdf";
import { format } from "date-fns";
import { toast } from "sonner";
import { DocumentKanban } from "@/components/documents/DocumentKanban";

const ESTATUS_COT_LABELS: Record<string, string> = {
  borrador: "Borrador", impresa: "Impresa", enviada: "Enviada",
  aceptada: "Aceptada", rechazada: "Rechazada", vencida: "Vencida",
};
const ESTATUS_PED_LABELS: Record<string, string> = {
  confirmado_cliente: "Confirmado Cliente", espera_autorizacion_precio: "Espera Autoriz.",
  precio_autorizado: "Precio Autoriz.", validado_contabilidad: "Validado Contab.",
  programado_entrega: "Prog. Entrega", entregado: "Entregado", cancelado: "Cancelado",
};
const ESTATUS_FAC_LABELS: Record<string, string> = {
  pendiente: "Pendiente", pagada: "Pagada", parcial: "Parcial",
  vencida: "Vencida", cancelada: "Cancelada",
};

function getEstatusLabel(doc: any) {
  if (doc.tipo_documento === "cotizacion") return ESTATUS_COT_LABELS[doc.estatus_cotizacion] || "-";
  if (doc.tipo_documento === "pedido") return ESTATUS_PED_LABELS[doc.estatus_pedido] || "-";
  if (doc.tipo_documento === "factura") return ESTATUS_FAC_LABELS[doc.estatus_factura] || "-";
  return "-";
}

function getEstatusVariant(doc: any): "default" | "secondary" | "destructive" | "outline" {
  const st = doc.tipo_documento === "cotizacion" ? doc.estatus_cotizacion
    : doc.tipo_documento === "pedido" ? doc.estatus_pedido : doc.estatus_factura;
  if (["aceptada", "confirmado_cliente", "pagada", "entregado", "impresa", "precio_autorizado"].includes(st)) return "default";
  if (["rechazada", "cancelado", "cancelada", "vencida"].includes(st)) return "destructive";
  if (["validado_contabilidad", "programado_entrega"].includes(st)) return "outline";
  return "secondary";
}

// Color config per tab type
const TAB_COLORS: Record<string, { active: string; badge: string; border: string }> = {
  cotizacion: { active: "bg-blue-600 text-white hover:bg-blue-700", badge: "bg-blue-100 text-blue-800", border: "border-blue-500" },
  pedido: { active: "bg-amber-500 text-white hover:bg-amber-600", badge: "bg-amber-100 text-amber-800", border: "border-amber-500" },
  factura: { active: "bg-emerald-600 text-white hover:bg-emerald-700", badge: "bg-emerald-100 text-emerald-800", border: "border-emerald-500" },
};

// Status badge colors
function getStatusBadgeClass(doc: any): string {
  const st = doc.tipo_documento === "cotizacion" ? doc.estatus_cotizacion
    : doc.tipo_documento === "pedido" ? doc.estatus_pedido : doc.estatus_factura;
  const map: Record<string, string> = {
    borrador: "bg-slate-100 text-slate-700 border-slate-300",
    impresa: "bg-blue-50 text-blue-700 border-blue-200",
    enviada: "bg-sky-50 text-sky-700 border-sky-200",
    aceptada: "bg-green-50 text-green-700 border-green-200",
    rechazada: "bg-red-50 text-red-700 border-red-200",
    vencida: "bg-orange-50 text-orange-700 border-orange-200",
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
    cancelada: "bg-red-50 text-red-700 border-red-200",
  };
  return map[st] || "bg-slate-100 text-slate-700 border-slate-300";
}

export default function DocumentsList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const qc = useQueryClient();

  // Persist filters via URL search params
  const tipoFilter = searchParams.get("tipo") || "cotizacion";
  const empresaFilter = searchParams.get("empresa") || "lumaggs_chevron";
  const ejecutivoFilter = searchParams.get("ejecutivo") || "all";

  const [search, setSearch] = useState("");
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("date_desc");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const setFilter = useCallback((key: string, value: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set(key, value);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Determine module based on tipoFilter
  const docModule = tipoFilter === "factura" ? "facturacion" as const : "cotizaciones" as const;
  const access = useModuleAccess(docModule);

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

  const { data: docs = [], isLoading, refetch } = useQuery({
    queryKey: ["documentos", search, tipoFilter, empresaFilter, ejecutivoFilter, access.accessLevel, access.teamMemberIds],
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
      if (access.accessLevel === "propio" && access.userId) {
        q = q.or(`created_by.eq.${access.userId},ejecutivo_venta_id.eq.${access.userId}`);
      } else if (access.accessLevel === "equipo" && access.teamMemberIds.length > 0) {
        q = q.or(`created_by.in.(${access.teamMemberIds.join(",")}),ejecutivo_venta_id.in.(${access.teamMemberIds.join(",")})`);
      }
      const { data, error } = await q;
      if (error) throw error;
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
      case "total_desc": return Number(b.total) - Number(a.total);
      case "total_asc": return Number(a.total) - Number(b.total);
      case "client_asc": return ((a.companies as any)?.name || "").localeCompare((b.companies as any)?.name || "");
      default: return 0;
    }
  });

  const handleDuplicate = async (e: React.MouseEvent, doc: any) => {
    e.stopPropagation();
    if (duplicating) return;
    setDuplicating(doc.id);
    try {
      const { data: srcDoc, error: srcErr } = await supabase.from("documentos").select("*").eq("id", doc.id).single();
      if (srcErr || !srcDoc) throw srcErr || new Error("No encontrado");
      const { data: srcItems } = await supabase.from("documento_productos").select("*").eq("documento_id", doc.id);
      const { id: _id, created_at, updated_at, numero_cotizacion, numero_pedido, numero_factura, pdf_url, estatus_cotizacion, ...rest } = srcDoc;
      const newDoc: any = {
        ...rest, pdf_url: null,
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

  const handleExport = () => {
    if (sortedDocs.length === 0) { toast.error("No hay datos para exportar"); return; }
    const headers = ["Número", "Cliente", "Ejecutivo", "Fecha", "Total", "Estatus"];
    const rows = sortedDocs.map((doc: any) => [
      doc.numero_cotizacion || doc.numero_pedido || doc.numero_factura || "",
      (doc.companies as any)?.name || "",
      getEjecutivoName(doc.ejecutivo_venta_id),
      format(new Date(doc.fecha_documento), "dd/MM/yyyy"),
      Number(doc.total).toFixed(2),
      getEstatusLabel(doc),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `documentos_${tipoFilter}_${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportación completada");
  };

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

  // Clear selection when filters change
  const tabColor = TAB_COLORS[tipoFilter] || TAB_COLORS.cotizacion;
  const isPedido = tipoFilter === "pedido";

  // Reset selection when tab/filter changes
  useState(() => { setSelectedIds(new Set()); });

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
          <Button variant="outline" size="sm" onClick={() => navigate("/delivery/schedule")}>
            <Truck className="mr-1 h-4 w-4" /> Programar Entregas
          </Button>
          <Button onClick={() => navigate("/documents/new")} size="sm">
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
          <Button
            key={emp.value}
            variant={empresaFilter === emp.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("empresa", emp.value)}
          >
            {emp.label}
          </Button>
        ))}
      </div>

      {/* Tipo tabs with color coding + view toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {[
            { value: "cotizacion", label: "Cotizaciones" },
            { value: "pedido", label: "Pedidos" },
            { value: "factura", label: "Facturas" },
          ].map((tipo) => {
            const isActive = tipoFilter === tipo.value;
            const colors = TAB_COLORS[tipo.value];
            return (
              <Button
                key={tipo.value}
                size="sm"
                className={`transition-all duration-150 ${isActive ? colors.active : "bg-background text-foreground border border-input hover:bg-accent"}`}
                variant={isActive ? "default" : "outline"}
                onClick={() => setFilter("tipo", tipo.value)}
              >
                {tipo.label}
              </Button>
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
                  { value: "date_desc", label: "Fecha ↓" },
                  { value: "date_asc", label: "Fecha ↑" },
                  { value: "total_desc", label: "Total ↓" },
                  { value: "total_asc", label: "Total ↑" },
                  { value: "client_asc", label: "Cliente A-Z" },
                ]}
              />
            </div>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Cargando...</p>
            ) : docs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">
                  {tipoFilter === "cotizacion" ? "No hay cotizaciones" : tipoFilter === "pedido" ? "No hay pedidos" : "No hay facturas"}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">Crea un nuevo documento para comenzar</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {!isPedido && (
                        <TableHead>
                          {tipoFilter === "factura" ? "No. Factura" : "Número"}
                        </TableHead>
                      )}
                      <TableHead className="min-w-[180px]">Cliente</TableHead>
                      <TableHead className="hidden sm:table-cell">Ejecutivo</TableHead>
                      {tipoFilter === "factura" && (
                        <TableHead className="hidden md:table-cell">Plaza</TableHead>
                      )}
                      <TableHead className="hidden md:table-cell">Fecha</TableHead>
                      {isPedido && (
                        <TableHead className="hidden md:table-cell">Fecha Programada</TableHead>
                      )}
                      <TableHead>Total</TableHead>
                      <TableHead>
                        {tipoFilter === "factura" ? "Estatus Factura" : "Estatus"}
                      </TableHead>
                      <TableHead className="hidden sm:table-cell">PDF</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedDocs.map((doc: any) => (
                      <TableRow
                        key={doc.id}
                        className="cursor-pointer transition-colors duration-150 hover:bg-muted/50"
                        onClick={() => navigate(`/documents/${doc.id}`)}
                      >
                        {!isPedido && (
                          <TableCell className="font-medium whitespace-nowrap">
                            {tipoFilter === "factura"
                              ? (doc.numero_factura || "-")
                              : (doc.numero_cotizacion || doc.numero_pedido || doc.numero_factura || "-")}
                          </TableCell>
                        )}
                        <TableCell>{(doc.companies as any)?.name || "-"}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {getEjecutivoName(doc.ejecutivo_venta_id)}
                        </TableCell>
                        {tipoFilter === "factura" && (
                          <TableCell className="hidden md:table-cell">
                            {(doc.plazas as any)?.nombre || "-"}
                          </TableCell>
                        )}
                        <TableCell className="hidden md:table-cell whitespace-nowrap">
                          {format(new Date(doc.fecha_documento), "dd/MM/yyyy")}
                        </TableCell>
                        {isPedido && (
                          <TableCell className="hidden md:table-cell whitespace-nowrap">
                            {doc.fecha_entrega_programada
                              ? format(new Date(doc.fecha_entrega_programada), "dd/MM/yyyy")
                              : "-"}
                          </TableCell>
                        )}
                        <TableCell className="whitespace-nowrap">
                          ${Number(doc.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeClass(doc)}`}>
                            {getEstatusLabel(doc)}
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {doc.pdf_url ? (
                            <Button variant="ghost" size="icon" asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                              <a href={doc.pdf_url} target="_blank" rel="noopener noreferrer" title="Ver PDF">
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          ) : doc.tipo_documento === "cotizacion" ? (
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); downloadCotizacionPdf(doc.id, () => refetch()); }} title="Generar PDF">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          ) : null}
                        </TableCell>
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
    </div>
  );
}
