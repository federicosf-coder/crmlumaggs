import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { HelpCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
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
  estatus_cotizacion: "Estatus actual de la cotización.",
  estatus_pedido: "Estatus actual del pedido.",
  estatus_entrega_corporativa: "Estatus actual de la entrega corporativa.",
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
  seguimiento_venta: [
    { value: "proxima_fecha_seguimiento", label: "Próximo seguimiento" },
    { value: "fecha_ultimo_contacto", label: "Último contacto" },
    { value: "fecha_perdida", label: "Fecha de pérdida" },
  ],
  payment: [{ value: "fecha_pago", label: "Fecha de pago" }],
  credit_request: [
    { value: "fecha_solicitud", label: "Fecha de solicitud" },
    { value: "fecha_resolucion", label: "Fecha de resolución" },
  ],
  entrega: [
    { value: "fecha_entrega_programada", label: "Fecha entrega programada" },
    { value: "fecha_entrega_real", label: "Fecha entrega real" },
  ],
};

export function getAvailableFields(entityType: EntityType) {
  const base = FILTER_FIELDS_BY_ENTITY[entityType] || [];
  const dates = DATE_FIELDS_EXTRA[entityType] || [];
  const seen = new Set(base.map((f) => f.value));
  return [
    ...base.map((f) => ({ value: f.value, label: f.label })),
    ...dates.filter((d) => !seen.has(d.value)),
  ];
}

export function getFieldDescription(field: string) {
  return FIELD_DESCRIPTIONS[field] || "—";
}

export const FIELD_OPTIONS: Record<string, { value: string; label: string }[]> = {
  pipeline_type: [
    { value: "primera_compra", label: "Primera compra" },
    { value: "recompra", label: "Recompra" },
  ],
  tipo_negocio: [
    { value: "prospecto", label: "Prospecto" },
    { value: "expansion", label: "Expansión" },
    { value: "recompra", label: "Recompra" },
    { value: "otro", label: "Otro" },
  ],
  estatus_recompra_chevron: [
    { value: "al_dia", label: "Al día" },
    { value: "proximo", label: "Próximo" },
    { value: "vencido", label: "Vencido" },
    { value: "en_riesgo", label: "En riesgo" },
    { value: "dormido", label: "Dormido" },
    { value: "sin_historial", label: "Sin historial" },
  ],
  estatus_recompra_phillips66: [
    { value: "al_dia", label: "Al día" },
    { value: "proximo", label: "Próximo" },
    { value: "vencido", label: "Vencido" },
    { value: "en_riesgo", label: "En riesgo" },
    { value: "dormido", label: "Dormido" },
    { value: "sin_historial", label: "Sin historial" },
  ],
  tipo_documento: [
    { value: "cotizacion", label: "Cotización" },
    { value: "pedido", label: "Pedido" },
    { value: "factura", label: "Factura" },
    { value: "entrega_corporativa", label: "Entrega corporativa" },
  ],
  estatus_factura: [
    { value: "pendiente", label: "Pendiente" },
    { value: "pagada", label: "Pagada" },
    { value: "vencida", label: "Vencida" },
    { value: "cancelada", label: "Cancelada" },
    { value: "vigente", label: "Vigente" },
  ],
  estatus_cotizacion: [
    { value: "borrador", label: "Borrador" },
    { value: "enviada", label: "Enviada" },
    { value: "aceptada", label: "Aceptada" },
    { value: "rechazada", label: "Rechazada" },
    { value: "vencida", label: "Vencida" },
    { value: "impresa", label: "Impresa" },
  ],
  estatus_pedido: [
    { value: "confirmado_cliente", label: "Confirmado cliente" },
    { value: "espera_autorizacion_precio", label: "Espera autorización precio" },
    { value: "precio_autorizado", label: "Precio autorizado" },
    { value: "validado_contabilidad", label: "Validado contabilidad" },
    { value: "programado_entrega", label: "Programado entrega" },
    { value: "entregado", label: "Entregado" },
    { value: "cancelado", label: "Cancelado" },
  ],
  estatus_entrega_corporativa: [
    { value: "solicitada", label: "Solicitada" },
    { value: "programada", label: "Programada" },
    { value: "entregada", label: "Entregada" },
    { value: "acuse_enviado", label: "Acuse enviado" },
  ],
  estatus_pago: [
    { value: "recibido", label: "Recibido" },
    { value: "enviado_validar", label: "Enviado a validar" },
    { value: "validado", label: "Validado" },
    { value: "aplicado", label: "Aplicado" },
  ],
  estatus_tarea: [
    { value: "pendiente", label: "Pendiente" },
    { value: "completada", label: "Completada" },
  ],
  no_contactar: [
    { value: "true", label: "Sí" },
    { value: "false", label: "No" },
  ],
};

export function getFieldOptions(field?: string) {
  if (!field) return null;
  return FIELD_OPTIONS[field] || null;
}

export function AvailableFieldsDialog({ entityType }: { entityType: EntityType }) {
  const [open, setOpen] = useState(false);
  const all = [...getAvailableFields(entityType)].sort((a, b) =>
    a.label.localeCompare(b.label, "es", { sensitivity: "base" }),
  );

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

export function FieldPickerDialog({
  entityType, value, onChange, label = "Campo",
}: {
  entityType: EntityType;
  value: string | undefined;
  onChange: (v: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const all = [...getAvailableFields(entityType)].sort((a, b) =>
    a.label.localeCompare(b.label, "es", { sensitivity: "base" }),
  );
  const selected = all.find((f) => f.value === value);
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <div className="flex-1 text-sm border rounded-md px-3 py-2 bg-background">
          {selected ? (
            <span>
              <span className="font-medium">{selected.label}</span>{" "}
              <code className="text-xs text-muted-foreground">{selected.value}</code>
            </span>
          ) : (
            <span className="text-muted-foreground">Sin seleccionar</span>
          )}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              {selected ? "Cambiar" : "Seleccionar"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Selecciona un campo</DialogTitle>
            </DialogHeader>
            {all.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay campos disponibles para esta entidad.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">Nombre</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {all.map((f) => (
                    <TableRow key={f.value} className={value === f.value ? "bg-primary/5" : ""}>
                      <TableCell>
                        <div className="font-medium">{f.label}</div>
                        <code className="text-xs text-muted-foreground">{f.value}</code>
                      </TableCell>
                      <TableCell className="text-sm">{FIELD_DESCRIPTIONS[f.value] || "—"}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="sm"
                          variant={value === f.value ? "default" : "outline"}
                          onClick={() => {
                            onChange(f.value);
                            setOpen(false);
                          }}
                        >
                          {value === f.value ? "Elegido" : "Elegir"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}