import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { HelpCircle } from "lucide-react";
import { FILTER_FIELDS_BY_ENTITY, type EntityType } from "./types";

const FIELD_DESCRIPTIONS: Record<string, string> = {
  // deal
  pipeline_type: "Tipo de pipeline (primera_compra o recompra).",
  stage_id: "Identificador de la etapa actual del negocio.",
  tipo_negocio: "Categoría del negocio (ej. nuevo, recompra).",
  facturado_unidades: "Unidades ya facturadas en el negocio.",
  pedido_unidades: "Unidades pedidas pero no facturadas.",
  cotizado_unidades: "Unidades cotizadas al cliente.",
  mes_negocio: "Mes asignado al negocio (YYYY-MM).",
  value: "Valor monetario total del negocio.",
  probability: "Probabilidad de cierre (0-100).",
  close_date: "Fecha estimada de cierre.",
  proxima_fecha_seguimiento: "Próxima fecha de seguimiento programada.",
  // company
  estatus_recompra_chevron: "Estatus de la recompra de Chevron.",
  estatus_recompra_phillips66: "Estatus de la recompra de Phillips 66.",
  estatus_cliente_id: "Estatus comercial del cliente.",
  proxima_recompra_chevron: "Fecha de próxima recompra Chevron.",
  proxima_recompra_phillips66: "Fecha de próxima recompra Phillips 66.",
  fecha_ultima_compra_chevron: "Fecha de la última compra Chevron.",
  fecha_ultima_compra_phillips66: "Fecha de la última compra Phillips 66.",
  // document
  tipo_documento: "Tipo de documento (cotización, pedido, factura).",
  estatus_factura: "Estatus actual de la factura.",
  total: "Importe total del documento.",
  saldo_pendiente_cobranza: "Saldo pendiente de cobro.",
  fecha_vencimiento: "Fecha de vencimiento del documento.",
  fecha_documento: "Fecha de emisión del documento.",
  // contact
  no_contactar: "Marca si el contacto solicitó no ser contactado.",
  // task
  due_date: "Fecha límite de la tarea.",
};

const DATE_FIELDS_EXTRA: Record<EntityType, { value: string; label: string }[]> = {
  deal: [
    { value: "close_date", label: "Fecha de cierre" },
    { value: "proxima_fecha_seguimiento", label: "Próximo seguimiento" },
  ],
  company: [
    { value: "proxima_recompra_chevron", label: "Próxima recompra Chevron" },
    { value: "proxima_recompra_phillips66", label: "Próxima recompra Phillips 66" },
    { value: "fecha_ultima_compra_chevron", label: "Última compra Chevron" },
    { value: "fecha_ultima_compra_phillips66", label: "Última compra Phillips 66" },
  ],
  document: [
    { value: "fecha_vencimiento", label: "Fecha de vencimiento" },
    { value: "fecha_documento", label: "Fecha del documento" },
  ],
  contact: [],
  task: [{ value: "due_date", label: "Fecha límite" }],
};

export function AvailableFieldsDialog({ entityType }: { entityType: EntityType }) {
  const [open, setOpen] = useState(false);
  const base = FILTER_FIELDS_BY_ENTITY[entityType] || [];
  const dates = DATE_FIELDS_EXTRA[entityType] || [];
  const seen = new Set(base.map((f) => f.value));
  const all = [
    ...base.map((f) => ({ value: f.value, label: f.label })),
    ...dates.filter((d) => !seen.has(d.value)),
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs">
          <HelpCircle className="h-3.5 w-3.5 mr-1" />
          Ver campos disponibles
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Campos disponibles</DialogTitle>
        </DialogHeader>
        {all.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay campos disponibles para esta entidad.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/3">Nombre</TableHead>
                <TableHead>Descripción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {all.map((f) => (
                <TableRow key={f.value}>
                  <TableCell>
                    <div className="font-medium">{f.label}</div>
                    <code className="text-xs text-muted-foreground">{f.value}</code>
                  </TableCell>
                  <TableCell className="text-sm">
                    {FIELD_DESCRIPTIONS[f.value] || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}