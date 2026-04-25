import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import Index from "@/pages/Index";
import Profile from "@/pages/Profile";
import UserManagement from "@/pages/admin/UserManagement";
import TeamManagement from "@/pages/admin/TeamManagement";
import PermissionsManagement from "@/pages/admin/PermissionsManagement";
import CatalogsManagement from "@/pages/admin/CatalogsManagement";
import ImportNoloco from "@/pages/admin/ImportNoloco";
import TemplatesManagement from "@/pages/admin/TemplatesManagement";
import ModulePlaceholder from "@/pages/ModulePlaceholder";
import Directory from "@/pages/Directory";
import ProductCatalog from "@/pages/inventory/ProductCatalog";
import DocumentsList from "@/pages/documents/DocumentsList";
import DocumentForm from "@/pages/documents/DocumentForm";
import DeliverySchedule from "@/pages/documents/DeliverySchedule";
import EntregaDetalle from "@/pages/documents/EntregaDetalle";
import CrmLanding from "@/pages/crm/CrmLanding";
import CrmPipeline from "@/pages/crm/CrmPipeline";
import CrmActivitiesTasks from "@/pages/crm/CrmActivitiesTasks";
import CrmRepurchase from "@/pages/crm/CrmRepurchase";
import CrmByCompany from "@/pages/crm/CrmByCompany";
import NotFound from "@/pages/NotFound";
import DeliveryAddresses from "@/pages/directory/DeliveryAddresses";
import Cobranza from "@/pages/cobranza/Cobranza";
import Unsubscribe from "@/pages/Unsubscribe";
import WhatsAppInbox from "@/pages/whatsapp/WhatsAppInbox";
import WhatsAppCampaigns from "@/pages/whatsapp/WhatsAppCampaigns";
import WhatsAppTemplates from "@/pages/whatsapp/WhatsAppTemplates";
import WhatsAppRules from "@/pages/whatsapp/WhatsAppRules";
import WhatsAppSettings from "@/pages/whatsapp/WhatsAppSettings";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, profile, signOut } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando...</div>;
  if (!session) return <Navigate to="/auth" replace />;
  if (profile && profile.approval_status !== "aprobado") {
    signOut();
    return <Navigate to="/auth" replace />;
  }
  return <AppLayout>{children}</AppLayout>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando...</div>;
  if (session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />

            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
            <Route path="/admin/teams" element={<ProtectedRoute><TeamManagement /></ProtectedRoute>} />
            <Route path="/admin/permissions" element={<ProtectedRoute><PermissionsManagement /></ProtectedRoute>} />
            <Route path="/admin/catalogs" element={<ProtectedRoute><CatalogsManagement /></ProtectedRoute>} />
            <Route path="/admin/import-noloco" element={<ProtectedRoute><ImportNoloco /></ProtectedRoute>} />
            <Route path="/admin/templates" element={<ProtectedRoute><TemplatesManagement /></ProtectedRoute>} />

            <Route path="/directory" element={<ProtectedRoute><Directory /></ProtectedRoute>} />
            <Route path="/directory/addresses" element={<ProtectedRoute><DeliveryAddresses /></ProtectedRoute>} />
            <Route path="/crm" element={<ProtectedRoute><CrmLanding /></ProtectedRoute>} />
            <Route path="/crm/empresas" element={<ProtectedRoute><CrmByCompany /></ProtectedRoute>} />
            <Route path="/crm/:brand/pipeline" element={<ProtectedRoute><CrmPipeline /></ProtectedRoute>} />
            <Route path="/crm/recompra" element={<ProtectedRoute><CrmRepurchase /></ProtectedRoute>} />
            <Route path="/activities" element={<ProtectedRoute><CrmActivitiesTasks /></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><DocumentsList /></ProtectedRoute>} />
            <Route path="/documents/new" element={<ProtectedRoute><DocumentForm /></ProtectedRoute>} />
            <Route path="/documents/:id" element={<ProtectedRoute><DocumentForm /></ProtectedRoute>} />
            <Route path="/documents/:id/edit" element={<ProtectedRoute><DocumentForm /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><ProductCatalog /></ProtectedRoute>} />
            <Route path="/delivery" element={<ProtectedRoute><DeliverySchedule /></ProtectedRoute>} />
            <Route path="/delivery/schedule" element={<ProtectedRoute><DeliverySchedule /></ProtectedRoute>} />
            <Route path="/delivery/entrega/:id" element={<ProtectedRoute><EntregaDetalle /></ProtectedRoute>} />
            <Route path="/cobranza" element={<ProtectedRoute><Cobranza /></ProtectedRoute>} />
            <Route path="/whatsapp" element={<ProtectedRoute><WhatsAppInbox /></ProtectedRoute>} />
            <Route path="/whatsapp/campaigns" element={<ProtectedRoute><WhatsAppCampaigns /></ProtectedRoute>} />
            <Route path="/whatsapp/templates" element={<ProtectedRoute><WhatsAppTemplates /></ProtectedRoute>} />
            <Route path="/whatsapp/rules" element={<ProtectedRoute><WhatsAppRules /></ProtectedRoute>} />
            <Route path="/whatsapp/settings" element={<ProtectedRoute><WhatsAppSettings /></ProtectedRoute>} />
            <Route path="/transfers" element={<ProtectedRoute><ModulePlaceholder title="Transferencias de Inventario" description="Gestión de transferencias entre almacenes. Próximamente en Fase 3." /></ProtectedRoute>} />
            
            <Route path="/training" element={<ProtectedRoute><ModulePlaceholder title="Capacitación" description="Materiales de capacitación y cursos para tu equipo." /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><ModulePlaceholder title="Reportes" description="Análisis, reportes e inteligencia de negocio." /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
