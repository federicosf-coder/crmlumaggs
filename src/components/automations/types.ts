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
    { value: "estatus_cotizacion", label: "Estatus cotización", type: "text" },
    { value: "estatus_pedido", label: "Estatus pedido", type: "text" },
    { value: "estatus_entrega_corporativa", label: "Estatus entrega corporativa", type: "text" },
    { value: "total", label: "Total", type: "number" },
    { value: "saldo_pendiente_cobranza", label: "Saldo pendiente", type: "number" },
  ],
  contact: [{ value: "no_contactar", label: "No contactar", type: "boolean" }],
  task: [],
};

export type FieldDef = { value: string; label: string; type: "text" | "number" | "boolean" };
export type FieldGroup = { label: string; fields: FieldDef[] };

// Comprehensive grouped fields available across all entities for conditions.
// Field values are prefixed with the source entity (e.g. "document.total").
// Plain values without a prefix are kept for backward-compatibility with
// previously saved automations.
export const GROUPED_FILTER_FIELDS: FieldGroup[] = [
  {
    label: "Documento",
    fields: [
      { value: "document.company_id", label: "Cliente (empresa)", type: "text" },
      { value: "document.contact_id", label: "Contacto", type: "text" },
      { value: "document.tipo_documento", label: "Tipo de documento", type: "text" },
      { value: "document.estatus_factura", label: "Estatus factura", type: "text" },
      { value: "document.estatus_cotizacion", label: "Estatus cotización", type: "text" },
      { value: "document.estatus_pedido", label: "Estatus pedido", type: "text" },
      { value: "document.estatus_entrega_corporativa", label: "Estatus entrega corporativa", type: "text" },
      { value: "document.follow_up_status", label: "Estatus seguimiento cotización", type: "text" },
      { value: "document.empresa_vendedora", label: "Empresa vendedora", type: "text" },
      { value: "document.numero_cotizacion", label: "Número de cotización", type: "text" },
      { value: "document.numero_pedido", label: "Número de pedido", type: "text" },
      { value: "document.numero_factura", label: "Número de factura", type: "text" },
      { value: "document.numero_oc_cliente", label: "Número OC cliente", type: "text" },
      { value: "document.fecha_documento", label: "Fecha del documento", type: "text" },
      { value: "document.fecha_vencimiento", label: "Fecha de vencimiento", type: "text" },
      { value: "document.fecha_entrega_programada", label: "Fecha entrega programada", type: "text" },
      { value: "document.fecha_oc_cliente", label: "Fecha OC cliente", type: "text" },
      { value: "document.subtotal", label: "Subtotal", type: "number" },
      { value: "document.iva_importe", label: "IVA importe", type: "number" },
      { value: "document.iva_porcentaje", label: "IVA porcentaje", type: "number" },
      { value: "document.total", label: "Total", type: "number" },
      { value: "document.saldo_pendiente_cobranza", label: "Saldo pendiente cobranza", type: "number" },
      { value: "document.unidades_equivalentes_total", label: "Unidades equivalentes", type: "number" },
      { value: "document.forma_pago", label: "Forma de pago", type: "text" },
      { value: "document.metodo_pago", label: "Método de pago", type: "text" },
      { value: "document.tipo_pago", label: "Tipo de pago", type: "text" },
      { value: "document.uso_cfdi", label: "Uso CFDI", type: "text" },
      { value: "document.notas", label: "Notas", type: "text" },
      { value: "document.is_active", label: "Activo", type: "boolean" },
      { value: "document.created_at", label: "Fecha de creación", type: "text" },
      { value: "document.updated_at", label: "Última actualización", type: "text" },
      { value: "document.ejecutivo_venta_id", label: "Ejecutivo de venta", type: "text" },
      { value: "document.plaza_id", label: "Plaza", type: "text" },
      { value: "document.direccion_envio_nombre", label: "Dirección de envío (nombre)", type: "text" },
    ],
  },
  {
    label: "Productos del documento",
    fields: [
      { value: "document_product.cantidad", label: "Cantidad", type: "number" },
      { value: "document_product.precio_unitario", label: "Precio unitario", type: "number" },
      { value: "document_product.descuento_porcentaje", label: "Descuento %", type: "number" },
      { value: "document_product.subtotal", label: "Subtotal partida", type: "number" },
      { value: "document_product.unidades_equivalentes", label: "Unidades equivalentes", type: "number" },
      { value: "document_product.producto_id", label: "Producto", type: "text" },
    ],
  },
  {
    label: "Pagos / Cobranza",
    fields: [
      { value: "payment.estado_pago", label: "Estado del pago", type: "text" },
      { value: "payment.estatus_pago", label: "Estatus del pago", type: "text" },
      { value: "payment.tipo_pago", label: "Tipo de pago", type: "text" },
      { value: "payment.banco", label: "Banco", type: "text" },
      { value: "payment.referencia_pago", label: "Referencia", type: "text" },
      { value: "payment.moneda", label: "Moneda", type: "text" },
      { value: "payment.monto_total", label: "Monto total", type: "number" },
      { value: "payment.monto_aplicado", label: "Monto aplicado", type: "number" },
      { value: "payment.monto_disponible", label: "Monto disponible", type: "number" },
      { value: "payment.fecha_pago", label: "Fecha de pago", type: "text" },
      { value: "payment.observaciones", label: "Observaciones", type: "text" },
      { value: "payment_application.estatus_aplicacion", label: "Estatus aplicación", type: "text" },
      { value: "payment_application.monto_aplicado", label: "Monto aplicado a documento", type: "number" },
      { value: "payment_application.fecha_aplicacion", label: "Fecha de aplicación", type: "text" },
      { value: "payment_application.tipo_documento", label: "Tipo doc. cobranza", type: "text" },
    ],
  },
  {
    label: "Tareas",
    fields: [
      { value: "task.title", label: "Título", type: "text" },
      { value: "task.description", label: "Descripción", type: "text" },
      { value: "task.priority", label: "Prioridad", type: "text" },
      { value: "task.completed", label: "Completada", type: "boolean" },
      { value: "task.completed_at", label: "Fecha de completado", type: "text" },
      { value: "task.due_date", label: "Fecha límite", type: "text" },
      { value: "task.programable_entrega", label: "Programable entrega", type: "boolean" },
      { value: "task.whatsapp_status", label: "Estatus WhatsApp", type: "text" },
      { value: "task.created_at", label: "Fecha de creación", type: "text" },
      { value: "task.updated_at", label: "Última actualización", type: "text" },
      { value: "task.user_id", label: "Asignado a", type: "text" },
    ],
  },
  {
    label: "Actividades CRM",
    fields: [
      { value: "activity.type", label: "Tipo", type: "text" },
      { value: "activity.channel", label: "Canal", type: "text" },
      { value: "activity.title", label: "Título", type: "text" },
      { value: "activity.description", label: "Descripción", type: "text" },
      { value: "activity.activity_date", label: "Fecha de la actividad", type: "text" },
      { value: "activity.message_type", label: "Tipo de mensaje", type: "text" },
      { value: "activity.created_at", label: "Fecha de creación", type: "text" },
    ],
  },
  {
    label: "Negocios CRM",
    fields: [
      { value: "deal.title", label: "Título", type: "text" },
      { value: "deal.pipeline_type", label: "Tipo de pipeline", type: "text" },
      { value: "deal.pipeline_id", label: "Pipeline", type: "text" },
      { value: "deal.stage_id", label: "Etapa", type: "text" },
      { value: "deal.tipo_negocio", label: "Tipo de negocio", type: "text" },
      { value: "deal.value", label: "Valor", type: "number" },
      { value: "deal.probability", label: "Probabilidad", type: "number" },
      { value: "deal.cotizado_unidades", label: "Unidades cotizadas", type: "number" },
      { value: "deal.pedido_unidades", label: "Unidades pedidas", type: "number" },
      { value: "deal.facturado_unidades", label: "Unidades facturadas", type: "number" },
      { value: "deal.potencial_unidades", label: "Unidades potencial", type: "number" },
      { value: "deal.volumen_mensual_estimado", label: "Volumen mensual estimado", type: "number" },
      { value: "deal.mes_negocio", label: "Mes del negocio", type: "text" },
      { value: "deal.close_date", label: "Fecha de cierre", type: "text" },
      { value: "deal.proxima_fecha_seguimiento", label: "Próximo seguimiento", type: "text" },
      { value: "deal.convertido_a_cliente", label: "Convertido a cliente", type: "boolean" },
      { value: "deal.fecha_conversion", label: "Fecha de conversión", type: "text" },
      { value: "deal.owner_id", label: "Responsable", type: "text" },
      { value: "deal.plaza_id", label: "Plaza", type: "text" },
      { value: "deal.motivo_perdida_id", label: "Motivo de pérdida", type: "text" },
      { value: "deal.origen_prospecto_id", label: "Origen prospecto", type: "text" },
      { value: "deal.notes", label: "Notas", type: "text" },
      { value: "deal.created_at", label: "Fecha de creación", type: "text" },
      { value: "deal.updated_at", label: "Última actualización", type: "text" },
    ],
  },
  {
    label: "Empresas / Clientes",
    fields: [
      { value: "company.name", label: "Nombre", type: "text" },
      { value: "company.razon_social", label: "Razón social", type: "text" },
      { value: "company.id_contpaq", label: "ID Contpaq", type: "text" },
      { value: "company.email", label: "Email", type: "text" },
      { value: "company.phone", label: "Teléfono", type: "text" },
      { value: "company.website", label: "Sitio web", type: "text" },
      { value: "company.industry", label: "Industria", type: "text" },
      { value: "company.industrias", label: "Industrias", type: "text" },
      { value: "company.address", label: "Dirección", type: "text" },
      { value: "company.city", label: "Ciudad", type: "text" },
      { value: "company.state", label: "Estado", type: "text" },
      { value: "company.zip_code", label: "Código postal", type: "text" },
      { value: "company.plaza_id", label: "Plaza", type: "text" },
      { value: "company.equipo", label: "Equipo", type: "text" },
      { value: "company.tipo_cliente_id", label: "Tipo de cliente", type: "text" },
      { value: "company.tipo_cliente_comercial", label: "Tipo cliente comercial", type: "text" },
      { value: "company.estatus_cliente_id", label: "Estatus cliente", type: "text" },
      { value: "company.prioridad_cliente_id", label: "Prioridad cliente", type: "text" },
      { value: "company.segmento_id", label: "Segmento", type: "text" },
      { value: "company.lista_precios", label: "Lista de precios", type: "text" },
      { value: "company.forma_pago", label: "Forma de pago", type: "text" },
      { value: "company.metodo_pago", label: "Método de pago", type: "text" },
      { value: "company.tipo_pago", label: "Tipo de pago", type: "text" },
      { value: "company.uso_cfdi", label: "Uso CFDI", type: "text" },
      { value: "company.potencial_cliente", label: "Potencial cliente", type: "text" },
      { value: "company.potencial_unidades", label: "Potencial unidades", type: "text" },
      { value: "company.volumen_mensual_estimado", label: "Volumen mensual estimado", type: "number" },
      { value: "company.barrera_entrada", label: "Barrera de entrada", type: "text" },
      { value: "company.riesgo_cambio_marca", label: "Riesgo cambio de marca", type: "text" },
      { value: "company.rol_lubricante", label: "Rol del lubricante", type: "text" },
      { value: "company.tipo_destino_lubricante", label: "Tipo destino lubricante", type: "text" },
      { value: "company.evaluacion_lubricante", label: "Evaluación lubricante", type: "text" },
      { value: "company.tomador_decision", label: "Tomador de decisión", type: "text" },
      { value: "company.origen_contacto", label: "Origen contacto", type: "text" },
      { value: "company.customer_score", label: "Customer score", type: "number" },
      { value: "company.ticket_promedio", label: "Ticket promedio", type: "number" },
      { value: "company.ticket_promedio_chevron", label: "Ticket promedio Chevron", type: "number" },
      { value: "company.ticket_promedio_phillips66", label: "Ticket promedio Phillips66", type: "number" },
      { value: "company.frecuencia_compra_dias", label: "Frecuencia de compra (días)", type: "number" },
      { value: "company.frecuencia_compra_chevron_dias", label: "Frecuencia compra Chevron (días)", type: "number" },
      { value: "company.frecuencia_compra_phillips66_dias", label: "Frecuencia compra Phillips66 (días)", type: "number" },
      { value: "company.total_facturas_chevron", label: "Total facturas Chevron", type: "number" },
      { value: "company.total_facturas_phillips66", label: "Total facturas Phillips66", type: "number" },
      { value: "company.fecha_ultima_compra", label: "Última compra", type: "text" },
      { value: "company.fecha_ultima_compra_chevron", label: "Última compra Chevron", type: "text" },
      { value: "company.fecha_ultima_compra_phillips66", label: "Última compra Phillips66", type: "text" },
      { value: "company.proxima_recompra_chevron", label: "Próxima recompra Chevron", type: "text" },
      { value: "company.proxima_recompra_phillips66", label: "Próxima recompra Phillips66", type: "text" },
      { value: "company.estatus_recompra_chevron", label: "Estatus recompra Chevron", type: "text" },
      { value: "company.estatus_recompra_phillips66", label: "Estatus recompra Phillips66", type: "text" },
      { value: "company.fecha_conversion_cliente", label: "Fecha conversión cliente", type: "text" },
      { value: "company.notes", label: "Notas", type: "text" },
      { value: "company.is_active", label: "Activa", type: "boolean" },
      { value: "company.created_at", label: "Fecha de creación", type: "text" },
    ],
  },
  {
    label: "Contactos",
    fields: [
      { value: "contact.first_name", label: "Nombre", type: "text" },
      { value: "contact.last_name", label: "Apellido", type: "text" },
      { value: "contact.email", label: "Email", type: "text" },
      { value: "contact.email2", label: "Email secundario", type: "text" },
      { value: "contact.mobile", label: "Celular", type: "text" },
      { value: "contact.job_title", label: "Puesto", type: "text" },
      { value: "contact.department", label: "Departamento", type: "text" },
      { value: "contact.influencia_id", label: "Influencia", type: "text" },
      { value: "contact.no_contactar", label: "No contactar", type: "boolean" },
      { value: "contact.comm_email", label: "Comunica por email", type: "boolean" },
      { value: "contact.comm_email2", label: "Comunica por email 2", type: "boolean" },
      { value: "contact.comm_tel", label: "Comunica por teléfono", type: "boolean" },
      { value: "contact.comm_tel_emp", label: "Comunica por tel. empresa", type: "boolean" },
      { value: "contact.comm_cel", label: "Comunica por celular", type: "boolean" },
      { value: "contact.comm_whatsapp", label: "Comunica por WhatsApp", type: "boolean" },
      { value: "contact.is_active", label: "Activo", type: "boolean" },
      { value: "contact.created_at", label: "Fecha de creación", type: "text" },
    ],
  },
  {
    label: "Direcciones",
    fields: [
      { value: "address.nombre", label: "Nombre dirección", type: "text" },
      { value: "address.tipo", label: "Tipo", type: "text" },
      { value: "address.tipos", label: "Tipos", type: "text" },
      { value: "address.calle", label: "Calle", type: "text" },
      { value: "address.ciudad", label: "Ciudad", type: "text" },
      { value: "address.estado", label: "Estado", type: "text" },
      { value: "address.pais", label: "País", type: "text" },
      { value: "address.codigo_postal", label: "Código postal", type: "text" },
      { value: "address.referencia", label: "Referencia", type: "text" },
      { value: "address.direccion_completa", label: "Dirección completa", type: "text" },
      { value: "address.is_active", label: "Activa", type: "boolean" },
    ],
  },
  {
    label: "Usuarios",
    fields: [
      { value: "user.full_name", label: "Nombre completo", type: "text" },
      { value: "user.email", label: "Email", type: "text" },
      { value: "user.phone", label: "Teléfono", type: "text" },
      { value: "user.plaza_id", label: "Plaza", type: "text" },
      { value: "user.approval_status", label: "Estatus de aprobación", type: "text" },
      { value: "user.is_active", label: "Activo", type: "boolean" },
    ],
  },
  {
    label: "Catálogo de productos",
    fields: [
      { value: "product.codigo", label: "Código", type: "text" },
      { value: "product.nombre_producto", label: "Nombre", type: "text" },
      { value: "product.descripcion", label: "Descripción", type: "text" },
      { value: "product.marca_id", label: "Marca", type: "text" },
      { value: "product.linea_id", label: "Línea", type: "text" },
      { value: "product.categoria_id", label: "Categoría", type: "text" },
      { value: "product.aplicacion_id", label: "Aplicación", type: "text" },
      { value: "product.uso_id", label: "Uso", type: "text" },
      { value: "product.viscosidad_id", label: "Viscosidad", type: "text" },
      { value: "product.formula_id", label: "Fórmula", type: "text" },
      { value: "product.presentacion_id", label: "Presentación", type: "text" },
      { value: "product.costo_actual", label: "Costo actual", type: "number" },
      { value: "product.precio_base_uf1", label: "Precio base UF1", type: "number" },
      { value: "product.precio_uf2", label: "Precio UF2", type: "number" },
      { value: "product.precio_uf3", label: "Precio UF3", type: "number" },
      { value: "product.precio_uf4", label: "Precio UF4", type: "number" },
      { value: "product.precio_r1", label: "Precio R1", type: "number" },
      { value: "product.precio_r2", label: "Precio R2", type: "number" },
      { value: "product.precio_r3", label: "Precio R3", type: "number" },
      { value: "product.precio_r4", label: "Precio R4", type: "number" },
      { value: "product.precio_lista_galper", label: "Precio lista Galper", type: "number" },
      { value: "product.is_active", label: "Activo", type: "boolean" },
    ],
  },
];

export function findGroupedField(value: string): FieldDef | undefined {
  for (const g of GROUPED_FILTER_FIELDS) {
    const f = g.fields.find((x) => x.value === value);
    if (f) return f;
  }
  // backward compat: match unprefixed legacy values by suffix
  for (const g of GROUPED_FILTER_FIELDS) {
    const f = g.fields.find((x) => x.value.split(".")[1] === value);
    if (f) return f;
  }
  return undefined;
}

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
      { value: "on_status_change", label: "Al cambiar estatus de documento o tarea" },
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