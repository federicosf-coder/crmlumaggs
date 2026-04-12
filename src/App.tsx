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
import ModulePlaceholder from "@/pages/ModulePlaceholder";
import Directory from "@/pages/Directory";
import ProductCatalog from "@/pages/inventory/ProductCatalog";
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

            <Route path="/directory" element={<ProtectedRoute><Directory /></ProtectedRoute>} />
            <Route path="/crm/chevron" element={<ProtectedRoute><ModulePlaceholder title="CRM — Chevron" description="Pipeline de ventas, oportunidades y gestión de clientes para lubricantes Chevron. Próximamente en Fase 2." /></ProtectedRoute>} />
            <Route path="/crm/phillips66" element={<ProtectedRoute><ModulePlaceholder title="CRM — Phillips 66" description="Pipeline de ventas, oportunidades y gestión de clientes para lubricantes Phillips 66. Próximamente en Fase 2." /></ProtectedRoute>} />
            <Route path="/quotes" element={<ProtectedRoute><ModulePlaceholder title="Cotizaciones" description="Crear y gestionar cotizaciones para lubricantes Chevron y Phillips 66. Próximamente en Fase 2." /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><ProductCatalog /></ProtectedRoute>} />
            <Route path="/delivery" element={<ProtectedRoute><ModulePlaceholder title="Entregas" description="Seguimiento y gestión de entregas de productos. Próximamente en Fase 4." /></ProtectedRoute>} />
            <Route path="/transfers" element={<ProtectedRoute><ModulePlaceholder title="Transferencias de Inventario" description="Gestión de transferencias entre almacenes. Próximamente en Fase 3." /></ProtectedRoute>} />
            <Route path="/invoicing" element={<ProtectedRoute><ModulePlaceholder title="Facturación" description="Facturación, generación de facturas y seguimiento de pagos." /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute><ModulePlaceholder title="Consulta de Productos" description="Buscar y explorar el catálogo de lubricantes Chevron y Phillips 66." /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><ModulePlaceholder title="Proyectos y Tareas" description="Gestión de proyectos y seguimiento de tareas para tu equipo." /></ProtectedRoute>} />
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
