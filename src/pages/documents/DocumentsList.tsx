import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText, Download, Pencil } from "lucide-react";
import { downloadCotizacionPdf } from "@/lib/generateCotizacionPdf";
import { format } from "date-fns";

const TIPO_DOC_LABELS: Record<string, string> = {
  cotizacion: "Cotización",
  pedido: "Pedido",
  factura: "Factura",
};

const EMPRESA_LABELS: Record<string, string> = {
  lumaggs_chevron: "Lumaggs Chevron",
  galsa_phillips66: "Galsa Phillips 66",
};

const ESTATUS_COT_LABELS: Record<string, string> = {
  borrador: "Borrador",
  impresa: "Impresa",
  enviada: "Enviada",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  vencida: "Vencida",
};

const ESTATUS_PED_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  en_proceso: "En Proceso",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

const ESTATUS_FAC_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  pagada: "Pagada",
  parcial: "Parcial",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

function getEstatusLabel(doc: any) {
  if (doc.tipo_documento === "cotizacion") return ESTATUS_COT_LABELS[doc.estatus_cotizacion] || "-";
  if (doc.tipo_documento === "pedido") return ESTATUS_PED_LABELS[doc.estatus_pedido] || "-";
  if (doc.tipo_documento === "factura") return ESTATUS_FAC_LABELS[doc.estatus_factura] || "-";
  return "-";
}

function getEstatusVariant(doc: any): "default" | "secondary" | "destructive" | "outline" {
  const st = doc.tipo_documento === "cotizacion" ? doc.estatus_cotizacion
    : doc.tipo_documento === "pedido" ? doc.estatus_pedido
    : doc.estatus_factura;
  if (["aceptada", "confirmado", "pagada", "entregado", "impresa"].includes(st)) return "default";
  if (["rechazada", "cancelado", "cancelada", "vencida"].includes(st)) return "destructive";
  return "secondary";
}

export default function DocumentsList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [empresaFilter, setEmpresaFilter] = useState<string>("lumaggs_chevron");
  const [tipoFilter, setTipoFilter] = useState<string>("cotizacion");

  const { data: docs = [], isLoading, refetch } = useQuery({
    queryKey: ["documentos", search, tipoFilter, empresaFilter],
    queryFn: async () => {
      let q = supabase
        .from("documentos")
        .select("*, companies(name), contacts(first_name, last_name)")
        .eq("is_active", true)
        .eq("empresa_vendedora", empresaFilter as any)
        .order("created_at", { ascending: false });
      if (tipoFilter !== "all") q = q.eq("tipo_documento", tipoFilter as any);
      if (search) q = q.or(`numero_cotizacion.ilike.%${search}%,numero_pedido.ilike.%${search}%,numero_factura.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documentos</h1>
          <p className="text-muted-foreground">Cotizaciones, pedidos y facturas</p>
        </div>
        <Button onClick={() => navigate("/documents/new")}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Documento
        </Button>
      </div>

      <div className="flex gap-2 mb-2">
        {[
          { value: "lumaggs_chevron", label: "Lumaggs Chevron" },
          { value: "galsa_phillips66", label: "Galsa Phillips 66" },
        ].map((emp) => (
          <Button
            key={emp.value}
            variant={empresaFilter === emp.value ? "default" : "outline"}
            onClick={() => setEmpresaFilter(emp.value)}
          >
            {emp.label}
          </Button>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
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
        <CardHeader>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por número..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Cargando...</p>
          ) : docs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">No hay documentos</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                 <TableRow>
                   <TableHead>Tipo</TableHead>
                   <TableHead>Número</TableHead>
                   <TableHead>Empresa Vendedora</TableHead>
                   <TableHead>Cliente</TableHead>
                   <TableHead>Ejecutivo</TableHead>
                   <TableHead>Fecha</TableHead>
                   <TableHead>Total</TableHead>
                   <TableHead>Estatus</TableHead>
                    <TableHead>PDF</TableHead>
                    <TableHead></TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((doc: any) => (
                  <TableRow
                    key={doc.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/documents/${doc.id}`)}
                  >
                    <TableCell>
                      <Badge variant="outline">{TIPO_DOC_LABELS[doc.tipo_documento]}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {doc.numero_cotizacion || doc.numero_pedido || doc.numero_factura || "-"}
                    </TableCell>
                    <TableCell>{EMPRESA_LABELS[doc.empresa_vendedora]}</TableCell>
                    <TableCell>{(doc.companies as any)?.name || "-"}</TableCell>
                    <TableCell>{(doc.profiles as any)?.full_name || "-"}</TableCell>
                    <TableCell>{format(new Date(doc.fecha_documento), "dd/MM/yyyy")}</TableCell>
                    <TableCell>${Number(doc.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</TableCell>
                   <TableCell>
                       <Badge variant={getEstatusVariant(doc)}>{getEstatusLabel(doc)}</Badge>
                     </TableCell>
                     <TableCell>
                       {doc.tipo_documento === "cotizacion" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadCotizacionPdf(doc.id, () => refetch());
                            }}
                            title="Generar PDF"
                          >
                           <Download className="h-4 w-4" />
                         </Button>
                       )}
                     </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
