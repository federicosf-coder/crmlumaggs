import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, ShoppingCart, FileText, Package, Truck,
  GraduationCap, ArrowLeftRight, FolderKanban, Search, UserCircle,
  Receipt, BarChart3, Droplets, LogOut, Settings, BookOpen, Shield, Database, MapPin, Wallet,
  MessageCircle, Megaphone, FileBadge, Bot, FileStack, Inbox,
  Briefcase, Zap, FolderOpen, TrendingUp,
  FileCheck, Boxes, ChevronDown, Link2,
  Sliders, ClipboardList, ShieldAlert, Network, DollarSign, TableProperties,
  Workflow,
  CalendarCheck, BadgeDollarSign,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { usePendingLeadsCount } from "@/hooks/useLeads";
import { useHuerfanosCount } from "@/hooks/useMapeoProductos";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type AppRole = "admin" | "manager" | "sales" | "delivery" | "warehouse" | "customer_service" | "accounting";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  roles: AppRole[] | "all";
  group?: "whatsapp";
}

const mainItems: NavItem[] = [
  { title: "Inicio", url: "/", icon: LayoutDashboard, roles: "all" },
  { title: "Portal del Vendedor", url: "/seller-portal", icon: Briefcase, roles: ["admin", "manager", "sales"] },
  { title: "Bandeja de Prospectos", url: "/leads", icon: Inbox, roles: ["admin", "manager", "sales", "customer_service"] },
  { title: "Directorio", url: "/directory", icon: BookOpen, roles: "all" },
  { title: "Seguimiento a Ventas", url: "/seguimiento", icon: TrendingUp, roles: ["admin", "manager", "sales", "customer_service"] },
  { title: "Cobranza", url: "/cobranza", icon: Wallet, roles: ["admin", "manager", "accounting"] },
  { title: "Tareas y Actividades", url: "/activities", icon: FolderKanban, roles: "all" },
  { title: "Biblioteca", url: "/biblioteca", icon: FolderOpen, roles: "all" },
  { title: "Solicitudes de Crédito", url: "/credito", icon: FileCheck, roles: ["admin", "manager", "sales", "customer_service", "accounting"] },
  { title: "Catálogo de Productos", url: "/inventory", icon: Package, roles: ["admin", "manager", "warehouse", "delivery"] },
  { title: "Entregas", url: "/delivery", icon: Truck, roles: ["admin", "manager", "delivery"] },
  { title: "Entregas Corporativas", url: "/entregas-corporativas", icon: CalendarCheck, roles: ["admin", "manager", "warehouse", "sales"] },
  { title: "Transferencias", url: "/transfers", icon: ArrowLeftRight, roles: ["admin", "manager", "warehouse"] },
  { title: "Capacitación", url: "/training", icon: GraduationCap, roles: "all" },
  { title: "Reportes", url: "/reports", icon: BarChart3, roles: ["admin", "manager", "accounting"] },
  { title: "Automatizaciones", url: "/automations", icon: Zap, roles: ["admin", "manager"] },
  { title: "Automatización de Tareas", url: "/automatizacion-tareas", icon: Workflow, roles: "all" },
];

const adminItems: NavItem[] = [
  { title: "Gestión de Usuarios", url: "/admin/users", icon: Users, roles: ["admin"] },
  { title: "Permisos", url: "/admin/permissions", icon: Shield, roles: ["admin"] },
  { title: "Equipos", url: "/admin/teams", icon: Settings, roles: ["admin", "manager"] },
  { title: "Catálogos", url: "/admin/catalogs", icon: Database, roles: ["admin", "manager"] },
  { title: "Plantillas", url: "/admin/templates", icon: FileStack, roles: ["admin", "manager", "sales"] },
];

const whatsappItems: NavItem[] = [
  { title: "Conversaciones", url: "/whatsapp", icon: MessageCircle, roles: "all", group: "whatsapp" },
  { title: "Campañas", url: "/whatsapp/campaigns", icon: Megaphone, roles: ["admin", "manager"], group: "whatsapp" },
  { title: "Plantillas", url: "/whatsapp/templates", icon: FileBadge, roles: ["admin", "manager"], group: "whatsapp" },
  { title: "Bot", url: "/whatsapp/rules", icon: Bot, roles: ["admin", "manager"], group: "whatsapp" },
  { title: "Configuración", url: "/whatsapp/settings", icon: Settings, roles: ["admin", "manager"], group: "whatsapp" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile, roles, signOut, hasAnyRole, hasRole } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadWhatsApp, setUnreadWhatsApp] = useState(0);
  const whatsappAccess = useModuleAccess("whatsapp");
  const inventarioAccess = useModuleAccess("inventario");
  const [inventarioOpen, setInventarioOpen] = useState(location.pathname.startsWith("/inventario"));
  const [documentosOpen, setDocumentosOpen] = useState(
    location.pathname.startsWith("/documents") || location.pathname.startsWith("/autorizacion-precios")
  );
  const { data: huerfanosCount = 0 } = useHuerfanosCount();
  const { data: leadsPendientes = 0 } = usePendingLeadsCount();

  useEffect(() => {
    if (!hasRole("admin")) return;
    let cancelled = false;
    const load = async () => {
      const { count } = await (supabase as any)
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("approval_status", "pendiente");
      if (!cancelled) setPendingCount(count || 0);
    };
    load();
    const channel = supabase
      .channel(`profiles-pending-count-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [hasRole]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await (supabase as any)
        .from("whatsapp_conversations")
        .select("unread_count")
        .gt("unread_count", 0);
      const total = (data ?? []).reduce((sum: number, row: any) => sum + (row.unread_count || 0), 0);
      if (!cancelled) setUnreadWhatsApp(total);
    };
    load();
    const channel = supabase
      .channel(`wa-unread-sidebar-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations" }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const canAccess = (item: NavItem) => {
    if (item.roles === "all") return true;
    if (roles.length === 0) return true;
    return hasAnyRole(item.roles);
  };

  const visibleMain = mainItems.filter(canAccess);
  const visibleAdmin = adminItems.filter(canAccess);
  const visibleWhatsApp = whatsappItems.filter(canAccess).filter(() => whatsappAccess.canView);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-sidebar-primary flex items-center justify-center shrink-0">
            <Droplets className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-sm text-sidebar-foreground">LubriManager</span>
              <span className="text-[10px] text-sidebar-foreground/60">Plataforma de Distribución</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Módulos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMain.slice(0, 5).map((item) => {
                const showBadge = item.url === "/whatsapp" && unreadWhatsApp > 0;
                const showLeadsBadge = item.url === "/leads" && leadsPendientes > 0;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end={item.url === "/"} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span className="flex-1">{item.title}</span>}
                        {showBadge && (
                          <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-[10px]">
                            {unreadWhatsApp}
                          </Badge>
                        )}
                        {showLeadsBadge && (
                          <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-[10px]">
                            {leadsPendientes}
                          </Badge>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {hasAnyRole(["admin", "manager", "sales", "customer_service", "accounting"]) && (
                <Collapsible open={documentosOpen} onOpenChange={setDocumentosOpen}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="hover:bg-sidebar-accent/50">
                        <FileText className="mr-2 h-4 w-4" />
                        {!collapsed && <span className="flex-1 text-left">Documentos</span>}
                        {!collapsed && <ChevronDown className={`h-4 w-4 transition-transform ${documentosOpen ? "rotate-180" : ""}`} />}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                  </SidebarMenuItem>
                  <CollapsibleContent>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/documents" className="pl-8 hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <FileText className="mr-2 h-4 w-4" />
                          {!collapsed && <span>Todos los Documentos</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/autorizacion-precios" className="pl-8 hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <BadgeDollarSign className="mr-2 h-4 w-4" />
                          {!collapsed && <span>Autorización de Precios</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {visibleMain.slice(5).map((item) => {
                const showBadge = item.url === "/whatsapp" && unreadWhatsApp > 0;
                const showLeadsBadge = item.url === "/leads" && leadsPendientes > 0;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end={item.url === "/"} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span className="flex-1">{item.title}</span>}
                        {showBadge && (
                          <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-[10px]">
                            {unreadWhatsApp}
                          </Badge>
                        )}
                        {showLeadsBadge && (
                          <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-[10px]">
                            {leadsPendientes}
                          </Badge>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {inventarioAccess.canView && (
          <SidebarGroup>
            <SidebarGroupLabel>Inventario</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <Collapsible open={inventarioOpen} onOpenChange={setInventarioOpen}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="hover:bg-sidebar-accent/50">
                        <Boxes className="mr-2 h-4 w-4" />
                        {!collapsed && <span className="flex-1 text-left">Inventario</span>}
                        {!collapsed && <ChevronDown className={`h-4 w-4 transition-transform ${inventarioOpen ? "rotate-180" : ""}`} />}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                  </SidebarMenuItem>
                  <CollapsibleContent>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/inventario/niveles" className="pl-8 hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <BarChart3 className="mr-2 h-4 w-4" />
                          {!collapsed && <span>Niveles de Inventario</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/inventario/kardex-gestion" className="pl-8 hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <FileStack className="mr-2 h-4 w-4" />
                          {!collapsed && <span>Gestión de Kárdex</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/inventario/restricciones" className="pl-8 hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <ShieldAlert className="mr-2 h-4 w-4" />
                          {!collapsed && <span>Restricciones</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/inventario/traspasos" className="pl-8 hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <ArrowLeftRight className="mr-2 h-4 w-4" />
                          {!collapsed && <span>Traspasos</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/inventario/dashboard" className="pl-8 hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <Network className="mr-2 h-4 w-4" />
                          {!collapsed && <span>Dashboard Red</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/inventario/costos" className="pl-8 hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <DollarSign className="mr-2 h-4 w-4" />
                          {!collapsed && <span>Costos y Precios</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/inventario/pedidos" className="pl-8 hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          {!collapsed && <span>Pedidos</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {visibleAdmin.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administración</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleAdmin.map((item) => {
                  const showBadge = item.url === "/admin/users" && pendingCount > 0;
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <item.icon className="mr-2 h-4 w-4" />
                          {!collapsed && <span className="flex-1">{item.title}</span>}
                          {showBadge && (
                            <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-[10px]">
                              {pendingCount}
                            </Badge>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleWhatsApp.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
              WhatsApp
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleWhatsApp.map((item) => {
                  const showBadge = item.url === "/whatsapp" && unreadWhatsApp > 0;
                const showLeadsBadge = item.url === "/leads" && leadsPendientes > 0;
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} end={item.url === "/whatsapp"} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <item.icon className="mr-2 h-4 w-4" />
                          {!collapsed && <span className="flex-1">{item.title}</span>}
                          {showBadge && (
                            <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-[10px]">
                              {unreadWhatsApp}
                            </Badge>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <Separator className="mb-3 bg-sidebar-border" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/profile" className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                <UserCircle className="mr-2 h-4 w-4" />
                {!collapsed && <span className="truncate">{profile?.full_name || "Perfil"}</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50" onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" />
                {!collapsed && <span>Cerrar Sesión</span>}
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
