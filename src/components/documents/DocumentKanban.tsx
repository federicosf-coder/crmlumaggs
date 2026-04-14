import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { format } from "date-fns";

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
  { key: "pendiente", label: "Pendiente", color: "bg-muted" },
  { key: "parcial", label: "Parcial", color: "bg-amber-100 dark:bg-amber-900/30" },
  { key: "pagada", label: "Pagada", color: "bg-green-100 dark:bg-green-900/30" },
  { key: "vencida", label: "Vencida", color: "bg-orange-100 dark:bg-orange-900/30" },
  { key: "cancelada", label: "Cancelada", color: "bg-red-100 dark:bg-red-900/30" },
];

function getColumns(tipo: string) {
  if (tipo === "cotizacion") return COTIZACION_COLUMNS;
  if (tipo === "pedido") return PEDIDO_COLUMNS;
  if (tipo === "factura") return FACTURA_COLUMNS;
  return COTIZACION_COLUMNS;
}

function getStatusField(tipo: string) {
  if (tipo === "cotizacion") return "estatus_cotizacion";
  if (tipo === "pedido") return "estatus_pedido";
  if (tipo === "factura") return "estatus_factura";
  return "estatus_cotizacion";
}

export function DocumentKanban({ documents, tipoFilter }: DocumentKanbanProps) {
  const navigate = useNavigate();
  const columns = getColumns(tipoFilter);
  const statusField = getStatusField(tipoFilter);

  const getDocsForStatus = (statusKey: string) =>
    documents.filter((d: any) => d[statusField] === statusKey);

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4 min-w-max">
        {columns.map((col) => {
          const colDocs = getDocsForStatus(col.key);
          return (
            <div key={col.key} className="w-[280px] flex-shrink-0">
              <div className={`rounded-t-lg px-3 py-2 ${col.color}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{col.label}</span>
                  <Badge variant="secondary" className="text-xs">{colDocs.length}</Badge>
                </div>
              </div>
              <div className="bg-muted/30 rounded-b-lg p-2 space-y-2 min-h-[200px]">
                {colDocs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">Sin documentos</p>
                ) : (
                  colDocs.map((doc: any) => (
                    <Card
                      key={doc.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => navigate(`/documents/${doc.id}`)}
                    >
                      <CardContent className="p-3 space-y-1">
                        <div className="font-medium text-sm truncate">
                          {doc.numero_cotizacion || doc.numero_pedido || doc.numero_factura || "Sin número"}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {(doc.companies as any)?.name || "Sin cliente"}
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {format(new Date(doc.fecha_documento), "dd/MM/yy")}
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
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
