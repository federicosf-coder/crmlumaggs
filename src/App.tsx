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
import ModulePlaceholder from "@/pages/ModulePlaceholder";
import Directory from "@/pages/Directory";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  if (!session) return <Navigate to="/auth" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
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

            <Route path="/directory" element={<ProtectedRoute><Directory /></ProtectedRoute>} />
            <Route path="/crm/chevron" element={<ProtectedRoute><ModulePlaceholder title="CRM — Chevron" description="Sales pipeline, deals, and customer management for Chevron lubricants. Coming in Phase 2." /></ProtectedRoute>} />
            <Route path="/crm/phillips66" element={<ProtectedRoute><ModulePlaceholder title="CRM — Phillips 66" description="Sales pipeline, deals, and customer management for Phillips 66 lubricants. Coming in Phase 2." /></ProtectedRoute>} />
            <Route path="/quotes" element={<ProtectedRoute><ModulePlaceholder title="Quotes" description="Create and manage quotes for Chevron & Phillips 66 lubricants. Coming in Phase 2." /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><ModulePlaceholder title="Inventory" description="Product catalog, stock levels, and warehouse management. Coming in Phase 3." /></ProtectedRoute>} />
            <Route path="/delivery" element={<ProtectedRoute><ModulePlaceholder title="Delivery" description="Track and manage product deliveries. Coming in Phase 4." /></ProtectedRoute>} />
            <Route path="/transfers" element={<ProtectedRoute><ModulePlaceholder title="Inventory Transfers" description="Manage transfers between warehouses. Coming in Phase 3." /></ProtectedRoute>} />
            <Route path="/invoicing" element={<ProtectedRoute><ModulePlaceholder title="Invoicing" description="Billing, invoice generation, and payment tracking." /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute><ModulePlaceholder title="Product Inquiry" description="Search and browse the Chevron & Phillips 66 lubricant catalog." /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><ModulePlaceholder title="Projects & Tasks" description="Project management and task tracking for your team." /></ProtectedRoute>} />
            <Route path="/training" element={<ProtectedRoute><ModulePlaceholder title="Training" description="Training materials and courses for your team." /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><ModulePlaceholder title="Reports" description="Analytics, reporting, and business intelligence." /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
