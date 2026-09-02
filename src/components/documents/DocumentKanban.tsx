import { useState } from "react";
import { parseLocalDate } from "@/lib/formatters";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface DocumentKanbanProps {
  documents: any[];
  tipoFilter: string;
}

const COTIZACION_COLUMNS = [
  { key: "borrador", label: "Borrador", color: "bg-muted" },
  { key: "impresa", label: "Impresa", color: "bg-blue-100 dark:bg-blue-900/30" },
  { key: "enviada", label: "Enviada", color: "bg-indigo-100 dark:bg-indigo-900/30" },
  { key: "aceptada", label: "Aceptada", color: "bg-green-100 dark:bg-green-900/30" },
  { key: "rechazada", label: "Rechazada", color: "bg-red-100 dark:bg-red-900/30" },
  { key: "vencida", label: "Vencida", color: "bg-orange-100 dark:bg-orange-900/30" },
];

const PEDIDO_COLUMNS = [
  { key: "confirmado_cliente", label: "Confirmado Cliente", color: "bg-blue-100 dark:bg-blue-900/30" },
  { key: "validado_contabilidad", label: "Validado Contab.", color: "bg-purple-100 dark:bg-purple-900/30" },
  { key: "programado_entrega", label: "Programado Entrega", color: "bg-amber-100 dark:bg-amber-900/30" },
  { key: "entregado", label: "Entregado", color: "bg-green-100 dark:bg-green-900/30" },
  { key: "cancelado", label: "Cancelado", color: "bg-red-100 dark:bg-red-900/30" },
];

const FACTURA_COLUMNS = [
  { key: "pendiente", label: "Vigente", color: "bg-muted" },
  { key: "pagada", label: "Pagada", color: "bg-green-100 dark:bg-green-900/30" },
  { key: "vencida", label: "Vencida", color: "bg-orange-100 dark:bg-orange-900/30" },
  { key: "cancelada", label: "Cancelada", color: "bg-red-100 dark:bg-red-900/30" },
];

const ENTREGA_CORP_COLUMNS = [
  { key: "solicitada", label: "Solicitadas", color: "bg-muted" },
  { key: "programada", label: "Programadas", color: "bg-amber-100 dark:bg-amber-900/30" },
  { key: "entregada", label: "Entregadas", color: "bg-green-100 dark:bg-green-900/30" },
  { key: "acuse_enviado", label: "Acuse Enviado", color: "bg-blue-100 dark:bg-blue-900/30" },
];

function getColumns(tipo: string) {
  if (tipo === "cotizacion") return COTIZACION_COLUMNS;
  if (tipo === "pedido") return PEDIDO_COLUMNS;
  if (tipo === "factura") return FACTURA_COLUMNS;
  if (tipo === "entrega_corporativa") return ENTREGA_CORP_COLUMNS;
  return COTIZACION_COLUMNS;
}

function getStatusField(tipo: string) {
  if (tipo === "cotizacion") return "estatus_cotizacion";
  if (tipo === "pedido") return "estatus_pedido";
  if (tipo === "factura") return "estatus_factura";
  if (tipo === "entrega_corporativa") return "estatus_entrega_corporativa";
  return "estatus_cotizacion";
}

function KanbanColumn({
  col,
  docs,
  statusField,
  onStatusChange,
  onNavigate,
}: {
  col: { key: string; label: string; color: string };
  docs: any[];
  statusField: string;
  onStatusChange: (docId: string, newStatus: string) => void;
  onNavigate: (id: string) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div className="w-[280px] flex-shrink-0">
      <div className={`rounded-t-xl border border-b-0 border-border/60 px-3 py-2.5 ${col.color}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide font-semibold text-foreground/80">{col.label}</span>
          <Badge variant="outline" className="text-[10px] font-medium bg-background/80 border">{docs.length}</Badge>
        </div>
      </div>
      <div
        className={`rounded-b-xl border border-t-0 border-border/60 p-2 space-y-2 min-h-[200px] transition-colors ${
          isDragOver ? "bg-primary/10 ring-2 ring-primary/30" : "bg-muted/30"
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const docId = e.dataTransfer.getData("docId");
          if (docId) onStatusChange(docId, col.key);
        }}
      >
        {docs.length === 0 ? (
          <p className="text-xs font-light text-muted-foreground text-center py-8">Sin documentos</p>
        ) : (
          docs.map((doc: any) => (
            <Card
              key={doc.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("docId", doc.id)}
              className="cursor-grab active:cursor-grabbing hover:border-primary/30"
              onClick={() => onNavigate(doc.id)}
            >
              <CardContent className="p-3 space-y-1">
                <div className="font-medium text-sm tracking-tight truncate">
                  {doc.numero_cotizacion || doc.numero_pedido || doc.numero_factura || "Sin número"}
                </div>
                <div className="text-xs font-light text-muted-foreground truncate">
                  {(doc.companies as any)?.name || "Sin cliente"}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-light text-muted-foreground">
                    {format(parseLocalDate(doc.fecha_documento), "dd/MM/yy")}
                  </span>
                  <span className="font-semibold">
                    ${Number(doc.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

export function DocumentKanban({ documents, tipoFilter }: DocumentKanbanProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const columns = getColumns(tipoFilter);
  const statusField = getStatusField(tipoFilter);

  const filteredDocs = documents.filter((d: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const num = (d.numero_cotizacion || d.numero_pedido || d.numero_factura || "").toLowerCase();
    const clientName = ((d.companies as any)?.name || "").toLowerCase();
    const total = String(Number(d.total).toFixed(2));
    return num.includes(s) || clientName.includes(s) || total.includes(s);
  });

  const handleStatusChange = async (docId: string, newStatus: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc || doc[statusField] === newStatus) return;

    const targetLabel = columns.find((c) => c.key === newStatus)?.label || newStatus;

    const { error } = await supabase
      .from("documentos")
      .update({ [statusField]: newStatus } as any)
      .eq("id", docId);

    if (error) {
      toast.error("No se pudo cambiar el estatus");
      return;
    }

    toast.success(`Documento movido a "${targetLabel}"`);
    queryClient.invalidateQueries({ queryKey: ["documentos"] });
  };

  const getDocsForStatus = (statusKey: string) =>
    filteredDocs.filter((d: any) => d[statusField] === statusKey);

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por número, cliente o total..."
          className="flex h-10 w-full rounded-md border border-input bg-background px-9 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4 min-w-max">
          {columns.map((col) => (
            <KanbanColumn
              key={col.key}
              col={col}
              docs={getDocsForStatus(col.key)}
              statusField={statusField}
              onStatusChange={handleStatusChange}
              onNavigate={(id) => window.open(`/documents/${id}`, "_blank")}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
