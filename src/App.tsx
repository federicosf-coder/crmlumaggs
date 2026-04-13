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
import ModulePlaceholder from "@/pages/ModulePlaceholder";
import Activities from "@/pages/Activities";
import Tasks from "@/pages/Tasks";
import Directory from "@/pages/Directory";
import ProductCatalog from "@/pages/inventory/ProductCatalog";
import DocumentsList from "@/pages/documents/DocumentsList";
import DocumentForm from "@/pages/documents/DocumentForm";
import CrmLanding from "@/pages/crm/CrmLanding";
import CrmPipeline from "@/pages/crm/CrmPipeline";
import CrmActivities from "@/pages/crm/CrmActivities";
import CrmTasks from "@/pages/crm/CrmTasks";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando...</div>;
  if (!session) return <Navigate to="/auth" replace />;
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

            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
            <Route path="/admin/teams" element={<ProtectedRoute><TeamManagement /></ProtectedRoute>} />
            <Route path="/admin/permissions" element={<ProtectedRoute><PermissionsManagement /></ProtectedRoute>} />
            <Route path="/admin/catalogs" element={<ProtectedRoute><CatalogsManagement /></ProtectedRoute>} />

            <Route path="/directory" element={<ProtectedRoute><Directory /></ProtectedRoute>} />
            <Route path="/crm" element={<ProtectedRoute><CrmLanding /></ProtectedRoute>} />
            <Route path="/crm/:brand/pipeline" element={<ProtectedRoute><CrmPipeline /></ProtectedRoute>} />
            <Route path="/crm/:brand/activities" element={<ProtectedRoute><CrmActivities /></ProtectedRoute>} />
            <Route path="/crm/:brand/tasks" element={<ProtectedRoute><CrmTasks /></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><DocumentsList /></ProtectedRoute>} />
            <Route path="/documents/new" element={<ProtectedRoute><DocumentForm /></ProtectedRoute>} />
            <Route path="/documents/:id/edit" element={<ProtectedRoute><DocumentForm /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><ProductCatalog /></ProtectedRoute>} />
            <Route path="/delivery" element={<ProtectedRoute><ModulePlaceholder title="Entregas" description="Seguimiento y gestión de entregas de productos. Próximamente en Fase 4." /></ProtectedRoute>} />
            <Route path="/activities" element={<ProtectedRoute><Activities /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
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
