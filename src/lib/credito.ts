export const CREDITO_TIPO_LABEL: Record<string, string> = {
  cescemex: "Cescemex",
  directo: "Crédito Directo",
};

export const CREDITO_TIPO_OPTIONS = [
  { value: "cescemex", label: "Cescemex" },
  { value: "directo", label: "Crédito Directo" },
];

export const CREDITO_ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador",
  portal_enviado: "Portal Enviado",
  llenando_formulario: "Llenando Formulario",
  en_revision_cs: "En Revisión CS",
  en_credito_cobranza: "En Crédito y Cobranza",
  revision_lista_69: "Revisión Lista 69",
  en_cescemex: "En Cescemex",
  en_direccion: "En Dirección",
  en_juridico: "En Jurídico",
  contrato_enviado: "Contrato Enviado",
  contrato_firmado: "Contrato Firmado",
  activo: "Activo",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
};

export const CREDITO_ESTADO_OPTIONS = Object.entries(CREDITO_ESTADO_LABEL).map(
  ([value, label]) => ({ value, label }),
);

export const CREDITO_ESTADO_COLOR: Record<string, string> = {
  borrador: "bg-slate-50 text-slate-700 border-slate-200",
  portal_enviado: "bg-blue-50 text-blue-700 border-blue-200",
  llenando_formulario: "bg-sky-50 text-sky-700 border-sky-200",
  en_revision_cs: "bg-indigo-50 text-indigo-700 border-indigo-200",
  en_credito_cobranza: "bg-violet-50 text-violet-700 border-violet-200",
  revision_lista_69: "bg-amber-50 text-amber-700 border-amber-200",
  en_cescemex: "bg-teal-50 text-teal-700 border-teal-200",
  en_direccion: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  en_juridico: "bg-purple-50 text-purple-700 border-purple-200",
  contrato_enviado: "bg-cyan-50 text-cyan-700 border-cyan-200",
  contrato_firmado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  activo: "bg-green-50 text-green-700 border-green-200",
  rechazado: "bg-red-50 text-red-700 border-red-200",
  cancelado: "bg-zinc-100 text-zinc-700 border-zinc-200",
};

export const CREDITO_FIRMAS = [
  { key: "solicitud",        label: "Solicitud de crédito",  fechaCol: "firma_solicitud_fecha",        nombreCol: "firma_solicitud_nombre",        personaMoralOnly: false },
  { key: "buro",             label: "Autorización Buró",     fechaCol: "firma_buro_fecha",             nombreCol: "firma_buro_nombre",             personaMoralOnly: false },
  { key: "confidencialidad", label: "Confidencialidad",      fechaCol: "firma_confidencialidad_fecha", nombreCol: "firma_confidencialidad_nombre", personaMoralOnly: false },
  { key: "subsistencia",     label: "Subsistencia de poderes", fechaCol: "firma_subsistencia_fecha",   nombreCol: "firma_subsistencia_nombre",     personaMoralOnly: true },
  { key: "lfpiorpi",         label: "LFPIORPI",              fechaCol: "firma_lfpiorpi_fecha",         nombreCol: "firma_lfpiorpi_nombre",         personaMoralOnly: false },
] as const;

export const CREDITO_TIPO_PERSONA_OPTIONS = [
  { value: "moral",  label: "Persona Moral" },
  { value: "fisica", label: "Persona Física" },
];

export const CREDITO_TIPO_PERSONA_LABEL: Record<string, string> = {
  moral: "Persona Moral",
  fisica: "Persona Física",
};
