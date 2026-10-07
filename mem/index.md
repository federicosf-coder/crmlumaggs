# Project Memory

## Core
- UI/UX and language localization strictly in Spanish (ES).
- Email confirmation disabled for registration; accounts auto-confirm and login.
- Manage two entities: Lumaggs (Chevron) and Galsa (Phillips 66).
- Main navigation: Directorio, CRM, Productos, Documentos, Tareas y Actividades.
- Costos/márgenes visibles por rol vía `role_costos_visibility` + hook `useCanViewCostos()` (admin siempre true). See mem://auth/costos-visibility.
- Default visual style for ALL dialogs/modals/forms = "Estilo Modal Refinado" (gradient header violet-50→blue-50, uppercase tracking-wide section labels, font-light body, fixed muted footer). See mem://style/refined-modal.
- Default visual style for ALL data lists/tables = "Estilo Tabla Refinada" (gradient violet/blue header, uppercase tracked column labels, vertical dividers, zebra rows, hover blue-50/40). See mem://style/refined-table.

## Memories
- [Estilo Modal Refinado](mem://style/refined-modal) — Default dialog/modal/form visual system: header, footer, typography, colors, indicators
- [Estilo Tabla Refinada](mem://style/refined-table) — Default list/table visual system applied via shared Table primitive
- [Business Domain](mem://project/business-domain) — Core commercial entities (Lumaggs/Galsa) and modular system scope
- [Architecture](mem://project/architecture) — Junction tables, SearchableSelect, PDF rules, sequence sync
- [Permissions System](mem://auth/permissions-system) — Role-based access levels (todos/equipo/propio/ninguno) per module
- [Permiso Ver Costos](mem://auth/costos-visibility) — role_costos_visibility + useCanViewCostos; pendiente RVS y KardexCarga
- [User Management](mem://auth/user-management) — Registration requirements, auto role assignment, team membership
- [Color Palette](mem://style/color-palette) — Brand colors for Lumaggs and Galsa (PDF headers and UI)
- [Dashboard Navigation](mem://style/dashboard-navigation) — Navigation order and removal of legacy views
- [Product Catalog](mem://features/product-catalog) — Lubricant attributes, Admin cost restrictions, responsive pricing
- [Documents Module](mem://features/documents-module) — Kanban flow, auto-completion, rules for Quotations, Orders, Invoices
- [Directory CRM Structure](mem://features/directory-crm-structure) — Client relations, multi-address support, pricing lists
- [CRM Functionality](mem://features/crm-functionality) — Brand-specific pipelines, value metrics, unified activities
- [Catalogs Management](mem://features/catalogs-management) — Dynamic product filtering by brand and logistics catalogs
- [Tasks Activities](mem://features/tasks-activities-module) — Calendar/List views, shared visibility (Owner/Collaborator)
- [Company Classification](mem://features/company-classification) — Detailed classification fields (Industries, potential, risks)
- [Orders Management](mem://features/orders-management) — Delivery workflows, routing drag-and-drop, evidence tracking
- [Email Infrastructure](mem://project/email-infrastructure) — Supabase Edge Function process-email-queue configuration
- [Conversión de prospectos](mem://features/lead-conversion) — Cliente convertido vs previo, canal, atribución conservadora
- [CRM Recompra Pipeline](mem://features/crm-recompra-pipeline) — 7 etapas fijas, 1 negocio/mes/empresa, cron mensual, contadores auto, bloques horizontales
- [Buzón de reclamos](mem://features/reclamos-email) — reclamos@correo.lumaggs.com.mx vía Resend a Chevron, registro en inv_reclamo_seguimiento
