import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoami from "./tools/whoami";
import searchCompanies from "./tools/search-companies";
import listOverdueInvoices from "./tools/list-overdue-invoices";
import listPendingActivities from "./tools/list-pending-activities";

// Build the issuer from the project ref (inlined by Vite at build time so this
// stays import-safe). The fallback keeps discovery well-formed during the
// throwaway manifest-extract eval.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "lumaggs-portal-mcp",
  title: "Portal Lumaggs / Galsa",
  version: "0.1.0",
  instructions:
    "Herramientas del Portal Lumaggs/Galsa. Cada llamada actúa como el usuario autenticado y respeta sus permisos (RLS). Usa `whoami` para verificar sesión, `search_companies` para buscar empresas, `list_overdue_invoices` para cartera vencida y `list_pending_activities` para las tareas pendientes del CRM.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoami, searchCompanies, listOverdueInvoices, listPendingActivities],
});