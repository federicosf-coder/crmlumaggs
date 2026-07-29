## Objetivo

Endpoint público (`POST`) que reciba formularios de landings/sitios web (y después Facebook Lead Ads), registre el prospecto en el CRM reutilizando `companies`/`contacts`/`crm_tasks`, y lo muestre en una bandeja común con semáforo de SLA y alertas por WhatsApp.

## Decisiones ya tomadas

- Los leads llegan **sin asignar** a una bandeja común que cualquier vendedor puede tomar.
- Se crea empresa **solo si el formulario trae el dato**; si no, el contacto queda sin empresa.
- Notificación externa: **WhatsApp** (además de los indicadores en el CRM).
- Seguridad: **API key por sitio**, revocable.

## Modelo de datos (mínimo, sin duplicar entidades)

Se reutiliza todo lo existente. Se agregan solo dos tablas de infraestructura que hoy no existen:

1. `lead_sources` — un registro por landing/sitio/campaña: nombre, dominio permitido, `api_key_hash`, plaza por defecto, marca por defecto, teléfono WhatsApp de aviso, activo.
2. `leads` — la bandeja de entrada: payload crudo (`jsonb`), campos normalizados (nombre, teléfono, email, empresa, mensaje, interés), `utm_source/medium/campaign/content/term`, `source_id`, `contact_id`, `company_id`, `crm_task_id`, `estatus` (`nuevo`, `pendiente_atencion`, `alerta`, `frio`, `recuperacion`, `atendido`, `descartado`), `responsable_id` (nulo hasta que alguien lo tome), `primer_contacto_at`, `ip`, `user_agent`.

Por qué `leads` y no `crm_items`: `crm_items` no se usa en ninguna pantalla y no tiene campos de origen/SLA; `crm_tasks.user_id` es obligatorio, así que un lead sin dueño no puede vivir ahí. `leads` es solo la bandeja de entrada — al tomarlo se materializa el contacto/empresa/tarea reales.

También se agrega `origen_lead` (texto) a `contacts` para conservar la fuente a nivel contacto (hoy `origen_contacto` solo existe en `companies`).

## Endpoint público

`POST /functions/v1/lead-intake` (sin JWT, CORS abierto)

- Autenticación: header `X-Api-Key` validado contra `lead_sources` (hash). Sin key válida → 401.
- Validación con Zod: nombre obligatorio, y al menos email o teléfono. Límites de longitud en todos los campos.
- Anti-spam: campo honeypot (`_hp`), rate limit por API key + IP, deduplicación por email/teléfono en las últimas 24 h (si ya existe un lead abierto, se anexa el nuevo mensaje en vez de duplicar).
- Normalización de teléfono a formato E.164 MX.
- Enlazado inteligente: si el email/teléfono ya corresponde a un contacto existente, se vincula a ese contacto y a su empresa en lugar de crear duplicados.
- Creación de empresa solo si viene el nombre (usando la plaza por defecto de la fuente, ya que `companies.plaza_id` es obligatorio).
- Respuesta `200 { ok: true, lead_id }`, o error con detalle de validación.

Se aceptará también el formato de Facebook Lead Ads (verificación `GET hub.challenge` + payload de `leadgen`) en el mismo endpoint, mapeando los campos del formulario.

## SLA, estados y alertas

Un job programado (cada 5 min) recorre los leads sin `primer_contacto_at`:

| Tiempo sin atención | Estado |
|---|---|
| > 15 min | Pendiente de atención |
| > 1 h | Alerta (se dispara WhatsApp) |
| > 24 h | Lead frío |
| > 72 h | Pasa a la sección de recuperación |

Además al ingresar el lead se envía WhatsApp inmediato al número configurado en la fuente (usando la infraestructura de WhatsApp ya existente).

## Interfaz en el CRM

Nueva pantalla **Bandeja de Leads** (`/leads`), en la navegación con badge de conteo de leads sin atender:

- Tarjetas KPI: Nuevos, Pendientes, En alerta, Fríos, En recuperación.
- Tabla con estilo de Tabla Refinada: semáforo de tiempo transcurrido, origen/campaña, datos de contacto, mensaje.
- Acciones por fila: **Tomar lead** (se asigna al usuario, se crea la tarea de seguimiento en Tareas y Actividades y se marca primer contacto), **WhatsApp**, **Correo**, **Ver perfil**, **Descartar** con motivo.
- Pestañas: Bandeja / Recuperación / Atendidos.
- Pantalla de administración de fuentes: alta de sitio, generación y revocación de API key (se muestra una sola vez), copia del snippet de integración listo para pegar en la landing.

## Recomendaciones adicionales de alerta

- Aviso al equipo si un lead lleva más de 3 días en "tomado" sin actividad registrada.
- Resumen diario por correo con leads no atendidos y tasa de respuesta por vendedor.
- Indicador de tiempo promedio de primera respuesta por fuente, para saber qué landing rinde mejor.

## Prueba

Al terminar se envían leads de prueba al endpoint (uno completo con empresa y UTMs, uno mínimo solo con teléfono, y uno inválido para ver el rechazo) y se muestra el resultado en la bandeja para revisarlos juntos.

## Detalles técnicos

- Edge function `lead-intake` con `verify_jwt = false`, cliente service-role, CORS comodín; la API key se guarda hasheada (SHA-256) y se compara en el servidor.
- Job de SLA vía `pg_cron` invocando una función de base de datos `recompute_lead_sla()` que actualiza estados y encola los avisos.
- RLS: `leads` visible para usuarios autenticados según el módulo de acceso; `lead_sources` solo admin; ambas con GRANT a `service_role` para la edge function.
