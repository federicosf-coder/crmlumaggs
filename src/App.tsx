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
import NivelesInventario from "@/pages/inventario/NivelesInventario";
import KardexCarga from "@/pages/inventario/KardexCarga";
import Pedidos from "@/pages/inventario/Pedidos";
import MapeoProductos from "@/pages/inventario/MapeoProductos";
import MinMaxInventario from "@/pages/inventario/MinMaxInventario";
import PedidosActivos from "@/pages/inventario/PedidosActivos";
import Restricciones from "@/pages/inventario/Restricciones";
import Traspasos from "@/pages/inventario/Traspasos";
import DashboardRed from "@/pages/inventario/DashboardRed";
import GestionCostos from "@/pages/inventario/GestionCostos";

import ReporteKardex from "@/pages/inventario/ReporteKardex";
import EntregasCorporativas from "@/pages/EntregasCorporativas";
import AutorizacionPrecios from "@/pages/AutorizacionPrecios";
import GestionKardex from "@/pages/inventario/GestionKardex";
import PedidosSugeridos from "@/pages/inventario/pedidos/PedidosSugeridos";
import PedidosSubir from "@/pages/inventario/pedidos/PedidosSubir";
import PedidosRecibidos from "@/pages/inventario/pedidos/PedidosRecibidos";
import PedidosReclamos from "@/pages/inventario/pedidos/PedidosReclamos";
import SolicitudesExtraordinarias from "@/pages/inventario/pedidos/SolicitudesExtraordinarias";
import DocumentsList from "@/pages/documents/DocumentsList";
import ImportarFacturasXML from "@/pages/ImportarFacturasXML";
import VincularPedidosFacturas from "@/pages/VincularPedidosFacturas";
import DocumentForm from "@/pages/documents/DocumentForm";
import DeliverySchedule from "@/pages/documents/DeliverySchedule";
import EntregaDetalle from "@/pages/documents/EntregaDetalle";
import CrmActivitiesTasks from "@/pages/crm/CrmActivitiesTasks";
import SeguimientoLanding from "@/pages/seguimiento/SeguimientoLanding";
import SeguimientoVentas from "@/pages/seguimiento/SeguimientoVentas";
import NotFound from "@/pages/NotFound";
import Alertas from "@/pages/Alertas";

import DeliveryAddresses from "@/pages/directory/DeliveryAddresses";
import Cobranza from "@/pages/cobranza/Cobranza";
import CobranzaLanding from "@/pages/cobranza/CobranzaLanding";
import Unsubscribe from "@/pages/Unsubscribe";
import WhatsAppInbox from "@/pages/whatsapp/WhatsAppInbox";
import WhatsAppCampaigns from "@/pages/whatsapp/WhatsAppCampaigns";
import WhatsAppTemplates from "@/pages/whatsapp/WhatsAppTemplates";
import WhatsAppRules from "@/pages/whatsapp/WhatsAppRules";
import WhatsAppSettings from "@/pages/whatsapp/WhatsAppSettings";
import ReportsLanding from "@/pages/reports/ReportsLanding";
import DailyDeliveryReport from "@/pages/reports/DailyDeliveryReport";
import DailyActivityReport from "@/pages/reports/DailyActivityReport";
import DesgloseFacturasReport from "@/pages/reports/DesgloseFacturasReport";
import DeloXLEReport from "@/pages/reports/DeloXLEReport";
import Pareto8020Report from "@/pages/reports/Pareto8020Report";
import CreditoCescemexReport from "@/pages/reports/CreditoCescemexReport";
import CescemexROIReport from "@/pages/reports/CescemexROIReport";
import ReporteVentasSistema from "@/pages/rvs/ReporteVentasSistema";
import SellerPortal from "@/pages/seller/SellerPortal";
import LeadsInbox from "@/pages/leads/LeadsInbox";
import GuiasDeVenta from "@/pages/seller/GuiasDeVenta";
import TrainingPage from "@/pages/training/TrainingPage";
import AutomationsPage from "@/pages/automations/AutomationsPage";
import AutomationEditorPage from "@/pages/automations/AutomationEditorPage";
import Biblioteca from "@/pages/biblioteca/Biblioteca";
import AutomatizacionTareasLanding from "@/pages/automatizacion-tareas/AutomatizacionTareasLanding";
import CreditoList from "@/pages/credito/CreditoList";
import CreditoDetail from "@/pages/credito/CreditoDetail";
import CreditoConfiguracion from "@/pages/credito/CreditoConfiguracion";
import CreditoPortal from "@/pages/credito/CreditoPortal";
import CreditoShortRedirect from "@/pages/credito/CreditoShortRedirect";
import CreditoImprimir from "@/pages/credito/CreditoImprimir";
import CreditoDescargas from "@/pages/credito/CreditoDescargas";
import OAuthConsent from "@/pages/OAuthConsent";

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
  if (session) {
    const params = new URLSearchParams(window.location.search);
    const rawNext = params.get("next") || "/";
    const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
    return <Navigate to={next} replace />;
  }
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
            <Route path="/portal/credito/:token" element={<CreditoPortal />} />
            <Route path="/p/:code" element={<CreditoShortRedirect />} />
            <Route path="/credito/:id/imprimir/:firmaKey" element={<CreditoImprimir />} />
            <Route path="/portal/credito/:token/imprimir/:firmaKey" element={<CreditoImprimir />} />
            <Route path="/credito/descargas/:token" element={<CreditoDescargas />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />

            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
            <Route path="/admin/teams" element={<ProtectedRoute><TeamManagement /></ProtectedRoute>} />
            <Route path="/admin/permissions" element={<ProtectedRoute><PermissionsManagement /></ProtectedRoute>} />
            <Route path="/admin/catalogs" element={<ProtectedRoute><CatalogsManagement /></ProtectedRoute>} />
            <Route path="/admin/import-noloco" element={<ProtectedRoute><ImportNoloco /></ProtectedRoute>} />
            <Route path="/admin/templates" element={<ProtectedRoute><TemplatesManagement /></ProtectedRoute>} />

            <Route path="/leads" element={<ProtectedRoute><LeadsInbox /></ProtectedRoute>} />
            <Route path="/directory" element={<ProtectedRoute><Directory /></ProtectedRoute>} />
            <Route path="/directory/addresses" element={<ProtectedRoute><DeliveryAddresses /></ProtectedRoute>} />
            <Route path="/seguimiento" element={<ProtectedRoute><SeguimientoLanding /></ProtectedRoute>} />
            <Route path="/seguimiento/:brand" element={<ProtectedRoute><SeguimientoVentas /></ProtectedRoute>} />
            <Route path="/activities" element={<ProtectedRoute><CrmActivitiesTasks /></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><DocumentsList /></ProtectedRoute>} />
            <Route path="/documents/new" element={<ProtectedRoute><DocumentForm /></ProtectedRoute>} />
            <Route path="/documents/:id" element={<ProtectedRoute><DocumentForm /></ProtectedRoute>} />
            <Route path="/documents/:id/edit" element={<ProtectedRoute><DocumentForm /></ProtectedRoute>} />
            <Route path="/importar-facturas-xml" element={<ProtectedRoute><ImportarFacturasXML /></ProtectedRoute>} />
            <Route path="/vincular-pedidos-facturas" element={<ProtectedRoute><VincularPedidosFacturas /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><ProductCatalog /></ProtectedRoute>} />
            <Route path="/entregas-corporativas" element={<ProtectedRoute><EntregasCorporativas /></ProtectedRoute>} />
            <Route path="/autorizacion-precios" element={<ProtectedRoute><AutorizacionPrecios /></ProtectedRoute>} />
            <Route path="/alertas" element={<ProtectedRoute><Alertas /></ProtectedRoute>} />

            <Route path="/inventario/niveles" element={<ProtectedRoute><NivelesInventario /></ProtectedRoute>} />
            <Route path="/inventario/kardex" element={<ProtectedRoute><KardexCarga /></ProtectedRoute>} />
            <Route path="/inventario/kardex-gestion" element={<ProtectedRoute><GestionKardex /></ProtectedRoute>} />
            <Route path="/inventario/mapeo" element={<ProtectedRoute><MapeoProductos /></ProtectedRoute>} />
            <Route path="/inventario/minmax" element={<ProtectedRoute><MinMaxInventario /></ProtectedRoute>} />
            <Route path="/inventario/pedidos-activos" element={<Navigate to="/inventario/pedidos/activos" replace />} />
            <Route path="/inventario/restricciones" element={<ProtectedRoute><Restricciones /></ProtectedRoute>} />
            <Route path="/inventario/traspasos" element={<ProtectedRoute><Traspasos /></ProtectedRoute>} />
            <Route path="/inventario/dashboard" element={<ProtectedRoute><DashboardRed /></ProtectedRoute>} />
            <Route path="/inventario/costos" element={<ProtectedRoute><GestionCostos /></ProtectedRoute>} />
            
            <Route path="/inventario/reporte-kardex" element={<ProtectedRoute><ReporteKardex /></ProtectedRoute>} />
            <Route path="/inventario/pedidos" element={<ProtectedRoute><Pedidos /></ProtectedRoute>}>
              <Route index element={<PedidosSugeridos />} />
              <Route path="sugeridos" element={<PedidosSugeridos />} />
              <Route path="subir" element={<PedidosSubir />} />
              <Route path="activos" element={<PedidosActivos />} />
              <Route path="recibidos" element={<PedidosRecibidos />} />
              <Route path="reclamos" element={<PedidosReclamos />} />
              <Route path="extraordinarias" element={<SolicitudesExtraordinarias />} />
            </Route>
            <Route path="/delivery" element={<ProtectedRoute><DeliverySchedule /></ProtectedRoute>} />
            <Route path="/delivery/schedule" element={<ProtectedRoute><DeliverySchedule /></ProtectedRoute>} />
            <Route path="/delivery/entrega/:id" element={<ProtectedRoute><EntregaDetalle /></ProtectedRoute>} />
            <Route path="/cobranza" element={<ProtectedRoute><CobranzaLanding /></ProtectedRoute>} />
            <Route path="/cobranza/:brand" element={<ProtectedRoute><Cobranza /></ProtectedRoute>} />
            
            <Route path="/whatsapp" element={<ProtectedRoute><WhatsAppInbox /></ProtectedRoute>} />
            <Route path="/whatsapp/campaigns" element={<ProtectedRoute><WhatsAppCampaigns /></ProtectedRoute>} />
            <Route path="/whatsapp/templates" element={<ProtectedRoute><WhatsAppTemplates /></ProtectedRoute>} />
            <Route path="/whatsapp/rules" element={<ProtectedRoute><WhatsAppRules /></ProtectedRoute>} />
            <Route path="/whatsapp/settings" element={<ProtectedRoute><WhatsAppSettings /></ProtectedRoute>} />
            <Route path="/transfers" element={<ProtectedRoute><ModulePlaceholder title="Transferencias de Inventario" description="Gestión de transferencias entre almacenes. Próximamente en Fase 3." /></ProtectedRoute>} />
            
            <Route path="/training" element={<ProtectedRoute><TrainingPage /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><ReportsLanding /></ProtectedRoute>} />
            <Route path="/reports/daily-delivery" element={<ProtectedRoute><DailyDeliveryReport /></ProtectedRoute>} />
            <Route path="/reports/daily-activity" element={<ProtectedRoute><DailyActivityReport /></ProtectedRoute>} />
            <Route path="/reports/desglose-facturas" element={<ProtectedRoute><DesgloseFacturasReport /></ProtectedRoute>} />
            <Route path="/reports/delo-xle-15w40" element={<ProtectedRoute><DeloXLEReport /></ProtectedRoute>} />
            <Route path="/reports/pareto-8020" element={<ProtectedRoute><Pareto8020Report /></ProtectedRoute>} />
            <Route path="/reports/credito-cescemex" element={<ProtectedRoute><CreditoCescemexReport /></ProtectedRoute>} />
            <Route path="/reports/cescemex-roi" element={<ProtectedRoute><CescemexROIReport /></ProtectedRoute>} />
            <Route path="/reporte-ventas-sistema" element={<ProtectedRoute><ReporteVentasSistema /></ProtectedRoute>} />

            <Route path="/seller-portal" element={<ProtectedRoute><SellerPortal /></ProtectedRoute>} />
            <Route path="/seller-portal/guias-de-venta" element={<ProtectedRoute><GuiasDeVenta /></ProtectedRoute>} />
            <Route path="/automations" element={<ProtectedRoute><AutomationsPage /></ProtectedRoute>} />
            <Route path="/automations/new" element={<ProtectedRoute><AutomationEditorPage /></ProtectedRoute>} />
            <Route path="/automations/:id/edit" element={<ProtectedRoute><AutomationEditorPage /></ProtectedRoute>} />
            <Route path="/automatizacion-tareas" element={<ProtectedRoute><AutomatizacionTareasLanding /></ProtectedRoute>} />
            <Route path="/biblioteca" element={<ProtectedRoute><Biblioteca /></ProtectedRoute>} />
            <Route path="/credito" element={<ProtectedRoute><CreditoList /></ProtectedRoute>} />
            <Route path="/credito/configuracion" element={<ProtectedRoute><CreditoConfiguracion /></ProtectedRoute>} />
            <Route path="/credito/:id" element={<ProtectedRoute><CreditoDetail /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
