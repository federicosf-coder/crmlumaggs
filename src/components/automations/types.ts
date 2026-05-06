export type EntityType = "deal" | "company" | "document" | "contact" | "task";

export type AutomationDraft = {
  name: string;
  description: string;
  is_active: boolean;
  entity_type: EntityType;
  trigger_type: string;
  trigger_config: Record<string, any>;
  conditions: ConditionGroup;
};

export type Condition = {
  field: string;
  operator: string;
  value: any;
};

export type ConditionGroup = {
  logic: "AND" | "OR";
  items: Condition[];
};

export type ActionDraft = {
  action_type: string;
  action_config: Record<string, any>;
};

export const ENTITY_OPTIONS: { value: EntityType; label: string }[] = [
  { value: "deal", label: "Negocio" },
  { value: "company", label: "Empresa" },
  { value: "document", label: "Documento" },
  { value: "contact", label: "Contacto" },
  { value: "task", label: "Tarea" },
];

export const DATE_FIELDS_BY_ENTITY: Record<EntityType, { value: string; label: string }[]> = {
  deal: [
    { value: "close_date", label: "Fecha de cierre" },
    { value: "proxima_fecha_seguimiento", label: "Próximo seguimiento" },
    { value: "mes_negocio", label: "Mes del negocio" },
  ],
  company: [
    { value: "proxima_recompra_chevron", label: "Próxima recompra Chevron" },
    { value: "proxima_recompra_phillips66", label: "Próxima recompra Phillips66" },
    { value: "fecha_ultima_compra_chevron", label: "Última compra Chevron" },
    { value: "fecha_ultima_compra_phillips66", label: "Última compra Phillips66" },
  ],
  document: [
    { value: "fecha_vencimiento", label: "Fecha de vencimiento" },
    { value: "fecha_documento", label: "Fecha del documento" },
  ],
  contact: [],
  task: [{ value: "due_date", label: "Fecha límite" }],
};

export const FILTER_FIELDS_BY_ENTITY: Record<
  EntityType,
  { value: string; label: string; type: "text" | "number" | "boolean" }[]
> = {
  deal: [
    { value: "pipeline_type", label: "Pipeline (tipo)", type: "text" },
    { value: "stage_id", label: "Etapa", type: "text" },
    { value: "tipo_negocio", label: "Tipo de negocio", type: "text" },
    { value: "facturado_unidades", label: "Unidades facturadas", type: "number" },
    { value: "pedido_unidades", label: "Unidades pedidas", type: "number" },
    { value: "cotizado_unidades", label: "Unidades cotizadas", type: "number" },
    { value: "mes_negocio", label: "Mes del negocio", type: "text" },
    { value: "value", label: "Valor", type: "number" },
    { value: "probability", label: "Probabilidad", type: "number" },
  ],
  company: [
    { value: "estatus_recompra_chevron", label: "Estatus recompra Chevron", type: "text" },
    { value: "estatus_recompra_phillips66", label: "Estatus recompra Phillips66", type: "text" },
    { value: "estatus_cliente_id", label: "Estatus cliente", type: "text" },
  ],
  document: [
    { value: "tipo_documento", label: "Tipo documento", type: "text" },
    { value: "estatus_factura", label: "Estatus factura", type: "text" },
    { value: "total", label: "Total", type: "number" },
    { value: "saldo_pendiente_cobranza", label: "Saldo pendiente", type: "number" },
  ],
  contact: [{ value: "no_contactar", label: "No contactar", type: "boolean" }],
  task: [],
};

export const OPERATORS_BY_TYPE: Record<string, { value: string; label: string; noValue?: boolean }[]> = {
  text: [
    { value: "eq", label: "es igual a" },
    { value: "neq", label: "no es igual a" },
    { value: "contains", label: "contiene" },
    { value: "is_empty", label: "está vacío", noValue: true },
    { value: "is_not_empty", label: "no está vacío", noValue: true },
    { value: "in", label: "está en lista" },
  ],
  number: [
    { value: "eq", label: "es igual a" },
    { value: "gt", label: "mayor que" },
    { value: "lt", label: "menor que" },
    { value: "gte", label: "mayor o igual" },
    { value: "lte", label: "menor o igual" },
    { value: "is_empty", label: "está vacío", noValue: true },
  ],
  boolean: [
    { value: "is_true", label: "es verdadero", noValue: true },
    { value: "is_false", label: "es falso", noValue: true },
  ],
};

export const TRIGGER_GROUPS: {
  label: string;
  triggers: { value: string; label: string; description?: string }[];
}[] = [
  {
    label: "Interacción del usuario",
    triggers: [
      { value: "existing_button_click", label: "Clic en botón existente" },
      { value: "button_click", label: "Clic en botón personalizado" },
      { value: "on_save", label: "Al guardar registro" },
      { value: "on_create", label: "Al crear registro" },
      { value: "on_field_change", label: "Al cambiar un campo" },
      { value: "on_stage_change", label: "Al cambiar etapa del negocio" },
      { value: "on_status_change", label: "Al cambiar estatus" },
    ],
  },
  {
    label: "Basado en tiempo",
    triggers: [
      { value: "date_reached", label: "Llega una fecha del registro" },
      { value: "days_before_date", label: "X días antes de una fecha" },
      { value: "days_after_date", label: "X días después de una fecha" },
      { value: "deal_stalled", label: "Negocio sin movimiento" },
      { value: "month_start", label: "Primer día del mes" },
      { value: "month_end", label: "Último día del mes" },
      { value: "month_day", label: "Día específico del mes" },
      { value: "daily_at_time", label: "Todos los días a una hora" },
    ],
  },
  {
    label: "Basado en datos",
    triggers: [{ value: "field_value_reaches", label: "Cuando un campo numérico alcanza valor" }],
  },
];

export const ACTION_GROUPS: {
  label: string;
  actions: { value: string; label: string }[];
}[] = [
  {
    label: "Comunicación",
    actions: [
      { value: "send_email", label: "Enviar correo" },
      { value: "send_whatsapp", label: "Enviar WhatsApp" },
      { value: "send_notification", label: "Enviar notificación interna" },
    ],
  },
  {
    label: "CRM",
    actions: [
      { value: "create_task", label: "Crear tarea" },
      { value: "update_deal_stage", label: "Cambiar etapa del negocio" },
      { value: "close_deal", label: "Cerrar negocio" },
      { value: "create_recompra_deal", label: "Crear negocio de recompra" },
      { value: "create_activity_log", label: "Registrar actividad" },
      { value: "assign_owner", label: "Asignar responsable" },
    ],
  },
  {
    label: "Datos",
    actions: [
      { value: "update_deal_field", label: "Actualizar campo del negocio" },
      { value: "update_company_field", label: "Actualizar campo de empresa" },
    ],
  },
];

export function actionLabel(type: string): string {
  for (const g of ACTION_GROUPS) {
    const a = g.actions.find((x) => x.value === type);
    if (a) return a.label;
  }
  return type;
}

export function triggerLabel(type: string): string {
  for (const g of TRIGGER_GROUPS) {
    const t = g.triggers.find((x) => x.value === type);
    if (t) return t.label;
  }
  return type;
}