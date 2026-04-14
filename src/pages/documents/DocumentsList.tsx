import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText, Download, Pencil, Copy } from "lucide-react";
import { SortMenu } from "@/components/SortMenu";
import { downloadCotizacionPdf } from "@/lib/generateCotizacionPdf";
import { format } from "date-fns";
import { toast } from "sonner";

const ESTATUS_COT_LABELS: Record<string, string> = {
  borrador: "Borrador", impresa: "Impresa", enviada: "Enviada",
  aceptada: "Aceptada", rechazada: "Rechazada", vencida: "Vencida",
};
const ESTATUS_PED_LABELS: Record<string, string> = {
  pendiente: "Pendiente", confirmado: "Confirmado", en_proceso: "En Proceso",
  enviado: "Enviado", entregado: "Entregado", cancelado: "Cancelado",
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
  if (["aceptada", "confirmado", "pagada", "entregado", "impresa"].includes(st)) return "default";
  if (["rechazada", "cancelado", "cancelada", "vencida"].includes(st)) return "destructive";
  return "secondary";
}

export default function DocumentsList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [empresaFilter, setEmpresaFilter] = useState<string>("lumaggs_chevron");
  const [tipoFilter, setTipoFilter] = useState<string>("cotizacion");
  const [ejecutivoFilter, setEjecutivoFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState("date_desc");

  // Fetch profiles for ejecutivo filter
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
    queryKey: ["documentos", search, tipoFilter, empresaFilter, ejecutivoFilter],
    queryFn: async () => {
      let q = supabase
        .from("documentos")
        .select("*, companies(name), contacts(first_name, last_name)")
        .eq("is_active", true)
        .eq("empresa_vendedora", empresaFilter as any)
        .order("created_at", { ascending: false });
      if (tipoFilter !== "all") q = q.eq("tipo_documento", tipoFilter as any);
      if (ejecutivoFilter !== "all") q = q.eq("ejecutivo_venta_id", ejecutivoFilter);
      const { data, error } = await q;
      if (error) throw error;

      // Client-side search to include company name
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

  // Get ejecutivo name from profiles
  const getEjecutivoName = (ejecutivoId: string | null) => {
    if (!ejecutivoId) return "-";
    const profile = profiles.find((p) => p.user_id === ejecutivoId);
    return profile?.full_name || "-";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documentos</h1>
          <p className="text-muted-foreground text-sm">Cotizaciones, pedidos y facturas</p>
        </div>
        <Button onClick={() => navigate("/documents/new")} size="sm">
          <Plus className="mr-1 h-4 w-4" /> Nuevo
        </Button>
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
            onClick={() => setEmpresaFilter(emp.value)}
          >
            {emp.label}
          </Button>
        ))}
      </div>

      {/* Tipo filter */}
      <div className="flex gap-2">
        {[
          { value: "cotizacion", label: "Cotizaciones" },
          { value: "pedido", label: "Pedidos" },
          { value: "factura", label: "Facturas" },
        ].map((tipo) => (
          <Button
            key={tipo.value}
            variant={tipoFilter === tipo.value ? "default" : "outline"}
            size="sm"
            onClick={() => setTipoFilter(tipo.value)}
          >
            {tipo.label}
          </Button>
        ))}
      </div>

      <Card>
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
            <Select value={ejecutivoFilter} onValueChange={setEjecutivoFilter}>
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
              <p className="mt-2 text-muted-foreground">No hay documentos</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead className="min-w-[180px]">Cliente</TableHead>
                    <TableHead className="hidden sm:table-cell">Ejecutivo</TableHead>
                    <TableHead className="hidden md:table-cell">Fecha</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Estatus</TableHead>
                    <TableHead className="hidden sm:table-cell">PDF</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedDocs.map((doc: any) => (
                    <TableRow
                      key={doc.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/documents/${doc.id}`)}
                    >
                      <TableCell className="font-medium whitespace-nowrap">
                        {doc.numero_cotizacion || doc.numero_pedido || doc.numero_factura || "-"}
                      </TableCell>
                      <TableCell>{(doc.companies as any)?.name || "-"}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {getEjecutivoName(doc.ejecutivo_venta_id)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell whitespace-nowrap">
                        {format(new Date(doc.fecha_documento), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        ${Number(doc.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getEstatusVariant(doc)}>{getEstatusLabel(doc)}</Badge>
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
    </div>
  );
}
