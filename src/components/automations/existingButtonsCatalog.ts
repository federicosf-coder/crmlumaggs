export type ExistingButton = {
  id: string;
  name: string;
  description: string;
  location: string;
  path: string;
};

export const EXISTING_BUTTONS: ExistingButton[] = [
  {
    id: "cobranza.enviar_confirmacion_pago",
    name: "Enviar confirmación de pago",
    description: "Envía al cliente la confirmación del pago aplicado.",
    location: "Cobranza › Detalle de pago",
    path: "/cobranza",
  },
  {
    id: "cobranza.registrar_pago",
    name: "Registrar pago",
    description: "Abre el formulario para registrar un nuevo pago.",
    location: "Cobranza",
    path: "/cobranza",
  },
  {
    id: "cobranza.aplicar_pago",
    name: "Aplicar pago",
    description: "Aplica un pago a una o varias facturas.",
    location: "Cobranza › Detalle de pago",
    path: "/cobranza",
  },
  {
    id: "cobranza.relacion.send_whatsapp",
    name: "WhatsApp desde relación cobranza",
    description: "Envía un WhatsApp al cliente desde la fila de la relación de cobranza (lista de facturas).",
    location: "Cobranza › Relación de facturas › Acciones de fila",
    path: "/cobranza",
  },
  {
    id: "cobranza.relacion.send_email",
    name: "Correo desde relación cobranza",
    description: "Envía un correo al cliente desde la fila de la relación de cobranza (lista de facturas).",
    location: "Cobranza › Relación de facturas › Acciones de fila",
    path: "/cobranza",
  },
  {
    id: "documents.generate_pdf",
    name: "Generar PDF",
    description: "Genera el PDF del documento (cotización, pedido, factura).",
    location: "Documentos › Detalle del documento",
    path: "/documents",
  },
  {
    id: "documents.send_email",
    name: "Enviar por correo",
    description: "Envía el documento por correo electrónico al cliente.",
    location: "Documentos › Detalle del documento",
    path: "/documents",
  },
  {
    id: "documents.send_whatsapp",
    name: "Enviar por WhatsApp",
    description: "Envía el documento por WhatsApp al contacto.",
    location: "Documentos › Detalle del documento",
    path: "/documents",
  },
  {
    id: "documents.enviar_acuse",
    name: "Enviar Acuse",
    description: "Envía el acuse del documento al cliente.",
    location: "Documentos › Detalle del documento",
    path: "/documents",
  },
  {
    id: "crm.create_deal",
    name: "Crear negocio",
    description: "Crea un nuevo negocio en el pipeline de CRM.",
    location: "CRM › Pipeline",
    path: "/crm",
  },
  {
    id: "crm.log_activity",
    name: "Registrar actividad",
    description: "Registra una actividad (llamada, visita, correo) sobre el negocio.",
    location: "CRM › Detalle del negocio",
    path: "/crm",
  },
  {
    id: "crm.create_task",
    name: "Crear tarea",
    description: "Crea una tarea de seguimiento.",
    location: "CRM › Tareas y Actividades",
    path: "/activities",
  },
  {
    id: "crm.close_deal",
    name: "Cerrar negocio",
    description: "Cierra el negocio como ganado o perdido.",
    location: "CRM › Detalle del negocio",
    path: "/crm",
  },
  {
    id: "directory.create_company",
    name: "Crear empresa",
    description: "Registra una nueva empresa en el directorio.",
    location: "Directorio",
    path: "/directory",
  },
  {
    id: "directory.create_contact",
    name: "Crear contacto",
    description: "Registra un nuevo contacto.",
    location: "Directorio › Empresa",
    path: "/directory",
  },
  {
    id: "whatsapp.send_message",
    name: "Enviar WhatsApp",
    description: "Envía un mensaje de WhatsApp manual al contacto.",
    location: "WhatsApp › Inbox",
    path: "/whatsapp",
  },
];